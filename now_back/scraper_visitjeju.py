"""
scraper_visitjeju.py — 비짓제주(api.visitjeju.net) 콘텐츠 수집.
대상: contentscd c2(쇼핑), c5(축제/행사) — 제주 지역 '쇼핑'/'행사' 서브탭용.

API 실측 확인 사항(2026-07-21, Playwright로 실제 브라우저 네트워크 요청을 관찰해서 발견 — 전부 비공식 내부 API라
apiKey 불필요, 대신 visitjeju.net 아무 페이지나 한 번 GET하면 서버가 익명 세션 쿠키(iceJWT)를 내려주고
그 쿠키로 아래 API들이 전부 정상 응답함, 로그인 불필요. 언제든 스펙이 바뀔 수 있음):

- 목록/검색: GET https://api.visitjeju.net/api/contents/list
  ?_siteId=jejuavj&locale=&device=pc&contentscd=&pageSize=&page=
  쇼핑(c2)은 이걸로 페이지네이션 전체 수집. sbst 필드에 이미 풍부한 전체 설명이 들어있음
  (구 vsjApi/contents/searchList보다 훨씬 나음 — 그건 짧은 introduction만 줬음).
  축제/행사(c5)는 추가로 &festivalcontents=y&state=&year=&month= 를 붙이면 서버가 진짜로
  '진행중(ing)' 상태 필터링을 해줌 — 처음엔 "기간 필드가 없어 진행중 필터링 불가능"이라 판단했는데 틀렸음,
  구조화된 시작/종료일 필드는 없지만 서버가 내부적으로 판단한 state로 걸러주는 건 가능. year/month 둘 다
  줘야 의미있게 필터링됨(안 주면 필터링 자체가 무시되고 전체 반환).
- 상세: GET https://api.visitjeju.net/api/contents/read
  ?_siteId=jejuavj&locale=&device=pc&contentsid=
  usedescinfo(이용시간/휴무), convenience(편의시설), dpsonfclt(장애인시설), etc(기타정보),
  homepage/snsurl까지 있음 — locale=en/cn 번역도 지원. 쇼핑(c2)은 이 필드들이 자주 채워져 있어
  건당 상세 조회할 가치가 있음. 행사(c5)는 이 필드들이 거의 항상 비어있고 위 list의 sbst가 이미
  충분히 풍부해서, 행사는 상세 호출을 생략함(아이템 수가 많아 왕복이 부담스럽기도 함).
- locale(kr/en/cn)별로 완전히 별도의 목록을 조회해야 함 — Visit Seoul의 multi_lang_list 같은 건당
  번역본 cid 매핑이 없어서, en/cn 목록을 통째로 수집한 뒤 contentsid로 매칭. 번역 커버리지는 부분적이라
  매칭 안 되면 한글 그대로 폴백.
"""
import os
import re
import time
import requests
from datetime import date, timedelta
from typing import Optional
from dotenv import load_dotenv
from sqlalchemy import text
from database import engine
from image_storage import rehost_image
from gemini_service import get_embedding
from collector_base import cleanup_expired
from notification import send_alert

load_dotenv()

LIST_URL = "https://api.visitjeju.net/api/contents/list"
DETAIL_URL = "https://api.visitjeju.net/api/contents/read"
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

CATEGORY_MAP = {"c2": "shopping", "c5": "행사"}  # 'shopping'은 Visit Seoul 쇼핑과 동일한 컬럼값 규칙(main.py list_places 참고)
# 행사 state=ing 조회할 기간 — 이번달+다음 2달치를 훑어서 "지금 진행중이거나 곧 열릴" 것들을 잡음
EVENT_MONTH_WINDOW = 3


def _clean(text_: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (text_ or "")).strip()


def _safe_float(v) -> Optional[float]:
    try:
        return float(v) if v else None
    except (TypeError, ValueError):
        return None


def _bootstrap_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": _UA})
    try:
        s.get("https://visitjeju.net/", timeout=15)
    except Exception as e:
        print(f"  ⚠️ [Visit Jeju] 세션 발급 실패: {e}")
    return s


def _fetch_list(session: requests.Session, params: dict) -> list[dict]:
    items: list[dict] = []
    page = 1
    while True:
        p = {**params, "page": page, "pageSize": 100}
        try:
            r = session.get(LIST_URL, params=p, timeout=15)
            data = r.json()
        except Exception as e:
            print(f"  ⚠️ [Visit Jeju] 목록 조회 실패 (page {page}, {params}): {e}")
            break
        page_items = data.get("items") or []
        items.extend(page_items)
        page_count = data.get("pageCount", 0)
        if not page_items or page >= page_count:
            break
        page += 1
    return items


