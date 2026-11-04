import asyncio
import os
import json
import google.generativeai as genai
from playwright.async_api import async_playwright
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
# 일관된 프로젝트 사용 모델 유지
gemini_model = genai.GenerativeModel("models/gemini-2.5-flash")   # 2026-11-04: pro-latest → flash

async def scrape_theme(keyword: str = "보이넥스트도어"):
    """[PoC] 네이버 뉴스와 유튜브 검색 결과를 통합 스크래핑"""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        raw_text = ""

        # 1. 네이버 뉴스 검색 (공식 방문, 팝업, 이벤트 위주)
        news_url = f"https://search.naver.com/search.naver?where=news&query={keyword}&sm=tab_opt&sort=1"
        print(f"🌐 네이버 뉴스 검색 중... '{news_url}'")
        try:
            await page.goto(news_url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)
            news_elements = await page.query_selector_all(".news_tit, .news_dsc")
            raw_text += "[네이버 뉴스 검색 결과]\n"
            for el in news_elements[:20]:
                text = await el.inner_text()
                raw_text += text + "\n"
        except Exception as e:
            print(f"🚨 네이버 뉴스 스크래핑 오류: {e}")

        # 2. 유튜브 검색 (Vlog, 방문기, 목격담 위주)
        yt_url = f"https://www.youtube.com/results?search_query={keyword}+방문+장소"
        print(f"🎥 유튜브 검색 중... '{yt_url}'")
        try:
            await page.goto(yt_url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)
            
            # 유튜브 제목과 설명 메타데이터 수집
            yt_elements = await page.query_selector_all("#video-title, #description-text")
            raw_text += "\n[유튜브 검색 결과 (Vlog, 목격담)]\n"
            for el in yt_elements[:20]:
                text = await el.inner_text()
                raw_text += text + "\n"
        except Exception as e:
            print(f"🚨 유튜브 스크래핑 오류: {e}")

        finally:
            await browser.close()
        
        if len(raw_text.strip()) < 50:
            print(f"⚠️ '{keyword}' 관련 추출된 텍스트가 너무 적습니다.")
            return []

        prompt = f"""
        당신은 연예인 팬덤 투어(성지순례) 큐레이터입니다. 
        아래의 '네이버 뉴스'와 '유튜브' 검색 결과를 종합하여 분석하고, 
        '{keyword}' 멤버들이 방문했거나 밀접한 관련이 있는 '구체적인 상업 시설이나 장소(카페, 식당, 팝업스토어, 팝업 장소 등)' 정보를 추출해주세요.

        [데이터 필드]
        - title: 장소 이름 (상호명, 정확히)
        - content: 해당 장소와 관련된 이슈 (누가 언제 방문했는지, 유튜브/뉴스에 어떻게 소개되었는지 등 상세히)
        - location: 뉴스나 유튜브에 언급된 위치 정보 (동 단위까지만이라도, 없으면 "확인 필요")
        - date_range: 방문 시기 혹은 관련 이벤트 기간 (예: 2024.10.12 방문)
        - image_url: "https://picsum.photos/seed/theme/400/300" (플레이스홀더 유지)

        [주의사항]
        1. 단순한 언급이 아닌, 실제로 방문했거나 행사가 열린 장소만 포함할 것.
        2. 장소 이름이 너무 뭉뚱그려진 경우(예: 어느 식당)는 제외할 것.
        3. 오직 JSON 리스트 형식으로만 응답할 것. 다른 텍스트는 출력하지 마세요.

        [텍스트 데이터]
        {raw_text}
        """
        
        print(f"🧠 Gemini가 '{keyword}' 관련 네이버/유튜브 통합 데이터를 분석 중입니다...")
        response = gemini_model.generate_content(prompt)
        
        try:
            content = response.text
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            return json.loads(content.strip())
        except Exception as e:
            print(f"❌ JSON 정제 실패: {e}\n응답내용: {response.text[:200]}")
            return []

async def save_theme_to_db(data, theme_id="보넥도"):
    """추출된 데이터를 DB에 '보넥도' region으로 저장 (수동 편집용)"""
    from database import engine
    from sqlalchemy import text
    from gemini_service import get_embedding

    with engine.connect() as conn:
        for item in data:
            print(f"💾 '{item['title']}' 저장 중...")
            try:
                emb = get_embedding(item['content'])
                emb_str = f"[{','.join(map(str, emb))}]"

                # 중복 확인
                check_query = text("SELECT id FROM seongsu_places WHERE title = :title AND region = :region")
                existing = conn.execute(check_query, {"title": item['title'], "region": theme_id}).fetchone()
                
                if existing:
                    print(f"ℹ️ 이미 존재하는 장소입니다. 건너뜁니다.")
                    continue

                query = text("""
                    INSERT INTO seongsu_places (title, content, location, date_range, image_url, embedding, region, latitude, longitude)
                    VALUES (:title, :content, :location, :date_range, :image_url, :embedding, :region, 0.0, 0.0)
                """)
                conn.execute(query, {
                    "title": item['title'],
                    "content": item['content'],
                    "location": item['location'],
                    "date_range": item['date_range'],
                    "image_url": item['image_url'],
                    "embedding": emb_str,
                    "region": theme_id
                })
            except Exception as e:
                print(f"❌ 저장 실패 ({item['title']}): {e}")
        conn.commit()
    print(f"✅ DB 저장 완료 (Region: {theme_id})")

if __name__ == "__main__":
    keyword = "보이넥스트도어"
    loop = asyncio.get_event_loop()
    found_places = loop.run_until_complete(scrape_theme(keyword))
    
    if found_places:
        print(f"✨ 분석 결과: {json.dumps(found_places, ensure_ascii=False, indent=2)}")
        loop.run_until_complete(save_theme_to_db(found_places, "보넥도"))
    else:
        print("📭 장소 정보를 찾지 못했습니다.")
