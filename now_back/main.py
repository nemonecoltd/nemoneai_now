from fastapi import FastAPI, HTTPException, Depends, File, UploadFile, Header
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import engine, cleanup_expired_data
from image_storage import rehost_image, delete_image, upload_bytes, get_storage_usage
from gemini_service import get_embedding, generate_answer, ai_translate
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import uvicorn
import logging
import os
import uuid
import json
import threading
import urllib.request
import urllib.error
import re
import asyncio

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def _lang_col(lang: str, base: str) -> str:
    """lang(ko/en/zh)에 맞는 컬럼명 반환. 예: _lang_col('zh', 'title') -> 'title_zh'"""
    return f"{base}_{lang}" if lang in ("en", "zh") else base

app = FastAPI(title="오늘 성수 (Now Seongsu) API")

# --- 정적 파일 서빙 ---
os.makedirs("static/profiles", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- CORS 설정 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic 모델 ---
ADMIN_EMAIL = "nemonecoltd@gmail.com"

def _verify_supabase_user(authorization: Optional[str] = Header(None)) -> dict:
    """Authorization: Bearer <access_token>을 Supabase에 검증해 실제 로그인 사용자 정보(id/email)를 반환.
    클라이언트가 보내는 user_id/admin_email을 그대로 신뢰하던 기존 방식(스팸/봇에 뚫렸던 원인)을 대체."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    token = authorization.split(" ", 1)[1]
    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    try:
        import httpx
        res = httpx.get(
            f"{supabase_url}/auth/v1/user",
            headers={"Authorization": f"Bearer {token}", "apikey": service_key},
            timeout=5,
        )
        if res.status_code != 200:
            raise HTTPException(status_code=401, detail="유효하지 않은 로그인입니다")
        data = res.json()
        return {"id": data["id"], "email": data.get("email", "")}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="로그인 확인에 실패했습니다")

class FeedbackCreate(BaseModel):
    user_name: str
    content: str

class FeedbackUpdate(BaseModel):
    content: str

class PlaceCollect(BaseModel):
    title: str
    content: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    location: Optional[str] = None
    date_range: Optional[str] = None
    end_date: Optional[date] = None

class PlaceUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date_range: Optional[str] = None
    region: Optional[str] = None
    pinned: Optional[bool] = None
    naver_place_id: Optional[str] = None
    link_url: Optional[str] = None
    link_title: Optional[str] = None

class Question(BaseModel):
    user_query: str

class TourRequest(BaseModel):
    companion: str
    user_id: Optional[str] = None

class LikeToggle(BaseModel):
    user_id: str
    place_id: int

class CourseSave(BaseModel):
    user_id: str
    user_name: Optional[str] = "User"
    user_image: Optional[str] = None
    title: str
    description: str
    steps: List[dict]
    region: Optional[str] = "성수"

class CourseLikeToggle(BaseModel):
    user_id: str
    course_id: int

class ThemeSave(BaseModel):
    user_id: str
    user_name: Optional[str] = "User"
    user_image: Optional[str] = None
    title: str
    description: str
    places: List[dict]
    region: Optional[str] = "성수"

class ThemeLikeToggle(BaseModel):
    user_id: str
    theme_id: int

# --- DB 스키마 자동 업데이트 로직 ---
def update_db_schema():
    """데이터 보존을 위해 user_id 컬럼 추가 및 기존 user_email의 NOT NULL 제약 해제"""
    tables = ['likes', 'saved_courses', 'themes', 'course_likes', 'theme_likes', 'feedbacks', 'user_ai_usages']
    with engine.connect() as conn:
        # 1. 기본 user_id 및 제약 해제
        for table in tables:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS user_id TEXT;"))
                conn.execute(text(f"ALTER TABLE {table} ALTER COLUMN user_email DROP NOT NULL;"))
            except Exception: pass
        
        # 2. 랭킹용 작성자 정보 컬럼 추가 (themes, saved_courses)
        for table in ['themes', 'saved_courses']:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS user_name TEXT;"))
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS user_image TEXT;"))
            except Exception: pass
            
        conn.commit()

# 앱 실행 시 스키마 업데이트 수행
update_db_schema()

# --- API 엔드포인트 ---

@app.post("/likes/toggle")
async def toggle_like(req: LikeToggle):
    """장소 좋아요 토글"""
    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM likes WHERE user_id = :user_id AND place_id = :place_id"),
            {"user_id": req.user_id, "place_id": req.place_id}
        ).fetchone()
        if existing:
            conn.execute(text("DELETE FROM likes WHERE id = :id"), {"id": existing[0]})
            liked = False
        else:
            conn.execute(
                text("INSERT INTO likes (user_id, place_id) VALUES (:user_id, :place_id)"),
                {"user_id": req.user_id, "place_id": req.place_id}
            )
            liked = True
        conn.commit()
        return {"liked": liked}

@app.get("/users/{user_id}/likes")
async def get_user_likes(user_id: str):
    query = text("""
        SELECT p.* FROM seongsu_places p
        JOIN likes l ON p.id = l.place_id
        WHERE l.user_id = :user_id
        ORDER BY l.created_at DESC
    """)
    with engine.connect() as conn:
        result = conn.execute(query, {"user_id": user_id})
        return [dict(row._mapping) for row in result]

@app.post("/courses/save")
async def save_course(course: CourseSave):
    import json
    try:
        with engine.connect() as conn:
            query = text("""
                INSERT INTO saved_courses (user_id, user_name, user_image, title, description, steps, region)
                VALUES (:user_id, :user_name, :user_image, :title, :description, :steps, :region)
            """)
            conn.execute(query, {
                "user_id": course.user_id, 
                "user_name": course.user_name,
                "user_image": course.user_image,
                "title": course.title,
                "description": course.description, "steps": json.dumps(course.steps),
                "region": course.region or "성수"
            })
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/users/{user_id}/courses")
async def get_user_courses(user_id: str):
    query = text("SELECT * FROM saved_courses WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 10")
    with engine.connect() as conn:
        result = conn.execute(query, {"user_id": user_id})
        return [dict(row._mapping) for row in result]

@app.get("/courses")
async def get_all_courses():
    """[랭킹] 모든 코스 조회 (자체 보관된 유저 정보 사용)"""
    query = text("""
        SELECT c.*, COUNT(cl.id) as like_count
        FROM saved_courses c
        LEFT JOIN course_likes cl ON c.id = cl.course_id
        WHERE c.title NOT LIKE '[퍼감]%'
          AND c.created_at >= NOW() - INTERVAL '45 days'
        GROUP BY c.id
        ORDER BY like_count DESC, c.created_at DESC
    """)
    with engine.connect() as conn:
        result = conn.execute(query)
        return [dict(row._mapping) for row in result]

@app.post("/courses/like/toggle")
async def toggle_course_like(req: CourseLikeToggle):
    """코스 좋아요 토글"""
    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM course_likes WHERE user_id = :user_id AND course_id = :course_id"),
            {"user_id": req.user_id, "course_id": req.course_id}
        ).fetchone()
        if existing:
            conn.execute(text("DELETE FROM course_likes WHERE id = :id"), {"id": existing[0]})
            liked = False
        else:
            conn.execute(
                text("INSERT INTO course_likes (user_id, course_id) VALUES (:user_id, :course_id)"),
                {"user_id": req.user_id, "course_id": req.course_id}
            )
            liked = True
        conn.commit()
        return {"liked": liked}

@app.post("/themes/save")
async def save_theme(theme: ThemeSave):
    import json
    try:
        with engine.connect() as conn:
            query = text("""
                INSERT INTO themes (user_id, user_name, user_image, title, description, places, region)
                VALUES (:user_id, :user_name, :user_image, :title, :description, :places, :region)
            """)
            conn.execute(query, {
                "user_id": theme.user_id, 
                "user_name": theme.user_name,
                "user_image": theme.user_image,
                "title": theme.title,
                "description": theme.description, 
                "places": json.dumps(theme.places),
                "region": theme.region or "성수"
            })
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/themes")
async def get_all_themes():
    """테마 랭킹 (자체 보관된 유저 정보 사용)"""
    query = text("""
        SELECT t.*, COUNT(tl.id) as computed_like_count
        FROM themes t
        LEFT JOIN theme_likes tl ON t.id = tl.theme_id
        WHERE t.title NOT LIKE '[퍼감]%'
        GROUP BY t.id
        ORDER BY t.pinned_at DESC NULLS LAST, computed_like_count DESC, t.created_at DESC
    """)
    with engine.connect() as conn:
        result = conn.execute(query)
        themes = []
        for row in result:
            theme_dict = dict(row._mapping)
            theme_dict['like_count'] = theme_dict.pop('computed_like_count')
            themes.append(theme_dict)
        return themes

@app.get("/users/{user_id}/themes")
async def get_user_themes(user_id: str):
    query = text("SELECT * FROM themes WHERE user_id = :user_id ORDER BY created_at DESC")
    with engine.connect() as conn:
        result = conn.execute(query, {"user_id": user_id})
        return [dict(row._mapping) for row in result]

@app.put("/themes/{theme_id}")
async def update_theme(theme_id: int, theme: ThemeSave):
    import json
    try:
        with engine.connect() as conn:
            existing = conn.execute(text("SELECT user_id FROM themes WHERE id = :id"), {"id": theme_id}).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Theme not found")
            if existing[0] != theme.user_id:
                raise HTTPException(status_code=403, detail="Not authorized")

            query = text("""
                UPDATE themes 
                SET title = :title, description = :description, places = :places
                WHERE id = :id
            """)
            conn.execute(query, {
                "id": theme_id, "title": theme.title,
                "description": theme.description, "places": json.dumps(theme.places)
            })
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/themes/{theme_id}")
async def delete_theme(theme_id: int, user_id: str):
    """테마 삭제 (작성자)"""
    with engine.connect() as conn:
        theme = conn.execute(text("SELECT user_id FROM themes WHERE id = :id"), {"id": theme_id}).fetchone()
        if not theme:
            raise HTTPException(status_code=404, detail="Theme not found")
        
        if theme[0] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        conn.execute(text("DELETE FROM themes WHERE id = :id"), {"id": theme_id})
        conn.commit()
        return {"status": "success"}

@app.get("/admin/themes")
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

@app.post("/admin/themes/generate-weekly")
async def admin_generate_weekly_theme():
    """어드민 전용 — 최근 7일 인기 팝업 TOP10으로 '주간 TOP10' 테마 자동 생성.
    같은 목적의 테마 하나(pinned_at IS NOT NULL)를 매주 덮어써서 테마 목록 최상단에 고정 노출."""
    with engine.connect() as conn:
        rows = list(_popularity_rows(conn, 7, limit=10))
        if len(rows) < 10:
            rows = list(_popularity_rows(conn, 30, limit=10))

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

MATMATCH_API_BASE = "https://nemoneai.com/api"

@app.get("/magazine")
async def get_magazine():
    """나우 매거진 피드 — 맛매치 Special #5(나우 관련 기사 모음)를 그대로 프록시.
    콘텐츠 원본·검색 색인은 맛매치 쪽으로 유지, 나우는 앱 내 열람 UX만 제공."""
    try:
        with urllib.request.urlopen(f"{MATMATCH_API_BASE}/specials/5", timeout=5) as res:
            data = json.loads(res.read())
    except Exception:
        raise HTTPException(status_code=502, detail="매거진을 불러올 수 없습니다")

    # 맛매치 특성상 post_ids에 오래된 기사부터 쌓임 — 나우는 최신 기사가 위로 오도록 역순 정렬
    posts = sorted(data.get("posts", []), key=lambda p: p.get("created_at") or "", reverse=True)
    return [
        {
            "id": p["id"],
            "title": p["title"],
            "image_url": p.get("image_url"),
            "category": p.get("category"),
            "created_at": p.get("created_at"),
            "excerpt": re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", p.get("body_text") or "")).strip()[:80],
        }
        for p in posts
    ]

@app.get("/magazine/{post_id}")
async def get_magazine_post(post_id: int):
    try:
        with urllib.request.urlopen(f"{MATMATCH_API_BASE}/posts/{post_id}", timeout=5) as res:
            data = json.loads(res.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
        raise HTTPException(status_code=502, detail="매거진을 불러올 수 없습니다")
    except Exception:
        raise HTTPException(status_code=502, detail="매거진을 불러올 수 없습니다")

    return {
        "id": data["id"],
        "title": data["title"],
        "body_text": data.get("body_text"),
        "image_url": data.get("image_url"),
        "category": data.get("category"),
        "created_at": data.get("created_at"),
    }

@app.put("/admin/themes/{theme_id}")
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

@app.delete("/admin/themes/{theme_id}")
async def admin_delete_theme(theme_id: int):
    """어드민 전용 — 소유자 체크 없이 테마 삭제"""
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM theme_likes WHERE theme_id = :id"), {"id": theme_id})
        conn.execute(text("DELETE FROM themes WHERE id = :id"), {"id": theme_id})
        conn.commit()
    return {"status": "success"}

@app.post("/themes/like/toggle")
async def toggle_theme_like(req: ThemeLikeToggle):
    """테마 좋아요 토글"""
    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM theme_likes WHERE user_id = :user_id AND theme_id = :theme_id"),
            {"user_id": req.user_id, "theme_id": req.theme_id}
        ).fetchone()
        if existing:
            conn.execute(text("DELETE FROM theme_likes WHERE id = :id"), {"id": existing[0]})
            liked = False
        else:
            conn.execute(
                text("INSERT INTO theme_likes (user_id, theme_id) VALUES (:user_id, :theme_id)"),
                {"user_id": req.user_id, "theme_id": req.theme_id}
            )
            liked = True
        conn.commit()
        return {"liked": liked}

@app.post("/ask")
async def ask_question(question: Question, region: str = "성수", lang: str = "ko", viewer: dict = Depends(_verify_supabase_user)):
    """[핵심] RAG 기반 다국어 질문 답변 — 로그인 필요(스팸/트래픽 공격 방지, 과거 무인증 남용 이력 있음)"""
    if lang not in ("ko", "en", "zh"):
        lang = "ko"
    try:
        # 1. 질문 벡터화 (동기 함수라 스레드로 오프로딩 — 안 그러면 이 호출 하나가 이벤트 루프 전체를 막아 다른 모든 요청이 같이 느려짐)
        query_embedding = await asyncio.to_thread(get_embedding, question.user_query)
        embedding_str = f"[{','.join(map(str, query_embedding))}]"

        # 2. 벡터 유사도 검색 (상위 5개)
        # 언어에 따라 검색 대상 필드를 다르게 하되, 영문이 비어있으면 한글로 Fallback
        title_field = f"COALESCE({_lang_col(lang, 'title')}, title)"
        content_field = f"COALESCE({_lang_col(lang, 'content')}, content)"

        # 제주는 2026-07-21부터 KOPIS/jeju.go.kr 수집 중단 — 기존 kopis_/jeju_ 접두 레거시 데이터가 섞여
        # 엉뚱한 답변에 쓰이지 않도록 제외 (공연 지역 자체는 KOPIS가 정상 소스라 제외하지 않음)
        kopis_exclude = "AND naver_place_id NOT LIKE 'kopis_%' AND naver_place_id NOT LIKE 'jeju_%' AND naver_place_id NOT LIKE 'culture_%'" if region == "제주" else ""
        search_query = text(f"""
            SELECT id, {title_field} AS title, {content_field} AS content, location
            FROM seongsu_places
            WHERE region = :region {kopis_exclude}
            ORDER BY embedding <-> :embedding
            LIMIT 5
        """)

        with engine.connect() as conn:
            result = conn.execute(search_query, {"region": region, "embedding": embedding_str})
            places_found = [dict(row._mapping) for row in result]
            context_list = [f"[{p['title']}] {p['content']} (위치: {p['location']})" for p in places_found]

            context_text = "\n".join(context_list)
            
        logger.info(f"🧠 [AskAI Context] Region: {region}, Lang: {lang}, Found: {len(context_list)} places")
        logger.info(f"Context Text Preview: {context_text[:200]}")

        if not context_text.strip():
            logger.warning("⚠️ 벡터 검색 결과가 비어있습니다. Gemini가 답변을 거부할 가능성이 높습니다.")

        # 3. Gemini 답변 생성
        answer = await asyncio.to_thread(generate_answer, question.user_query, context_text, region=region, lang=lang)

        return {"answer": answer, "places": places_found}
    except Exception as e:
        logger.error(f"❌ Ask failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
async def search_places(q: str, region: str = "성수", lang: str = "ko"):
    """[핵심] 다국어 검색 (벡터 기반)"""
    if lang not in ("ko", "en", "zh"):
        lang = "ko"
    try:
        query_embedding = await asyncio.to_thread(get_embedding, q)
        embedding_str = f"[{','.join(map(str, query_embedding))}]"

        title_field = _lang_col(lang, "title")
        content_field = _lang_col(lang, "content")

        query = text(f"""
            SELECT id, {title_field} as title, {content_field} as content, image_url, video_url, location, date_range, latitude, longitude, region
            FROM seongsu_places
            WHERE region = :region
            ORDER BY embedding <-> :embedding
            LIMIT 10
        """)
        
        with engine.connect() as conn:
            result = conn.execute(query, {"region": region, "embedding": embedding_str})
            return [dict(row._mapping) for row in result]
    except Exception as e:
        logger.error(f"❌ Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/places/popular")
async def get_popular_places(limit: Optional[int] = None, offset: int = 0):
    """인기 랭킹 (조회수+좋아요*2 가중치, 하루 2회 갱신 캐시). 지역 무관 통합 랭킹(공연 제외)."""
    data = _place_popularity_cache[offset:]
    if limit is not None:
        data = data[:min(limit, 500)]
    return data

@app.get("/places/popular/performance")
async def get_popular_performances(limit: Optional[int] = None, offset: int = 0):
    """공연 전용 인기 랭킹 (플레이스 랭킹과 동일 산식/캐시 주기, 공연만 집계)."""
    data = _performance_popularity_cache[offset:]
    if limit is not None:
        data = data[:min(limit, 500)]
    return data

@app.get("/places/popular/festival")
async def get_popular_festivals(limit: Optional[int] = None, offset: int = 0):
    """축제 전용 인기 랭킹 (플레이스 랭킹과 동일 산식/캐시 주기, region='축제'만 집계)."""
    data = _festival_popularity_cache[offset:]
    if limit is not None:
        data = data[:min(limit, 500)]
    return data

@app.get("/places/closing-soon")
async def get_closing_soon():
    """핫플 탭 상단 '마감임박' 전광판용 (하루 1회 갱신 캐시). /places/{place_id}보다 먼저 등록해야
    FastAPI가 'closing-soon'을 place_id로 오인해 파싱 에러를 내는 라우팅 충돌을 피할 수 있음."""
    return _closing_soon_cache

@app.post("/itinerary")
async def create_itinerary(req: TourRequest, region: str = "성수", lang: str = "ko", viewer: dict = Depends(_verify_supabase_user)):
    import json
    from datetime import date
    if lang not in ("ko", "en", "zh"):
        lang = "ko"
    try:
        today = date.today()
        
        # [NEW LOGIC] Rate Limiting (하루 2회 제한)
        if req.user_id:
            with engine.connect() as conn:
                # 테이블이 없다면 자동 생성
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS user_ai_usages (
                        id SERIAL PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        action_type VARCHAR(50) NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                """))
                conn.commit()

                # 오늘 사용 횟수 조회
                usage_query = text("""
                    SELECT COUNT(*) FROM user_ai_usages 
                    WHERE user_id = :user_id AND action_type = 'itinerary_generate' 
                    AND DATE(created_at) = CURRENT_DATE
                """)
                usage_count = conn.execute(usage_query, {"user_id": req.user_id}).scalar()

                # 2회 이상 사용 시 차단
                if usage_count and usage_count >= 2:
                    logger.warning(f"🚫 [Rate Limit] {req.user_id} exceeded daily itinerary generation limit.")
                    raise HTTPException(status_code=403, detail="오늘 제공된 AI 코스 생성 기회(2회)를 모두 사용하셨습니다. 내일 다시 이용해주세요!")

        # 1. 캐시 확인 (지역 및 언어 정보 포함)
        with engine.connect() as conn:
            # 캐시 키에 언어 추가 (현재는 단순 companion/date 기반이나 확장이 필요할 수 있음)
            cache_query = text("SELECT itinerary_json FROM ai_itinerary_cache WHERE companion = :companion AND created_at = :today")
            cached_result = conn.execute(cache_query, {"companion": req.companion, "today": today}).fetchone()
            
            if cached_result:
                logger.info(f"✨ [Cache Hit] Returning cached itinerary for {req.companion}")
                return cached_result[0]

        # 2. 캐시 없으면 Gemini 호출 (언어에 맞는 필드 가져옴)
        title_field = _lang_col(lang, "title")
        content_field = _lang_col(lang, "content")

        # 후보 장소 선정: 기존엔 ORDER BY RANDOM()이라 매번 완전히 무작위였음(편향 버그의 응급조치였을 뿐,
        # "이 동행에 맞는 장소를 고른다"는 문제 자체는 회피한 상태) — companion을 자연어 쿼리로 바꿔
        # pgvector 임베딩 유사도로 정렬하고, 카테고리별 ROW_NUMBER round-robin으로 한 카테고리 쏠림 방지
        _COMPANION_QUERY = {
            "solo": "혼자 조용히 둘러보기 좋은 감성적인 장소",
            "couple": "연인과 함께 가기 좋은 로맨틱한 데이트 장소",
            "friends": "친구들과 함께 즐겁게 놀기 좋은 활기찬 장소",
        }
        companion_query_text = _COMPANION_QUERY.get(req.companion.strip().lower(), "누구와 가도 좋은 인기 장소")
        companion_embedding = await asyncio.to_thread(get_embedding, companion_query_text)
        companion_embedding_str = f"[{','.join(map(str, companion_embedding))}]"

        search_query = text(f"""
            WITH ranked AS (
                SELECT id, {title_field} AS title, {content_field} AS content, location, date_range,
                       ROW_NUMBER() OVER (
                           PARTITION BY COALESCE(category, 'popup')
                           ORDER BY embedding <-> :embedding
                       ) AS rn,
                       COALESCE(category, 'popup') AS cat
                FROM seongsu_places
                WHERE region = :region AND (end_date IS NULL OR end_date >= CURRENT_DATE)
                  AND naver_place_id NOT LIKE 'kopis_%' AND naver_place_id NOT LIKE 'jeju_%' AND naver_place_id NOT LIKE 'culture_%'
            )
            SELECT id, title, content, location, date_range FROM ranked
            ORDER BY rn ASC, cat ASC
            LIMIT 15
        """)
        with engine.connect() as conn:
            result = conn.execute(search_query, {"region": region, "embedding": companion_embedding_str})
            rows = result.fetchall()
            context_text = "\n".join([f"[id:{row[0]}][{row[1]}] {row[2]} (위치: {row[3]})" + (f" (운영일시: {row[4]})" if row[4] else "") for row in rows])
        
        from gemini_service import generate_walking_tour
        # 프롬프트에 지역 및 언어 정보 전달 (동기 함수라 스레드로 오프로딩)
        itinerary = await asyncio.to_thread(generate_walking_tour, req.companion, context_text, region=region, lang=lang)

        # 3. 결과 캐싱
        try:
            with engine.connect() as conn:
                insert_cache = text("""
                    INSERT INTO ai_itinerary_cache (companion, itinerary_json, created_at)
                    VALUES (:companion, :json, :today)
                    ON CONFLICT (companion, created_at) DO UPDATE SET itinerary_json = EXCLUDED.itinerary_json
                """)
                conn.execute(insert_cache, {
                    "companion": req.companion,
                    "json": json.dumps(itinerary),
                    "today": today
                })
                conn.commit()
                logger.info(f"💾 [Cache Save] Itinerary for {req.companion} saved to cache")
        except Exception as cache_err:
            logger.error(f"❌ Cache save failed: {cache_err}")

        # [NEW LOGIC] 성공 시 사용 이력 저장
        if req.user_id:
            try:
                with engine.connect() as conn:
                    insert_usage = text("""
                        INSERT INTO user_ai_usages (user_id, action_type) 
                        VALUES (:user_id, 'itinerary_generate')
                    """)
                    conn.execute(insert_usage, {"user_id": req.user_id})
                    conn.commit()
            except Exception as usage_err:
                logger.error(f"❌ Usage logging failed: {usage_err}")

        return itinerary
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"❌ Itinerary creation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/places")
async def list_places(region: Optional[str] = None, category: Optional[str] = None, limit: Optional[int] = None, offset: int = 0, sort: Optional[str] = None):
    # limit 미지정 시 기존 동작(전체 반환) 유지 — sitemap.ts/posts 상세 페이지가 region 없이 전체를 가져와 사용함
    where_clause = "WHERE p.region = :region AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)" if region else "WHERE (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)"
    # 공연은 KOPIS 데이터만 목록에 노출 (구 소스는 SEO 색인 보존을 위해 DB엔 남기되 리스트에서만 제외, 만료는 기존 45일 유예 로직에 위임)
    if region == "공연":
        where_clause += " AND p.naver_place_id LIKE 'kopis_%'"
    # 제주는 2026-07-21부터 KOPIS/jeju.go.kr 수집 중단(비짓제주 API로 대체) — 기존 kopis_/jeju_ 접두
    # 레거시 데이터는 SEO 색인 보존을 위해 DB엔 남기되 새 팝업/클래스/행사/쇼핑 목록에는 섞이지 않도록 제외
    elif region == "제주":
        where_clause += " AND p.naver_place_id NOT LIKE 'kopis_%' AND p.naver_place_id NOT LIKE 'jeju_%' AND p.naver_place_id NOT LIKE 'culture_%'"
    # category: 'class'=원데이클래스/체험, 'popup'=팝업스토어(기존 데이터는 category가 NULL이라 COALESCE로 보정),
    # 'shopping'/'전시'=Visit Seoul 데이터(성수/홍대/강북/강남 하위), '행사'=비짓제주 축제/행사(제주 하위)
    # 공연(서울)은 장르 서브탭: 연극/뮤지컬/음악(대중음악)/종합(그 외 클래식·국악·무용·서커스마술·복합)
    if category == "class":
        where_clause += " AND p.category = 'class'"
    elif category == "shopping":
        where_clause += " AND p.category = 'shopping'"
    elif category == "전시":
        where_clause += " AND p.category = '전시'"
    elif category == "행사":
        where_clause += " AND p.category = '행사'"
    elif category == "popup":
        where_clause += " AND COALESCE(p.category, 'popup') = 'popup' AND p.naver_place_id NOT LIKE 'kopis_%' AND p.naver_place_id NOT LIKE 'jeju_%' AND p.naver_place_id NOT LIKE 'culture_%'"
    elif category in ("연극", "뮤지컬", "음악", "종합"):
        where_clause += f" AND p.category = '{category}'"
    limit_clause = "LIMIT :limit OFFSET :offset" if limit is not None else ""
    base_cols = "p.id, p.title, p.title_en, p.title_zh, p.content, p.content_en, p.content_zh, p.image_url, p.video_url, p.location, p.date_range, p.end_date, p.latitude, p.longitude, p.region, p.category, p.pinned_at, p.naver_place_id"
    # sort 옵션: 'latest'(신규 수집순), 'popular'(최근 30일 조회+좋아요 인기순), 'closing'(마감임박순), 기본은 랜덤
    # 예전엔 GREATEST(updated_at, created_at)를 썼는데, 블로그갱신(어드민 수동 편집 + 신규 팝업 자동갱신 스케줄러)이
    # updated_at을 계속 찍다 보니 몇 달 전 수집된 팝업이 오늘 갱신됐다는 이유만으로 "최신순" 상위에 튀어오르는
    # 문제가 생김 — "최신순"은 사용자 입장에서 "신규 추가"를 의미하므로 created_at만 기준으로 함
    if sort == "popular":
        query = text(
            f"SELECT {base_cols}, COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT v.id) AS score "
            f"FROM seongsu_places p "
            f"LEFT JOIN likes l ON l.place_id = p.id AND l.created_at >= NOW() - INTERVAL '30 days' "
            f"LEFT JOIN place_views v ON v.place_id = p.id AND v.viewed_at >= NOW() - INTERVAL '30 days' "
            f"{where_clause} "
            f"GROUP BY p.id "
            f"ORDER BY p.pinned_at DESC NULLS LAST, score DESC, p.created_at DESC {limit_clause}"
        )
    else:
        order_clause = (
            "p.created_at DESC" if sort == "latest"
            else "p.end_date ASC NULLS LAST" if sort == "closing"
            else "RANDOM()"
        )
        query = text(
            f"SELECT {base_cols} "
            f"FROM seongsu_places p {where_clause} "
            f"ORDER BY p.pinned_at DESC NULLS LAST, {order_clause} {limit_clause}"
        )
    with engine.connect() as conn:
        params = {"offset": offset}
        if limit is not None:
            params["limit"] = min(limit, 500)
        if region:
            params["region"] = region
        result = conn.execute(query, params)
        return [dict(row._mapping) for row in result]