def _fetch_detail(session: requests.Session, cid: str, locale: str = "kr") -> dict:
    try:
        r = session.get(DETAIL_URL, params={"_siteId": "jejuavj", "locale": locale, "device": "pc", "contentsid": cid}, timeout=15)
        data = r.json()
        if data.get("result") == "200":
            return data.get("item") or {}
    except Exception:
        pass
    return {}


def _labels(items: Optional[list]) -> str:
    if not items:
        return ""
    return ", ".join(x.get("label", "") for x in items if isinstance(x, dict) and x.get("label"))


def _normalize_url(url: Optional[str]) -> str:
    url = (url or "").strip()
    if not url or url.lower() in ("none", "null"):
        return ""
    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = f"https://{url}"
    return url


_LABELS = {
    "kr": {"tag": "태그", "phone": "연락처", "hours": "이용안내", "convenience": "편의시설", "dpsonfclt": "장애인시설", "etc": "기타"},
    "en": {"tag": "Tags", "phone": "Contact", "hours": "Hours", "convenience": "Facilities", "dpsonfclt": "Accessibility", "etc": "Other"},
    "cn": {"tag": "标签", "phone": "联系方式", "hours": "使用信息", "convenience": "便利设施", "dpsonfclt": "无障碍设施", "etc": "其他"},
}


def _shop_content(detail: Optional[dict], fallback: Optional[dict], locale: str = "kr") -> str:
    """쇼핑용 — 상세 API(이용시간/편의시설/장애인시설/기타정보) 우선, 없으면 목록 데이터로 폴백."""
    labels = _LABELS.get(locale, _LABELS["kr"])
    src = detail or fallback or {}
    if not src:
        return ""
    parts = []
    intro = (src.get("sbst") or src.get("introduction") or "").strip()
    if intro:
        parts.append(intro)
    if detail:
        hours = (detail.get("usedescinfo") or "").strip()
        if hours:
            parts.append(f"{labels['hours']}: {hours}")
        conv = _labels(detail.get("convenience"))
        if conv:
            parts.append(f"{labels['convenience']}: {conv}")
        dpsonfclt = _labels(detail.get("dpsonfclt"))
        if dpsonfclt:
            parts.append(f"{labels['dpsonfclt']}: {dpsonfclt}")
        etc = _labels(detail.get("etc"))
        if etc:
            parts.append(f"{labels['etc']}: {etc}")
    tag = (src.get("tag") or "").strip()
    if tag:
        parts.append(f"{labels['tag']}: {tag}")
    phone = (src.get("phoneno") or "").strip()
    if phone and phone != "*":
        parts.append(f"{labels['phone']}: {phone}")
    return " | ".join(parts)


def _event_content(it: Optional[dict], locale: str = "kr") -> str:
    """행사용 — list API의 sbst(전체 설명, 날짜/코스 등 포함)를 그대로 사용 + 태그/전화번호."""
    labels = _LABELS.get(locale, _LABELS["kr"])
    if not it:
        return ""
    parts = []
    body = (it.get("sbst") or it.get("introduction") or "").strip()
    if body:
        parts.append(body)
    tag = (it.get("tag") or "").strip()
    if tag:
        parts.append(f"{labels['tag']}: {tag}")
    phone = (it.get("phoneno") or "").strip()
    if phone and phone != "*":
        parts.append(f"{labels['phone']}: {phone}")
    return " | ".join(parts)


def _image_url(it: dict) -> str:
    photo = ((it.get("repPhoto") or {}).get("photoid")) or {}
    return photo.get("imgpath") or photo.get("thumbnailpath") or ""


