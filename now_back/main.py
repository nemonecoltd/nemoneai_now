from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import engine, cleanup_expired_data
from image_storage import rehost_image, delete_image, upload_bytes, get_storage_usage
from gemini_service import get_embedding, generate_answer, ai_translate
from apscheduler.schedulers.background import BackgroundScheduler
import uvicorn
import logging
import os
import uuid
import json
import threading
import urllib.request

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
class FeedbackCreate(BaseModel):
    user_id: str
    user_name: str
    content: str

class FeedbackReply(BaseModel):
    admin_email: str # 관리자 인증용 유지
    reply: str

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
        ORDER BY computed_like_count DESC, t.created_at DESC
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
            ORDER BY t.created_at DESC
        """)).fetchall()
        return [dict(row._mapping) for row in rows]

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
async def ask_question(question: Question, region: str = "성수", lang: str = "ko"):
    """[핵심] RAG 기반 다국어 질문 답변"""
    try:
        # 1. 질문 벡터화
        query_embedding = get_embedding(question.user_query)
        embedding_str = f"[{','.join(map(str, query_embedding))}]"

        # 2. 벡터 유사도 검색 (상위 5개)
        # 언어에 따라 검색 대상 필드를 다르게 하되, 영문이 비어있으면 한글로 Fallback
        title_field = f"COALESCE({_lang_col(lang, 'title')}, title)"
        content_field = f"COALESCE({_lang_col(lang, 'content')}, content)"

        search_query = text(f"""
            SELECT id, {title_field} AS title, {content_field} AS content, location
            FROM seongsu_places
            WHERE region = :region
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
        answer = generate_answer(question.user_query, context_text, region=region, lang=lang)

        return {"answer": answer, "places": places_found}
    except Exception as e:
        logger.error(f"❌ Ask failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
async def search_places(q: str, region: str = "성수", lang: str = "ko"):
    """[핵심] 다국어 검색 (벡터 기반)"""
    try:
        query_embedding = get_embedding(q)
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

@app.post("/itinerary")
async def create_itinerary(req: TourRequest, region: str = "성수", lang: str = "ko"):
    import json
    from datetime import date
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
        
        search_query = text(f"SELECT id, {title_field}, {content_field}, location, date_range FROM seongsu_places WHERE region = :region AND (end_date IS NULL OR end_date >= CURRENT_DATE) ORDER BY RANDOM() LIMIT 15")
        with engine.connect() as conn:
            result = conn.execute(search_query, {"region": region})
            rows = result.fetchall()
            context_text = "\n".join([f"[id:{row[0]}][{row[1]}] {row[2]} (위치: {row[3]})" + (f" (운영일시: {row[4]})" if row[4] else "") for row in rows])
        
        from gemini_service import generate_walking_tour
        # 프롬프트에 지역 및 언어 정보 전달
        itinerary = generate_walking_tour(req.companion, context_text, region=region, lang=lang)

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
    where_clause = "WHERE region = :region AND (end_date IS NULL OR end_date >= CURRENT_DATE)" if region else "WHERE (end_date IS NULL OR end_date >= CURRENT_DATE)"
    # 공연/제주는 KOPIS 데이터만 목록에 노출 (구 소스는 SEO 색인 보존을 위해 DB엔 남기되 리스트에서만 제외, 만료는 기존 45일 유예 로직에 위임)
    if region in ("공연", "제주"):
        where_clause += " AND naver_place_id LIKE 'kopis_%'"
    # category: 'class'=원데이클래스/체험, 'popup'=팝업스토어(기존, category IS NULL)
    if category == "class":
        where_clause += " AND category = 'class'"
    elif category == "popup":
        where_clause += " AND category IS NULL"
    limit_clause = "LIMIT :limit OFFSET :offset" if limit is not None else ""
    # sort='latest' — 어드민이 이번에 새로 갱신/수집한 항목을 확인할 때 사용. 기본은 랜덤(같은 날짜 갱신은 랜덤과 동일하게 순서 무의미)
    # updated_at은 어드민 수동 편집 시에만 찍혀(스크래퍼 재수집은 안 건드림) 대부분 NULL이라,
    # "updated_at DESC NULLS LAST"를 그대로 1순위로 쓰면 몇 달 전 수동 편집된 소수 항목이
    # 오늘 새로 수집된 항목보다 항상 위로 올라가는 문제가 있었음 — GREATEST로 실제 최신 시점 비교
    order_clause = "GREATEST(updated_at, created_at) DESC" if sort == "latest" else "RANDOM()"
    query = text(
        f"SELECT id, title, title_en, title_zh, content, content_en, content_zh, image_url, video_url, location, date_range, end_date, latitude, longitude, region, category, pinned_at, naver_place_id "
        f"FROM seongsu_places {where_clause} "
        f"ORDER BY pinned_at DESC NULLS LAST, {order_clause} {limit_clause}"
    )
    with engine.connect() as conn:
        params = {"offset": offset}
        if limit is not None:
            params["limit"] = min(limit, 500)
        if region:
            params["region"] = region
        result = conn.execute(query, params)
        return [dict(row._mapping) for row in result]

@app.get("/places/{place_id}")
async def get_place(place_id: int):
    query = text("SELECT id, title, title_en, title_zh, content, content_en, content_zh, image_url, video_url, location, date_range, end_date, latitude, longitude, region, category, naver_place_id, blog_reviews, link_url, link_title FROM seongsu_places WHERE id = :id")
    with engine.connect() as conn:
        result = conn.execute(query, {"id": place_id})
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Place not found")
        return dict(row._mapping)

@app.post("/places/{place_id}/view")
async def record_place_view(place_id: int):
    """장소 조회수 기록 — 상세 페이지 진입 시 호출"""
    with engine.connect() as conn:
        conn.execute(text("INSERT INTO place_views (place_id) VALUES (:place_id)"), {"place_id": place_id})
        conn.commit()
    return {"ok": True}

_place_popularity_cache: list = []
_performance_popularity_cache: list = []

def _popularity_rows(conn, interval_days: int, limit: int = 100, only_performance: bool = False):
    """조회수/좋아요 기반 인기 랭킹 쿼리 — interval_days 기간 내 활동만 집계.
    only_performance=False(기본, 플레이스 랭킹): 공연은 완전히 제외(장기적으로 메뉴별 랭킹 분리 예정, 우선 공연만 분리).
    only_performance=True(공연 랭킹 전용): 공연(KOPIS 수집분)만 집계."""
    region_clause = (
        "AND p.region = '공연' AND p.naver_place_id LIKE 'kopis_%'"
        if only_performance
        else "AND p.region != '공연' AND (p.region != '제주' OR p.naver_place_id LIKE 'kopis_%')"
    )
    return conn.execute(text(f"""
        SELECT p.id, p.title, p.title_en, p.title_zh, p.content, p.content_en, p.content_zh, p.image_url, p.location, p.region, p.naver_place_id, p.updated_at, p.date_range,
               COUNT(DISTINCT l.id) AS like_count,
               COUNT(DISTINCT v.id) AS view_count,
               COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT v.id) AS score
        FROM seongsu_places p
        LEFT JOIN likes l ON l.place_id = p.id AND l.created_at >= NOW() - INTERVAL '{interval_days} days'
        LEFT JOIN place_views v ON v.place_id = p.id AND v.viewed_at >= NOW() - INTERVAL '{interval_days} days'
        WHERE (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
          {region_clause}
        GROUP BY p.id
        ORDER BY score DESC, p.created_at DESC
        LIMIT {limit}
    """))

def refresh_place_popularity():
    """장소 인기 랭킹 재계산 — 조회수(최근48시간, 부족시 30일 확장) + 좋아요*2. 하루 3회(한국시간 0/8/16시) 실행.
    메인 페이지 '추천' 탭(/places/popular)과 어드민 랭킹(/admin/ranking/weekly)이 공통으로 사용.
    48시간으로 좁힌 이유: 7일 창에서는 소수 인기 항목의 트래픽 쏠림(자기강화)으로 순위가 거의 안 바뀌는 문제 완화."""
    global _place_popularity_cache, _performance_popularity_cache
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS place_views (
                id SERIAL PRIMARY KEY,
                place_id INTEGER NOT NULL,
                viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_place_views_place_viewed ON place_views (place_id, viewed_at)"))
        conn.commit()

        result = list(_popularity_rows(conn, 2))
        if len(result) < 25:
            result = list(_popularity_rows(conn, 30))
        _place_popularity_cache = [dict(row._mapping) for row in result]

        perf_result = list(_popularity_rows(conn, 2, only_performance=True))
        if len(perf_result) < 25:
            perf_result = list(_popularity_rows(conn, 30, only_performance=True))
        _performance_popularity_cache = [dict(row._mapping) for row in perf_result]

@app.get("/admin/ranking/weekly")
async def admin_weekly_ranking():
    """장소 인기 TOP 25 (하루 3회 계산된 48시간 캐시 반환, 메인 추천 랭킹과 동일 산식). 공연 제외."""
    return _place_popularity_cache[:25]

@app.get("/admin/ranking/weekly7d")
async def admin_weekly_ranking_7d():
    """CSV 다운로드(주간 콘텐츠 제작용) 전용 — 화면 표시용 48시간 캐시와 별개로 항상 최신 7일 데이터를 즉석 계산."""
    with engine.connect() as conn:
        result = list(_popularity_rows(conn, 7))
        if len(result) < 25:
            result = list(_popularity_rows(conn, 30))
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
    try:
        secret = os.getenv("ADMIN_SECRET_KEY", "")
        url = f"http://127.0.0.1:3002/api/revalidate?path=/posts/{place_id}&secret={secret}"
        urllib.request.urlopen(url, timeout=3)
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

@app.post("/places/{place_id}/enrich")
async def enrich_place_content(place_id: int):
    """pcmap에서 방문자 리뷰 텍스트를 수집해 Gemini로 고품질 소개 생성. 어드민 수동 트리거용."""
    import asyncio
    import re as _re

    # 1. DB에서 place 정보 조회
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT title, location, naver_place_id FROM seongsu_places WHERE id = :id"),
            {"id": place_id}
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Place not found")

    title = row[0] or ""
    location = row[1] or ""
    naver_place_id = row[2] or ""
    if not naver_place_id:
        raise HTTPException(status_code=400, detail="naver_place_id 없음 — pcmap 조회 불가")

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
        raise HTTPException(status_code=500, detail=f"Gemini 생성 실패: {e}")

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

    return {
        "content": generated,
        "blog_reviews": blog_reviews,
        "has_road": bool(road_text),
    }


@app.delete("/places/{place_id}")
async def delete_place(place_id: int):
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
async def create_feedback(req: FeedbackCreate):
    query = text("INSERT INTO feedbacks (user_id, user_name, content) VALUES (:user_id, :name, :content)")
    with engine.connect() as conn:
        conn.execute(query, {"user_id": req.user_id, "name": req.user_name, "content": req.content})
        conn.commit()
    return {"status": "success"}

@app.delete("/feedbacks/{feedback_id}")
async def delete_feedback(feedback_id: int, user_id: str):
    with engine.connect() as conn:
        feedback = conn.execute(text("SELECT user_id FROM feedbacks WHERE id = :id"), {"id": feedback_id}).fetchone()
        if not feedback:
            raise HTTPException(status_code=404, detail="Not Found")
        if feedback[0] != user_id and user_id != 'admin_uuid_placeholder':
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        conn.execute(text("DELETE FROM feedbacks WHERE id = :id"), {"id": feedback_id})
        conn.commit()
    return {"status": "success"}

@app.post("/feedbacks/{feedback_id}/reply")
async def reply_feedback(feedback_id: int, req: FeedbackReply):
    if req.admin_email != 'nemonecoltd@gmail.com':
        raise HTTPException(status_code=403, detail="Admin only")
    with engine.connect() as conn:
        conn.execute(text("UPDATE feedbacks SET admin_reply = :reply WHERE id = :id"), {"reply": req.reply, "id": feedback_id})
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

refresh_place_popularity()

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_expired_data, 'cron', hour=0, minute=0)
# 서버는 UTC 기준 — 한국시간(KST=UTC+9) 자정(00:00)/낮 12시(12:00)에 맞춰 UTC 15:00, 03:00에 실행
scheduler.add_job(refresh_place_popularity, 'cron', hour=15, minute=5, id='ranking_kst_0000')
scheduler.add_job(refresh_place_popularity, 'cron', hour=23, minute=5, id='ranking_kst_0800')
scheduler.add_job(refresh_place_popularity, 'cron', hour=7, minute=5, id='ranking_kst_1600')
scheduler.start()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
