import asyncio
from playwright.async_api import async_playwright
import nest_asyncio

nest_asyncio.apply()

async def scrape_popga():
    print("🚀 [POPGA] 팝가 매거진 스크래핑 시작")
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto("https://popga.co.kr/content/magazine/201", wait_until='domcontentloaded', timeout=60000)

        popups_data = await page.evaluate('''() => {
            const results = [];
            const h2_elements = Array.from(document.querySelectorAll('h2'));
            h2_elements.forEach(h2 => {
                const titleText = h2.innerText;
                if (/^\\d+\\./.test(titleText)) {
                    let node = h2.nextElementSibling;
                    let thumbnail = "";
                    let location = "";
                    let date = "";
                    
                    while (node && node.tagName !== 'H2') {
                        if (node.tagName === 'P') {
                            const img = node.querySelector('img');
                            if (img && !thumbnail) thumbnail = img.src;
                        }
                        if (node.tagName === 'UL') {
                            const lis = node.querySelectorAll('li');
                            lis.forEach(li => {
                                const text = li.innerText;
                                if (text.includes('위치:')) location = text.replace('위치:', '').trim();
                                if (text.includes('기간:')) date = text.replace('기간:', '').trim();
                            });
                        }
                        node = node.nextElementSibling;
                    }
                    
                    // 정규식으로 '1. [타이틀]' 형태에서 타이틀만 추출
                    let cleanTitle = titleText.replace(/^\\d+\\.\\s*\\[?/, '').replace(/\\]$/, '').trim();
                    
                    results.push({
                        title: cleanTitle,
                        date: date,
                        location: location,
                        thumbnail: thumbnail,
                        content: `기간: ${date}\\n장소: ${location}`,
                        latitude: null,
                        longitude: null
                    });
                }
            });
            return results;
        }''')

        print(f"📦 {len(popups_data)}개의 팝업 데이터 추출 성공")
        await browser.close()
    
    print(f"✅ [POPGA] 스크래핑 완료.")
    return popups_data

if __name__ == '__main__':
    results = asyncio.run(scrape_popga())
    for res in results:
        print(res)