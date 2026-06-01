import asyncio
from sqlalchemy import text
from database import engine
from scraper_naver_map_v2 import scrape_naver_map_popups
from scraper_seoul_api_concert import scrape_seoul_api_concert
from gemini_service import get_embedding
from datetime import date, timedelta


def dedup_by_title(items: list[dict]) -> list[dict]:
    """같은 배치 내 타이틀 중복 제거 (첫 번째 항목 유지)"""
    seen = {}
    for item in items:
        title = item.get("title", "").strip()
        if title and title not in seen:
            seen[title] = item
    return list(seen.values())


def upsert_items(combined_data: list[dict], region: str):
    deduped = dedup_by_title(combined_data)
    print(f"📋 [{region}] 중복 제거 후 {len(deduped)}개 처리 (원본 {len(combined_data)}개)")

    for item in deduped:
        with engine.connect() as conn:
            try:
                title = item["title"].strip()
                print(f"  ✨ [{region}] '{title}' 처리 중...")

                embedding = get_embedding(item["content"])

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
                    "title_en": item.get("title_en", title),
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
                    "region": region,
                })
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"  ❌ [{region}] '{item.get('title', '?')}' 반영 실패: {e}")


async def run_seongsu():
    print("\n🚀 [성수] 수집 시작")
    try:
        result = await scrape_naver_map_popups("성수 팝업스토어")
        if result:
            upsert_items(result, "성수")
    except Exception as e:
        print(f"  ⚠️ [네이버지도] 수집 실패: {e}")
    print("✅ [성수] 완료")


async def run_hongdae():
    print("\n🚀 [홍대] 수집 시작")
    try:
        result = await scrape_naver_map_popups("홍대 팝업스토어")
        if result:
            upsert_items(result, "홍대")
    except Exception as e:
        print(f"  ⚠️ [네이버지도] 수집 실패: {e}")
    print("✅ [홍대] 완료")


async def run_concert():
    print("\n🎭 [공연] 수집 시작")
    try:
        combined = await scrape_seoul_api_concert()
    except Exception as e:
        print(f"  ⚠️ [서울시API] 수집 실패: {e}")
        return
    if combined:
        upsert_items(combined, "공연")
    print("✅ [공연] 완료")


async def run_all():
    print("=" * 50)
    print("🌐 지금 여기 전체 수집 시작")
    print("=" * 50)
    await run_seongsu()
    await run_hongdae()
    await run_concert()
    print("\n" + "=" * 50)
    print("🏁 전체 수집 완료")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(run_all())
