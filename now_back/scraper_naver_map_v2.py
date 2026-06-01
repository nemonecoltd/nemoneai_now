"""
네이버 지도 팝업스토어 검색 스크래퍼 v2.
DOM 파싱 대신 브라우저가 호출하는 allSearch API 응답을 직접 가로채서 사용.
1페이지(최대 20개) 수집.
"""
import asyncio
from playwright.async_api import async_playwright


async def scrape_naver_map_popups(query: str = "성수 팝업스토어") -> list[dict]:
    print(f"🗺️ [네이버지도] '{query}' 검색 시작")
    raw_items: list[dict] = []

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

        async def on_response(response):
            if "allSearch" in response.url and response.status == 200:
                try:
                    data = await response.json()
                    places = (data.get("result", {}).get("place") or {}).get("list", [])
                    if places:
                        raw_items.extend(places)
                        total = (data["result"]["place"] or {}).get("totalCount", "?")
                        print(f"  ✅ {len(places)}개 수집 (서버 전체: {total}개)")
                except Exception as e:
                    print(f"  ⚠️ 응답 파싱 실패: {e}")

        page.on("response", on_response)

        encoded = query.replace(" ", "%20")
        await page.goto(
            f"https://map.naver.com/p/search/{encoded}",
            wait_until="domcontentloaded",
            timeout=30000,
        )
        await page.wait_for_timeout(4000)
        await browser.close()

    if not raw_items:
        print("⚠️ [네이버지도] 수집된 데이터 없음")
        return []

    results = []
    for item in raw_items:
        name = item.get("name", "").strip()
        if not name:
            continue
        results.append({
            "naver_place_id": item.get("id", f"nmap_{hash(name) % 100000}"),
            "title": name,
            "title_en": item.get("nameEn") or name,
            "location": item.get("roadAddress") or item.get("address") or "성수동",
            "latitude": _safe_float(item.get("y")),
            "longitude": _safe_float(item.get("x")),
            "content": _build_content(item),
            "content_en": "",
            "video_url": "",
            "image_url": item.get("thumUrl") or "",
        })

    print(f"✅ [네이버지도] 최종 {len(results)}개 수집 완료")
    return results


def _safe_float(val):
    try:
        return float(val) if val else None
    except (ValueError, TypeError):
        return None


def _build_content(item: dict) -> str:
    parts = []
    if item.get("category"):
        parts.append(f"카테고리: {item['category']}")
    if item.get("roadAddress") or item.get("address"):
        parts.append(f"주소: {item.get('roadAddress') or item.get('address')}")
    if item.get("businessStatus"):
        status = item["businessStatus"].get("status", {})
        if status.get("text"):
            parts.append(f"영업: {status['text']}")
    if item.get("tel"):
        parts.append(f"전화: {item['tel']}")
    return " | ".join(parts) if parts else name if (name := item.get("name", "")) else ""


if __name__ == "__main__":
    results = asyncio.run(scrape_naver_map_popups())
    for r in results:
        print(f"  - {r['title']} / {r['location']}")
