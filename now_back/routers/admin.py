"""어드민 전용 — 테마 관리/랭킹 조회/전체 장소/배너/통계."""
import json
import os
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from database import engine
from image_storage import get_storage_usage
import ranking_service as ranking

router = APIRouter()

@router.post("/admin/push/weekly")
async def trigger_weekly_push():
    """Web Push 주간 발송 수동 트리거 — 스케줄 등록 전 검증용. 자동 스케줄은 아직 미등록."""
    import push_service
    return push_service.run_weekly_push()

@router.get("/admin/themes")
async def admin_get_all_themes():
    """어드민 전용 — 전체 테마 조회 ([퍼감] 제외)"""
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT t.*, COUNT(tl.id) as like_count
            FROM themes t
            LEFT JOIN theme_likes tl ON t.id = tl.theme_id
            WHERE t.title NOT LIKE '[퍼감]%'
            GROUP BY t.id
            ORDER BY t.pinned_at DESC NULLS LAST, t.created_at DESC
        """)).fetchall()
        return [dict(row._mapping) for row in rows]

@router.post("/admin/themes/generate-weekly")
async def admin_generate_weekly_theme():
    """어드민 전용 — 최근 7일 인기 팝업 TOP10으로 '주간 TOP10' 테마 자동 생성.
    같은 목적의 테마 하나(pinned_at IS NOT NULL)를 매주 덮어써서 테마 목록 최상단에 고정 노출."""
    with engine.connect() as conn:
        rows = list(ranking._popularity_rows(conn, 7, limit=10))
        if len(rows) < 10:
            rows = list(ranking._popularity_rows(conn, 30, limit=10))

        today = date.today()
        week_start = today - timedelta(days=7)
        title = f"이번주 TOP10 핫플 ({week_start.strftime('%m/%d')}~{today.strftime('%m/%d')})"
        top_names = ", ".join(r.title for r in rows[:3])
        description = f"최근 7일간 조회수·좋아요 기준 인기 팝업 TOP10. {top_names} 등이 포함되어 있어요."
        places = [
            {
                "place_id": r.id,
                "title": r.title,
                "content": r.content,
                "location": r.location,
                "image_url": r.image_url,
                "video_url": "",
                "date_range": r.date_range,
            }
            for r in rows
        ]
        places_json = json.dumps(places, ensure_ascii=False)

        existing_id = conn.execute(text("SELECT id FROM themes WHERE pinned_at IS NOT NULL LIMIT 1")).scalar()
        if existing_id:
            conn.execute(text("""
                UPDATE themes SET title = :title, description = :description,
                       places = cast(:places as jsonb), pinned_at = NOW(), created_at = NOW()
                WHERE id = :id
            """), {"title": title, "description": description, "places": places_json, "id": existing_id})
            theme_id = existing_id
        else:
            result = conn.execute(text("""
                INSERT INTO themes (user_id, user_name, title, description, places, region, pinned_at)
                VALUES (NULL, '지금여기 AI', :title, :description, cast(:places as jsonb), '성수', NOW())
                RETURNING id
            """), {"title": title, "description": description, "places": places_json})
            theme_id = result.scalar()
        conn.commit()
        return {"status": "success", "id": theme_id}

@router.put("/admin/themes/{theme_id}")
async def admin_update_theme(theme_id: int, body: dict):
    """어드민 전용 — 소유자 체크 없이 테마 수정 (title/description/places)"""
    allowed = {}
    for k in ("title", "description"):
        if k in body:
            allowed[k] = body[k]
    if "places" in body:
        allowed["places"] = json.dumps(body["places"], ensure_ascii=False)
    if not allowed:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join([
        f"{k} = cast(:{k} as jsonb)" if k == "places" else f"{k} = :{k}"
        for k in allowed
    ])
    with engine.connect() as conn:
        conn.execute(text(f"UPDATE themes SET {set_clause} WHERE id = :id"), {**allowed, "id": theme_id})
        conn.commit()
    return {"status": "success"}

@router.delete("/admin/themes/{theme_id}")
async def admin_delete_theme(theme_id: int):
    """어드민 전용 — 소유자 체크 없이 테마 삭제"""
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM theme_likes WHERE theme_id = :id"), {"id": theme_id})
        conn.execute(text("DELETE FROM themes WHERE id = :id"), {"id": theme_id})
        conn.commit()
    return {"status": "success"}

@router.get("/admin/ranking/weekly")
async def admin_weekly_ranking():
    """장소 인기 TOP 25 (하루 3회 계산된 48시간 캐시 반환, 메인 추천 랭킹과 동일 산식). 공연 제외.
    blog_reviews만은 캐시가 아닌 실시간 DB 값으로 덮어씀 — 4시간 캐시 주기 사이에 어드민에서 갱신해도
    "미갱신"으로 잘못 표시되던 동기화 문제 수정(캐시 자체를 매번 새로 계산하기엔 무겁고, 여기선 필요 없음)."""
    top25 = [dict(item) for item in ranking.get_popular()[:25]]
    ids = [item["id"] for item in top25]
    if ids:
        with engine.connect() as conn:
            rows = conn.execute(
                text("SELECT id, blog_reviews FROM seongsu_places WHERE id = ANY(:ids)"),
                {"ids": ids},
            )
            live_blog_reviews = {row.id: row.blog_reviews for row in rows}
        for item in top25:
            item["blog_reviews"] = live_blog_reviews.get(item["id"], item.get("blog_reviews"))
    return top25

@router.get("/admin/ranking/weekly7d")
async def admin_weekly_ranking_7d():
    """CSV 다운로드(주간 콘텐츠 제작용) 전용 — 화면 표시용 48시간 캐시와 별개로 항상 최신 7일 데이터를 즉석 계산.
    "이번주 핫플 팝업" 서울권 기사용이라 제주는 제외(화면 표시용 TOP25는 제주 포함 그대로 유지)."""
    with engine.connect() as conn:
        result = list(ranking._popularity_rows(conn, 7, exclude_jeju=True))
        if len(result) < 25:
            result = list(ranking._popularity_rows(conn, 30, exclude_jeju=True))
        top25 = [dict(row._mapping) for row in result[:25]]
        # 순위변동(rank_delta) — 화면 표시용 캐시(ranking_snapshot.top25_ids, 최근 갱신 주기 기준)를
        # 비교 기준으로 재사용. 이 엔드포인트 자체는 별도 이력을 쌓지 않으므로 새 스냅샷은 기록하지 않는다.
        prev_row = conn.execute(text("SELECT top25_ids FROM ranking_snapshot WHERE id = 1")).fetchone()
        prev_rank_by_id = {pid: idx for idx, pid in enumerate(prev_row[0])} if prev_row and prev_row[0] else {}
        for idx, item in enumerate(top25):
            if item["id"] in prev_rank_by_id:
                item["rank_delta"] = prev_rank_by_id[item["id"]] - idx
            else:
                item["rank_delta"] = "new"
        return top25

@router.get("/admin/places")
async def admin_list_all_places(region: Optional[str] = None):
    """어드민 전용 — 만료 포함 전체 장소 조회"""
    where_clause = "WHERE region = :region" if region else ""
    params: dict = {"region": region} if region else {}
    query = text(
        f"SELECT id, title, content, image_url, location, date_range, end_date, region, category, pinned_at, naver_place_id, created_at, updated_at, link_url, link_title, blog_reviews "
        f"FROM seongsu_places {where_clause} "
        f"ORDER BY pinned_at DESC NULLS LAST, id DESC"
    )
    with engine.connect() as conn:
        result = conn.execute(query, params)
        return [dict(row._mapping) for row in result]

_STATS_REGIONS = ['성수', '홍대', '강북', '강남', '부산', '제주', '공연', '축제']
_STATS_CATEGORIES = ['팝업', '클래스', '쇼핑', '전시']
_STATS_WINDOW_HOURS = 48

@router.get("/admin/region-stats")
async def admin_region_stats():
    """어드민 대시보드 — 분야(지역)별 등록 장소 수/최근 48시간 조회수 + 팝업·클래스·쇼핑·전시 카테고리별 세부 분해.
    4시간 단위 시간대별 집계는 지역 불문 모양이 거의 똑같아 판단에 도움이 안 돼(2026-08-11, 실사용 피드백)
    카테고리별 분해로 교체 — 실제 어느 카테고리가 트래픽을 만드는지가 운영 대응에 더 유의미함.
    category IN ('전시','행사')→전시, 'class'→클래스, 'shopping'→쇼핑, 그 외(NULL 포함, 공연 장르 등)→팝업으로
    귀속시켜 4개 버킷이 지역 전체를 빠짐없이 분할하도록 함(place_count/조회수 총합이 항상 region 총합과 일치).
    직전 48시간(48~96시간 전) 조회수도 함께 계산해 전주기 대비 변화율을 같이 내려줌 — 급격한 변화(±20%)를
    프론트에서 강조 표시하기 위함(2026-08-11)."""
    category_case = """
        CASE
            WHEN p.category IN ('전시', '행사') THEN '전시'
            WHEN p.category = 'class' THEN '클래스'
            WHEN p.category = 'shopping' THEN '쇼핑'
            ELSE '팝업'
        END
    """
    with engine.connect() as conn:
        rows = conn.execute(text(f"""
            WITH curr AS (
                SELECT p.id AS place_id, p.region, ({category_case}) AS bucket,
                       COUNT(v.id) AS views
                FROM seongsu_places p
                LEFT JOIN place_views v ON v.place_id = p.id
                    AND v.viewed_at >= NOW() - INTERVAL '{_STATS_WINDOW_HOURS} hours'
                WHERE p.region = ANY(:regions)
                GROUP BY p.id, p.region, bucket
            ),
            prev AS (
                SELECT p.id AS place_id, COUNT(v.id) AS views
                FROM seongsu_places p
                LEFT JOIN place_views v ON v.place_id = p.id
                    AND v.viewed_at >= NOW() - INTERVAL '{_STATS_WINDOW_HOURS * 2} hours'
                    AND v.viewed_at < NOW() - INTERVAL '{_STATS_WINDOW_HOURS} hours'
                WHERE p.region = ANY(:regions)
                GROUP BY p.id
            )
            SELECT curr.region, curr.bucket,
                   COUNT(*) AS place_count,
                   SUM(curr.views) AS views,
                   SUM(prev.views) AS prev_views
            FROM curr JOIN prev ON prev.place_id = curr.place_id
            GROUP BY curr.region, curr.bucket
        """), {"regions": _STATS_REGIONS}).fetchall()

    by_region: dict = {
        r: {c: {"place_count": 0, "views": 0, "prev_views": 0} for c in _STATS_CATEGORIES}
        for r in _STATS_REGIONS
    }
    for region, bucket, place_count, views, prev_views in rows:
        if region in by_region and bucket in by_region[region]:
            by_region[region][bucket] = {"place_count": place_count, "views": views, "prev_views": prev_views}

    def _delta_pct(curr: int, prev: int):
        if prev == 0:
            return None if curr == 0 else 100.0
        return round((curr - prev) / prev * 100, 1)

    return {
        "categories": _STATS_CATEGORIES,
        "window_hours": _STATS_WINDOW_HOURS,
        "regions": [
            {
                "region": r,
                "place_count": sum(c["place_count"] for c in by_region[r].values()),
                "total_views": sum(c["views"] for c in by_region[r].values()),
                "by_category": [
                    {
                        "category": c,
                        "place_count": by_region[r][c]["place_count"],
                        "views": by_region[r][c]["views"],
                        "prev_views": by_region[r][c]["prev_views"],
                        "delta_pct": _delta_pct(by_region[r][c]["views"], by_region[r][c]["prev_views"]),
                    }
                    for c in _STATS_CATEGORIES
                ],
            }
            for r in _STATS_REGIONS
        ],
    }

@router.get("/banner")
async def get_banner():
    """플레이스 상세페이지 상단에 표시할 전역 공지/기사 배너 (공지사항 게시판 대체용, 수동 운영)."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS site_banner (
                id INTEGER PRIMARY KEY DEFAULT 1,
                text TEXT DEFAULT '',
                url TEXT DEFAULT '',
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        conn.commit()
        row = conn.execute(text("SELECT text, url FROM site_banner WHERE id = 1")).fetchone()
        if not row:
            return {"text": "", "url": ""}
        return {"text": row.text or "", "url": row.url or ""}

