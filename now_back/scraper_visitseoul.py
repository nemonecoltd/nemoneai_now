"""
scraper_visitseoul.py — Visit Seoul(api.visitseoul.net) 콘텐츠 수집.
소스 기준 파일(메뉴 기준 아님) — 쇼핑/축제/문화(전시) 세 메뉴로 나눠 upsert하되
API 호출 방식·인증이 공통이라 한 파일에서 함수만 나눠 공유한다.

API 실측 확인 사항(2026-07-20):
- 목록: POST https://api-call.visitseoul.net/api/v1/contents/list
  body {lang_code_id, page_no, page_size, com_ctgry_sn?} — com_ctgry_sn은 대분류(ctgry_level=1) 8종에서만 동작,
  세부 카테고리(level 2/3)는 이 필터로 안 걸러져서 응답의 com_ctgry_sn 값으로 클라이언트 사이드 필터링해야 함
- 카테고리 전체 트리: GET https://api-call.visitseoul.net/api/v1/category/list
  {com_ctgry_sn, ctgry_nm, ctgry_path, ctgry_level(1=대/2=중/3=소), sort_no} — 정확한 코드 확인용, 아래 CTGRY_* 상수 출처
- 상세: POST https://api-call.visitseoul.net/api/v1/contents/info  body {cid}
  주소/좌표/전화/운영시간/휴무일은 data.traffic·data.extra, 본문은 data.post_desc(HTML)에 있음
- 목록 응답의 multi_lang_list(예: "ko:KOPxxx,en:ENPxxx,zh-CN:CNPxxx,...")로 언어별 cid가 이미 매핑돼 있어
  en/zh-CN cid로 상세를 그대로 조회하면 공식 번역본이 나옴 — Gemini 번역 호출 불필요(비용/속도 이득)
"""
import os
import re
import json
import html as html_module
import time
import urllib.request
import urllib.error
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

API_KEY = os.getenv("VISITSEOUL_API_KEY")
LIST_URL = "https://api-call.visitseoul.net/api/v1/contents/list"
INFO_URL = "https://api-call.visitseoul.net/api/v1/contents/info"

CTGRY_SHOPPING = "Cu8e6t5"  # 대분류 '쇼핑'
CTGRY_FESTIVAL = "Cv7s8m5"  # 대분류 '축제/공연/행사'
CTGRY_CULTURE = "Ca0o2d4"  # 대분류 '문화관광'
CTGRY_FESTIVAL_PERFORMANCE = "Cb2b0t2"  # '축제/공연/행사 > 공연' — 코피스와 중복이라 제외 대상
CTGRY_CULTURE_FACILITIES = "Cg1x6l1"  # '문화관광 > 문화시설'(전시시설) — 다음 단계(전시 서브탭)용, 하위 3종:
CTGRY_CULTURE_FACILITIES_SUB = {"Cg1x6l1", "Cy6j7j7", "Ct9t6m8", "Cr0q2v2"}  # 문화시설/기타/미술관·화랑/박물관
CTGRY_LANDMARK = "Cl5y4k0"  # '문화관광 > 랜드마크관광' — 전시 서브탭에서 제외 대상


