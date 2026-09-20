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


def _auth_headers(content_type: Optional[str] = None, cache_control: Optional[str] = None) -> dict:
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
    }
    if content_type:
        headers["Content-Type"] = content_type
    if cache_control:
        headers["cache-control"] = cache_control
    return headers


def is_internal_url(url: Optional[str]) -> bool:
    """이미 우리 Supabase Storage에 있는 URL인지 확인 (중복 재호스팅 방지)."""
    return bool(url) and url.startswith(_STORAGE_PREFIX)


def _compress_to_webp(raw_bytes: bytes) -> bytes:
    from PIL import Image  # 압축/업로드 경로에서만 필요 — 삭제만 하는 호출자는 PIL 없이도 동작해야 함

    img = Image.open(io.BytesIO(raw_bytes))
    # 애니메이션 GIF/WEBP는 첫 프레임만 정적 이미지로 쓴다(움직이는 썸네일 자체는 별도 기능).
    # 투명(RGBA/팔레트+alpha) 소스를 바로 .convert("RGB")하면 알파 채널만 버려지고 그 아래 RGB
    # 값(흔히 0,0,0)이 그대로 남아 투명이었던 부분이 새까맣게 나온다 — 흰 배경에 합성한 뒤
    # RGB로 변환해야 함(이전에 네이버 움직이는 팝업 썸네일이 새까맣게 나왔던 원인, 2026-09-11 재발견).
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[-1])
        img = background
    else:
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
    # Supabase Storage 업로드 시 cache-control을 안 지정하면 객체가 Cache-Control: no-cache로
    # 서빙돼(2026-09-20, curl로 실측 확인) 브라우저·CDN 둘 다 캐싱을 안 하고 방문할 때마다
    # 매번 다시 받아간다 — Free 플랜 Cached Egress 5GB를 지난 청구주기에 초과한 원인으로 추정.
    # 파일명이 타임스탬프+해시라 같은 경로가 재사용되지 않으므로(재수집 시에도 새 파일로 올라감,
    # collector_base.py 참고) 1년으로 안전하게 캐싱해도 된다. 헤더 형식은 "max-age=<초>"
    # 정확히 이 포맷이어야 함 — @supabase/storage-js 소스(uploadOrUpdate)에서
    # `cache-control: max-age=${cacheControl}`로 보내는 걸 확인. 처음에
    # "public, max-age=..., immutable"로 시도했다가 무시됨(실측 확인 후 정정).
    upload_resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        headers=_auth_headers("image/webp", cache_control="max-age=31536000"),
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
    """버킷 내 전체 객체를 재귀적으로 나열 (하위 폴더 포함).

    Supabase list API는 호출당 최대 1000개만 반환하므로 offset으로 끝까지 페이지네이션한다.
    (예전엔 offset 없이 한 번만 호출해 첫 1000개만 세는 바람에, 객체가 1000개를 넘어가면
    사용량 지표가 실제와 무관하게 낮은 값에 멈춰있던 버그가 있었음.)
    """
    items = []
    offset = 0
    page_size = 1000
    while True:
        resp = requests.post(
            f"{SUPABASE_URL}/storage/v1/object/list/{bucket}",
            headers=_auth_headers("application/json"),
            json={"limit": page_size, "offset": offset, "prefix": prefix, "sortBy": {"column": "name", "order": "asc"}},
            timeout=15,
        )
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        for item in batch:
            if item.get("id") is None:
                items.extend(_list_all_objects(bucket, f"{prefix}{item['name']}/"))
            else:
                items.append(item)
        if len(batch) < page_size:
            break
        offset += page_size
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


def delete_image(url: Optional[str]) -> str:
    """우리 Supabase Storage에 있는 이미지면 삭제. 외부 URL/빈 값은 무시.

    반환값은 호출부(cleanup_expired_data 등)가 성공/실패/스킵 건수를 집계해 로그로
    남길 수 있도록 함 — 고아 이미지 5,967개(2026-09-03 발견)가 어느 경로에서 새는지
    지금까지 로그가 전혀 없어 특정을 못 했던 문제를 고치기 위함.
    """
    if not is_internal_url(url):
        return "skipped"
    path = url[len(_STORAGE_PREFIX):]
    try:
        resp = requests.delete(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers=_auth_headers(),
            timeout=10,
        )
        if resp.status_code in (200, 404):
            return "deleted"
        logger.warning("[image_storage] 삭제 실패 (path=%s): %s", path, resp.text)
        return "failed"
    except Exception as e:
        logger.warning("[image_storage] 삭제 중 오류 (path=%s): %s", path, e)
        return "failed"
