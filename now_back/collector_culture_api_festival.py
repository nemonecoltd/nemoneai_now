import asyncio
from sqlalchemy import text
from database import engine
from scraper_culture_api_festival import scrape_culture_api_festival
from gemini_service import get_embedding
from datetime import date, timedelta


async def run_culture_api_festival_collection():
    print("🎪 [문체부 축제API] 전국 축제 수집 가동")

    try:
        items = await scrape_culture_api_festival()
    except Exception as e:
        print(f"⚠️ [문체부 축제API] 축제 수집 실패: {e}")
        return

    if not items:
        print("⚠️ 수집된 축제 데이터가 없습니다.")
        return

    print(f"📦 총 {len(items)}개의 축제 데이터를 처리합니다.")

    for item in items:
        with engine.connect() as conn:
            try:
                title = item["title"].strip()
                if not title:
                    continue
                print(f"✨ [{item['region']}] '{title}' 처리 중...")

                embedding = get_embedding(item["content"])

                end_date = item.get("end_date_actual") or (date.today() + timedelta(days=30))

                upsert_query = text("""
                    INSERT INTO seongsu_places
                    (title, title_en, content, content_en, location, latitude, longitude, naver_place_id, video_url, image_url, embedding, end_date, region)
                    VALUES (:title, :title_en, :content, :content_en, :location, :latitude, :longitude, :naver_place_id, :video_url, :image_url, :embedding, :end_date, :region)
                    ON CONFLICT (title)
                    DO UPDATE SET
                        content = EXCLUDED.content,
                        location = EXCLUDED.location,
                        image_url = COALESCE(EXCLUDED.image_url, seongsu_places.image_url),
                        end_date = EXCLUDED.end_date,
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
                    "end_date": end_date,
                    "region": item["region"],
                })
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"❌ 축제 '{title}' 반영 실패: {e}")
            await asyncio.sleep(0.3)  # Gemini embedding API rate limit 방지

    print("✅ 문체부 축제API 수집 및 동기화 완료.")


if __name__ == "__main__":
    asyncio.run(run_culture_api_festival_collection())