def _call(url: str, body: dict, retries: int = 3) -> dict:
    """비짓서울 API가 간헐적으로 500을 뱉는 게 확인돼(2026-07-20) 짧은 백오프로 재시도."""
    last_err = None
    for attempt in range(retries):
        req = urllib.request.Request(
            url,
            data=json.dumps(body).encode(),
            method="POST",
            headers={
                "Accept": "application/json;charset=UTF-8",
                "Content-Type": "application/json;charset=UTF-8",
                "VISITSEOUL-API-KEY": API_KEY,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                return json.loads(res.read().decode())
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code >= 500 and attempt < retries - 1:
                time.sleep(1.5 * (attempt + 1))
                continue
            raise
    raise last_err


def _list_all(com_ctgry_sn: str, page_size: int = 500) -> list[dict]:
    """대분류 하나를 전량 페이지네이션으로 수집."""
    items: list[dict] = []
    page_no = 1
    while True:
        body = _call(LIST_URL, {
            "lang_code_id": "ko",
            "page_no": page_no,
            "page_size": page_size,
            "com_ctgry_sn": com_ctgry_sn,
        })
        page_items = body.get("data", [])
        items.extend(page_items)
        total = body.get("paging", {}).get("total_count", len(items))
        if len(items) >= total or not page_items:
            break
        page_no += 1
    return items


_DISTRICT_REGION = [
    ("성동구", "성수"),
    ("마포구", "홍대"),
    ("강남구", "강남"),
    ("서초구", "강남"),
    ("송파구", "강남"),
]


def _region_from_address(addr: str) -> str:
    for district, region in _DISTRICT_REGION:
        if district in addr:
            return region
    return "강북"  # 위 3개 지역 제외한 서울 전체 (기존 강북 버킷 동작 방식과 일관되게 유지)


def _strip_html(html: str) -> str:
    if not html:
        return ""
    text_ = re.sub(r"<style[^>]*>.*?</style>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text_ = re.sub(r"<script[^>]*>.*?</script>", "", text_, flags=re.DOTALL | re.IGNORECASE)
    text_ = re.sub(r"</(p|div|li|h[1-6])>", "\n", text_)
    text_ = re.sub(r"<br\s*/?>", "\n", text_)
    text_ = re.sub(r"<[^>]*>", "", text_)
    text_ = html_module.unescape(text_)  # &nbsp; 등 HTML 엔티티를 실제 문자로 디코딩
    text_ = re.sub(r"[ \t]+", " ", text_)
    text_ = re.sub(r"\n{3,}", "\n\n", text_)
    return text_.strip()


def _clean_title(title: str) -> str:
    """제목에 <br> 등 HTML 태그가 섞여 들어오는 경우가 있어(예: '~특별전<br> <운현궁...')."""
    title = re.sub(r"<[^>]*>", " ", title or "")
    title = html_module.unescape(title)
    return re.sub(r"\s+", " ", title).strip()


def _normalize_url(url: Optional[str]) -> str:
    """cmmn_hmpg_url이 'www.example.com'처럼 스킴 없이 오는 경우가 있어(now 페이지 내 상대경로로 깨짐 방지)."""
    url = (url or "").strip()
    if not url:
        return ""
    if not re.match(r"^https?://", url, re.IGNORECASE):
        url = f"https://{url}"
    return url


def _parse_vs_date(s: Optional[str]) -> Optional[date]:
    """'2026.05.08' 형식(schdul_info_bgnde/endde)을 date로 변환."""
    if not s:
        return None
    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})", s.strip())
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


def _extra_text(extra: dict) -> str:
    bits = []
    if extra.get("cmmn_use_time"):
        bits.append(f"운영시간: {extra['cmmn_use_time']}")
    if extra.get("cmmn_telno"):
        bits.append(f"전화: {extra['cmmn_telno']}")
    return "\n".join(bits)


def _content_from_detail(detail: dict, extra_text: str = "") -> str:
    body = _strip_html(detail.get("post_desc", "")) or html_module.unescape(detail.get("sumry", ""))
    if extra_text:
        body = f"{body}\n\n{extra_text}" if body else extra_text
    return body


def _fetch_one(raw: dict) -> Optional[dict]:
    """ko 상세(주소/좌표/부가정보) + multi_lang_list의 en/zh-CN cid로 공식 번역본까지 한 번에 조립."""
    cid = raw["cid"]
    try:
        ko_detail = _call(INFO_URL, {"cid": cid}).get("data", {})
    except Exception as e:
        print(f"  ⚠️ [{cid}] 상세 조회 실패: {e}")
        return None

    title = _clean_title(ko_detail.get("post_sj") or raw.get("post_sj") or "")
    if not title:
        return None

    traffic = ko_detail.get("traffic", {}) or {}
    extra = ko_detail.get("extra", {}) or {}
    addr = traffic.get("new_adres") or traffic.get("adres") or ""
    if not addr:
        print(f"  ⏭️ [{title}] 주소 없음, 스킵")
        return None

    extra_text = _extra_text(extra)
    content = _content_from_detail(ko_detail, extra_text)

    lang_map = dict(pair.split(":", 1) for pair in raw.get("multi_lang_list", "").split(",") if ":" in pair)
    title_en, content_en = title, ""
    title_zh, content_zh = title, ""
    try:
        if lang_map.get("en"):
            en_detail = _call(INFO_URL, {"cid": lang_map["en"]}).get("data", {})
            title_en = _clean_title(en_detail.get("post_sj") or title)
            content_en = _content_from_detail(en_detail, extra_text)
    except Exception as e:
        print(f"  ⚠️ [{title}] 영문 조회 실패: {e}")
    try:
        if lang_map.get("zh-CN"):
            zh_detail = _call(INFO_URL, {"cid": lang_map["zh-CN"]}).get("data", {})
            title_zh = _clean_title(zh_detail.get("post_sj") or title)
            content_zh = _content_from_detail(zh_detail, extra_text)
    except Exception as e:
        print(f"  ⚠️ [{title}] 중문 조회 실패: {e}")

    start_date = _parse_vs_date(ko_detail.get("schdul_info_bgnde"))
    end_date_actual = _parse_vs_date(ko_detail.get("schdul_info_endde"))
    date_range = f"{start_date.strftime('%Y.%m.%d.')} ~ {end_date_actual.strftime('%Y.%m.%d.')}" if start_date and end_date_actual else ""

    return {
        "title": title,
        "title_en": title_en,
        "title_zh": title_zh,
        "content": content,
        "content_en": content_en,
        "content_zh": content_zh,
        "location": addr,
        "latitude": _safe_float(traffic.get("map_position_y")),
        "longitude": _safe_float(traffic.get("map_position_x")),
        "image_url": ko_detail.get("main_img") or raw.get("main_img") or "",
        "region": _region_from_address(addr),
        "external_id": f"visitseoul_{cid}",
        "end_date_actual": end_date_actual,  # 일정정보(schdul_info_bgnde/endde)에서 파싱한 실제 종료일 — 없으면 None
        "date_range": date_range,
        # naver_place_id가 실제 네이버 장소 ID가 아니라 "네이버지도에서 보기" 링크를 못 만듦 —
        # 대신 공식 홈페이지(있으면 SNS)를 대표 링크로 사용
        "link_url": _normalize_url(extra.get("cmmn_hmpg_url")),
        "link_title": "공식 페이지" if extra.get("cmmn_hmpg_url") else "",
    }


def fetch_shopping() -> list[dict]:
    """대분류 '쇼핑' 전체를 수집해 지역별 팝업/클래스와 같은 seongsu_places 항목으로 변환."""
    print("\n🗺️ [Visit Seoul/쇼핑] 목록 조회 시작")
    raw_items = _list_all(CTGRY_SHOPPING)
    print(f"✅ [Visit Seoul/쇼핑] 목록 {len(raw_items)}건 수집")

    results = []
    for i, raw in enumerate(raw_items):
        item = _fetch_one(raw)
        if not item:
            continue
        item["category"] = "shopping"
        print(f"  ✨ [Visit Seoul/쇼핑] ({i + 1}/{len(raw_items)}) '{item['title']}' 처리 중...")
        results.append(item)
    return results


def _safe_float(v) -> Optional[float]:
    try:
        return float(v) if v else None
    except (TypeError, ValueError):
        return None


def fetch_festival() -> list[dict]:
    """대분류 '축제/공연/행사'에서 '공연' 서브카테고리(코피스와 중복) 제외 + 서울 주소만 남겨 수집.
    기간(시작/종료일) 필드가 API에 아예 없어 '종료된 축제 제외'를 정확히 판단할 수 없음 —
    대신 팝업/클래스처럼 수집 시점+30일 임시 만료를 주고 매주 재수집 때마다 갱신되는 방식으로,
    Visit Seoul 목록에서 빠진(=종료 추정) 축제는 재수집이 끊겨 자연스럽게 45일 유예 후 삭제되게 함."""
    print("\n🗺️ [Visit Seoul/축제] 목록 조회 시작")
    raw_items = _list_all(CTGRY_FESTIVAL)
    raw_items = [it for it in raw_items if it["com_ctgry_sn"] != CTGRY_FESTIVAL_PERFORMANCE]
    print(f"✅ [Visit Seoul/축제] 공연 제외 후 {len(raw_items)}건 대상")

    results = []
    skipped_non_seoul = 0
    for i, raw in enumerate(raw_items):
        item = _fetch_one(raw)
        if not item:
            continue
        if not item["location"].startswith("서울"):
            skipped_non_seoul += 1
            continue
        item["category"] = None
        item["region"] = "축제"
        print(f"  ✨ [Visit Seoul/축제] ({i + 1}/{len(raw_items)}) '{item['title']}' 처리 중...")
        results.append(item)
    print(f"⏭️ 서울 외 지역 {skipped_non_seoul}건 제외")
    return results


def fetch_culture() -> list[dict]:
    """대분류 '문화관광' 중 '문화시설'(전시시설/미술관·화랑/박물관/기타전시시설) 계열만 남기고
    '랜드마크관광'은 제외, 서울 주소만 수집 — 성수/홍대/강북/강남 메뉴 하위 '전시' 서브탭용
    (공연과는 다른 개념이라 '공연' 메뉴가 아니라 지역별 쇼핑/팝업/클래스와 같은 자리에 배치).
    지역 분류는 fetch_shopping과 동일하게 _fetch_one 안의 _region_from_address 결과를 그대로 사용 —
    팝업 등 기존 데이터와 주소가 겹칠 수 있는데, upsert가 제목 기준으로 병합 시도하고 안 되면
    중복인 채로 남으니(정밀 필터링 원칙) 필요시 수동으로 정리.
    기간 필드가 없는 건 축제와 동일 이슈라 같은 30일 롤링 만료 방식 적용."""
    print("\n🗺️ [Visit Seoul/전시] 목록 조회 시작")
    raw_items = _list_all(CTGRY_CULTURE)
    raw_items = [it for it in raw_items if it["com_ctgry_sn"] in CTGRY_CULTURE_FACILITIES_SUB]
    print(f"✅ [Visit Seoul/전시] 문화시설 계열 {len(raw_items)}건 대상")

    results = []
    skipped_non_seoul = 0
    for i, raw in enumerate(raw_items):
        item = _fetch_one(raw)
        if not item:
            continue
        if not item["location"].startswith("서울"):
            skipped_non_seoul += 1
            continue
        item["category"] = "전시"
        print(f"  ✨ [Visit Seoul/전시] ({i + 1}/{len(raw_items)}) '{item['title']}' 처리 중... (지역: {item['region']})")
        results.append(item)
    print(f"⏭️ 서울 외 지역 {skipped_non_seoul}건 제외")
    return results


def _safe_float(v) -> Optional[float]:
    try:
        return float(v) if v else None
    except (TypeError, ValueError):
        return None


def upsert_visitseoul_items(items: list[dict], permanent: bool = True) -> tuple[int, int, int]:
    """Visit Seoul 전용 upsert.
    schdul_info_bgnde/endde(실제 일정)가 있으면 그걸 end_date로 그대로 씀(이미 지난 경우 즉시 목록에서 빠지고
    45일 뒤 자연 삭제됨 — 정확한 종료 판단 가능).
    없을 때만 permanent=True(쇼핑 등 상시 운영): end_date 항상 NULL — 45일 유예 TTL 삭제 대상에서 아예 제외.
    permanent=False(기간 불명 이벤트): 수집 시점+30일 임시 만료, 재수집될 때마다 자동 갱신
    (기존 팝업/클래스 스크래퍼와 동일한 패턴 — database.cleanup_expired_data 참고)."""
    new_count = 0
    updated_count = 0
    fail_count = 0
    for item in items:
        try:
            embedding = get_embedding(item["content"])
            real_end_date = item.get("end_date_actual")
            if real_end_date:
                end_date = real_end_date
            else:
                end_date = None if permanent else (date.today() + timedelta(days=30))
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
                "region": item["region"],
                "category": item["category"],
                "end_date": end_date,
                "real_end_date": real_end_date,
                "date_range": item.get("date_range", ""),
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
                            date_range = :date_range,
                            link_url = COALESCE(:link_url, link_url),
                            link_title = COALESCE(:link_title, link_title)
                        WHERE id = :id
                    """), {**params, "id": existing_id})
                    updated_count += 1
                else:
                    conn.execute(text("""
                        INSERT INTO seongsu_places
                        (title, title_en, title_zh, content, content_en, content_zh, location, latitude, longitude,
                         naver_place_id, image_url, embedding, end_date, date_range, region, category, link_url, link_title)
                        VALUES
                        (:title, :title_en, :title_zh, :content, :content_en, :content_zh, :location, :latitude, :longitude,
                         :naver_place_id, :image_url, :embedding, :end_date, :date_range, :region, :category, :link_url, :link_title)
                    """), params)
                    new_count += 1
                conn.commit()
                print(f"    ✅ [{item['region']}] '{item['title']}' 저장 완료")
        except Exception as e:
            fail_count += 1
            print(f"    ❌ '{item.get('title', '?')}' 저장 실패: {e}")
    return new_count, updated_count, fail_count


def run_shopping():
    print("=" * 50)
    print("🛍️  Visit Seoul 쇼핑 수집 시작")
    print("=" * 50)
    items = fetch_shopping()
    new_count, updated_count, fail_count = upsert_visitseoul_items(items, permanent=True)
    cleanup_expired()
    print("\n" + "=" * 50)
    print(f"🏁 완료 — 신규 {new_count} / 갱신 {updated_count} / 실패 {fail_count}")
    print("=" * 50)
    send_alert(
        f"Visit Seoul 쇼핑 수집 완료\n신규 {new_count} · 갱신 {updated_count}"
        + (f" · 실패 {fail_count}" if fail_count else "")
    )


def run_festival():
    print("=" * 50)
    print("🎪 Visit Seoul 축제 수집 시작")
    print("=" * 50)
    items = fetch_festival()
    new_count, updated_count, fail_count = upsert_visitseoul_items(items, permanent=False)
    cleanup_expired()
    print("\n" + "=" * 50)
    print(f"🏁 완료 — 신규 {new_count} / 갱신 {updated_count} / 실패 {fail_count}")
    print("=" * 50)
    send_alert(
        f"Visit Seoul 축제 수집 완료\n신규 {new_count} · 갱신 {updated_count}"
        + (f" · 실패 {fail_count}" if fail_count else "")
    )


def run_culture():
    print("=" * 50)
    print("🖼️  Visit Seoul 전시 수집 시작")
    print("=" * 50)
    items = fetch_culture()
    new_count, updated_count, fail_count = upsert_visitseoul_items(items, permanent=False)
    cleanup_expired()
    print("\n" + "=" * 50)
    print(f"🏁 완료 — 신규 {new_count} / 갱신 {updated_count} / 실패 {fail_count}")
    print("=" * 50)
    send_alert(
        f"Visit Seoul 전시 수집 완료\n신규 {new_count} · 갱신 {updated_count}"
        + (f" · 실패 {fail_count}" if fail_count else "")
    )


if __name__ == "__main__":
    import sys
    target = sys.argv[1] if len(sys.argv) > 1 else "shopping"
    if target == "festival":
        run_festival()
    elif target == "culture":
        run_culture()
    else:
        run_shopping()
