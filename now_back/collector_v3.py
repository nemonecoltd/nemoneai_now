import asyncio
from sqlalchemy import text
from database import engine
from scraper_naver_map_v2 import scrape_naver_map_popups
from scraper_seoul_api import scrape_seoul_api
from scraper_popga import scrape_popga
from gemini_service import get_embedding
from datetime import date, timedelta

async def run_v3_collection():
    print("🚀 [V3-SEONGSU] 성수동 하이브리드 수집 가동")
    
    # 1. 수집원 A: 네이버 맵 (SNS 유행 팝업/공연)
    # 2. 수집원 B: 서울시 API (공식 문화행사)
    # 3. 수집원 C: 팝가 매거진 (성수 팝업)
    tasks = [scrape_naver_map_popups(), scrape_seoul_api(), scrape_popga()]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    combined_data = []
    names = ["네이버맵", "서울시API", "팝가"]
    for name, result in zip(names, results):
        if isinstance(result, Exception):
            print(f"⚠️ [{name}] 수집 실패 (건너뜀): {result}")
        else:
            combined_data += result
    
    if not combined_data:
        print("⚠️ 성수동 수집된 데이터가 전혀 없습니다.")
        return

    print(f"📦 총 {len(combined_data)}개의 성수 데이터를 처리합니다.")

    for item in combined_data:
        with engine.connect() as conn:
            try:
                title = item['title'].strip()
                print(f"✨ [성수] '{title}' 처리 중...")
                
                embedding = get_embedding(item['content'])
                
                upsert_query = text("""
                    INSERT INTO seongsu_places
                    (title, title_en, content, content_en, location, latitude, longitude, naver_place_id, video_url, image_url, embedding, end_date, region)
                    VALUES (:title, :title_en, :content, :content_en, :location, :latitude, :longitude, :naver_place_id, :video_url, :image_url, :embedding, :end_date, :region)
                    ON CONFLICT (title)
                    DO UPDATE SET
                        title_en = EXCLUDED.title_en,
                        content_en = EXCLUDED.content_en,
                        location = EXCLUDED.location,
                        latitude = COALESCE(EXCLUDED.latitude, seongsu_places.latitude),
                        longitude = COALESCE(EXCLUDED.longitude, seongsu_places.longitude),
                        content = EXCLUDED.content,
                        image_url = COALESCE(EXCLUDED.image_url, seongsu_places.image_url),
                        region = EXCLUDED.region
                """)

                conn.execute(upsert_query, {
                    "title": title,
                    "title_en": item.get('title_en', title),
                    "content": item['content'],
                    "content_en": item.get('content_en', ""),
                    "location": item['location'],
                    "latitude": item['latitude'],
                    "longitude": item['longitude'],
                    "naver_place_id": item.get('naver_place_id'),
                    "video_url": item.get('video_url', ""),
                    "image_url": item.get('image_url', ""),
                    "embedding": f"[{','.join(map(str, embedding))}]",
                    "end_date": date.today() + timedelta(days=30),
                    "region": "성수"
                })
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"❌ 성수 '{title}' 반영 실패: {e}")

    print("✅ [V3-SEONGSU] 수집 및 동기화 완료.")

if __name__ == "__main__":
    asyncio.run(run_v3_collection())
