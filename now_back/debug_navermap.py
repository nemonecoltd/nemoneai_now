"""네이버 지도 API 엔드포인트 진단 스크립트 — 실제 호출되는 API를 캡처."""
import asyncio
import json
from playwright.async_api import async_playwright

async def debug():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
        )
        page = await context.new_page()

        captured = []

        async def on_response(response):
            url = response.url
            # JSON 응답 중 검색/장소 관련만 캡처
            if response.status == 200 and any(k in url for k in ['search', 'place', 'graphql', 'list']):
                ct = response.headers.get('content-type', '')
                if 'json' in ct:
                    try:
                        body = await response.json()
                        captured.append({'url': url, 'body': body})
                        print(f"[API] {url[:100]}")
                    except:
                        pass

        page.on('response', on_response)

        print("▶ 네이버 지도 접속 중...")
        await page.goto(
            "https://map.naver.com/p/search/성수%20팝업스토어",
            wait_until='domcontentloaded',
            timeout=30000
        )
        await page.wait_for_timeout(5000)

        print(f"\n▶ 로드된 프레임 목록:")
        for frame in page.frames:
            print(f"  {frame.url[:100]}")

        print(f"\n▶ 캡처된 API 응답 {len(captured)}개")
        # 가장 데이터가 많은 응답 출력
        for item in captured:
            body_str = json.dumps(item['body'], ensure_ascii=False)
            if len(body_str) > 500:  # 의미 있는 응답만
                print(f"\n--- URL: {item['url'][:100]} ---")
                print(body_str[:800])

        await browser.close()

asyncio.run(debug())
