"""텔레그램 알림 — 로컬 스크래퍼(collector_naver.py, collector_kopis.py) 실행 결과 요약 전송용."""
import os
import logging
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv
from sqlalchemy import text

from database import engine

load_dotenv()

logger = logging.getLogger(__name__)


def send_alert(message: str) -> None:
    """텔레그램 알림 전송. 토큰 미설정 시 로그만 출력.
    이 함수는 로컬 스크래퍼들(collector_naver.py 등)이 공유해서 쓰므로, 여기서 전역으로
    억제하면 안 됨 — 억제가 필요한 특정 호출부(push_service.run_weekly_push)에서만
    호출 전에 개별적으로 걸러야 함(2026-08-10, 여기서 전역 억제했다가 정상 실행된 로컬
    스크래퍼 완료 알림까지 같이 묵음 처리되는 사고가 있었음)."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    print(f"[alert] {message}")
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": f"🗺️ NOW 스크래퍼 알림\n{message}"},
            timeout=10,
        )
    except Exception as e:
        logger.error(f"[alert] 텔레그램 전송 실패: {e}")


_KST = timezone(timedelta(hours=9))
_REPORT_REGIONS = ['성수', '홍대', '강북', '강남', '부산', '제주', '공연', '축제']
_REPORT_WINDOW_HOURS = 48


def _delta_text(curr: int, prev: int) -> str:
    if prev == 0:
        return " (신규)" if curr > 0 else ""
    pct = round((curr - prev) / prev * 100, 1)
    sign = "+" if pct >= 0 else ""
    return f" ({sign}{pct}%)"


def send_four_hourly_report() -> None:
    """4시간마다(KST 00/08/12/16/20시) 분야별 조회수·직전대비 + 전체 현황을 텔레그램으로 발송.
    새벽 4시(KST)만 제외 요청 — main.py의 cron 등록은 다른 4시간 주기 작업들과 동일하게 6개
    시각 전부 등록해두고, 실행 여부(04시 스킵)만 이 함수 안에서 판단(2026-08-11)."""
    now_kst = datetime.now(timezone.utc).astimezone(_KST)
    if now_kst.hour == 4:
        return

    with engine.connect() as conn:
        rows = conn.execute(text(f"""
            WITH curr AS (
                SELECT p.id AS place_id, p.region, COUNT(v.id) AS views
                FROM seongsu_places p
                LEFT JOIN place_views v ON v.place_id = p.id
                    AND v.viewed_at >= NOW() - INTERVAL '{_REPORT_WINDOW_HOURS} hours'
                WHERE p.region = ANY(:regions)
                GROUP BY p.id, p.region
            ),
            prev AS (
                SELECT p.id AS place_id, COUNT(v.id) AS views
                FROM seongsu_places p
                LEFT JOIN place_views v ON v.place_id = p.id
                    AND v.viewed_at >= NOW() - INTERVAL '{_REPORT_WINDOW_HOURS * 2} hours'
                    AND v.viewed_at < NOW() - INTERVAL '{_REPORT_WINDOW_HOURS} hours'
                WHERE p.region = ANY(:regions)
                GROUP BY p.id
            )
            SELECT curr.region, SUM(curr.views) AS views, SUM(prev.views) AS prev_views
            FROM curr JOIN prev ON prev.place_id = curr.place_id
            GROUP BY curr.region
        """), {"regions": _REPORT_REGIONS}).fetchall()

        views_by_region = {r: (0, 0) for r in _REPORT_REGIONS}
        for region, views, prev_views in rows:
            views_by_region[region] = (views or 0, prev_views or 0)

        total_places = conn.execute(text("SELECT COUNT(*) FROM seongsu_places")).scalar() or 0
        total_courses = conn.execute(text("SELECT COUNT(*) FROM saved_courses")).scalar() or 0

    total_views = sum(v for v, _ in views_by_region.values())
    total_prev_views = sum(p for _, p in views_by_region.values())

    # 전체 유저수 — routers/admin.py의 get_admin_stats()와 동일한 방식(Supabase auth admin API)
    total_users = 0
    supabase_url = os.getenv("SUPABASE_URL", "")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if supabase_url and service_key:
        try:
            res = requests.get(
                f"{supabase_url}/auth/v1/admin/users?page=1&per_page=1000",
                headers={"Authorization": f"Bearer {service_key}", "apikey": service_key},
                timeout=5,
            )
            if res.status_code == 200:
                total_users = len(res.json().get("users", []))
        except Exception:
            pass

    lines = [
        f"📊 분야별 조회수 리포트 ({now_kst.strftime('%m/%d %H:%M')} 기준, 최근 {_REPORT_WINDOW_HOURS}시간)",
        "",
        f"전체 조회수: {total_views:,}회{_delta_text(total_views, total_prev_views)}",
        "",
    ]
    for region in _REPORT_REGIONS:
        views, prev_views = views_by_region[region]
        lines.append(f"{region} {views:,}회{_delta_text(views, prev_views)}")
    lines += [
        "",
        f"전체 DB {total_places:,}곳",
        f"생성된 코스 {total_courses:,}개",
        f"전체 유저 {total_users:,}명",
    ]
    send_alert("\n".join(lines))
