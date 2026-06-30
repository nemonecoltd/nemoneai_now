"""
외부 이미지를 Supabase Storage로 다운로드·압축 후 재호스팅.
네이버 등 외부 CDN hotlink 차단/만료로 인한 깨짐·SEO 색인 오류 방지.
"""
import io
import logging
import os
import time
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "place-images"
MAX_DIMENSION = 1000
STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024  # Supabase Free 플랜 Storage 한도 1GB

_STORAGE_PREFIX = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/"


def _auth_headers(content_type: Optional[str] = None) -> dict:
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def is_internal_url(url: Optional[str]) -> bool:
    """이미 우리 Supabase Storage에 있는 URL인지 확인 (중복 재호스팅 방지)."""
    return bool(url) and url.startswith(_STORAGE_PREFIX)


def _compress_to_webp(raw_bytes: bytes) -> bytes:
    from PIL import Image  # 압축/업로드 경로에서만 필요 — 삭제만 하는 호출자는 PIL 없이도 동작해야 함

    img = Image.open(io.BytesIO(raw_bytes))
    img = img.convert("RGB")
    if max(img.size) > MAX_DIMENSION:
        ratio = MAX_DIMENSION / max(img.size)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)))
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=80)
    return buf.getvalue()


def upload_bytes(raw_bytes: bytes, name_hint: str = "upload") -> str:
    """원본 이미지 바이트를 압축해 Supabase Storage에 업로드하고 공개 URL을 반환.

    어드민 직접 업로드용 — service role 키로 업로드하므로 Storage RLS 정책 설정 없이도 동작.
    """
    webp_bytes = _compress_to_webp(raw_bytes)
    path = f"{int(time.time() * 1000)}-{abs(hash(name_hint)) % 100000}.webp"
    upload_resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        headers=_auth_headers("image/webp"),
        data=webp_bytes,
        timeout=15,
    )
    upload_resp.raise_for_status()
    return f"{_STORAGE_PREFIX}{path}"


def rehost_image(url: Optional[str]) -> Optional[str]:
    """외부 URL을 다운로드·압축해 Supabase Storage에 올리고 내부 URL을 반환.

    실패 시(차단·만료·네트워크 오류 등) 원본 URL을 그대로 반환 — 장소 등록/수정 자체는
    이미지 재호스팅 실패와 무관하게 계속 진행되어야 함.
    """
    if not url or not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return url
    if is_internal_url(url):
        return url

    try:
        resp = requests.get(
            url,
            timeout=10,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
        )
        resp.raise_for_status()
        return upload_bytes(resp.content, name_hint=url)
    except Exception as e:
        logger.warning("[image_storage] 재호스팅 실패, 원본 URL 유지 (url=%s): %s", url, e)
        return url


def _list_all_objects(bucket: str, prefix: str = "") -> list:
    """버킷 내 전체 객체를 재귀적으로 나열 (하위 폴더 포함)."""
    resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/list/{bucket}",
        headers=_auth_headers("application/json"),
        json={"limit": 1000, "offset": 0, "prefix": prefix, "sortBy": {"column": "name", "order": "asc"}},
        timeout=15,
    )
    resp.raise_for_status()
    items = []
    for item in resp.json():
        if item.get("id") is None:
            items.extend(_list_all_objects(bucket, f"{prefix}{item['name']}/"))
        else:
            items.append(item)
    return items


def get_storage_usage() -> dict:
    """전체 버킷 Storage 사용량(바이트) 및 플랜 한도 대비 비율."""
    total_bytes = 0
    try:
        buckets_resp = requests.get(f"{SUPABASE_URL}/storage/v1/bucket", headers=_auth_headers(), timeout=10)
        buckets_resp.raise_for_status()
        for bucket in buckets_resp.json():
            for item in _list_all_objects(bucket["id"]):
                total_bytes += (item.get("metadata") or {}).get("size") or 0
    except Exception as e:
        logger.warning("[image_storage] 사용량 조회 실패: %s", e)

    return {
        "used_bytes": total_bytes,
        "limit_bytes": STORAGE_LIMIT_BYTES,
        "percent": round(total_bytes / STORAGE_LIMIT_BYTES * 100, 2) if STORAGE_LIMIT_BYTES else 0,
    }


def delete_image(url: Optional[str]) -> None:
    """우리 Supabase Storage에 있는 이미지면 삭제. 외부 URL은 무시."""
    if not is_internal_url(url):
        return
    path = url[len(_STORAGE_PREFIX):]
    try:
        resp = requests.delete(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers=_auth_headers(),
            timeout=10,
        )
        if resp.status_code not in (200, 404):
            logger.warning("[image_storage] 삭제 실패 (path=%s): %s", path, resp.text)
    except Exception as e:
        logger.warning("[image_storage] 삭제 중 오류 (path=%s): %s", path, e)
