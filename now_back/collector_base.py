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
    new_count = 0
    updated_count = 0
    fail_count = 0

    # 역순 INSERT: rank1이 마지막에 들어가 created_at이 가장 최신 → 서비스 최상단
    for item in reversed(deduped):
        with engine.connect() as conn:
            try:
                title = item["title"].strip()
                item_region = region or item["region"]
                print(f"  ✨ [{item_region}] '{title}' 처리 중...")

                embedding = get_embedding(item["content"])

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

                naver_place_id = item.get("naver_place_id")
                params = {
                    "title": title,
                    "title_en": item.get("title_en", title),
                    "content": item["content"],
                    "content_en": item.get("content_en", ""),
                    "location": item["location"],
                    "latitude": item.get("latitude"),
                    "longitude": item.get("longitude"),
                    "naver_place_id": naver_place_id,
                    "video_url": item.get("video_url", ""),
                    "image_url": item.get("image_url", ""),
                    "embedding": f"[{','.join(map(str, embedding))}]",
                    "end_date": end_date,
                    "real_end_date": real_end_date,
                    "date_range": item.get("date_range", ""),
                    "region": item_region,
                    "link_url": item.get("link_url"),
                }

                # naver_place_id가 같은데 title만 바뀐 경우(KOPIS가 공연명을 살짝 수정해 재게시하는 경우 등),
                # ON CONFLICT (title)만으로는 감지가 안 돼 naver_place_id UNIQUE 제약에 걸려 실패하던 문제 방지 —
                # naver_place_id 또는 title로 기존 행을 먼저 찾아 있으면 UPDATE(naver_place_id 갱신 포함), 없으면 INSERT.
                existing_id = conn.execute(
                    text("SELECT id FROM seongsu_places WHERE naver_place_id = :naver_place_id OR title = :title LIMIT 1"),
                    {"naver_place_id": naver_place_id, "title": title}
                ).scalar()

                if existing_id:
                    conn.execute(text("""
                        UPDATE seongsu_places SET
                            title = :title,
                            title_en = :title_en,
                            content = :content,
                            content_en = :content_en,
                            location = :location,
                            latitude = COALESCE(:latitude, latitude),
                            longitude = COALESCE(:longitude, longitude),
                            naver_place_id = :naver_place_id,
                            image_url = COALESCE(:image_url, image_url),
                            link_url = COALESCE(:link_url, link_url),
                            region = :region,
                            end_date = COALESCE(:real_end_date, end_date),
                            date_range = CASE WHEN :date_range != '' THEN :date_range ELSE date_range END,
                            created_at = CURRENT_TIMESTAMP
                        WHERE id = :id
                    """), {**params, "id": existing_id})
                    updated_count += 1
                else:
                    conn.execute(text("""
                        INSERT INTO seongsu_places
                        (title, title_en, content, content_en, location, latitude, longitude, naver_place_id, video_url, image_url, embedding, end_date, date_range, region, link_url)
                        VALUES (:title, :title_en, :content, :content_en, :location, :latitude, :longitude, :naver_place_id, :video_url, :image_url, :embedding, :end_date, :date_range, :region, :link_url)
                    """), params)
                    new_count += 1
                conn.commit()
            except Exception as e:
                conn.rollback()
                fail_count += 1
                print(f"  ❌ [{item_region}] '{item.get('title', '?')}' 반영 실패: {e}")

    return new_count, updated_count, fail_count


def cleanup_expired():
    """end_date가 지난 플레이스를 DB에서 삭제 (연결된 Supabase Storage 이미지도 같이 삭제).

    database.cleanup_expired_data()로 위임 — 서버 cron과 로컬 수집 스크립트가
    같은 정리 로직(이미지 삭제 포함)을 쓰도록 통합. 분리돼있으면 로컬에서 먼저
    DB row를 지워버려 서버 cron이 이미지를 못 찾는 고아 이미지 문제가 생김.
    """
    cleanup_expired_data()
