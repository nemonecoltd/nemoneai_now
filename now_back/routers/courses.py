"""코스(3시간코스/자유코스) — 생성(draft)/조회/편집/발행 + 장소 검색 + 장소 제보.

저장 위치는 themes가 아니라 saved_courses(steps JSON)다 — 실제 AI 코스가 이미 여기 살고
있고, themes(테마지도)는 이번 기능과 완전히 분리해서 건드리지 않는다.

steps 원소 규칙: {place_id, place_name, activity, duration, date_range} — "time"은 저장하지
않는다. timed 코스의 시간 라벨은 14:00 시작 + duration 누적으로 상세 페이지가 렌더 시점에
계산한다. 순서를 바꿔도 AI 재호출 없이 시간표가 자연스럽게 재배열되는 핵심 장치이기 때문.
"""
import json
import logging
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text

from database import engine
from deps import _client_ip, _verify_supabase_user, _verify_supabase_user_optional
from routers.ai import check_daily_ai_limit, generate_timed_course, log_ai_usage
from schemas import CourseDraftCreate, CoursePublish, CourseUpdate, PlaceReportCreate

logger = logging.getLogger(__name__)
router = APIRouter()

_ALLOWED_SCOPES = {"timed", "free"}
_STEP_KEYS = {"place_id", "place_name", "activity", "duration", "date_range"}

_CATEGORY_LABEL = {
    None: "팝업", "popup": "팝업", "class": "클래스", "shopping": "쇼핑",
    "전시": "전시", "행사": "행사", "연극": "연극", "뮤지컬": "뮤지컬",
    "음악": "음악", "종합": "공연",
}


def _ensure_course_columns(conn):
    """saved_courses 컬럼 확장 — ADD COLUMN IF NOT EXISTS라 재기동마다 불러도 안전한 no-op.
    기존 33건에 대한 실제 값 백필은 별도 일회성 스크립트(migrate_courses_v2.py)로 처리—
    여기서 매 기동마다 값을 덮어쓰면 신규 생성된 free/공개 코스까지 되돌릴 위험이 있음."""
    for stmt in [
        "ALTER TABLE saved_courses ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'free'",
        "ALTER TABLE saved_courses ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'",
        "ALTER TABLE saved_courses ADD COLUMN IF NOT EXISTS forked_from INTEGER REFERENCES saved_courses(id)",
        "ALTER TABLE saved_courses ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false",
        "ALTER TABLE saved_courses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE",
    ]:
        try:
            conn.execute(text(stmt))
        except Exception:
            pass
    conn.commit()


# main.py가 라우터를 import하는 시점(=앱 기동 시)에 한 번 실행 — social.py의 /courses/save 등
# 다른 라우터가 이 컬럼들을 참조하기 전에 컬럼 존재가 보장되어야 하므로 지연 실행이 아니라 즉시 실행.
with engine.connect() as _startup_conn:
    _ensure_course_columns(_startup_conn)


def _clean_steps(raw_steps: list, conn) -> list:
    """AI/유저가 넣은 steps에서 place_id가 실제 DB에 있는 것만 남기고, 허용된 키만 통과.
    AI 환각(존재하지 않는 place_id)이나 프리텍스트 스텝이 섞이는 것을 방지."""
    if not raw_steps:
        return []
    ids = [s.get("place_id") for s in raw_steps if isinstance(s, dict) and s.get("place_id")]
    if not ids:
        return []
    valid_ids = set()
    if ids:
        rows = conn.execute(text("SELECT id FROM seongsu_places WHERE id = ANY(:ids)"), {"ids": ids})
        valid_ids = {r[0] for r in rows}
    cleaned = []
    for s in raw_steps:
        if not isinstance(s, dict) or s.get("place_id") not in valid_ids:
            continue
        cleaned.append({k: s.get(k) for k in _STEP_KEYS if k in s})
    return cleaned


# 검색/제보는 로그인 없이도 쓸 수 있어야 하는 화면이라 IP 레이트리밋으로 방어(랭킹공유와 동일 패턴)
_place_report_rate_limit: dict = {}
_PLACE_REPORT_LIMIT_PER_HOUR = 10
_PLACE_REPORT_LIMIT_PER_DAY = 30