@router.post("/admin/banner")
async def update_banner(payload: dict):
    """어드민에서 배너 텍스트/URL 갱신. 비우면 배너가 사라짐."""
    text_val = (payload.get("text") or "").strip()
    url_val = (payload.get("url") or "").strip()
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS site_banner (
                id INTEGER PRIMARY KEY DEFAULT 1,
                text TEXT DEFAULT '',
                url TEXT DEFAULT '',
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        conn.execute(text("""
            INSERT INTO site_banner (id, text, url, updated_at) VALUES (1, :text, :url, NOW())
            ON CONFLICT (id) DO UPDATE SET text = :text, url = :url, updated_at = NOW()
        """), {"text": text_val, "url": url_val})
        conn.commit()
    return {"status": "success"}

@router.get("/admin/stats")
async def get_admin_stats():
    """관리자용 통계 (총 유저수/코스수/스팟수)"""
    with engine.connect() as conn:
        course_count = conn.execute(text("SELECT COUNT(*) FROM saved_courses")).scalar()
        place_count = conn.execute(text("SELECT COUNT(*) FROM seongsu_places")).scalar()

    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    total_users = 0
    if supabase_url and service_key:
        try:
            import httpx
            res = httpx.get(
                f"{supabase_url}/auth/v1/admin/users?page=1&per_page=1000",
                headers={"Authorization": f"Bearer {service_key}", "apikey": service_key},
                timeout=5,
            )
            if res.status_code == 200:
                total_users = len(res.json().get("users", []))
        except Exception:
            pass

    storage = get_storage_usage()

    return {
        "total_users": total_users,
        "total_courses": course_count or 0,
        "total_places": place_count or 0,
        "storage_used_bytes": storage["used_bytes"],
        "storage_limit_bytes": storage["limit_bytes"],
        "storage_percent": storage["percent"],
    }
