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
import push_service
import notification
import ga4_service
from enrich_service import _auto_enrich_new_popups, _enrich_place_core
from scraper_seoul_crowd import poll_crowd
from routers import admin, ai, courses, crowd, magazine, places, push, rankings, social

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
app.include_router(push.router)

ranking.refresh_place_popularity()  # 내부에서 refresh_closing_soon()도 같이 호출됨
# 서울시 API가 로컬(집/사무실) IP를 막아둔 상태라(서버 IP는 정상 응답) 로컬에서 호출하면
# 항상 5/5 실패 + 텔레그램 알림이 10분마다 반복됨. 아래 poll_crowd 스케줄러 등록과 동일하게
# 로컬(TELEGRAM_BOT_ENABLED=true)에서는 건너뜀(2026-08-30).
if os.getenv("TELEGRAM_BOT_ENABLED") != "true":
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
# 4시간마다 분야별 조회수 리포트 텔레그램 발송 — 같은 6개 시각에 등록하되, 새벽 4시(KST) 발송만
# 함수 내부에서 건너뜀(요청 사항). 랭킹 갱신(minute=5) 이후 실행되도록 minute=15로 살짝 늦춤.
# 로컬(TELEGRAM_BOT_ENABLED=true, 텔레그램 봇 전용 게이트)에서는 등록 안 함 — 로컬 개발 서버가 켜져
# 있는 동안 같은 시각에 서버와 로컬 양쪽에서 중복 발송되는 것을 방지(2026-08-11).
if os.getenv("TELEGRAM_BOT_ENABLED") != "true":
    scheduler.add_job(notification.send_four_hourly_report, 'cron', hour=15, minute=15, id='report_kst_0000')
    scheduler.add_job(notification.send_four_hourly_report, 'cron', hour=19, minute=15, id='report_kst_0400')
    scheduler.add_job(notification.send_four_hourly_report, 'cron', hour=23, minute=15, id='report_kst_0800')
    scheduler.add_job(notification.send_four_hourly_report, 'cron', hour=3, minute=15, id='report_kst_1200')
    scheduler.add_job(notification.send_four_hourly_report, 'cron', hour=7, minute=15, id='report_kst_1600')
    scheduler.add_job(notification.send_four_hourly_report, 'cron', hour=11, minute=15, id='report_kst_2000')
# GA4 리포트 — KST 6/9/12/15/18/21/23:59시에 방문자/조회수/광고수익/국가별 통계 발송.
# UTC = KST-9h: 6→21(전날), 9→0, 12→3, 15→6, 18→9, 21→12, 23:59→14:59. 마지막 슬롯은 원래
# 익일 0시20분(자정 직후)이었는데, 그 시점엔 "오늘 00시~현재 누적"이 20분치뿐이라 전부 0으로
# 찍혀 무의미했음(2026-08-14 리포트 확인) — 하루 거의 전체(23:59)를 담도록 자정 직전으로 당김.
# 로컬(TELEGRAM_BOT_ENABLED=true)에서는 등록 안 함(서버·로컬 중복 발송 방지).
if os.getenv("TELEGRAM_BOT_ENABLED") != "true":
    scheduler.add_job(ga4_service.send_ga4_report, 'cron', hour=21, minute=20, id='ga4_kst_0600')
    scheduler.add_job(ga4_service.send_ga4_report, 'cron', hour=0, minute=20, id='ga4_kst_0900')
    scheduler.add_job(ga4_service.send_ga4_report, 'cron', hour=3, minute=20, id='ga4_kst_1200')
    scheduler.add_job(ga4_service.send_ga4_report, 'cron', hour=6, minute=20, id='ga4_kst_1500')
    scheduler.add_job(ga4_service.send_ga4_report, 'cron', hour=9, minute=20, id='ga4_kst_1800')
    scheduler.add_job(ga4_service.send_ga4_report, 'cron', hour=12, minute=20, id='ga4_kst_2100')
    scheduler.add_job(ga4_service.send_ga4_report, 'cron', hour=14, minute=59, id='ga4_kst_2359')
# GA4 주간/월간 리포트 — 지난주/지난달 누적을 그 전 기간과 비교해서 발송.
# 주간: 월요일 KST 07:00 = UTC 일요일 22:00 / 월간: 매월 1일 KST 10:00 = UTC 매월 1일 01:00
if os.getenv("TELEGRAM_BOT_ENABLED") != "true":
    scheduler.add_job(ga4_service.send_weekly_ga4_report, 'cron', day_of_week='sun', hour=22, minute=10, id='ga4_weekly_kst_mon_0700')
    scheduler.add_job(ga4_service.send_monthly_ga4_report, 'cron', day=1, hour=1, minute=10, id='ga4_monthly_kst_1st_1000')
# 목요일 주간 Web Push — 구독자 수와 무관하게 매주 발송(0명이면 push_service 내부에서 그냥 아무것도 안 보내고 끝남).
# 한국시간(KST=UTC+9) 목요일 12:30 = UTC 목요일 03:30
# 로컬(TELEGRAM_BOT_ENABLED=true)에서는 등록 안 함 — 실구독자에게 나가는 진짜 발송이라, 로컬 개발서버가
# 그 순간 켜져 있으면 서버와 중복으로 두 번 발송될 수 있음(2026-08-13, "목요일 웹푸시가 2번 왔다" 신고로 발견).
if os.getenv("TELEGRAM_BOT_ENABLED") != "true":
    scheduler.add_job(push_service.run_weekly_push, 'cron', day_of_week='thu', hour=3, minute=30, id='push_weekly_kst_thu_1230')
scheduler.start()


if os.getenv("AUTO_ENRICH_POPUPS") == "true":
    scheduler.add_job(_auto_enrich_new_popups, IntervalTrigger(minutes=10), id="auto_enrich_new_popups")

# 서울시 실시간 도시데이터(혼잡도) — 로컬 launchd(맥 꺼지면 중단)에서 서버 cron으로 이전(2026-08-09).
# 10분 간격: 서울시 자체 생활인구 데이터가 내부적으로 약 5분 주기로 갱신되므로 그보다 촘촘히 돌려도
# 새 값을 못 받고, 6개 지점×6회/시간 = 시간당 36건 호출로 부하도 미미함. delta(직전 대비)는 더 이상
# "1시간 전"이 아니라 "직전 폴링(10분 전) 대비"라 프론트 라벨도 그에 맞게 "직전대비"로 표기.
# 위 이전 작업 때 이 등록 자체를 로컬에서 빼는 걸 빠뜨려서, 서울시 API가 막아둔 로컬 IP로
# 계속 폴링 → 10분마다 5/5 실패 텔레그램 알림이 반복되고 있었음 — 다른 로컬 전용 작업들과
# 동일하게 게이트 추가(2026-08-30).
if os.getenv("TELEGRAM_BOT_ENABLED") != "true":
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