@app.get("/places/categories")
async def list_place_categories(region: str):
    """지역별 서브탭 동적 렌더링용 — 해당 지역에 실제(만료 안 된) 데이터가 있는 category 목록만 반환."""
    query = text("""
        SELECT DISTINCT COALESCE(category, 'popup') AS category
        FROM seongsu_places
        WHERE region = :region AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND naver_place_id NOT LIKE 'kopis_%' AND naver_place_id NOT LIKE 'jeju_%' AND naver_place_id NOT LIKE 'culture_%'
    """)
    with engine.connect() as conn:
        result = conn.execute(query, {"region": region})
        return [row[0] for row in result]

@app.get("/places/{place_id}")
async def get_place(place_id: int):
    query = text("SELECT id, title, title_en, title_zh, content, content_en, content_zh, image_url, video_url, location, date_range, end_date, latitude, longitude, region, category, naver_place_id, blog_reviews, link_url, link_title, created_at FROM seongsu_places WHERE id = :id")
    with engine.connect() as conn:
        result = conn.execute(query, {"id": place_id})
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Place not found")
        place = dict(row._mapping)
        # 핫플인증 배지 — 현재 TOP25 인기 랭킹에 들어있는지 + 랭킹 갱신 시각
        hot_rank = next((i + 1 for i, r in enumerate(_place_popularity_cache[:25]) if r["id"] == place_id), None)
        place["hot_rank"] = hot_rank
        place["hot_rank_updated_at"] = _popularity_last_refreshed if hot_rank else None
        return place

