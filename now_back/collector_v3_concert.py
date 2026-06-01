import asyncio
from sqlalchemy import text
from database import engine
from scraper_seoul_api_concert import scrape_seoul_api_concert
from gemini_service import get_embedding
from datetime import date, timedelta

async def run_concert_collection():
    print("🎭 [CONCERT] 서울 공연 수집 가동")

    try:
        combined_data = await scrape_seoul_api_concert()
    except Exception as e:
        print(f"⚠️ [서울시API] 공연 수집 실패: {e}")
        return

    if not combined_data:
        print("⚠️ 공연 수집 데이터가 없습니다.")
        return

    print(f"📦 총 {len(combined_data)}개의 공연 데이터를 처리합니다.")

    for item in combined_data:
        with engine.connect() as conn:
            try:
                title = item["title"].strip()
                print(f"✨ [공연] '{title}' 처리 중...")

                embedding = get_embedding(item["content"])

                upsert_query = text("""
                    INSERT INTO seongsu_places
                    (title, title_en, content, content_en, location, latitude, longitude, naver_place_id, video_url, image_url, embedding, end_date, region)
                    VALUES (:title, :title_en, :content, :content_en, :location, :latitude, :longitude, :naver_place_id, :video_url, :image_url, :embedding, :end_date, :region)
                    ON CONFLICT (title)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        location = EXCLUDED.location,
                        image_url = COALESCE(EXCLUDED.image_url, seongsu_places.image_url),
                        region = EXCLUDED.region
                """)

                conn.execute(upsert_query, {
                    "title": title,
                    "title_en": item.get("title_en", ""),
                    "content": item["content"],
                    "content_en": item.get("content_en", ""),
                    "location": item["location"],
                    "latitude": item.get("latitude"),
                    "longitude": item.get("longitude"),
                    "naver_place_id": item.get("naver_place_id"),
                    "video_url": item.get("video_url", ""),
                    "image_url": item.get("image_url", ""),
                    "embedding": f"[{','.join(map(str, embedding))}]",
                    "end_date": date.today() + timedelta(days=30),
                    "region": "공연",
                })
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"❌ 공연 '{title}' 반영 실패: {e}")

    print("✅ 공연 수집 및 동기화 완료.")

if __name__ == "__main__":
    asyncio.run(run_concert_collection())
