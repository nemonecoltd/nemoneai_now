"""로컬 스크래퍼 전용 내부 API — VM의 GCS ADC(서비스 계정) 권한이 필요한 작업을
로컬 프로세스 대신 서버가 대행한다. x-admin-secret 헤더로만 인증(matmatch 어드민과 동일 패턴).
"""
import os
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Request

import gcs_storage

router = APIRouter(prefix="/internal", tags=["internal"])

ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "")


def _verify(x_admin_secret: Optional[str]) -> None:
    if not ADMIN_SECRET_KEY or x_admin_secret != ADMIN_SECRET_KEY:
        raise HTTPException(status_code=403, detail="forbidden")


@router.post("/gcs-upload")
async def gcs_upload(request: Request, x_admin_secret: Optional[str] = Header(default=None)):
    """이미지 바이트를 raw body로 받아 GCS(now-popup/)에 업로드하고 공개 URL을 반환.
    name_hint는 쿼리스트링으로 받는다(파일명 충돌 방지용 해시 시드일 뿐, 검증 불필요)."""
    _verify(x_admin_secret)
    name_hint = request.query_params.get("name_hint", "popup")
    precompressed = request.query_params.get("precompressed") == "1"
    raw_bytes = await request.body()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="empty body")
    try:
        url = gcs_storage.upload_popup_image(raw_bytes, name_hint=name_hint, precompressed=precompressed)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"gcs upload failed: {e}")
    return {"url": url}


@router.delete("/gcs-image")
async def gcs_delete(url: str, x_admin_secret: Optional[str] = Header(default=None)):
    _verify(x_admin_secret)
    result = gcs_storage.delete_popup_image(url)
    return {"result": result}