@app.post("/places/{place_id}/view")
async def record_place_view(place_id: int):
    """장소 조회수 기록 — 상세 페이지 진입 시 호출"""
    with engine.connect() as conn:
        conn.execute(text("INSERT INTO place_views (place_id) VALUES (:place_id)"), {"place_id": place_id})
        conn.commit()
    return {"ok": True}

_place_popularity_cache: list = []
_performance_popularity_cache: list = []
_festival_popularity_cache: list = []
_popularity_last_refreshed: Optional[str] = None

def _popularity_rows(conn, interval_days: int, limit: int = 100, only_performance: bool = False, only_festival: bool = False, min_score: int = 0, exclude_jeju: bool = False):
    """조회수/좋아요 기반 인기 랭킹 쿼리 — interval_days 기간 내 활동만 집계.
    only_performance=False, only_festival=False(기본, 플레이스 랭킹): 공연/축제 제외, 원데이클래스/체험(category='class')도 제외해 팝업만 집계
    (어드민 CSV가 "이번주 핫플 팝업" 기사 작성용이라 학원류가 섞이면 편집상 어색함).
    only_performance=True(공연 랭킹 전용): 공연(KOPIS 수집분)만 집계.
    only_festival=True(축제 랭킹 전용): region='축제'만 집계.
    min_score: 이 점수 미만인 항목은 아예 제외(신규 카테고리라 조회수가 거의 없을 때 0점짜리로 25위를 억지로 채우지 않기 위함).
    exclude_jeju: 화면 표시용 TOP25/인기 캐시에는 제주 팝업도 포함하되, 주간 CSV(이번주 핫플 팝업 기사용)에서만
    제주를 빼고 싶을 때 사용 — 서울권 팝업 기사에 제주가 섞이면 편집상 어색하다는 요청."""
    if only_performance:
        region_clause = "AND p.region = '공연' AND p.naver_place_id LIKE 'kopis_%'"
    elif only_festival:
        region_clause = "AND p.region = '축제'"
    else:
        region_clause = "AND p.region != '공연' AND p.region != '축제' AND COALESCE(p.category, 'popup') = 'popup' AND p.naver_place_id NOT LIKE 'kopis_%' AND p.naver_place_id NOT LIKE 'jeju_%' AND p.naver_place_id NOT LIKE 'culture_%'"
        if exclude_jeju:
            region_clause += " AND p.region != '제주'"
    having_clause = f"HAVING COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT v.id) >= {min_score}" if min_score > 0 else ""
    return conn.execute(text(f"""
        SELECT p.id, p.title, p.title_en, p.title_zh, p.content, p.content_en, p.content_zh, p.image_url, p.location, p.region, p.category, p.naver_place_id, p.updated_at, p.date_range, p.blog_reviews,
               COUNT(DISTINCT l.id) AS like_count,
               COUNT(DISTINCT v.id) AS view_count,
               COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT v.id) AS score
        FROM seongsu_places p
        LEFT JOIN likes l ON l.place_id = p.id AND l.created_at >= NOW() - INTERVAL '{interval_days} days'
        LEFT JOIN place_views v ON v.place_id = p.id AND v.viewed_at >= NOW() - INTERVAL '{interval_days} days'
        WHERE (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
          {region_clause}
        GROUP BY p.id
        {having_clause}
        ORDER BY score DESC, p.created_at DESC
        LIMIT {limit}
    """))

