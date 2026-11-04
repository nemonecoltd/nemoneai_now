import asyncio
import os
import json
import google.generativeai as genai
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
gemini_model = genai.GenerativeModel("models/gemini-2.5-flash")   # 2026-11-04: pro-latest → flash

async def scrape_popup(region: str = "성수동"):
    """[지침] 지정된 지역의 팝업스토어 정보를 스크래핑"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # 사람처럼 보이게 하기 위해 User-Agent 설정
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        # 타겟 URL: 지역별 검색 결과
        search_url = f"https://search.naver.com/search.naver?query={region}+팝업스토어+일정&where=nextrea"
        print(f"🌐 '{search_url}' 접속 중...")
        
        try:
            await page.goto(search_url, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(3000)

            # 더 포괄적인 셀렉터들 (제목, 요약문, 블로그 내용 등)
            selectors = [
                ".news_tit", ".api_txt_lines", ".title_link", 
                ".dsc_txt", ".total_tit", ".elss.sub_tit"
            ]
            
            raw_text = ""
            for selector in selectors:
                elements = await page.query_selector_all(selector)
                for el in elements[:10]:
                    text = await el.inner_text()
                    if text.strip():
                        raw_text += text + "\n"
            
            # 페이지 전체 텍스트 일부 추가 (보험용)
            body_text = await page.inner_text("body")
            raw_text += body_text[:2000] # 너무 길면 Gemini가 힘들어하므로 앞부분만

        except Exception as e:
            print(f"🚨 브라우저 제어 오류: {e}")
        finally:
            await browser.close()
        
        if len(raw_text.strip()) < 50:
            print(f"⚠️ {region} 추출된 텍스트가 너무 적습니다. 재시도 필요.")
            return []

        prompt = f"""
        아래는 '{region} 팝업스토어' 검색 결과 텍스트야. 여기서 현재 혹은 다가오는 팝업스토어 정보를 정확히 추출해줘.
        필드명: title, location, date_range, content, image_url, video_url
        [텍스트 데이터]
        {raw_text}
        
        *주의사항:
        1. 존재하지 않는 정보(image_url 등)는 null 대신 적절한 샘플 이미지 주소(https://picsum.photos/400/300)를 넣어줘.
        2. date_range는 가능한 'YYYY.MM.DD~YYYY.MM.DD' 형식을 지켜줘.
        3. 실존하는 팝업스토어 정보만 최대 30개 추출할 것.
        4. 오직 JSON만 응답해.
        """
        
        print(f"🧠 Gemini가 {region} 데이터를 정제하고 일정을 분석 중입니다...")
        response = gemini_model.generate_content(prompt)
        
        try:
            # 마크다운 및 불필요한 텍스트 제거
            content = response.text
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            return json.loads(content.strip())
        except Exception as e:
            print(f"❌ JSON 정제 실패: {e}\n응답내용: {response.text[:100]}")
            return []

if __name__ == "__main__":
    # 테스트 실행
    for r in ["성수동", "홍대"]:
        result = asyncio.run(scrape_popup(r))
        print(f"--- {r} 결과 ({len(result)}개) ---")
        # print(json.dumps(result, indent=2, ensure_ascii=False))
