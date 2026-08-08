from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from database import engine, cleanup_expired_data
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import uvicorn
import logging
import os

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

import ranking_service as ranking
from enrich_service import _auto_enrich_new_popups, _enrich_place_core
from scraper_seoul_crowd import poll_crowd
from routers import admin, ai, courses, crowd, magazine, places, rankings, social

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

# --- 라우터 등록 ---
# rankings(/places/popular*, /places/closing-soon)와 courses(/places/search)는 반드시
# places(/places/{place_id})보다 먼저 — 뒤바뀌면 'popular'/'closing-soon'/'search'가
# place_id(int)로 파싱돼 422가 남
app.include_router(social.router)
app.include_router(rankings.router)
app.include_router(courses.router)
app.include_router(ai.router)
app.include_router(magazine.router)
app.include_router(places.router)
app.include_router(admin.router)
app.include_router(crowd.router)

ranking.refresh_place_popularity()  # 내부에서 refresh_closing_soon()도 같이 호출됨
poll_crowd()  # 재시작 직후에도 스케줄러 첫 틱(최대 10분)까지 기다리지 않고 바로 최신값 확보

scheduler = BackgroundScheduler()
scheduler.add_job(cleanup_expired_data, 'cron', hour=0, minute=0)
# 서버는 UTC 기준 — 한국시간(KST=UTC+9) 4시간 간격(0/4/8/12/16/20시)에 맞춰 UTC 15/19/23/03/07/11시에 실행
scheduler.add_job(ranking.refresh_place_popularity, 'cron', hour=15, minute=5, id='ranking_kst_0000', kwargs={'is_cron': True})
scheduler.add_job(ranking.refresh_place_popularity, 'cron', hour=19, minute=5, id='ranking_kst_0400', kwargs={'is_cron': True})
scheduler.add_job(ranking.refresh_place_popularity, 'cron', hour=23, minute=5, id='ranking_kst_0800', kwargs={'is_cron': True})
scheduler.add_job(ranking.refresh_place_popularity, 'cron', hour=3, minute=5, id='ranking_kst_1200', kwargs={'is_cron': True})
scheduler.add_job(ranking.refresh_place_popularity, 'cron', hour=7, minute=5, id='ranking_kst_1600', kwargs={'is_cron': True})
scheduler.add_job(ranking.refresh_place_popularity, 'cron', hour=11, minute=5, id='ranking_kst_2000', kwargs={'is_cron': True})
scheduler.start()


if os.getenv("AUTO_ENRICH_POPUPS") == "true":
    scheduler.add_job(_auto_enrich_new_popups, IntervalTrigger(minutes=10), id="auto_enrich_new_popups")

# 서울시 실시간 도시데이터(혼잡도) — 로컬 launchd(맥 꺼지면 중단)에서 서버 cron으로 이전(2026-08-09).
# 10분 간격: 서울시 자체 생활인구 데이터가 내부적으로 약 5분 주기로 갱신되므로 그보다 촘촘히 돌려도
# 새 값을 못 받고, 6개 지점×6회/시간 = 시간당 36건 호출로 부하도 미미함. delta(직전 대비)는 더 이상
# "1시간 전"이 아니라 "직전 폴링(10분 전) 대비"라 프론트 라벨도 그에 맞게 "직전대비"로 표기.
scheduler.add_job(poll_crowd, IntervalTrigger(minutes=10), id="poll_crowd")

# 텔레그램으로 플레이스 ID 보내면 블로그갱신 트리거 — 로컬 전용(Playwright 없는 프로덕션에선 절대 켜면 안 됨,
# getUpdates 폴링도 두 곳에서 동시에 하면 충돌함). 로컬 .env에만 TELEGRAM_BOT_ENABLED=true를 넣어서 게이트.
if os.getenv("TELEGRAM_BOT_ENABLED") == "true":
    import asyncio as _asyncio
    from telegram_admin_bot import start_bot
    from collector_favorite import run_favorite
    from collector_kakao import run_kakao_keyword

    def _enrich_place_sync(place_id: int) -> dict:
        return _asyncio.run(_enrich_place_core(place_id))

    start_bot(_enrich_place_sync, run_favorite, run_kakao_keyword)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8081)