_MIN_RANKING_SCORE = 3  # 이 미만 점수(조회1~2건 수준)는 25위 안이라도 노출 안 함 — 신생 카테고리(축제 등) 0점 채우기 방지

def refresh_place_popularity():
    """장소 인기 랭킹 재계산 — 조회수(최근48시간, 부족시 30일 확장) + 좋아요*2. 하루 6회(한국시간 4시간 간격) 실행.
    메인 페이지 '추천' 탭(/places/popular)과 어드민 랭킹(/admin/ranking/weekly)이 공통으로 사용.
    48시간으로 좁힌 이유: 7일 창에서는 소수 인기 항목의 트래픽 쏠림(자기강화)으로 순위가 거의 안 바뀌는 문제 완화.
    _MIN_RANKING_SCORE 미만 항목은 아예 제외해, 활동이 적을 땐 25개를 억지로 채우지 않고 그보다 적게 노출될 수 있음."""
    global _place_popularity_cache, _performance_popularity_cache, _festival_popularity_cache, _popularity_last_refreshed
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS place_views (
                id SERIAL PRIMARY KEY,
                place_id INTEGER NOT NULL,
                viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_place_views_place_viewed ON place_views (place_id, viewed_at)"))
        # 톱25 'NEW' 배지용 — 프로세스 재시작에도 이전 톱25 목록이 유지되도록 DB에 스냅샷 저장(메모리 캐시만 쓰면 재배포할 때마다 전부 NEW로 오탐)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ranking_snapshot (
                id INTEGER PRIMARY KEY DEFAULT 1,
                top25_ids JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CHECK (id = 1)
            )
        """))
        conn.execute(text("ALTER TABLE ranking_snapshot ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"))
        conn.commit()

        prev_snapshot = conn.execute(text("SELECT top25_ids, updated_at FROM ranking_snapshot WHERE id = 1")).fetchone()
        prev_top25_ids = set(prev_snapshot[0]) if prev_snapshot else set()
        # 배포/재시작 때마다 이 함수가 다시 호출되는데, 그때마다 스냅샷을 덮어쓰면 4시간이 안 지났어도
        # "이전 목록 = 방금 계산한 현재 목록"이 되어 NEW가 즉시 사라짐 — 실제 주기(4시간)보다 충분히 짧은
        # 시간 내 재호출이면 스냅샷을 갱신하지 않고 기존 기준선 그대로 비교만 함
        is_real_cycle = (prev_snapshot is None) or (datetime.now(timezone.utc) - prev_snapshot[1] >= timedelta(hours=3))

        result = list(_popularity_rows(conn, 2, min_score=_MIN_RANKING_SCORE))
        if len(result) < 25:
            result = list(_popularity_rows(conn, 30, min_score=_MIN_RANKING_SCORE))
        _place_popularity_cache = [dict(row._mapping) for row in result]

        current_top25_ids = [item["id"] for item in _place_popularity_cache[:25]]
        new_ids = set(current_top25_ids) - prev_top25_ids
        for item in _place_popularity_cache:
            item["is_new"] = item["id"] in new_ids
        if is_real_cycle:
            conn.execute(
                text("INSERT INTO ranking_snapshot (id, top25_ids, updated_at) VALUES (1, CAST(:ids AS jsonb), NOW()) ON CONFLICT (id) DO UPDATE SET top25_ids = CAST(:ids AS jsonb), updated_at = NOW()"),
                {"ids": json.dumps(current_top25_ids)},
            )
            conn.commit()

        perf_result = list(_popularity_rows(conn, 2, only_performance=True, min_score=_MIN_RANKING_SCORE))
        if len(perf_result) < 25:
            perf_result = list(_popularity_rows(conn, 30, only_performance=True, min_score=_MIN_RANKING_SCORE))
        _performance_popularity_cache = [dict(row._mapping) for row in perf_result]

        fest_result = list(_popularity_rows(conn, 2, only_festival=True, min_score=_MIN_RANKING_SCORE))
        if len(fest_result) < 25:
            fest_result = list(_popularity_rows(conn, 30, only_festival=True, min_score=_MIN_RANKING_SCORE))
        _festival_popularity_cache = [dict(row._mapping) for row in fest_result]

    _popularity_last_refreshed = datetime.now(timezone.utc).isoformat()
    refresh_closing_soon()  # 랭킹과 같은 주기(4시간)로 같이 갱신 — 랜덤 12개라 자주 바뀌어도 자연스러움


_closing_soon_cache: list = []

def refresh_closing_soon():
    """핫플 탭 상단 '마감임박' 전광판용 — refresh_place_popularity()와 같은 주기(4시간)로 갱신.
    14일 이내 마감 예정 중 랜덤 12개를 뽑아 캐시. 팝업 전용(공연/축제/클래스/쇼핑/전시/행사 등은 제외해
    성수/홍대/강북/강남/제주의 순수 팝업스토어만 노출, 정확도 불필요라 랜덤으로 충분)."""
    global _closing_soon_cache
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, title, title_en, title_zh, image_url, region
            FROM seongsu_places
            WHERE end_date IS NOT NULL
              AND end_date >= CURRENT_DATE
              AND end_date <= CURRENT_DATE + INTERVAL '14 days'
              AND COALESCE(category, 'popup') = 'popup'
              AND naver_place_id NOT LIKE 'kopis_%'
              AND naver_place_id NOT LIKE 'jeju_%'
              AND naver_place_id NOT LIKE 'culture_%'
              AND region IN ('성수', '홍대', '강북', '강남', '제주')
            ORDER BY RANDOM()
            LIMIT 12
        """))
        _closing_soon_cache = [dict(row._mapping) for row in result]

