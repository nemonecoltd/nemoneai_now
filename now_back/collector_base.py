from typing import Optional
from sqlalchemy import text
from database import engine, cleanup_expired_data
from gemini_service import get_embedding
from image_storage import is_internal_url, delete_image
from datetime import date, timedelta


# 챗봇(/ai/ask)·AI코스는 PLACE_REGIONS(성수/홍대/강북/강남/부산/제주)에서만 동작한다 —
# 프론트(HomeClient.tsx)에서 챗봇 탭일 때 공연/축제 지역 선택지 자체를 감춰두기 때문에
# 이 두 지역은 벡터 검색 대상이 될 수 없다. 그런데도 수집할 때마다 항목당 Gemini 임베딩을
# 1회씩 호출하고 있었고, KOPIS 공연은 재수집 규모가 1200건 이상이라 쓰이지도 않는 임베딩에
# API 비용만 계속 나갔음(2026-08-30 비용 점검에서 발견). 해당 지역은 임베딩 생성을 건너뛴다.
_NO_EMBEDDING_REGIONS = {"공연", "축제"}


def dedup_by_title(items: "list[dict]") -> "list[dict]":
    seen = {}
    for item in items:
        title = item.get("title", "").strip()
        if title and title not in seen:
            seen[title] = item
    return list(seen.values())


def _load_blocklist(conn) -> tuple[set, set]:
    """관리자가 삭제한 항목의 naver_place_id/title 목록 — 원본 소스에 stale 데이터가
    남아있어도 재수집 시 upsert_items가 다시 살려내지 않도록 걸러내는 데 사용."""
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS deleted_places_blocklist (
            id SERIAL PRIMARY KEY,
            naver_place_id TEXT,
            title TEXT,
            deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    rows = conn.execute(text("SELECT naver_place_id, title FROM deleted_places_blocklist")).fetchall()
    ids = {r.naver_place_id for r in rows if r.naver_place_id}
    titles = {r.title for r in rows if r.title}
    return ids, titles


def upsert_items(combined_data: "list[dict]", region: Optional[str] = None):
    """region을 지정하면 모든 항목에 고정 적용, None이면 항목별 item['region']을 사용."""
    deduped = dedup_by_title(combined_data)
    print(f"📋 [{region or '항목별'}] 중복 제거 후 {len(deduped)}개 처리 (원본 {len(combined_data)}개)")
    new_count = 0
    updated_count = 0
    fail_count = 0
    blocked_count = 0

    with engine.connect() as conn:
        blocked_ids, blocked_titles = _load_blocklist(conn)
        conn.commit()

    # 역순 INSERT: rank1이 마지막에 들어가 created_at이 가장 최신 → 서비스 최상단
    for item in reversed(deduped):
        title = item["title"].strip()
        if item.get("naver_place_id") in blocked_ids or title in blocked_titles:
            blocked_count += 1
            continue
        with engine.connect() as conn:
            try:
                item_region = region or item["region"]
                print(f"  ✨ [{item_region}] '{title}' 처리 중...")

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

                # naver_place_id가 같은데 title만 바뀐 경우(KOPIS가 공연명을 살짝 수정해 재게시하는 경우 등),
                # ON CONFLICT (title)만으로는 감지가 안 돼 naver_place_id UNIQUE 제약에 걸려 실패하던 문제 방지 —
                # naver_place_id 또는 title로 기존 행을 먼저 찾아 있으면 UPDATE(naver_place_id 갱신 포함), 없으면 INSERT.
                existing_row = conn.execute(
                    text("SELECT id, image_url FROM seongsu_places WHERE naver_place_id = :naver_place_id OR title = :title LIMIT 1"),
                    {"naver_place_id": naver_place_id, "title": title}
                ).first()

                # 임베딩은 아래 INSERT에만 쓰인다 — UPDATE문은 embedding 컬럼을 건드리지 않으므로
                # 기존 항목 재수집 때 계산하면 그대로 버려진다(계산해놓고 안 쓰는 Gemini 호출).
                # 그래서 신규 INSERT일 때만, 그리고 챗봇 검색 대상 지역일 때만 호출한다.
                # (2026-08-30 비용 점검: KOPIS 공연 1200여 건이 재수집마다 전량 헛호출되고 있었음)
                embedding = None
                if not existing_row and item_region not in _NO_EMBEDDING_REGIONS:
                    embedding = get_embedding(item["content"])

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
                    # 임베딩 없이 INSERT되면 NULL — pgvector에서 NULL은 거리 계산 결과도 NULL이라
                    # ORDER BY embedding <-> ... 에서 항상 뒤로 밀려 검색 결과에 섞이지 않는다(의도된 동작).
                    "embedding": f"[{','.join(map(str, embedding))}]" if embedding else None,
                    "end_date": end_date,
                    "real_end_date": real_end_date,
                    "date_range": item.get("date_range", ""),
                    "region": item_region,
                    "link_url": item.get("link_url"),
                    "category": item.get("category"),
                }

                if existing_row:
                    existing_id = existing_row[0]
                    old_image = existing_row[1]
                    new_image = params.get("image_url")
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
                            category = :category,
                            end_date = COALESCE(:real_end_date, end_date),
                            date_range = CASE WHEN :date_range != '' THEN :date_range ELSE date_range END,
                            created_at = CURRENT_TIMESTAMP
                        WHERE id = :id
                    """), {**params, "id": existing_id})
                    updated_count += 1
                    # 재수집 때마다 이미지를 새로 재호스팅해 image_url을 덮어쓰므로, 교체 전 옛 내부 이미지를
                    # 삭제하지 않으면 Supabase Storage에 고아 객체가 무한 누적된다(버킷 용량이 계속 차오르던 원인).
                    # 단, 새 값이 유효한 내부 이미지일 때만 삭제 — 재호스팅 실패로 외부 URL이 온 경우엔 기존 이미지 보존.
                    if is_internal_url(new_image) and is_internal_url(old_image) and new_image != old_image:
                        delete_image(old_image)
                else:
                    conn.execute(text("""
                        INSERT INTO seongsu_places
                        (title, title_en, content, content_en, location, latitude, longitude, naver_place_id, video_url, image_url, embedding, end_date, date_range, region, link_url, category)
                        VALUES (:title, :title_en, :content, :content_en, :location, :latitude, :longitude, :naver_place_id, :video_url, :image_url, :embedding, :end_date, :date_range, :region, :link_url, :category)
                    """), params)
                    new_count += 1
                conn.commit()
            except Exception as e:
                conn.rollback()
                fail_count += 1
                print(f"  ❌ [{item_region}] '{item.get('title', '?')}' 반영 실패: {e}")

    if blocked_count:
        print(f"  🚫 삭제 블록리스트에 있어 건너뜀: {blocked_count}개")

    return new_count, updated_count, fail_count


def cleanup_expired():
    """end_date가 지난 플레이스를 DB에서 삭제 (연결된 Supabase Storage 이미지도 같이 삭제).

    database.cleanup_expired_data()로 위임 — 서버 cron과 로컬 수집 스크립트가
    같은 정리 로직(이미지 삭제 포함)을 쓰도록 통합. 분리돼있으면 로컬에서 먼저
    DB row를 지워버려 서버 cron이 이미지를 못 찾는 고아 이미지 문제가 생김.
    """
    cleanup_expired_data()
