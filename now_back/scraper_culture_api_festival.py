from __future__ import annotations

import json
import os
import re
import time
import xml.etree.ElementTree as ET
from calendar import monthrange
from datetime import date

import requests
from dotenv import load_dotenv

load_dotenv()

CULTURE_FESTIVAL_API_KEY = os.getenv("CULTURE_FESTIVAL_API_KEY")
URL = "https://api.kcisa.kr/openapi/service/rest/meta4/getKCPG0504"
_RAW_CACHE_PATH = "/tmp/culture_api_festival_raw_cache.json"  # 당일 한정 캐시 — API 응답 지연/장애 대비
_DETAIL_BASE = "https://www.mcst.go.kr"
_THUMBNAIL_PATTERN = re.compile(
    r"/attachFiles/cultureInfoCourt/localFestival/notifyFestival/[^\"']+\.(?:jpg|jpeg|png|gif)", re.IGNORECASE
)


def _fetch_thumbnail(detail_url: str) -> str | None:
    """API에 이미지가 없을 때 상세 페이지 HTML에서 썸네일을 긁어옴."""
    if not detail_url:
        return None
    try:
        r = requests.get(detail_url, timeout=10)
        if r.status_code != 200:
            return None
        m = _THUMBNAIL_PATTERN.search(r.text)
        return f"{_DETAIL_BASE}{m.group(0)}" if m else None
    except requests.RequestException:
        return None

_FULL_DATE_PATTERN = re.compile(r"(\d{4})\s*[.년]\s*(\d{1,2})")
_BARE_MONTH_AFTER_TILDE_PATTERN = re.compile(r"~[^0-9]*(\d{1,2})\s*[.\s월]")
_RECURRING_MONTH_PATTERN = re.compile(r"(\d{1,2})\s*월")


def _clean_period(period: str) -> str:
    period = re.sub(r"\([^)]*\)", "", period)  # 요일/일수 등 괄호 설명 제거
    period = period.split("|")[0]  # 시간대 정보 제거
    return period.strip()


def _active_range(period: str) -> tuple[tuple[int, int], tuple[int, int]] | None:
    """월 단위로 (시작 연,월), (종료 연,월)을 추정. 파싱 불가 시 None."""
    text = _clean_period(period)
    if not text:
        return None

    full_matches = _FULL_DATE_PATTERN.findall(text)
    if full_matches:
        start_year, start_month = int(full_matches[0][0]), int(full_matches[0][1])
        if len(full_matches) >= 2:
            end_year, end_month = int(full_matches[-1][0]), int(full_matches[-1][1])
        else:
            tail = text[text.find("~") + 1:] if "~" in text else ""
            m = _BARE_MONTH_AFTER_TILDE_PATTERN.search("~" + tail) if tail else None
            if m:
                end_month = int(m.group(1))
                end_year = start_year if end_month >= start_month else start_year + 1
            else:
                end_year, end_month = start_year, start_month
        return (start_year, start_month), (end_year, end_month)

    months = [int(m) for m in _RECURRING_MONTH_PATTERN.findall(text)]
    if not months:
        return None
    start_month = months[0]
    end_month = months[-1]
    return (None, start_month), (None, end_month)


def _is_active(period: str, today: date) -> bool:
    rng = _active_range(period)
    if rng is None:
        return False
    (start_year, start_month), (end_year, end_month) = rng

    if start_year is None:  # 매년 반복 행사 — 연도 무시, 월만 비교
        if start_month <= end_month:
            return start_month <= today.month <= end_month
        return today.month >= start_month or today.month <= end_month  # 연말~연초 걸치는 경우

    return (start_year, start_month) <= (today.year, today.month) <= (end_year, end_month)


def _end_date_actual(period: str) -> date | None:
    rng = _active_range(period)
    if rng is None:
        return None
    (_, _), (end_year, end_month) = rng
    if end_year is None:  # 매년 반복 — 구체적 종료일 없음
        return None
    last_day = monthrange(end_year, end_month)[1]
    return date(end_year, end_month, last_day)