@app.get("/admin/ranking/weekly")
async def admin_weekly_ranking():
    """장소 인기 TOP 25 (하루 3회 계산된 48시간 캐시 반환, 메인 추천 랭킹과 동일 산식). 공연 제외.
    blog_reviews만은 캐시가 아닌 실시간 DB 값으로 덮어씀 — 4시간 캐시 주기 사이에 어드민에서 갱신해도
    "미갱신"으로 잘못 표시되던 동기화 문제 수정(캐시 자체를 매번 새로 계산하기엔 무겁고, 여기선 필요 없음)."""
    top25 = [dict(item) for item in _place_popularity_cache[:25]]
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

@app.get("/admin/ranking/weekly7d")
async def admin_weekly_ranking_7d():
    """CSV 다운로드(주간 콘텐츠 제작용) 전용 — 화면 표시용 48시간 캐시와 별개로 항상 최신 7일 데이터를 즉석 계산.
    "이번주 핫플 팝업" 서울권 기사용이라 제주는 제외(화면 표시용 TOP25는 제주 포함 그대로 유지)."""
    with engine.connect() as conn:
        result = list(_popularity_rows(conn, 7, exclude_jeju=True))
        if len(result) < 25:
            result = list(_popularity_rows(conn, 30, exclude_jeju=True))
        return [dict(row._mapping) for row in result[:25]]

