"""포맷별 데이터 조회 — DB만 알고 렌더링은 모른다(순수 dict payload 반환).
기존 database.py/ranking_service.py/routers 함수를 그대로 재사용, 새 커넥션 설정 없음."""
from __future__ import annotations
import json
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import text

from database import engine

from . import db as ig_db
from .regions import region_label

WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"]


def _period_text(end_date) -> str:
    if end_date is None:
        return "종료일 미정"
    if isinstance(end_date, str):
        end_date = datetime.strptime(end_date, "%Y-%m-%d").date()
    return f"~ {end_date.month}월 {end_date.day}일"


def _fetch_end_dates(ids: list[int]) -> dict[int, object]:
    if not ids:
        return {}
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, end_date FROM seongsu_places WHERE id = ANY(:ids)"), {"ids": ids}
        ).fetchall()
    return {r.id: r.end_date for r in rows}


# ── 월: 주간 조회 순위 ──────────────────────────────────────

def get_ranking_payload(target_date: date) -> dict:
    import ranking_service as ranking

    with engine.connect() as conn:
        rows = list(ranking._popularity_rows(conn, 7, limit=100, exclude_jeju=True))
        used_days = 7
        if len(rows) < 25:
            rows = list(ranking._popularity_rows(conn, 30, limit=100, exclude_jeju=True))
            used_days = 30

    top25 = rows[:25]
    end_dates = _fetch_end_dates([r.id for r in top25])

    prev_payload = ig_db.last_decided_payload("ranking")
    prev_ids: list[int] = prev_payload.get("top25_ids", []) if prev_payload else []
    prev_rank_by_id = {pid: i for i, pid in enumerate(prev_ids)}

    items = []
    needs_review = False
    for idx, r in enumerate(top25):
        rank = idx + 1
        label = region_label(r.region)
        if label is None:
            needs_review = True
            label = r.region or "-"
        badge, badge_class = None, None
        if prev_ids:
            if r.id not in prev_rank_by_id:
                badge, badge_class = "첫 진입", "new"
            else:
                delta = prev_rank_by_id[r.id] - idx
                if delta >= 2:
                    badge, badge_class = f"{delta}계단 ↑", "up"
        items.append({
            "id": r.id, "rank": rank,
            "rank_tens": str(rank // 10), "rank_ones": str(rank % 10),
            "title": r.title, "region_label": label,
            "period_text": _period_text(end_dates.get(r.id)),
            "badge": badge, "badge_class": badge_class,
        })

    # 2026-10-03 — "월~일" 달력 주 단위로 계산했는데, 집계 쿼리(_popularity_rows)는 실제로
    # NOW()부터 과거 7일이라 발행 요일이 월요일이 아니면(지금은 토요일) 라벨이 실제 데이터
    # 범위와 안 맞고, 심지어 아직 오지 않은 날짜(예: 발행일 다음날)까지 포함돼 보였다
    # ("09.28–10.04"인데 발행은 10/3) — target_date를 끝으로 과거 7일로 맞춘다.
    week_end = target_date
    week_start = week_end - timedelta(days=6)
    week_range = f"{week_start.month:02d}.{week_start.day:02d} – {week_end.month:02d}.{week_end.day:02d}"

    return {
        "format": "ranking", "target_date": target_date.isoformat(),
        "week_range": week_range,
        "headline_line1": "이번 주", "headline_line2": "진짜 많이 본 곳",
        "aggregation_days": used_days,
        "items": items,
        "top25_ids": [it["id"] for it in items],
        "needs_review": needs_review,
    }


# ── 수: 3시간 코스 ──────────────────────────────────────────

_COURSE_ROTATION = ["성수", "홍대", "강북", "강남"]
_BAR_COLORS = ["var(--pace)", "var(--navy)", "var(--signal)", "#5B7089"]


def _next_course_region(target_date: date) -> str:
    # 예전엔 "직전에 승인/게시된 course"를 기준으로 다음 지역을 골랐는데, 텔레그램 승인 흐름을
    # 거친 적이 한 번도 없어(ig_posts 전 행이 status='pending') 로테이션이 계속 첫 지역
    # (성수)에 멈춰 있었다(2026-09-27 발견). 승인 여부와 무관하게 항상 돌아가도록 ISO
    # 주차(연중 몇째 주인지) 기준으로 지역을 결정 — 매주 자동으로 다음 지역으로 넘어간다.
    week = target_date.isocalendar()[1]
    return _COURSE_ROTATION[week % len(_COURSE_ROTATION)]


def _find_public_course(region: str) -> Optional[dict]:
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT c.id, c.steps, COUNT(cl.id) AS like_count
                FROM saved_courses c
                LEFT JOIN course_likes cl ON c.id = cl.course_id
                WHERE c.is_public = true AND c.region = :region
                  AND c.steps IS NOT NULL AND jsonb_array_length(c.steps) BETWEEN 2 AND 4
                GROUP BY c.id
                ORDER BY like_count DESC, c.created_at DESC
                LIMIT 20
            """),
            {"region": region},
        ).fetchall()

    for row in rows:
        steps = row.steps if isinstance(row.steps, list) else json.loads(row.steps)
        place_ids = [s.get("place_id") for s in steps]
        if any(pid is None for pid in place_ids):
            continue
        course_key = f"saved:{row.id}"
        if ig_db.course_already_used(course_key):
            continue
        with engine.connect() as conn:
            alive = conn.execute(
                text("SELECT id FROM seongsu_places WHERE id = ANY(:ids) AND (end_date IS NULL OR end_date >= CURRENT_DATE)"),
                {"ids": place_ids},
            ).fetchall()
        if len(alive) != len(place_ids):
            continue
        return {"course_key": course_key, "steps": steps}
    return None


def _generate_course(region: str) -> Optional[dict]:
    """PACE의 실제 3시간코스 생성 코어를 HTTP 없이 직접 호출.

    2026-09-17 진단 — 지시서가 지목한 create_itinerary는 실제로는 courses.py 자체 docstring에
    "구 AI투어, 신규 흐름은 /courses/draft?scope=timed로 대체" 라고 적힌 폐기 경로였다.
    그런데 현재 경로인 create_course_draft도 그대로 쓰면 안 된다 — viewer: dict =
    Depends(_verify_supabase_user)가 기본값 없는 필수 파라미터라 인증 없이 호출이 안 되고,
    check_daily_ai_limit(viewer["id"])를 무조건 호출해 "일일 한도 카운터를 건드리지 않는다"는
    지시서 요구를 못 지킨다. create_course_draft가 실제로 위임하는 더 안쪽 함수
    routers.ai.generate_timed_course(region, companion, lang)가 인증도 한도 체크도 없는
    순수 생성 로직이라 이걸 직접 호출하고, steps 정제는 courses.py의 _clean_steps(conn)를
    그대로 재사용한다.

    2026-09-20 — 예전엔 공개 코스가 없을 때만 부르는 폴백이었는데, "닫힌 팝업이 섞여있을 수
    있는 몇 주 전 유저 코스를 재사용하지 말고 매번 그 자리에서 새로 생성하라"는 결정에 따라
    get_course_payload에서 항상 먼저 호출하는 경로로 바뀜(이 함수 자체는 그대로, 호출 순서만
    변경). 그러면서 "생성한 코스는 URL도 있어야 한다"는 요구가 같이 나와 saved_courses에
    is_public=true로 실제 저장해 진짜 공유 URL(/course/{id})이 생기게 함 — user_id는 FK
    제약이 없는 nullable text라 봇 생성분을 안전하게 넣을 수 있음(스키마 확인 완료).
    user_name을 "NEMONE PACE"로 남겨 실제 유저가 만든 것처럼 보이지 않게 한다."""
    import asyncio

    from database import engine as _engine
    from routers.ai import generate_timed_course
    from routers.courses import _clean_steps

    itinerary = asyncio.run(generate_timed_course(region, "친구", "ko"))
    with _engine.connect() as conn:
        steps = _clean_steps(itinerary.get("steps", []), conn)
    if not steps:
        return None

    with _engine.connect() as conn:
        row = conn.execute(
            text("""
                INSERT INTO saved_courses
                    (user_id, user_name, title, description, steps, region, scope, source, is_public)
                VALUES
                    (NULL, 'NEMONE PACE', :title, :description, CAST(:steps AS jsonb), :region, 'timed', 'ig_auto', true)
                RETURNING id
            """),
            {
                "title": itinerary.get("title") or f"{region} 3시간 코스",
                "description": itinerary.get("description", ""),
                "steps": json.dumps(steps, ensure_ascii=False),
                "region": region,
            },
        ).fetchone()
        conn.commit()

    return {"course_key": f"saved:{row.id}", "steps": steps}


def get_course_payload(target_date: date, region_override: str | None = None) -> dict:
    # region_override: 관리자가 특정 지역으로 강제 지정하고 싶을 때(예: 로테이션이 몇 주째
    # 안 도는 걸 우회해 수동 실행). 없으면 기존 로테이션 로직 그대로.
    region = region_override or _next_course_region(target_date)
    # 몇 주 전 유저가 저장해둔 공개 코스를 재사용하면 그 사이 팝업이 종료됐을 위험이 있어(비록
    # _find_public_course가 "현재 살아있는 장소인지"는 걸러내지만, 폐점 임박이거나 정보가 오래된
    # 채로 방치될 수 있음) — 항상 그 자리에서 새로 생성하는 걸 우선으로 하고, 생성이 실패할
    # 때만(AI 오류 등) 기존 공개 코스로 폴백(2026-09-20, 순서 뒤집음).
    course = _generate_course(region) or _find_public_course(region)
    needs_review = course is None
    if course is None:
        return {"format": "course", "target_date": target_date.isoformat(), "region": region,
                "needs_review": True, "reason": "코스 후보 없음(공개 코스·자동생성 모두 실패)"}

    steps = course["steps"][:4]
    with engine.connect() as conn:
        place_rows = conn.execute(
            text("SELECT id, title, content, image_url FROM seongsu_places WHERE id = ANY(:ids)"),
            {"ids": [s["place_id"] for s in steps]},
        ).fetchall()
    place_by_id = {r.id: r for r in place_rows}

    start = datetime(2000, 1, 1, 14, 0)
    cur = start
    stops = []
    for i, s in enumerate(steps):
        place = place_by_id.get(s["place_id"])
        duration = int(s.get("duration") or 60)
        stops.append({
            "place_id": s["place_id"],
            "name": place.title if place else s.get("place_name", "장소"),
            "raw_content": (place.content if place else s.get("activity", ""))[:300],
            "activity": s.get("activity", ""),
            "image_url": place.image_url if place else None,
            "time": cur.strftime("%H:%M"),
            "duration": duration,
            "duration_label": f"{duration}분",
            "color": _BAR_COLORS[min(i, 3)],
        })
        cur += timedelta(minutes=duration + (10 if i < len(steps) - 1 else 0))

    total_minutes = sum(s["duration"] for s in stops) + 10 * (len(stops) - 1)
    if abs(total_minutes - 180) > 20:
        needs_review = True

    total_span = (cur - start).total_seconds() / 60
    bar_segments = []
    for i, s in enumerate(stops):
        bar_segments.append({"flex": round(s["duration"] / total_span * 100), "color": s["color"]})
        if i < len(stops) - 1:
            bar_segments.append({"flex": round(10 / total_span * 100), "color": "var(--line)"})

    # 코스는 발행일 당일 나갈 팝업용이다(매주 일요일 12:00 발행 → 그날 방문). 날짜·요일 라벨은
    # 발행일(target_date)을 그대로 쓴다 — 예전엔 "다음 토요일"을 계산해 발행일과 6일 어긋났다.
    outing_date_label = f"{target_date.month}월 {target_date.day}일 {WEEKDAY_KO[target_date.weekday()]}요일"

    # course_key는 항상 "saved:{id}" 형태(_generate_course도 이제 saved_courses에 저장하고
    # 그 id를 씀, 2026-09-20) — 실제 공유 가능한 코스 상세 URL을 여기서 뽑아 텔레그램
    # 메시지에 실어 보낸다(전엔 URL이 어디에도 안 나가서 관리자가 매번 수동으로 찾아야 했음).
    course_id = course["course_key"].split(":", 1)[1] if course["course_key"].startswith("saved:") else None
    share_url = f"https://now.nemoneai.com/course/{course_id}" if course_id else None

    # 이미지와 캡션이 같은 날짜를 보도록 outing_day를 캡션 프롬프트에도 그대로 넘긴다.
    outing_day = outing_date_label

    return {
        "format": "course", "target_date": target_date.isoformat(),
        "region": region, "course_key": course["course_key"], "share_url": share_url,
        "where": f"{region} · {outing_day}", "outing_day": outing_day,
        "start_time": stops[0]["time"], "end_time": cur.strftime("%H:%M"),
        "stops": [{
            "place_id": s["place_id"], "name": s["name"], "time": s["time"],
            "duration_label": s["duration_label"], "color": s["color"],
            "raw_content": s["raw_content"], "activity": s["activity"],
            "image_url": s["image_url"],
            "move_to_next": "도보 10분",
        } for s in stops],
        "bar_segments": bar_segments,
        "needs_review": needs_review,
    }


# ── 금: 마감 임박 ────────────────────────────────────────────

def get_closing_payload(target_date: date) -> dict:
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT p.id, p.title, p.region, p.end_date,
                       COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT v.id) AS score
                FROM seongsu_places p
                LEFT JOIN likes l ON l.place_id = p.id AND l.created_at >= NOW() - INTERVAL '7 days'
                LEFT JOIN place_views v ON v.place_id = p.id AND v.viewed_at >= NOW() - INTERVAL '7 days'
                WHERE p.end_date IS NOT NULL
                  AND p.end_date >= :d0 AND p.end_date <= :d7
                  AND COALESCE(p.category, 'popup') = 'popup'
                  AND p.region NOT IN ('공연', '축제')
                  AND COALESCE(p.naver_place_id, '') NOT LIKE 'kopis_%'
                  AND COALESCE(p.naver_place_id, '') NOT LIKE 'jeju_%'
                  AND COALESCE(p.naver_place_id, '') NOT LIKE 'culture_%'
                GROUP BY p.id
                ORDER BY p.end_date ASC, score DESC
                LIMIT 3
            """),
            {"d0": target_date, "d7": target_date + timedelta(days=7)},
        ).fetchall()

    if not rows:
        return {"format": "closing", "target_date": target_date.isoformat(), "items": [], "needs_review": False}

    all_within_d3 = all((r.end_date - target_date).days <= 3 for r in rows)
    headline = "이번 주말이\n마지막인 곳" if all_within_d3 else "일주일 안에\n끝나는 곳"

    needs_review = False
    items = []
    for r in rows:
        label = region_label(r.region)
        if label is None:
            needs_review = True
            label = r.region or "-"
        dday = (r.end_date - target_date).days
        items.append({
            "id": r.id, "title": r.title, "region_label": label,
            "dday": str(dday),
            "end_text": f"{r.end_date.month}월 {r.end_date.day}일 {WEEKDAY_KO[r.end_date.weekday()]}요일 종료",
        })

    return {
        "format": "closing", "target_date": target_date.isoformat(),
        "date_label": f"{target_date.month:02d}.{target_date.day:02d} {['MON','TUE','WED','THU','FRI','SAT','SUN'][target_date.weekday()]}",
        "headline": headline, "items": items, "needs_review": needs_review,
    }


