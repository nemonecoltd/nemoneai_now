from __future__ import annotations

import json
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import date

import requests
from dotenv import load_dotenv

load_dotenv()

CULTURE_API_KEY = os.getenv("CULTURE_API_KEY")
URL = "https://api.kcisa.kr/openapi/CNV_060/request"
_RAW_CACHE_PATH = "/tmp/culture_api_raw_cache.json"  # 당일 한정 캐시 — API 응답 지연/장애 대비

# 기존 서울 API 수집분 venue 이름 + 메이저 서울 공연장 보강 (DB가 못 잡던 곳)
# "소극장"/"대극장"/"씨어터" 등 범용어는 타지역 오염 유발하므로 제외, 고유 명칭만 사용
EXTRA_SEOUL_VENUES = [
    "서울", "아르코예술극장", "대학로예술극장", "대학로", "세종문화회관", "국립극장",
    "LG아트센터", "유니플렉스", "충무아트센터", "마포아트센터", "블루스퀘어",
    "잠실", "장충", "코엑스", "DDP", "동대문디자인플라자", "한전아트센터",
    "국립국악원", "정동극장", "남산국악당", "상상마당 홍대",
    "롯데콘서트홀", "금호아트홀 연세", "일신홀", "다산아트홀", "서울돈화문국악당",
    "반포", "예술의전당 [서울]",
]
EXTRA_JEJU_VENUES = ["제주아트센터", "제주", "제주특별자치도문예회관", "한라", "서귀포"]
SEOUL_TAG_ALIASES = {"서울", "대학로"}
JEJU_TAG_ALIASES = {"제주"}
_TAG_PATTERN = re.compile(r"\[([가-힣]{2,4})\]")


def _classify_region(title: str, site: str) -> str | None:
    """1순위: [지역] 태그, 2순위: venue 화이트리스트. 매칭 안 되면 None(제외)."""
    m = _TAG_PATTERN.search(title) or _TAG_PATTERN.search(site)
    tag = m.group(1) if m else None

    if tag in SEOUL_TAG_ALIASES:
        return "공연"
    if tag in JEJU_TAG_ALIASES:
        return "제주"
    if tag is not None:
        return None  # 다른 지역 태그가 명시되어 있으면 확실히 제외

    if any(v in site for v in EXTRA_SEOUL_VENUES):
        return "공연"
    if any(v in site for v in EXTRA_JEJU_VENUES):
        return "제주"
    return None


def _is_active(event_period: str, today_str: str) -> bool:
    parts = event_period.split("~")
    if len(parts) != 2:
        return False
    end = parts[1].strip()
    return bool(end) and end >= today_str


def _parse_end_date(event_period: str) -> date | None:
    parts = event_period.split("~")
    if len(parts) != 2:
        return None
    end = parts[1].strip()
    try:
        return date(int(end[:4]), int(end[4:6]), int(end[6:8]))
    except (ValueError, IndexError):
        return None


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
            URL, params={"serviceKey": CULTURE_API_KEY, "numOfRows": page_size, "pageNo": page}, timeout=30
        )
        if r.status_code != 200:
            print(f"❌ [문체부API] 응답 에러: {r.status_code}")
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
                "eventSite": (item.findtext("eventSite") or "").strip(),
                "contactPoint": (item.findtext("contactPoint") or "").strip(),
                "url": (item.findtext("url") or "").strip(),
                "imageObject": (item.findtext("imageObject") or "").strip(),
                "description": (item.findtext("description") or "").strip(),
            })
        print(f"  페이지 {page} 수집 ({len(items)}/{total_count})", flush=True)
        if len(items) >= total_count:
            break
        page += 1
        time.sleep(0.2)

    if items:
        _save_raw_cache(items)
    return items


async def scrape_culture_api_concert() -> list[dict]:
    if not CULTURE_API_KEY:
        print("⚠️ CULTURE_API_KEY가 설정되지 않았습니다.")
        return []

    print("🏛️ 문체부 통합 공연 API 수집 중...")
    raw_items = _fetch_all_raw()
    print(f"📦 전국 {len(raw_items)}건 수신.")

    today_str = date.today().strftime("%Y%m%d")
    seen_titles: set[str] = set()
    results: list[dict] = []

    for it in raw_items:
        title = it["title"]
        if not title or title in seen_titles:
            continue
        if not _is_active(it["eventPeriod"], today_str):
            continue
        region = _classify_region(title, it["eventSite"])
        if region is None:
            continue
        seen_titles.add(title)

        end_date = _parse_end_date(it["eventPeriod"])
        clean_title = _TAG_PATTERN.sub("", title).strip()
        description = re.sub(r"<[^>]+>", "", it["description"]).strip()

        content_parts = [f"[{it['eventSite']}] {clean_title}"]
        if it["eventPeriod"]:
            content_parts.append(f"기간: {it['eventPeriod']}")
        if it["contactPoint"]:
            content_parts.append(f"문의: {it['contactPoint']}")
        if description:
            content_parts.append(description)

        results.append({
            "title": clean_title,
            "title_en": "",
            "location": it["eventSite"] or ("제주" if region == "제주" else "서울"),
            "content": " | ".join(content_parts),
            "content_en": "",
            "latitude": None,
            "longitude": None,
            "video_url": "",
            "naver_place_id": f"culture_{abs(hash(clean_title)) % 1000000}",
            "image_url": it["imageObject"],
            "region": region,
            "end_date_actual": end_date,
            "detail_url": it["url"],
        })

    print(f"✅ 진행중/예정 공연 {len(results)}건 정제 완료 (서울 {sum(1 for r in results if r['region']=='공연')} / 제주 {sum(1 for r in results if r['region']=='제주')}).")
    return results


if __name__ == "__main__":
    import asyncio
    res = asyncio.run(scrape_culture_api_concert())
    for r in res[:20]:
        print(f"  - [{r['region']}] [{r['location']}] {r['title']}")
