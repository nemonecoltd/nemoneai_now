"""인기 랭킹 조회 + 랭킹 공유/저장.

주의: /places/popular*·/places/closing-soon은 places 라우터의 /places/{place_id}보다
먼저 등록돼야 한다(안 그러면 'popular'가 place_id로 파싱돼 422) — main.py에서
이 라우터를 places보다 먼저 include하는 순서를 바꾸지 말 것.
"""
import json
import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import text

from database import engine
from deps import _client_ip
import ranking_service as ranking
from schemas import RankingShareCreate

router = APIRouter()

def _ensure_ranking_share_table(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS ranking_share (
            id SERIAL PRIMARY KEY,
            tab TEXT NOT NULL,
            region TEXT,
            label TEXT NOT NULL,
            items JSONB NOT NULL,
            user_id UUID,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    conn.commit()

_MAX_SAVED_RANKINGS_PER_USER = 10

# 공유 생성은 로그인 없이 누구나 호출 가능 — IP당 요청 빈도를 제한해 스팸 페이지 대량 생성을 막는다.
# 단일 프로세스(fork 모드)라 메모리 dict로 충분, 재시작하면 카운트가 리셋되지만 공격 방지 목적상 문제 없음.
_ranking_share_rate_limit: dict = {}
_RANKING_SHARE_LIMIT_PER_HOUR = 5
_RANKING_SHARE_LIMIT_PER_DAY = 20

def _check_ranking_share_rate_limit(ip: str):
    now = time.time()
    timestamps = _ranking_share_rate_limit.setdefault(ip, [])
    timestamps[:] = [t for t in timestamps if now - t < 86400]
    if len([t for t in timestamps if now - t < 3600]) >= _RANKING_SHARE_LIMIT_PER_HOUR:
        raise HTTPException(status_code=429, detail="너무 많은 요청입니다. 잠시 후 다시 시도해주세요.")
    if len(timestamps) >= _RANKING_SHARE_LIMIT_PER_DAY:
        raise HTTPException(status_code=429, detail="일일 공유 생성 한도를 초과했습니다.")
    timestamps.append(now)

@router.post("/ranking/share")
async def create_ranking_share(payload: RankingShareCreate, request: Request):
    """랭킹 공유/마이페이지 저장 — 클릭 시점의 top-N 스냅샷을 그대로 고정 저장(라이브 랭킹과 무관하게 유지).
    user_id가 있으면(마이페이지 저장) 유저당 최대 _MAX_SAVED_RANKINGS_PER_USER개만 유지, 넘으면 가장 오래된 것부터 삭제."""
    import json
    _check_ranking_share_rate_limit(_client_ip(request))
    with engine.connect() as conn:
        _ensure_ranking_share_table(conn)
        if payload.user_id:
            conn.execute(text("""
                DELETE FROM ranking_share WHERE id IN (
                    SELECT id FROM ranking_share WHERE user_id = :user_id
                    ORDER BY created_at DESC OFFSET :max_keep
                )
            """), {"user_id": payload.user_id, "max_keep": _MAX_SAVED_RANKINGS_PER_USER - 1})
        row = conn.execute(text("""
            INSERT INTO ranking_share (tab, region, label, items, user_id)
            VALUES (:tab, :region, :label, CAST(:items AS jsonb), :user_id)
            RETURNING id
        """), {
            "tab": payload.tab,
            "region": payload.region,
            "label": payload.label,
            "items": json.dumps(payload.items, ensure_ascii=False),
            "user_id": payload.user_id,
        }).fetchone()
        conn.commit()
        return {"id": row.id}

@router.get("/ranking/share/{share_id}")
async def get_ranking_share(share_id: int):
    with engine.connect() as conn:
        _ensure_ranking_share_table(conn)
        row = conn.execute(text("SELECT id, tab, region, label, items, created_at FROM ranking_share WHERE id = :id"), {"id": share_id}).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="공유된 랭킹을 찾을 수 없습니다.")
        return dict(row._mapping)

@router.get("/users/{user_id}/ranking-shares")
async def get_user_ranking_shares(user_id: str):
    with engine.connect() as conn:
        _ensure_ranking_share_table(conn)
        result = conn.execute(text("""
            SELECT id, tab, region, label, items, created_at FROM ranking_share
            WHERE user_id = :user_id ORDER BY created_at DESC
        """), {"user_id": user_id})
        return [dict(row._mapping) for row in result]

@router.delete("/ranking/share/{share_id}")
async def delete_ranking_share(share_id: int, user_id: str):
    with engine.connect() as conn:
        _ensure_ranking_share_table(conn)
        conn.execute(text("DELETE FROM ranking_share WHERE id = :id AND user_id = :user_id"), {"id": share_id, "user_id": user_id})
        conn.commit()
        return {"status": "success"}

@router.get("/places/popular")
async def get_popular_places(region: Optional[str] = None, limit: Optional[int] = None, offset: int = 0):
    """인기 랭킹 (조회수+좋아요*2 가중치, 4시간 주기 갱신 캐시).
    region 미지정: 지역 무관 통합 랭킹(공연/축제 제외). region 지정 시(성수/홍대/강북/강남/제주) 해당 지역만."""
    source = ranking.get_popular(region)
    data = source[offset:]
    if limit is not None:
        data = data[:min(limit, 500)]
    return data

@router.get("/places/popular/performance")
async def get_popular_performances(limit: Optional[int] = None, offset: int = 0):
    """공연 전용 인기 랭킹 (플레이스 랭킹과 동일 산식/캐시 주기, 공연만 집계)."""
    data = ranking.get_performance()[offset:]
    if limit is not None:
        data = data[:min(limit, 500)]
    return data

@router.get("/places/popular/festival")
async def get_popular_festivals(limit: Optional[int] = None, offset: int = 0):
    """축제 전용 인기 랭킹 (플레이스 랭킹과 동일 산식/캐시 주기, region='축제'만 집계)."""
    data = ranking.get_festival()[offset:]
    if limit is not None:
        data = data[:min(limit, 500)]
    return data

@router.get("/places/popular/shopping")
async def get_popular_shopping(limit: Optional[int] = None, offset: int = 0):
    """쇼핑 전용 인기 랭킹 (category='shopping', 지역 구분 없이 통합 — 트래픽 쌓이면 지역 서브탭 분리 예정)."""
    data = ranking.get_shopping()[offset:]
    if limit is not None:
        data = data[:min(limit, 500)]
    return data

@router.get("/places/popular/exhibition")
async def get_popular_exhibitions(limit: Optional[int] = None, offset: int = 0):
    """전시 전용 인기 랭킹 (category='전시', 지역 구분 없이 통합 — 트래픽 쌓이면 지역 서브탭 분리 예정)."""
    data = ranking.get_exhibition()[offset:]
    if limit is not None:
        data = data[:min(limit, 500)]
    return data

@router.get("/places/closing-soon")
async def get_closing_soon():
    """핫플 탭 상단 '마감임박' 전광판용 (하루 1회 갱신 캐시). /places/{place_id}보다 먼저 등록해야
    FastAPI가 'closing-soon'을 place_id로 오인해 파싱 에러를 내는 라우팅 충돌을 피할 수 있음."""
    return ranking.get_closing_soon()
