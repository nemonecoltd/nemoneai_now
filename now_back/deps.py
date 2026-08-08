"""공용 유틸/의존성 — 라우터·서비스 어디서든 순환 import 없이 가져다 쓰는 최하위 모듈.
(이 모듈은 프로젝트 내 다른 모듈을 import하지 않는다 — 순환 참조 방지의 기준점)"""
import os
from typing import Optional

from fastapi import Header, HTTPException, Request

ADMIN_EMAIL = "nemonecoltd@gmail.com"

# 플레이스 랭킹 지역 서브탭 — ranking_service의 지역별 집계와 RankingShareCreate 검증이 공유
_PLACE_RANKING_REGIONS = ['성수', '홍대', '강북', '강남', '부산', '제주']

# 서울시 실시간 도시데이터(혼잡도) API 지점명 매핑 — 프론트/라우터가 쓰는 짧은 키(홍대/성수) ↔
# API에 실제 등록된 지점명. 등록명은 예상과 다를 수 있어 반드시 실 API 호출로 확인 후 채울 것
# (2026-08-09 확인: '홍대관광특구'는 오류, 공백 포함 '홍대 관광특구'가 정확한 등록명. '성수카페거리'는 그대로 정확).
CROWD_AREA_MAP = {
    '홍대': '홍대 관광특구',
    '성수': '성수카페거리',
}


def _lang_col(lang: str, base: str) -> str:
    """lang(ko/en/zh/ja)에 맞는 컬럼명 반환. 예: _lang_col('zh', 'title') -> 'title_zh'"""
    return f"{base}_{lang}" if lang in ("en", "zh", "ja") else base


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


def _verify_supabase_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    """_verify_supabase_user의 비필수 버전 — 토큰이 없거나 유효하지 않아도 401 대신 None.
    코스 상세처럼 '공개면 누구나, 비공개면 소유자만'인 화면에서 소유자 판별용으로 사용."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return _verify_supabase_user(authorization)
    except HTTPException:
        return None


def _client_ip(request: Request) -> str:
    # nginx가 /api-now/를 FastAPI로 직접 프록시하며 X-Forwarded-For를 항상 세팅함(단일 홉이라 신뢰 가능)
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
