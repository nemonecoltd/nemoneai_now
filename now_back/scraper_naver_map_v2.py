"""
네이버 지도 팝업스토어 검색 스크래퍼 v2.
DOM 파싱 대신 브라우저가 호출하는 allSearch API 응답을 직접 가로채서 사용.
"""
import asyncio
from playwright.async_api import async_playwright

_DETAIL_CONCURRENCY = 1  # 순차 방문 — 차단 방지


async def scrape_naver_map_popups(query: str = "성수 팝업스토어") -> list[dict]:
    print(f"🗺️ [네이버지도] '{query}' 검색 시작")
    raw_items: list[dict] = []
    seen_ids: set[str] = set()

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
                    new_items = [p for p in places if str(p.get("id", "")) not in seen_ids]
                    for item in new_items:
                        seen_ids.add(str(item.get("id", "")))
                        raw_items.append(item)
                    if new_items:
                        total = (data["result"]["place"] or {}).get("totalCount", "?")
                        print(f"  ✅ +{len(new_items)}개 수집 (누적 {len(raw_items)}개 / 전체 {total}개)")
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

        # 마우스 휠로 결과 패널 스크롤 (최대 20회 — 20개씩 × 20 = 400개)
        for scroll_attempt in range(20):
            prev_count = len(raw_items)
            # 좌측 결과 패널 위치(x=300)에서 마우스 휠 스크롤
            await page.mouse.move(300, 400)
            await page.mouse.wheel(0, 3000)
            await page.wait_for_timeout(2500)
            if len(raw_items) == prev_count:
                print(f"  ℹ️ 스크롤 {scroll_attempt + 1}회 후 추가 결과 없음, 완료")
                break
            print(f"  🔄 스크롤 {scroll_attempt + 1}회: 누적 {len(raw_items)}개")

        await page.close()
        await browser.close()

    if not raw_items:
        print("⚠️ [네이버지도] 수집된 데이터 없음")
        return []

    results = []
    for item in raw_items:
        name = item.get("name", "").strip()
        if not name:
            continue
        place_id = str(item.get("id", f"nmap_{hash(name) % 100000}"))
        intro = ""
        results.append({
            "naver_place_id": place_id,
            "title": name,
            "title_en": item.get("nameEn") or name,
            "location": item.get("roadAddress") or item.get("address") or "성수동",
            "latitude": _safe_float(item.get("y")),
            "longitude": _safe_float(item.get("x")),
            "content": _build_content(item, intro),
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


def _build_content(item: dict, intro: str = "") -> str:
    return intro or ""


if __name__ == "__main__":
    results = asyncio.run(scrape_naver_map_popups())
    for r in results:
        print(f"  - {r['title']} / {r['location']}")
        if r["content"]:
            print(f"    {r['content'][:120]}")