def _load_raw_cache() -> list[dict] | None:
    if not os.path.exists(_RAW_CACHE_PATH):
        return None
    try:
        with open(_RAW_CACHE_PATH) as f:
            cached = json.load(f)
        if cached.get("date") == date.today().isoformat():
            return cached.get("items")
    except (json.JSONDecodeError, OSError):
        pass
    return None


def _save_raw_cache(items: list[dict]) -> None:
    try:
        with open(_RAW_CACHE_PATH, "w") as f:
            json.dump({"date": date.today().isoformat(), "items": items}, f, ensure_ascii=False)
    except OSError:
        pass


def _fetch_all_raw(page_size: int = 1000, use_cache: bool = True) -> list[dict]:
    if use_cache:
        cached = _load_raw_cache()
        if cached is not None:
            print(f"  (당일 캐시 사용: {len(cached)}건)")
            return cached

    items = []
    page = 1
    while True:
        r = requests.get(
            URL, params={"serviceKey": CULTURE_FESTIVAL_API_KEY, "numOfRows": page_size, "pageNo": page}, timeout=30
        )
        if r.status_code != 200:
            print(f"❌ [축제API] 응답 에러: {r.status_code}")
            break
        root = ET.fromstring(r.text)
        total_count = int(root.findtext(".//totalCount", "0"))
        page_items = root.findall(".//item")
        if not page_items:
            break
        for item in page_items:
            items.append({
                "title": (item.findtext("title") or "").strip(),
                "eventPeriod": (item.findtext("eventPeriod") or "").strip(),
                "spatialCoverage": (item.findtext("spatialCoverage") or "").strip(),
                "description": (item.findtext("description") or "").strip(),
                "url": (item.findtext("url") or "").strip(),
                "referenceIdentifier": (item.findtext("referenceIdentifier") or "").strip(),
            })
        print(f"  페이지 {page} 수집 ({len(items)}/{total_count})", flush=True)
        if len(items) >= total_count:
            break
        page += 1
        time.sleep(0.2)

    if items:
        _save_raw_cache(items)
    return items


async def scrape_culture_api_festival() -> list[dict]:
    if not CULTURE_FESTIVAL_API_KEY:
        print("⚠️ CULTURE_FESTIVAL_API_KEY가 설정되지 않았습니다.")
        return []

    print("🎪 문체부 지역축제 API 수집 중...")
    raw_items = _fetch_all_raw()
    print(f"📦 전국 {len(raw_items)}건 수신.")

    today = date.today()
    seen_titles: set[str] = set()
    results: list[dict] = []

    for it in raw_items:
        title = it["title"]
        if not title or title in seen_titles:
            continue
        if not _is_active(it["eventPeriod"], today):
            continue
        seen_titles.add(title)

        description = re.sub(r"<[^>]+>", "", it["description"]).strip()
        location = it["spatialCoverage"] or title  # 지역 정보 없으면 제목(보통 지역명 포함)으로 대체
        content_parts = [f"[{it['spatialCoverage']}] {title}"] if it["spatialCoverage"] else [title]
        if it["eventPeriod"]:
            content_parts.append(f"기간: {it['eventPeriod']}")
        if description:
            content_parts.append(description)

        image_url = it["referenceIdentifier"] if it["referenceIdentifier"].lower().endswith((".jpg", ".jpeg", ".png", ".gif")) else ""
        if not image_url:
            image_url = _fetch_thumbnail(it["url"]) or ""
        time.sleep(0.1)

        results.append({
            "title": title,
            "title_en": "",
            "location": location,
            "content": " | ".join(content_parts),
            "content_en": "",
            "latitude": None,
            "longitude": None,
            "video_url": "",
            "naver_place_id": f"festival_{abs(hash(title)) % 1000000}",
            "image_url": image_url,
            "region": "축제",
            "end_date_actual": _end_date_actual(it["eventPeriod"]),
            "detail_url": it["url"],
        })

    print(f"✅ 진행중인 축제 {len(results)}건 정제 완료.")
    return results


if __name__ == "__main__":
    import asyncio
    res = asyncio.run(scrape_culture_api_festival())
    for r in res[:30]:
        print(f"  - [{r['location']}] {r['title']}")
