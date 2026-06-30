"""
네이버 지도 스크래퍼 결과 → AI 소개 생성 → DB upsert
"""
import asyncio
from datetime import date, timedelta
from sqlalchemy import text
from scraper_naver_map_v2 import scrape_naver_map_popups
from gemini_service import get_embedding, generate_answer
from database import engine


def ai_generate_intro(title: str, location: str, category: str = "") -> str:
    """제목+위치로 Gemini가 2~3문장 한국어 소개 생성"""
    prompt = f"""다음 팝업스토어/장소의 소개 문구를 2~3문장으로 작성해줘.
- 장소명: {title}
- 위치: {location}
- 카테고리: {category or '팝업스토어'}
규칙:
- 방문자 입장에서 매력적으로
- 사실만 (모르면 일반적인 표현 사용)
- 이모지 없이 한국어로만
소개:"""
    try:
        from google import genai
        from google.genai import types
        import os
        from dotenv import load_dotenv
        load_dotenv()
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        text = response.text.strip()
        return text[:400] if text else ""
    except Exception as e:
        print(f"    ⚠️ AI 생성 실패: {e}")
        return ""


async def main():
    print("🗺️ 네이버 지도 수집 시작...")
    items = await scrape_naver_map_popups("성수 팝업스토어")
    print(f"  수집: {len(items)}개\n")

    with engine.connect() as conn:
        for item in items:
            title = item["title"].strip()
            location = item.get("location", "")
            print(f"  처리 중: {title}")

            # AI 소개 생성
            intro = ai_generate_intro(title, location)
            naver_url = f"https://map.naver.com/p/entry/place/{item.get('naver_place_id', '')}"
            link_line = f"네이버 지도 바로가기: {naver_url}"
            if intro:
                print(f"    소개: {intro[:60]}...")
                item["content"] = "\n\n".join([intro, link_line])
            else:
                print(f"    소개 생성 실패, 링크만 저장")
                item["content"] = link_line

            try:
                embedding = get_embedding(item["content"])
                end_date = date.today() + timedelta(days=30)

                conn.execute(text("""
                    INSERT INTO seongsu_places
                    (title, title_en, content, content_en, location, latitude, longitude, naver_place_id, video_url, image_url, embedding, end_date, region)
                    VALUES (:title, :title_en, :content, :content_en, :location, :latitude, :longitude, :naver_place_id, :video_url, :image_url, :embedding, :end_date, :region)
                    ON CONFLICT (naver_place_id)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        title = EXCLUDED.title,
                        title_en = EXCLUDED.title_en,
                        location = EXCLUDED.location,
                        latitude = COALESCE(EXCLUDED.latitude, seongsu_places.latitude),
                        longitude = COALESCE(EXCLUDED.longitude, seongsu_places.longitude),
                        image_url = COALESCE(EXCLUDED.image_url, seongsu_places.image_url),
                        region = EXCLUDED.region,
                        created_at = CURRENT_TIMESTAMP
                """), {
                    "title": title,
                    "title_en": item.get("title_en", title),
                    "content": item["content"],
                    "content_en": "",
                    "location": location,
                    "latitude": item.get("latitude"),
                    "longitude": item.get("longitude"),
                    "naver_place_id": item.get("naver_place_id"),
                    "video_url": item.get("video_url", ""),
                    "image_url": item.get("image_url", ""),
                    "embedding": f"[{','.join(map(str, embedding))}]",
                    "end_date": end_date,
                    "region": "성수",
                })
                conn.commit()
                print(f"    ✅ DB 저장 완료")
            except Exception as e:
                conn.rollback()
                print(f"    ❌ 저장 실패: {e}")

    print("\n완료!")


if __name__ == "__main__":
    asyncio.run(main())