def fetch_shopping(session: requests.Session) -> list[dict]:
    print("\n🛍️ [Visit Jeju/쇼핑] 목록 조회 시작 (ko)")
    kr_items = _fetch_list(session, {"_siteId": "jejuavj", "locale": "kr", "device": "pc", "contentscd": "c2"})
    print(f"✅ [Visit Jeju/쇼핑] {len(kr_items)}건")

    print("🛍️ [Visit Jeju/쇼핑] 번역본 조회 (en/cn)")
    en_items = {it["contentsid"]: it for it in _fetch_list(session, {"_siteId": "jejuavj", "locale": "en", "device": "pc", "contentscd": "c2"})}
    cn_items = {it["contentsid"]: it for it in _fetch_list(session, {"_siteId": "jejuavj", "locale": "cn", "device": "pc", "contentscd": "c2"})}
    print(f"✅ [Visit Jeju/쇼핑] en {len(en_items)}건 / cn {len(cn_items)}건 (매칭용)")

    results = []
    seen_titles: set[str] = set()
    total = len(kr_items)
    for i, it in enumerate(kr_items, 1):
        cid = it.get("contentsid")
        title = _clean(it.get("title"))
        if not title or not cid or title in seen_titles:
            continue
        seen_titles.add(title)

        en = en_items.get(cid)
        cn = cn_items.get(cid)

        # 이용시간/편의시설/장애인시설 등 — 쇼핑은 이 필드들이 자주 채워져 있어 건당 상세 조회할 가치 있음
        detail_kr = _fetch_detail(session, cid, "kr")
        detail_en = _fetch_detail(session, cid, "en") if detail_kr else {}
        detail_cn = _fetch_detail(session, cid, "cn") if detail_kr else {}
        time.sleep(0.1)

        link_url = _normalize_url(detail_kr.get("homepage")) or _normalize_url(detail_kr.get("snsurl"))
        if i % 50 == 0 or i == total:
            print(f"  … [Visit Jeju/쇼핑] 상세 조회 {i}/{total}")

        results.append({
            "title": title,
            "title_en": _clean(en.get("title")) if en and en.get("title") else title,
            "title_zh": _clean(cn.get("title")) if cn and cn.get("title") else title,
            "content": _shop_content(detail_kr, it, "kr"),
            "content_en": _shop_content(detail_en, en, "en"),
            "content_zh": _shop_content(detail_cn, cn, "cn"),
            "location": it.get("roadaddress") or it.get("address") or "",
            "latitude": _safe_float(it.get("latitude")),
            "longitude": _safe_float(it.get("longitude")),
            "image_url": _image_url(it),
            "external_id": f"visitjeju_{cid}",
            "category": "shopping",
            "link_url": link_url,
            "link_title": "홈페이지/SNS" if link_url else "",
        })
    return results


def _month_windows(n: int) -> list[tuple[str, str]]:
    today = date.today()
    windows = []
    y, m = today.year, today.month
    for _ in range(n):
        windows.append((str(y), f"{m:02d}"))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return windows


def fetch_events(session: requests.Session) -> list[dict]:
    months = _month_windows(EVENT_MONTH_WINDOW)
    print(f"\n🎪 [Visit Jeju/행사] state=ing 기준 {EVENT_MONTH_WINDOW}개월치 조회 시작: {months}")

    by_cid: dict[str, dict] = {}
    en_by_cid: dict[str, dict] = {}
    cn_by_cid: dict[str, dict] = {}
    for year, month in months:
        kr = _fetch_list(session, {"_siteId": "jejuavj", "locale": "kr", "device": "pc", "contentscd": "c5", "festivalcontents": "y", "state": "ing", "year": year, "month": month})
        en = _fetch_list(session, {"_siteId": "jejuavj", "locale": "en", "device": "pc", "contentscd": "c5", "festivalcontents": "y", "state": "ing", "year": year, "month": month})
        cn = _fetch_list(session, {"_siteId": "jejuavj", "locale": "cn", "device": "pc", "contentscd": "c5", "festivalcontents": "y", "state": "ing", "year": year, "month": month})
        for it in kr:
            by_cid[it["contentsid"]] = it
        for it in en:
            en_by_cid[it["contentsid"]] = it
        for it in cn:
            cn_by_cid[it["contentsid"]] = it
        print(f"  … {year}-{month}: kr {len(kr)}건 (누적 고유 {len(by_cid)}건)")

    print(f"✅ [Visit Jeju/행사] 고유 {len(by_cid)}건 (진행중, {EVENT_MONTH_WINDOW}개월 합산)")

    results = []
    seen_titles: set[str] = set()
    for cid, it in by_cid.items():
        title = _clean(it.get("title"))
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)

        en = en_by_cid.get(cid)
        cn = cn_by_cid.get(cid)

        results.append({
            "title": title,
            "title_en": _clean(en.get("title")) if en and en.get("title") else title,
            "title_zh": _clean(cn.get("title")) if cn and cn.get("title") else title,
            "content": _event_content(it, "kr"),
            "content_en": _event_content(en, "en"),
            "content_zh": _event_content(cn, "cn"),
            "location": it.get("roadaddress") or it.get("address") or "",
            "latitude": _safe_float(it.get("latitude")),
            "longitude": _safe_float(it.get("longitude")),
            "image_url": _image_url(it),
            "external_id": f"visitjeju_{cid}",
            "category": "행사",
            "link_url": "",
            "link_title": "",
        })
    return results


