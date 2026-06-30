from typing import Optional
from sqlalchemy import text
from database import engine, cleanup_expired_data
from gemini_service import get_embedding
from datetime import date, timedelta


def dedup_by_title(items: "list[dict]") -> "list[dict]":
    seen = {}
    for item in items:
        title = item.get("title", "").strip()
        if title and title not in seen:
            seen[title] = item
    return list(seen.values())


def upsert_items(combined_data: "list[dict]", region: Optional[str] = None):
    """region을 지정하면 모든 항목에 고정 적용, None이면 항목별 item['region']을 사용."""
    deduped = dedup_by_title(combined_data)
    print(f"📋 [{region or '항목별'}] 중복 제거 후 {len(deduped)}개 처리 (원본 {len(combined_data)}개)")

    # 역순 INSERT: rank1이 마지막에 들어가 created_at이 가장 최신 → 서비스 최상단
    for item in reversed(deduped):
        with engine.connect() as conn:
            try:
                title = item["title"].strip()
                item_region = region or item["region"]
                print(f"  ✨ [{item_region}] '{title}' 처리 중...")

                embedding = get_embedding(item["content"])

                upsert_query = text("""
                    INSERT INTO seongsu_places
                    (title, title_en, content, content_en, location, latitude, longitude, naver_place_id, video_url, image_url, embedding, end_date, date_range, region)
                    VALUES (:title, :title_en, :content, :content_en, :location, :latitude, :longitude, :naver_place_id, :video_url, :image_url, :embedding, :end_date, :date_range, :region)
                    ON CONFLICT (title)
                    DO UPDATE SET
                        title_en = EXCLUDED.title_en,
                        content_en = EXCLUDED.content_en,
                        location = EXCLUDED.location,
                        latitude = COALESCE(EXCLUDED.latitude, seongsu_places.latitude),
                        longitude = COALESCE(EXCLUDED.longitude, seongsu_places.longitude),
                        content = EXCLUDED.content,
                        image_url = COALESCE(EXCLUDED.image_url, seongsu_places.image_url),
                        region = EXCLUDED.region,
                        end_date = COALESCE(:real_end_date, seongsu_places.end_date),
                        date_range = CASE WHEN EXCLUDED.date_range != '' THEN EXCLUDED.date_range ELSE seongsu_places.date_range END,
                        created_at = CURRENT_TIMESTAMP
                """)

                # end_date: 실제 행사 종료일(date 객체 또는 ISO 문자열) 우선, 못 구하면 +30일 임시값.
                # 재수집 시에도 실제 값이 없으면 기존 end_date를 덮어쓰지 않음(real_end_date=None → COALESCE로 보존).
                end_date_actual = item.get("end_date_actual")
                real_end_date = None
                if isinstance(end_date_actual, date):
                    real_end_date = end_date_actual
                elif end_date_actual:
                    try:
                        real_end_date = date.fromisoformat(end_date_actual)
                    except ValueError:
                        real_end_date = None
                end_date = real_end_date or (date.today() + timedelta(days=30))

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
                    "end_date": end_date,
                    "real_end_date": real_end_date,
                    "date_range": item.get("date_range", ""),
                    "region": item_region,
                })
                conn.commit()
            except Exception as e:
                conn.rollback()
                print(f"  ❌ [{item_region}] '{item.get('title', '?')}' 반영 실패: {e}")


def cleanup_expired():
    """end_date가 지난 플레이스를 DB에서 삭제 (연결된 Supabase Storage 이미지도 같이 삭제).

    database.cleanup_expired_data()로 위임 — 서버 cron과 로컬 수집 스크립트가
    같은 정리 로직(이미지 삭제 포함)을 쓰도록 통합. 분리돼있으면 로컬에서 먼저
    DB row를 지워버려 서버 cron이 이미지를 못 찾는 고아 이미지 문제가 생김.
    """
    cleanup_expired_data()