@app.post("/places/upload-image")
async def upload_place_image(file: UploadFile = File(...)):
    """어드민 장소 등록/수정 화면에서 이미지 파일 직접 업로드 (압축 후 Supabase Storage 저장)."""
    try:
        raw_bytes = await file.read()
        url = upload_bytes(raw_bytes, name_hint=file.filename or "upload")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/places")
async def create_place(place: PlaceUpdate):
    try:
        data = place.dict(exclude_unset=True)
        # 필수값 기본 설정 (DB 스키마 오류 방지)
        if "title" not in data:
            raise HTTPException(status_code=400, detail="title is required")
        if "content" not in data:
            data["content"] = ""

        # 외부 이미지 URL → Supabase Storage 재호스팅 (hotlink 차단/SEO 색인 오류 방지)
        if data.get("image_url"):
            data["image_url"] = rehost_image(data["image_url"])

        # 임베딩 생성
        data["embedding"] = f"[{','.join(map(str, get_embedding(data['content'])))}]"
        
        columns = ", ".join(data.keys())
        placeholders = ", ".join([f":{k}" for k in data.keys()])
        
        query = text(f"INSERT INTO seongsu_places ({columns}) VALUES ({placeholders})")
        with engine.connect() as conn:
            conn.execute(query, data)
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _revalidate_place(place_id: int):
    """공개 도메인으로 호출 — 127.0.0.1:3002는 프로덕션 서버 안에서만 유효한 주소라 로컬 백엔드(텔레그램 봇 등)에서
    호출하면 로컬 3002번(아무것도 없음)으로 가서 조용히 실패했음. 공개 URL로 바꾸면 로컬/프로덕션 어디서 트리거해도 동작함."""
    try:
        secret = os.getenv("ADMIN_SECRET_KEY", "")
        url = f"https://now.nemoneai.com/api/revalidate?path=/posts/{place_id}&secret={secret}"
        urllib.request.urlopen(url, timeout=8)
    except Exception:
        pass

def _translate_and_save(place_id: int, new_title: Optional[str], new_content: Optional[str]):
    """어드민 저장과 별개로 백그라운드에서 영문/중문 번역 후 DB에 반영 (저장 응답 지연 방지)."""
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT title, content FROM seongsu_places WHERE id = :id"),
                {"id": place_id}
            ).fetchone()
            if not row:
                return
            title = new_title if new_title is not None else row.title
            content = new_content if new_content is not None else row.content
            title_en, content_en, title_zh, content_zh = ai_translate(title, content)
            if title_en:
                conn.execute(
                    text("""
                        UPDATE seongsu_places SET
                            title_en = :title_en, content_en = :content_en,
                            title_zh = :title_zh, content_zh = :content_zh
                        WHERE id = :id
                    """),
                    {"title_en": title_en, "content_en": content_en,
                     "title_zh": title_zh, "content_zh": content_zh, "id": place_id}
                )
                conn.commit()
    except Exception as e:
        logger.error(f"❌ 백그라운드 번역 실패 (place_id={place_id}): {e}")

