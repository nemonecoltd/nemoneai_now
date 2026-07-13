"""
네이버 지도 팝업스토어 검색 스크래퍼 v2.
map.naver.com의 allSearch(스크롤 기반, 1페이지=20개)는 운영기간이 없고 더 가져오려면
스크롤 자동화가 필요해 불안정했음. 대신 pcmap.place.naver.com/popupstore/list 페이지의
__APOLLO_STATE__(PopupstoreSearchBusinessItem)를 단일 요청으로 직접 읽음 — 스크롤 없이
한 번에 최대 ~79개(display 파라미터로도 더 안 늘어나는 자체 상한)를 운영기간까지 포함해 가져옴.
"""
import asyncio
import json
import re
from datetime import date
from typing import Optional

from playwright.async_api import async_playwright


def _parse_naver_date(s: Optional[str]) -> Optional[date]:
    """'26.06.16.' 형식(YY.MM.DD.)을 date로 변환."""
    if not s:
        return None
    m = re.match(r"(\d{2})\.(\d{2})\.(\d{2})", s.strip())
    if not m:
        return None
    yy, mm, dd = m.groups()
    try:
        return date(2000 + int(yy), int(mm), int(dd))
    except ValueError:
        return None


def _safe_float(val):
    try:
        return float(val) if val else None
    except (ValueError, TypeError):
        return None


async def scrape_naver_map_popups(query: str = "성수 팝업스토어", allowed_districts: Optional[list[str]] = None) -> list[dict]:
    """allowed_districts: 네이버 commonAddress(예: '서울 강남구')에 포함된 구 이름 리스트로 결과 필터링.
    None이면 필터링 없이 전체 반환 (검색 관련도로 넓게 잡히는 지역명 오염 방지용 — 예: '강남 팝업스토어' 검색이
    실제로는 성동구/강동구 결과를 대량 포함하는 경우)."""
    print(f"🗺️ [네이버지도] '{query}' 검색 시작 (popupstore/list)")
    encoded = query.replace(" ", "%20")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
        )
        page = await context.new_page()
        await page.goto(
            f"https://pcmap.place.naver.com/popupstore/list?query={encoded}&display=100",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        await page.wait_for_timeout(2500)
        html = await page.content()
        await page.close()
        await browser.close()

    m = re.search(r"window\.__APOLLO_STATE__\s*=\s*(\{.*?\});", html, re.S)
    if not m:
        print("⚠️ [네이버지도] 수집된 데이터 없음")
        return []

    apollo = json.loads(m.group(1))

    results = []
    for key, item in apollo.items():
        # PopupstoreSearchBusinessItem: 기간한정 팝업스토어(운영기간 있음)
        # PlaceListBusinessesItem: 네이버가 '팝업스토어' 업종이 아닌 일반 업체로 분류한 경우
        #   (원데이클래스/공방 체험 등 상시 운영 콘텐츠가 여기 해당 — 운영기간 필드 자체가 없음)
        # 한 쿼리 결과엔 둘 중 하나만 존재함(확인됨) — 섞여서 오염될 우려 없음
        if not (key.startswith("PopupstoreSearchBusinessItem:") or key.startswith("PlaceListBusinessesItem:")) or not isinstance(item, dict):
            continue
        name = (item.get("name") or "").strip()
        if not name:
            continue
        common_address = item.get("commonAddress") or ""
        if allowed_districts and not any(d in common_address for d in allowed_districts):
            continue
        place_id = str(item.get("id") or f"nmap_{hash(name) % 100000}")
        results.append({
            "naver_place_id": place_id,
            "title": name,
            "title_en": name,
            "location": item.get("roadAddress") or item.get("address") or "",
            "latitude": _safe_float(item.get("y")),
            "longitude": _safe_float(item.get("x")),
            "content": "",
            "content_en": "",
            "video_url": "",
            "image_url": item.get("imageUrl") or "",
            "start_date": _parse_naver_date(item.get("operationStartDateTime")),
            "end_date": _parse_naver_date(item.get("operationEndDateTime")),
        })

    matched = sum(1 for r in results if r["end_date"])
    print(f"✅ [네이버지도] 최종 {len(results)}개 수집 완료 (운영기간 매칭 {matched}개)")
    return results


if __name__ == "__main__":
    results = asyncio.run(scrape_naver_map_popups())
    for r in results:
        print(f"  - {r['title']} / {r['location']} / {r['start_date']}~{r['end_date']}")
