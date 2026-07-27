"""AI 기능 — RAG 질문답변/벡터 검색/AI 코스 생성."""
import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from database import engine
from deps import _lang_col, _verify_supabase_user
from gemini_service import generate_answer, get_embedding
from schemas import Question, TourRequest

logger = logging.getLogger(__name__)
router = APIRouter()

@router.post("/ask")
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

@router.get("/search")
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

@router.post("/itinerary")
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

@router.get("/users/{user_id}/usage/itinerary")
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