@app.put("/places/{place_id}")
async def update_place(place_id: int, place: PlaceUpdate):
    try:
        import re as _re
        from datetime import date as _date
        update_data = place.dict(exclude_unset=True)
        if update_data.get("image_url"):
            update_data["image_url"] = rehost_image(update_data["image_url"])
        if "content" in update_data:
            update_data["embedding"] = f"[{','.join(map(str, get_embedding(update_data['content'])))}]"
        # 어드민이 title/content를 직접 수정하면 영문 번역도 같이 갱신 (안 그러면 예전 번역이 새 내용과 어긋난 채 남음)
        # AI 호출(수 초 소요)로 저장 응답이 느려지지 않도록 백그라운드 스레드로 분리 — title/content 저장은 즉시 반영되고, 번역은 잠시 후 뒤따라 채워짐
        if "title" in update_data or "content" in update_data:
            _new_title = update_data.get("title")
            _new_content = update_data.get("content")
            threading.Thread(
                target=_translate_and_save, args=(place_id, _new_title, _new_content), daemon=True
            ).start()
        # date_range → end_date 자동 파싱 (어드민에서 운영일시만 수정해도 삭제 기준 동기화)
        if "date_range" in update_data and "end_date" not in update_data:
            dr = update_data["date_range"] or ""
            end_part = dr.split("~")[-1]
            # 어드민은 보통 "26.06.09."처럼 2자리 연도로 입력하므로 2~4자리 모두 허용
            m = _re.search(r"(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})", end_part)
            if m:
                try:
                    year = int(m.group(1))
                    if year < 100:
                        year += 2000
                    update_data["end_date"] = _date(year, int(m.group(2)), int(m.group(3)))
                except ValueError:
                    pass
            else:
                # "미정" 등 종료일을 특정할 수 없는 경우 — end_date를 비워 무기한(자동삭제 대상 아님)으로 처리
                # (기존엔 여기서 아무것도 안 해서 스크래핑 당시의 임시 end_date가 그대로 남아있었음)
                update_data["end_date"] = None
        # pinned bool → pinned_at timestamp
        if "pinned" in update_data:
            update_data["pinned_at"] = "NOW()" if update_data.pop("pinned") else None
        set_parts = []
        for k in update_data.keys():
            if k == "pinned_at" and update_data[k] == "NOW()":
                set_parts.append("pinned_at = NOW()")
            else:
                set_parts.append(f"{k} = :{k}")
        if update_data.get("pinned_at") == "NOW()":
            del update_data["pinned_at"]
        # 어드민 저장 시각 기록 — 리스트/랭킹에서 "블로그갱신됨" 표기용
        set_parts.append("updated_at = NOW()")
        set_clause = ", ".join(set_parts)
        query = text(f"UPDATE seongsu_places SET {set_clause} WHERE id = :place_id")
        with engine.connect() as conn:
            conn.execute(query, {**update_data, "place_id": place_id})
            conn.commit()
        threading.Thread(target=_revalidate_place, args=(place_id,), daemon=True).start()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def _enrich_place_core(place_id: int) -> dict:
    """블로그갱신 실제 처리 로직 — HTTP 엔드포인트(/places/{id}/enrich)와 텔레그램 봇 둘 다에서 재사용.
    FastAPI에 종속되지 않도록 HTTPException 대신 ValueError/RuntimeError를 던짐."""
    import asyncio
    import re as _re

    # 1. DB에서 place 정보 조회
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT title, location, naver_place_id FROM seongsu_places WHERE id = :id"),
            {"id": place_id}
        ).fetchone()
    if not row:
        raise ValueError("Place not found")

    title = row[0] or ""
    location = row[1] or ""
    naver_place_id = row[2] or ""
    if not naver_place_id:
        raise ValueError("naver_place_id 없음 — pcmap 조회 불가")

    # 2. pcmap 방문자 리뷰 탭 — 블로그 카드 스크래핑
    try:
        from playwright.async_api import async_playwright

        blog_reviews: list[dict] = []
        road_text = ""

        async def _scrape():
            nonlocal road_text
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                ctx = await browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                )
                page = await ctx.new_page()

                # 홈 탭 — Apollo state에서 road 텍스트만 수집
                await page.goto(
                    f"https://pcmap.place.naver.com/place/{naver_place_id}/home",
                    wait_until="domcontentloaded", timeout=25000
                )
                await page.wait_for_timeout(2000)
                home_html = await page.content()
                apollo_match = _re.search(r'window\.__APOLLO_STATE__\s*=\s*(\{.+?\});\s*</script>', home_html, _re.DOTALL)
                if apollo_match:
                    try:
                        apollo = json.loads(apollo_match.group(1))
                        for key, val in apollo.items():
                            if key.startswith("PlaceDetailBase:") and isinstance(val, dict):
                                road_text = val.get("road") or ""
                    except Exception:
                        pass

                async def _extract_blog_cards(pg):
                    return await pg.evaluate("""() => {
                        const result = [];
                        const links = document.querySelectorAll('a[href*="blog.naver.com"]');
                        for (const a of links) {
                            const lines = (a.innerText || '').split('\\n').map(s => s.trim()).filter(Boolean);
                            const title = lines[3] || lines[2] || lines[1] || lines[0] || '';
                            const img = a.querySelector('img');
                            if (title.length > 5) {
                                result.push({
                                    title: title.substring(0, 100),
                                    url: a.href,
                                    thumbnail: img ? img.src : ''
                                });
                            }
                            if (result.length >= 5) break;
                        }
                        return result;
                    }""")

                # 블로그 리뷰 탭
                await page.goto(
                    f"https://pcmap.place.naver.com/place/{naver_place_id}/review/ugc",
                    wait_until="domcontentloaded", timeout=25000
                )
                await page.wait_for_timeout(3000)
                cards = await _extract_blog_cards(page)

                await browser.close()
                return cards

        blog_reviews = await asyncio.wait_for(_scrape(), timeout=45)

    except Exception as e:
        logger.warning(f"pcmap 스크래핑 실패 ({naver_place_id}): {e}")
        blog_reviews = []
        road_text = ""

    # 3. Gemini로 고품질 소개 생성
    try:
        from google import genai as _genai
        client = _genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        blog_block = ""
        if blog_reviews:
            blog_block = "\n실제 방문자 블로그 후기 제목:\n" + "\n".join(f"- {r['title']}" for r in blog_reviews)
        road_block = f"\n찾아오는 길: {road_text}" if road_text else ""

        if blog_reviews:
            length_guide = "3~4문장, 1문단으로"
        else:
            length_guide = "2~3문단으로 구체적으로 (각 문단은 빈 줄로 구분)"

        prompt = (
            f"다음 팝업스토어 소개 글을 {length_guide} 작성해줘.\n"
            f"장소명: {title}\n위치: {location}"
            f"{blog_block}"
            f"{road_block}\n\n"
            f"조건: 방문자 입장에서, 이모지 없이, 마크다운 기호 없이, 선택지/옵션 없이 소개 문구만 출력. "
            f"블로그 후기 제목이 있다면 그 분위기와 특징을 반드시 녹여낼 것."
        )

        resp = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        generated = (resp.text or "").strip()[:600]
    except Exception as e:
        raise RuntimeError(f"Gemini 생성 실패: {e}")

    # 4. DB 저장 — content 업데이트 + blog_reviews 저장 + 갱신 시각 기록
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE seongsu_places SET content = :content, blog_reviews = :blog_reviews, updated_at = NOW() WHERE id = :id"),
            {
                "content": generated,
                "blog_reviews": json.dumps(blog_reviews, ensure_ascii=False) if blog_reviews else None,
                "id": place_id,
            }
        )
        conn.commit()

    # content가 바뀌었으니 영문/중문 번역도 백그라운드로 갱신 (안 그러면 예전 번역이 새 내용과 어긋난 채 남음)
    threading.Thread(target=_translate_and_save, args=(place_id, None, generated), daemon=True).start()

    # 상세 페이지가 5분 ISR 캐시라 이걸 안 부르면 캐시 만료 전까지 옛 내용이 계속 보임(일반 저장 플로우는 이미 호출 중)
    threading.Thread(target=_revalidate_place, args=(place_id,), daemon=True).start()

    return {
        "content": generated,
        "blog_reviews": blog_reviews,
        "has_road": bool(road_text),
    }


@app.post("/places/{place_id}/enrich")
async def enrich_place_content(place_id: int):
    """pcmap에서 방문자 리뷰 텍스트를 수집해 Gemini로 고품질 소개 생성. 어드민 수동 트리거용."""
    try:
        return await _enrich_place_core(place_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/places/{place_id}")
async def delete_place(place_id: int, viewer: dict = Depends(_verify_supabase_user)):
    if viewer["email"] != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="관리자만 삭제할 수 있습니다")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT image_url FROM seongsu_places WHERE id = :place_id"), {"place_id": place_id}).fetchone()
        conn.execute(text("DELETE FROM seongsu_places WHERE id = :place_id"), {"place_id": place_id})
        conn.commit()
    if row and row[0]:
        delete_image(row[0])
    return {"status": "success"}

