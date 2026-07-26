"""
scraper_seoul_exhibition.py — 서울시 열린데이터광장 문화행사 정보 API 중 '전시/미술' 카테고리만 수집.

배경: 기존 '강북 전시' 데이터는 비짓서울 API 기반인데, 실제 전시회가 아니라 미술관/전시장
'시설 정보'만 있어 랭킹에 실질적인 콘텐츠가 없었음(성수/홍대도 동일 문제, 3~4건뿐).
이 API는 실제 전시명·기간·이미지·공식링크가 있는 진짜 전시 정보를 제공.

- 서울시 전체 데이터라 자치구 세분화는 하지 않고 전부 region='강북'으로 고정 저장
  (랭킹 품질 개선이 목적, 지역 세분화는 추후 검토).
- API 자체에 다국어 필드가 없고 매주 정기 수집이라 매번 AI 번역 비용을 들이지 않음 —
  title_en/content_en 등을 생략하면 upsert_items()가 자동으로 한글 폴백.
- 데이터가 STRTDATE 내림차순(최신/예정 먼저, 과거 이력 뒤)으로 정렬돼 있어 앞쪽 페이지만
  훑어도 현재 진행중/예정 전시를 놓치지 않음 — 19,460건 전체를 다 받을 필요 없음.
- 결과가 많아도 100개만 랜덤 반영(품질 확인 단계, 추후 확대 검토).
"""
from __future__ import annotations

import os
import re
import random
from datetime import date, datetime

import requests
from dotenv import load_dotenv

load_dotenv()

SEOUL_API_KEY = os.getenv("SEOUL_API_KEY")
_PAGE_SIZE = 500
_MAX_PAGES = 6  # 최신순 정렬이라 3000건이면 현재 진행중/예정 전시는 전부 커버됨
_CULTCODE_PATTERN = re.compile(r"cultcode=(\d+)")


def _parse_dt(s: str) -> date | None:
    try:
        return datetime.strptime(s.strip()[:10], "%Y-%m-%d").date()
    except (ValueError, AttributeError):
        return None


def _fetch_exhibitions() -> list[dict]:
    if not SEOUL_API_KEY or SEOUL_API_KEY == "sample":
        print("⚠️ 서울시 API 키가 설정되지 않았습니다.")
        return []

    today = date.today()
    exhibitions = []
    for page in range(_MAX_PAGES):
        start = page * _PAGE_SIZE + 1
        end = start + _PAGE_SIZE - 1
        url = f"http://openAPI.seoul.go.kr:8088/{SEOUL_API_KEY}/json/culturalEventInfo/{start}/{end}/"
        print(f"🖼️ [서울시/전시] 수집 중 ({start}~{end})...")
        try:
            r = requests.get(url, timeout=15)
            if r.status_code != 200:
                print(f"  ❌ 응답 에러: {r.status_code}")
                break
            rows = r.json().get("culturalEventInfo", {}).get("row", [])
            if not rows:
                break
            exhibitions.extend(row for row in rows if row.get("CODENAME") == "전시/미술")
        except Exception as e:
            print(f"  ⚠️ 페이지 {page + 1} 수집 실패: {e}")
            break

    # 최신순 정렬이라 종료일이 today보다 한참 전인 행이 연속으로 나오기 시작하면 그 뒤는 전부 과거 이력
    active = [e for e in exhibitions if (_parse_dt(e.get("END_DATE", "")) or date.min) >= today]
    print(f"📦 [서울시/전시] 전시/미술 {len(exhibitions)}건 중 진행중/예정 {len(active)}건.")
    return active


async def scrape_seoul_exhibition() -> list[dict]:
    active = _fetch_exhibitions()
    if len(active) > 100:
        active = random.sample(active, 100)

    seen_titles: set[str] = set()
    results: list[dict] = []
    for e in active:
        title = (e.get("TITLE") or "").strip()
        if not title or title in seen_titles:
            continue
        seen_titles.add(title)

        place = e.get("PLACE", "") or "서울"
        guname = e.get("GUNAME", "")
        strt = _parse_dt(e.get("STRTDATE", ""))
        end = _parse_dt(e.get("END_DATE", ""))
        date_range = f"{strt.strftime('%Y.%m.%d.')} ~ {end.strftime('%Y.%m.%d.')}" if strt and end else ""

        content_parts = [f"[{guname or '서울'}] {place}"]
        if date_range:
            content_parts.append(f"기간: {date_range}")
        if e.get("PRO_TIME"):
            content_parts.append(f"운영시간: {e['PRO_TIME']}")
        if e.get("IS_FREE"):
            content_parts.append(f"요금: {e['IS_FREE']}" + (f" ({e['USE_FEE']})" if e.get("USE_FEE") else ""))
        if e.get("ETC_DESC"):
            content_parts.append(re.sub(r"<[^>]+>", "", e["ETC_DESC"]).strip())
        content_parts.append("<출처 : 서울 열린데이터광장 제공>")

        cultcode_match = _CULTCODE_PATTERN.search(e.get("HMPG_ADDR", ""))
        naver_place_id = f"seoulex_{cultcode_match.group(1)}" if cultcode_match else f"seoulex_{abs(hash(title)) % 1000000}"

        results.append({
            "title": title,
            "location": place,
            "content": " | ".join(content_parts),
            "latitude": float(e["LAT"]) if e.get("LAT") else None,
            "longitude": float(e["LOT"]) if e.get("LOT") else None,
            "naver_place_id": naver_place_id,
            "image_url": e.get("MAIN_IMG", "") or "",
            "region": "강북",
            "category": "전시",
            "end_date_actual": end,
            "date_range": date_range,
            "link_url": e.get("ORG_LINK") or e.get("HMPG_ADDR") or "",
        })

    print(f"✅ [서울시/전시] {len(results)}건 정제 완료.")
    return results


if __name__ == "__main__":
    import asyncio
    res = asyncio.run(scrape_seoul_exhibition())
    for r in res[:20]:
        print(f"  - {r['title']} ({r['date_range']})")
