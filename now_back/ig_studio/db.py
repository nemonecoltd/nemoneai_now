"""ig_posts 스키마 + 조회/기록 헬퍼. main.py의 기존 스키마 갱신 경로와 별개로,
ig_studio를 처음 쓸 때 이 모듈이 알아서 CREATE TABLE IF NOT EXISTS 한다."""
from __future__ import annotations
import json
from datetime import date
from typing import Optional

from sqlalchemy import text

from database import engine

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS ig_posts (
  id            SERIAL PRIMARY KEY,
  format        TEXT NOT NULL,
  target_date   DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  needs_review  BOOLEAN NOT NULL DEFAULT false,
  payload       JSONB NOT NULL,
  caption       TEXT,
  output_dir    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  decided_at    TIMESTAMPTZ
)
"""


def ensure_schema() -> None:
    with engine.connect() as conn:
        conn.execute(text(_SCHEMA_SQL))
        conn.commit()


def create_pending(fmt: str, target_date: date, payload: dict, needs_review: bool, output_dir: str, caption: str | None) -> int:
    """같은 (format, target_date)의 기존 pending은 대체(재생성) — 지시서 6절."""
    ensure_schema()
    with engine.connect() as conn:
        conn.execute(
            text("DELETE FROM ig_posts WHERE format = :fmt AND target_date = :d AND status = 'pending'"),
            {"fmt": fmt, "d": target_date},
        )
        row = conn.execute(
            text(
                "INSERT INTO ig_posts (format, target_date, needs_review, payload, caption, output_dir) "
                "VALUES (:fmt, :d, :nr, :payload, :cap, :outdir) RETURNING id"
            ),
            {
                "fmt": fmt, "d": target_date, "nr": needs_review,
                "payload": json.dumps(payload, ensure_ascii=False, default=str),
                "cap": caption, "outdir": output_dir,
            },
        ).fetchone()
        conn.commit()
    return row[0]


def get_post(post_id: int) -> Optional[dict]:
    ensure_schema()
    with engine.connect() as conn:
        row = conn.execute(text("SELECT * FROM ig_posts WHERE id = :id"), {"id": post_id}).fetchone()
    return dict(row._mapping) if row else None


def set_status(post_id: int, status: str) -> None:
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE ig_posts SET status = :s, decided_at = NOW() WHERE id = :id"),
            {"s": status, "id": post_id},
        )
        conn.commit()


def last_decided_payload(fmt: str) -> Optional[dict]:
    """월요일 순위 비교·수요일 지역 로테이션이 쓰는 "직전 게시분" 조회 — approved/posted만 인정(6절)."""
    ensure_schema()
    with engine.connect() as conn:
        row = conn.execute(
            text(
                "SELECT payload FROM ig_posts WHERE format = :fmt AND status IN ('approved','posted') "
                "ORDER BY target_date DESC LIMIT 1"
            ),
            {"fmt": fmt},
        ).fetchone()
    return row[0] if row else None


def course_already_used(place_ids_key: str) -> bool:
    """saved_courses 선택 시 '아직 ig_posts에 안 쓰인 코스' 조건(4절) — payload.course_key로 매칭.

    2026-10-11 수정 — status IN ('approved','posted') 조건 때문에 사실상 항상 False였다.
    텔레그램 승인 흐름을 실제로 끝까지 밟은 적이 한 번도 없어서(ig_posts 전 행이 영구히
    'pending', create_pending()의 "같은 날짜 pending은 대체" 주석 참고) "이미 쓰였다"는
    판정이 절대 안 나고, _find_public_course()가 매번 좋아요 1위 코스를 그대로 다시 골랐다
    (사용자 리포트: "지난주 홍대랑 이번주 홍대랑 거의 같다" — 실제로 saved:60을 반복 선택 중이었음
    확인). status 조건을 빼고 "format=course로 생성된 적이 있는지"만 본다 — 승인 여부와 무관하게
    한 번 쓰인 코스는 재사용하지 않는 게 실제 의도에 맞는다."""
    ensure_schema()
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT 1 FROM ig_posts WHERE format = 'course' AND payload->>'course_key' = :k LIMIT 1"),
            {"k": place_ids_key},
        ).fetchone()
    return row is not None