def _check_place_report_rate_limit(ip: str):
    now = time.time()
    timestamps = _place_report_rate_limit.setdefault(ip, [])
    timestamps[:] = [t for t in timestamps if now - t < 86400]
    if len([t for t in timestamps if now - t < 3600]) >= _PLACE_REPORT_LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail="너무 많은 요청입니다. 잠시 후 다시 시도해주세요.")
    if len(timestamps) >= _PLACE_REPORT_LIMIT_PER_DAY:
        raise HTTPException(status_code=429, detail="일일 제보 한도를 초과했습니다.")
    timestamps.append(now)


@router.post("/courses/draft")
async def create_course_draft(
    payload: CourseDraftCreate,
    scope: str,
    region: str = "성수",
    source: Optional[str] = None,
    lang: str = "ko",
    viewer: dict = Depends(_verify_supabase_user),
):
    """코스 생성 진입점 3종:
    - scope=timed: 3시간코스 — AI 생성(2회/일 공유 한도), companion으로 취향 반영
    - scope=free & source=likes: 찜한 장소로 즉시 구성(AI 미호출, 한도 무관)
    - scope=free (그 외): 빈 코스 즉시 생성(AI 미호출, 한도 무관)
    """
    if scope not in _ALLOWED_SCOPES:
        raise HTTPException(status_code=400, detail=f"허용되지 않은 scope입니다: {scope}")
    if lang not in ("ko", "en", "zh"):
        lang = "ko"

    title, description, steps, actual_source = "", "", [], source or "manual"

    if scope == "timed":
        check_daily_ai_limit(viewer["id"])
        companion = (payload.companion or "solo").strip().lower()
        itinerary = await generate_timed_course(region, companion, lang)
        title = itinerary.get("title", "")
        description = itinerary.get("description", "")
        with engine.connect() as conn:
            steps = _clean_steps(itinerary.get("steps", []), conn)
        actual_source = "ai_draft"
        log_ai_usage(viewer["id"])
    elif source == "likes":
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT p.id AS place_id, p.title AS place_name
                FROM seongsu_places p
                JOIN likes l ON p.id = l.place_id
                WHERE l.user_id = :user_id AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
                ORDER BY l.created_at DESC
                LIMIT 10
            """), {"user_id": viewer["id"]}).fetchall()
        steps = [{"place_id": r.place_id, "place_name": r.place_name, "activity": "", "duration": 60, "date_range": None} for r in rows]
        actual_source = "likes"
        description = "찜한 장소로 만든 나만의 코스"

    with engine.connect() as conn:
        _ensure_course_columns(conn)
        row = conn.execute(text("""
            INSERT INTO saved_courses
                (user_id, user_name, user_image, title, description, steps, region, scope, source, is_public)
            VALUES
                (:user_id, :user_name, :user_image, :title, :description, CAST(:steps AS jsonb), :region, :scope, :source, false)
            RETURNING id
        """), {
            "user_id": viewer["id"],
            "user_name": payload.user_name or "User",
            "user_image": payload.user_image,
            "title": title,
            "description": description,
            "steps": json.dumps(steps, ensure_ascii=False),
            "region": region,
            "scope": scope,
            "source": actual_source,
        }).fetchone()
        conn.commit()
    return {"id": row.id}


@router.get("/courses/{course_id}")
async def get_course(course_id: int, viewer: Optional[dict] = Depends(_verify_supabase_user_optional)):
    """공개 코스는 누구나, 비공개는 소유자만(그 외 404 — 존재 자체를 숨김)."""
    with engine.connect() as conn:
        row = conn.execute(text("SELECT * FROM saved_courses WHERE id = :id"), {"id": course_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="코스를 찾을 수 없습니다")
    course = dict(row._mapping)
    if not course.get("is_public") and (not viewer or viewer["id"] != course.get("user_id")):
        raise HTTPException(status_code=404, detail="코스를 찾을 수 없습니다")
    return course


@router.put("/courses/{course_id}")
async def update_course(course_id: int, payload: CourseUpdate, viewer: dict = Depends(_verify_supabase_user)):
    """임시저장 — 소유자만, is_public은 여기서 바꾸지 않음(발행은 /publish 전용)."""
    with engine.connect() as conn:
        existing = conn.execute(text("SELECT user_id FROM saved_courses WHERE id = :id"), {"id": course_id}).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="코스를 찾을 수 없습니다")
        if existing.user_id != viewer["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")

        updates = payload.dict(exclude_unset=True)
        if "steps" in updates:
            updates["steps"] = json.dumps(_clean_steps(updates["steps"], conn), ensure_ascii=False)
        if not updates:
            return {"status": "success"}

        set_parts = []
        for k in updates:
            set_parts.append(f"{k} = CAST(:{k} AS jsonb)" if k == "steps" else f"{k} = :{k}")
        set_parts.append("updated_at = NOW()")
        conn.execute(
            text(f"UPDATE saved_courses SET {', '.join(set_parts)} WHERE id = :id"),
            {**updates, "id": course_id},
        )
        conn.commit()
    return {"status": "success"}


@router.post("/courses/{course_id}/publish")
async def publish_course(course_id: int, payload: CoursePublish, viewer: dict = Depends(_verify_supabase_user)):
    """is_public=true 전환 전용. title 미입력 시 "{지역} {상위 카테고리} {개수}곳" 자동 제안."""
    with engine.connect() as conn:
        row = conn.execute(text("SELECT * FROM saved_courses WHERE id = :id"), {"id": course_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="코스를 찾을 수 없습니다")
        course = dict(row._mapping)
        if course["user_id"] != viewer["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")

        steps = course["steps"] if isinstance(course["steps"], list) else json.loads(course["steps"] or "[]")
        if not steps:
            raise HTTPException(status_code=400, detail="장소를 1곳 이상 담아야 발행할 수 있습니다")

        title = (payload.title or course["title"] or "").strip()
        if not title:
            place_ids = [s["place_id"] for s in steps if s.get("place_id")]
            cats = []
            if place_ids:
                cat_rows = conn.execute(
                    text("SELECT category FROM seongsu_places WHERE id = ANY(:ids)"), {"ids": place_ids}
                ).fetchall()
                cats = [r[0] for r in cat_rows]
            top_cat = max(set(cats), key=cats.count) if cats else None
            title = f"{course['region']} {_CATEGORY_LABEL.get(top_cat, '팝업')} {len(steps)}곳"

        conn.execute(
            text("UPDATE saved_courses SET title = :title, is_public = true, updated_at = NOW() WHERE id = :id"),
            {"title": title, "id": course_id},
        )
        conn.commit()
    return {"status": "success", "title": title}


@router.get("/places/search")
async def search_places_by_text(q: str = "", region: Optional[str] = None):
    """코스 편집 화면의 '장소 추가' 검색 — 벡터 검색과 달리 임베딩 호출 없는 경량 ILIKE 검색."""
    q = q.strip()
    if len(q) < 1:
        return []
    where = ["(end_date IS NULL OR end_date >= CURRENT_DATE)", "title ILIKE :q"]
    params: dict = {"q": f"%{q}%", "limit": 20}
    if region:
        where.append("region = :region")
        params["region"] = region
    query = text(f"""
        SELECT id, title, location, image_url, region, category, date_range
        FROM seongsu_places
        WHERE {' AND '.join(where)}
        ORDER BY created_at DESC
        LIMIT :limit
    """)
    with engine.connect() as conn:
        result = conn.execute(query, params)
        return [dict(row._mapping) for row in result]


def _ensure_place_reports_table(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS place_reports (
            id SERIAL PRIMARY KEY,
            query TEXT NOT NULL,
            region TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    conn.commit()


@router.post("/place_reports")
async def create_place_report(payload: PlaceReportCreate, request: Request, viewer: dict = Depends(_verify_supabase_user)):
    """검색 결과 0건일 때 제보 로그만 저장(어드민 처리 UI는 이번 범위 아님)."""
    _check_place_report_rate_limit(_client_ip(request))
    with engine.connect() as conn:
        _ensure_place_reports_table(conn)
        conn.execute(
            text("INSERT INTO place_reports (query, region) VALUES (:query, :region)"),
            {"query": payload.query, "region": payload.region},
        )
        conn.commit()
    return {"status": "success"}