def upsert_visitjeju_items(items: list[dict]) -> tuple[int, int, int]:
    """쇼핑(c2)=상시 운영으로 보고 end_date NULL(45일 TTL 삭제 대상 제외).
    행사(c5)=state=ing로 이미 '진행중'만 걸러왔지만, 재수집이 늦어지는 경우를 대비한 안전장치로
    수집 시점+30일 임시 만료도 같이 둠(팝업/클래스와 동일 패턴) — 응답에서 계속 나오는 한 계속 갱신됨."""
    new_count = updated_count = fail_count = 0
    for item in items:
        try:
            embedding = get_embedding(item["content"] or item["title"])
            end_date = None if item["category"] == "shopping" else (date.today() + timedelta(days=30))
            params = {
                "title": item["title"],
                "title_en": item["title_en"],
                "title_zh": item["title_zh"],
                "content": item["content"],
                "content_en": item["content_en"],
                "content_zh": item["content_zh"],
                "location": item["location"],
                "latitude": item["latitude"],
                "longitude": item["longitude"],
                "naver_place_id": item["external_id"],
                "image_url": rehost_image(item["image_url"]) or "",
                "embedding": f"[{','.join(map(str, embedding))}]",
                "region": "제주",
                "category": item["category"],
                "end_date": end_date,
                "link_url": item.get("link_url") or None,
                "link_title": item.get("link_title") or None,
            }
            with engine.connect() as conn:
                existing_id = conn.execute(
                    text("SELECT id FROM seongsu_places WHERE naver_place_id = :naver_place_id OR title = :title LIMIT 1"),
                    {"naver_place_id": params["naver_place_id"], "title": params["title"]}
                ).scalar()

                if existing_id:
                    conn.execute(text("""
                        UPDATE seongsu_places SET
                            title = :title, title_en = :title_en, title_zh = :title_zh,
                            content = :content, content_en = :content_en, content_zh = :content_zh,
                            location = :location,
                            latitude = COALESCE(:latitude, latitude),
                            longitude = COALESCE(:longitude, longitude),
                            naver_place_id = :naver_place_id,
                            image_url = COALESCE(:image_url, image_url),
                            embedding = :embedding,
                            region = :region,
                            category = :category,
                            end_date = :end_date,
                            link_url = COALESCE(:link_url, link_url),
                            link_title = COALESCE(:link_title, link_title)
                        WHERE id = :id
                    """), {**params, "id": existing_id})
                    updated_count += 1
                else:
                    conn.execute(text("""
                        INSERT INTO seongsu_places
                        (title, title_en, title_zh, content, content_en, content_zh, location, latitude, longitude,
                         naver_place_id, image_url, embedding, end_date, region, category, link_url, link_title)
                        VALUES
                        (:title, :title_en, :title_zh, :content, :content_en, :content_zh, :location, :latitude, :longitude,
                         :naver_place_id, :image_url, :embedding, :end_date, :region, :category, :link_url, :link_title)
                    """), params)
                    new_count += 1
                conn.commit()
                print(f"    ✅ [제주/{item['category']}] '{item['title']}' 저장 완료")
        except Exception as e:
            fail_count += 1
            print(f"    ❌ '{item.get('title', '?')}' 저장 실패: {e}")
    return new_count, updated_count, fail_count


def run_all():
    print("=" * 50)
    print("🏝️  Visit Jeju 쇼핑/행사 수집 시작")
    print("=" * 50)
    session = _bootstrap_session()
    items = fetch_shopping(session) + fetch_events(session)
    new_count, updated_count, fail_count = upsert_visitjeju_items(items) if items else (0, 0, 0)
    cleanup_expired()
    print("\n" + "=" * 50)
    print(f"🏁 완료 — 신규 {new_count} / 갱신 {updated_count} / 실패 {fail_count}")
    print("=" * 50)
    send_alert(
        f"Visit Jeju 쇼핑/행사 수집 완료\n신규 {new_count} · 갱신 {updated_count}"
        + (f" · 실패 {fail_count}" if fail_count else "")
    )


if __name__ == "__main__":
    run_all()
