from __future__ import annotations

import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta

import requests
from dotenv import load_dotenv

load_dotenv()

KOPIS_SERVICE_KEY = os.getenv("KOPIS_SERVICE_KEY")
LIST_URL = "http://www.kopis.or.kr/openApi/restful/pblprfr"
DETAIL_URL = "http://www.kopis.or.kr/openApi/restful/pblprfr/{mt20id}"

WINDOW_DAYS = 31
WINDOW_COUNT = 3  # 오늘부터 약 93일


def _date_windows():
    windows = []
    start = date.today()
    for _ in range(WINDOW_COUNT):
        end = start + timedelta(days=WINDOW_DAYS - 1)
        windows.append((start.strftime("%Y%m%d"), end.strftime("%Y%m%d")))
        start = end + timedelta(days=1)
    return windows


def _fetch_list(genre: str | None, signgucode: str, stdate: str, eddate: str) -> list[ET.Element]:
    items = []
    cpage = 1
    while True:
        params = {
            "service": KOPIS_SERVICE_KEY,
            "stdate": stdate,
            "eddate": eddate,
            "cpage": cpage,
            "rows": 100,
            "signgucode": signgucode,
        }
        if genre:
            params["shcate"] = genre
        try:
            r = requests.get(LIST_URL, params=params, timeout=15)
            if r.status_code != 200:
                break
            root = ET.fromstring(r.text)
            page_items = root.findall(".//db")
            if not page_items:
                break
            items.extend(page_items)
            if len(page_items) < 100:
                break
            cpage += 1
        except Exception as e:
            print(f"  ⚠️ [KOPIS] 목록 조회 실패 ({genre}/{signgucode}/{stdate}): {e}")
            break
    return items


def _fetch_detail(mt20id: str) -> ET.Element | None:
    try:
        r = requests.get(DETAIL_URL.format(mt20id=mt20id), params={"service": KOPIS_SERVICE_KEY}, timeout=15)
        if r.status_code != 200:
            return None
        root = ET.fromstring(r.text)
        return root.find(".//db")
    except Exception as e:
        print(f"  ⚠️ [KOPIS] 상세 조회 실패 ({mt20id}): {e}")
        return None


def _clean_fcltynm(name: str) -> str:
    """KOPIS fcltynm은 종종 '시설명 (시설명)' 처럼 괄호 안에 동일 문자열이 중복됨."""
    m = re.match(r"^(.*?)\s*\(\s*\1\s*\)\s*$", name.strip())
    return m.group(1).strip() if m else name.strip()


def _parse_kopis_date(s: str) -> date | None:
    try:
        return datetime.strptime(s.strip(), "%Y.%m.%d").date()
    except (ValueError, AttributeError):
        return None


def _classify_genre(genrenm: str) -> str:
    """서울 공연 메뉴 서브탭 분류. 코피스 장르 3가지(연극/뮤지컬/대중음악→음악)만 별도 분류하고
    나머지(클래식/국악/무용/서커스마술/복합 등)는 모두 '종합'으로 묶는다."""
    if genrenm == "연극":
        return "연극"
    if genrenm == "뮤지컬":
        return "뮤지컬"
    if genrenm == "대중음악":
        return "음악"
    return "종합"


async def scrape_kopis_concert() -> list[dict]:
    if not KOPIS_SERVICE_KEY:
        print("⚠️ KOPIS_SERVICE_KEY가 설정되지 않았습니다.")
        return []

    print("🎭 [KOPIS] 공연 목록 수집 중 (서울: 전체 장르/연극·뮤지컬·음악·종합 분류)...")
    today = date.today()
    found: dict[str, dict] = {}  # mt20id -> {"region": ..., "category": ...}

    # 서울 — shcate(장르코드) 필터 없이 전체 조회, 리스트 응답의 genrenm으로 4분류
    for stdate, eddate in _date_windows():
        for el in _fetch_list(None, "11", stdate, eddate):
            mt20id = el.findtext("mt20id", "").strip()
            if not mt20id or mt20id in found:
                continue
            end = _parse_kopis_date(el.findtext("prfpdto", ""))
            if end and end < today:
                continue  # 공연완료 제외
            genrenm = el.findtext("genrenm", "").strip()
            found[mt20id] = {"region": "공연", "category": _classify_genre(genrenm)}

    print(f"📦 [KOPIS] 공연 {len(found)}건 발견. 상세 정보 조회 중...")

    results: list[dict] = []
    for mt20id, meta in found.items():
        detail = _fetch_detail(mt20id)
        time.sleep(0.15)
        if detail is None:
            continue

        title = detail.findtext("prfnm", "").strip()
        if not title:
            continue

        prfpdfrom = detail.findtext("prfpdfrom", "")
        prfpdto = detail.findtext("prfpdto", "")
        end_date_actual = _parse_kopis_date(prfpdto)
        fcltynm = _clean_fcltynm(detail.findtext("fcltynm", ""))
        poster = detail.findtext("poster", "")
        sty = re.sub(r"<[^>]+>", "", detail.findtext("sty", "") or "").strip()
        prfcast = detail.findtext("prfcast", "")
        prfruntime = detail.findtext("prfruntime", "")
        prfage = detail.findtext("prfage", "")
        pcseguidance = detail.findtext("pcseguidance", "")
        dtguidance = detail.findtext("dtguidance", "")
        entrpsnm = detail.findtext("entrpsnm", "")

        link_url = None
        relate = detail.find(".//relates/relate")
        if relate is not None:
            link_url = (relate.findtext("relateurl", "") or "").strip() or None

        content_parts = []
        if sty:
            content_parts.append(sty)
        if prfpdfrom and prfpdto:
            content_parts.append(f"기간: {prfpdfrom} ~ {prfpdto}")
        if prfcast:
            content_parts.append(f"출연: {prfcast}")
        if prfruntime:
            content_parts.append(f"러닝타임: {prfruntime}")
        if prfage:
            content_parts.append(f"관람연령: {prfage}")
        if pcseguidance:
            content_parts.append(f"티켓가격: {pcseguidance}")
        if dtguidance:
            content_parts.append(f"공연시간: {dtguidance}")
        if entrpsnm:
            content_parts.append(f"기획: {entrpsnm}")
        content_parts.append("<출처 : KOPIS 제공>")

        results.append({
            "title": title,
            "title_en": "",
            "location": fcltynm,
            "content": " | ".join(content_parts),
            "content_en": "",
            "date_range": f"{prfpdfrom} ~ {prfpdto}" if prfpdfrom else "",
            "latitude": None,
            "longitude": None,
            "video_url": "",
            "naver_place_id": f"kopis_{mt20id}",
            "image_url": poster,
            "region": meta["region"],
            "category": meta.get("category"),
            "end_date_actual": end_date_actual,
            "link_url": link_url,
        })

    print(f"✅ [KOPIS] 공연 {len(results)}건 정제 완료.")
    return results


if __name__ == "__main__":
    import asyncio
    res = asyncio.run(scrape_kopis_concert())
    for r in res[:20]:
        print(f"  - [{r['region']}] {r['title']} ({r['location']})")