# ── 매일 스토리: 혼잡도 ──────────────────────────────────────

_LEVEL_DOTS = {"여유": 1, "보통": 2, "약간 붐빔": 3, "붐빔": 4}
_STALE_THRESHOLD_MIN = 30  # 지시서 4절 그대로 — 아래 타임존 버그를 30분 부족 문제로 오진단했다가 바로잡음


def get_crowd_payload(now_kst: datetime) -> dict:
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT area_nm, congest_lvl, updated_at FROM crowd_status ORDER BY area_nm")).fetchall()

    if not rows:
        return {"format": "crowd", "target_date": now_kst.date().isoformat(), "spots": [], "needs_review": True, "reason": "crowd_status 데이터 없음"}

    latest_updated = max(r.updated_at for r in rows)
    # .replace(tzinfo=...)는 시각은 그대로 두고 라벨만 바꿔서(KST 16:11 → "UTC" 16:11로
    # 오인) 항상 9시간 어긋난 값으로 비교하는 버그가 있었다(2026-09-17 — 실제론 27분 전
    # 데이터인데 매번 stale=True로 나옴) — .astimezone(UTC)로 실제 시각 변환해서 비교.
    stale = (now_kst.astimezone(timezone.utc) - latest_updated) > timedelta(minutes=_STALE_THRESHOLD_MIN)

    needs_review = stale
    spots = []
    for r in rows:
        dots = _LEVEL_DOTS.get(r.congest_lvl)
        if dots is None:
            needs_review = True
            dots = 0
        spots.append({"name": r.area_nm, "level": r.congest_lvl, "dot_count": dots})

    hh, mm = now_kst.strftime("%H"), now_kst.strftime("%M")
    return {
        "format": "crowd", "target_date": now_kst.date().isoformat(),
        "time_digits": [hh[0], hh[1], ":", mm[0], mm[1]],
        "spots": spots, "stale": stale, "needs_review": needs_review,
    }