@app.get("/users/{user_id}/usage/itinerary")
async def get_user_itinerary_usage(user_id: str):
    """오늘 남은 AI 코스 생성 횟수 조회"""
    try:
        with engine.connect() as conn:
            # 테이블 존재 확인 (없으면 생성)
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_ai_usages (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    action_type VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            """))
            conn.commit()

            query = text("""
                SELECT COUNT(*) FROM user_ai_usages 
                WHERE user_id = :user_id AND action_type = 'itinerary_generate' 
                AND DATE(created_at) = CURRENT_DATE
            """)
            count = conn.execute(query, {"user_id": user_id}).scalar()
            return {"usage_count": count or 0, "limit": 2}
    except Exception as e:
        logger.error(f"❌ Failed to fetch usage: {e}")
        return {"usage_count": 0, "limit": 2}

@app.get("/feedbacks")
async def get_feedbacks():
    query = text("SELECT * FROM feedbacks ORDER BY created_at DESC")
    with engine.connect() as conn:
        result = conn.execute(query)
        return [dict(row._mapping) for row in result]

@app.post("/feedbacks")
async def create_feedback(req: FeedbackCreate, viewer: dict = Depends(_verify_supabase_user)):
    query = text("INSERT INTO feedbacks (user_id, user_name, content) VALUES (:user_id, :name, :content)")
    with engine.connect() as conn:
        conn.execute(query, {"user_id": viewer["id"], "name": req.user_name, "content": req.content})
        conn.commit()
    return {"status": "success"}

@app.put("/feedbacks/{feedback_id}")
async def update_feedback(feedback_id: int, req: FeedbackUpdate, viewer: dict = Depends(_verify_supabase_user)):
    with engine.connect() as conn:
        feedback = conn.execute(text("SELECT user_id FROM feedbacks WHERE id = :id"), {"id": feedback_id}).fetchone()
        if not feedback:
            raise HTTPException(status_code=404, detail="Not Found")
        if feedback[0] != viewer["id"] and viewer["email"] != ADMIN_EMAIL:
            raise HTTPException(status_code=403, detail="Unauthorized")

        conn.execute(text("UPDATE feedbacks SET content = :content WHERE id = :id"), {"content": req.content, "id": feedback_id})
        conn.commit()
    return {"status": "success"}

@app.delete("/feedbacks/{feedback_id}")
async def delete_feedback(feedback_id: int, viewer: dict = Depends(_verify_supabase_user)):
    with engine.connect() as conn:
        feedback = conn.execute(text("SELECT user_id FROM feedbacks WHERE id = :id"), {"id": feedback_id}).fetchone()
        if not feedback:
            raise HTTPException(status_code=404, detail="Not Found")
        if feedback[0] != viewer["id"] and viewer["email"] != ADMIN_EMAIL:
            raise HTTPException(status_code=403, detail="Unauthorized")

        conn.execute(text("DELETE FROM feedbacks WHERE id = :id"), {"id": feedback_id})
        conn.commit()
    return {"status": "success"}

@app.post("/feedbacks/{feedback_id}/reply")
async def reply_feedback(feedback_id: int, req: dict, viewer: dict = Depends(_verify_supabase_user)):
    if viewer["email"] != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin only")
    with engine.connect() as conn:
        conn.execute(text("UPDATE feedbacks SET admin_reply = :reply WHERE id = :id"), {"reply": req.get("reply", ""), "id": feedback_id})
        conn.commit()
    return {"status": "success"}

@app.get("/admin/places")
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

@app.get("/banner")
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

@app.post("/admin/banner")
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

@app.get("/admin/stats")
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

refresh_place_popularity()  # 내부에서 refresh_closing_soon()도 같이 호출됨

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_expired_data, 'cron', hour=0, minute=0)
# 서버는 UTC 기준 — 한국시간(KST=UTC+9) 4시간 간격(0/4/8/12/16/20시)에 맞춰 UTC 15/19/23/03/07/11시에 실행
scheduler.add_job(refresh_place_popularity, 'cron', hour=15, minute=5, id='ranking_kst_0000')
scheduler.add_job(refresh_place_popularity, 'cron', hour=19, minute=5, id='ranking_kst_0400')
scheduler.add_job(refresh_place_popularity, 'cron', hour=23, minute=5, id='ranking_kst_0800')
scheduler.add_job(refresh_place_popularity, 'cron', hour=3, minute=5, id='ranking_kst_1200')
scheduler.add_job(refresh_place_popularity, 'cron', hour=7, minute=5, id='ranking_kst_1600')
scheduler.add_job(refresh_place_popularity, 'cron', hour=11, minute=5, id='ranking_kst_2000')
scheduler.start()

# 신규 팝업 자동 블로그갱신 — 10분마다 blog_reviews가 비어있는 네이버 팝업(공연/축제/코피스/비짓제주 등
# 레거시 소스 제외)을 찾아 자동으로 갱신. Playwright가 로컬에만 있어 프로덕션에선 절대 켜면 안 됨 —
# 로컬 .env에만 AUTO_ENRICH_POPUPS=true를 넣어서 게이트.
# created_at 7일(지난주치까지) 이내로 한정 — 매주 목요일 스크래핑분만 대상으로 하고 그보다 예전부터
# 쌓인 미갱신 백로그는 안 건드림(백로그는 기존처럼 어드민/텔레그램 수동 트리거로 처리).
_auto_enrich_success_count = 0
_auto_enrich_fail_count = 0

def _auto_enrich_new_popups() -> None:
    import asyncio as _asyncio
    global _auto_enrich_success_count, _auto_enrich_fail_count
    BATCH_LIMIT = 1  # 10분마다 1건 — 안전하게 천천히
    ITEM_TIMEOUT_SEC = 120  # 한 건이 멈춰도 다음 10분 주기를 막지 않도록 상한
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id FROM seongsu_places
            WHERE blog_reviews IS NULL
              AND COALESCE(category, 'popup') = 'popup'
              AND region NOT IN ('공연', '축제')
              AND naver_place_id NOT LIKE 'kopis_%'
              AND naver_place_id NOT LIKE 'jeju_%'
              AND naver_place_id NOT LIKE 'culture_%'
              AND naver_place_id NOT LIKE 'visitjeju_%'
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)
              AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at ASC
            LIMIT :limit
        """), {"limit": BATCH_LIMIT}).fetchall()

    if not rows:
        # 처리할 게 없어짐 = 이번 배치 종료. 뭔가 했었으면(카운터>0) 요약 알림 후 리셋, 이미 0이면(계속 idle) 조용히 넘어감
        if _auto_enrich_success_count or _auto_enrich_fail_count:
            from notification import send_alert
            send_alert(
                f"[신규 팝업 자동 블로그갱신] 배치 완료 — 성공 {_auto_enrich_success_count}건, 실패 {_auto_enrich_fail_count}건"
            )
            _auto_enrich_success_count = 0
            _auto_enrich_fail_count = 0
        return

    for row in rows:
        try:
            _asyncio.run(_asyncio.wait_for(_enrich_place_core(row.id), timeout=ITEM_TIMEOUT_SEC))
            logger.info("[auto_enrich] 완료 (place_id=%s)", row.id)
            _auto_enrich_success_count += 1
        except _asyncio.TimeoutError:
            logger.error("[auto_enrich] 타임아웃(%ss 초과) — 건너뜀 (place_id=%s)", ITEM_TIMEOUT_SEC, row.id)
            _auto_enrich_fail_count += 1
        except Exception as e:
            logger.error("[auto_enrich] 실패 (place_id=%s): %s", row.id, e)
            _auto_enrich_fail_count += 1

if os.getenv("AUTO_ENRICH_POPUPS") == "true":
    scheduler.add_job(_auto_enrich_new_popups, IntervalTrigger(minutes=10), id="auto_enrich_new_popups")

# 텔레그램으로 플레이스 ID 보내면 블로그갱신 트리거 — 로컬 전용(Playwright 없는 프로덕션에선 절대 켜면 안 됨,
# getUpdates 폴링도 두 곳에서 동시에 하면 충돌함). 로컬 .env에만 TELEGRAM_BOT_ENABLED=true를 넣어서 게이트.
if os.getenv("TELEGRAM_BOT_ENABLED") == "true":
    import asyncio as _asyncio
    from telegram_admin_bot import start_bot

    def _enrich_place_sync(place_id: int) -> dict:
        return _asyncio.run(_enrich_place_core(place_id))

    start_bot(_enrich_place_sync)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
