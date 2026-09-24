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

# 모든 이미지는 Supabase 대신 GCS로 올린다. Supabase Storage public 엔드포인트가 cache-control
# 헤더를 무시하고 항상 no-cache로 서빙하는 문제(Cached Egress 쿼터 초과 원인) 때문에 2026-09-23에
# 팝업만 먼저 GCS로 옮겼는데, 9/24 AWS 대역 분산 스크래퍼가 비팝업 상세(페이지당 Supabase
# 이미지 16장)를 10분간 ~1,500건 긁으면서 Cached Egress가 하루 120MB→600MB로 폭등 —
# 카테고리 구분 없이 전부 GCS로 전환(2026-09-25). Supabase 업로드는 GCS 실패 시 폴백으로만 남긴다.
# 배포 서버(now_backend)에선 VM의 ADC로 gcs_storage를 직접 호출하고, GCS 자격증명이 없는 로컬
# 스크래퍼는 SSH 터널로 배포 백엔드의 /internal/gcs-upload를 대신 호출한다. 터널은 launchd
# com.nemoneai.now.gcs-tunnel이 상시 유지(로컬 18081 → 서버 8081). 원래 로컬 포트도 8081이었는데
# 로컬 텔레그램 봇 uvicorn이 8081을 점유하고 있어 요청이 서버가 아닌 로컬 봇으로 가서 실패 →
# 항상 Supabase로 폴백되고 있었다(2026-09-25 발견, 9/23 이후 신규 팝업 22장이 Supabase로 간 원인).
NOW_BACKEND_TUNNEL_URL = os.getenv("NOW_BACKEND_TUNNEL_URL", "http://127.0.0.1:18081")
ADMIN_SECRET_KEY = os.getenv("ADMIN_SECRET_KEY", "")
# 프리픽스 이름은 팝업 전용이던 시절 그대로 둔다 — 이미 DB에 저장된 URL 778건과 is_internal_url/
# delete_image 판별이 이 경로에 묶여 있어서, 이름만 바꾸면 기존 이미지가 외부 URL로 오인됨.
_GCS_POPUP_PREFIX = "https://storage.googleapis.com/nemoneai-thumbnails/now-popup/"
_gcs_direct_ok: Optional[bool] = None  # None=미확인, 한 번 실패하면 이후 호출은 바로 터널로


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
    """이미 우리 저장소(Supabase 또는 GCS)에 있는 URL인지 확인 (중복 재호스팅 방지)."""
    return bool(url) and (url.startswith(_STORAGE_PREFIX) or url.startswith(_GCS_POPUP_PREFIX))


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


def _upload_bytes_to_supabase(raw_bytes: bytes, name_hint: str) -> str:
    """GCS 업로드 실패 시에만 쓰는 폴백 경로 — 원본 이미지를 압축해 Supabase Storage에 업로드.

    service role 키로 업로드하므로 Storage RLS 정책 설정 없이도 동작.
    """
    webp_bytes = _compress_to_webp(raw_bytes)
    path = f"{int(time.time() * 1000)}-{abs(hash(name_hint)) % 100000}.webp"
    # Supabase Storage 업로드 시 cache-control을 안 지정하면 객체가 Cache-Control: no-cache로
    # 서빙돼(2026-09-20, curl로 실측 확인) 브라우저·CDN 둘 다 캐싱을 안 하고 방문할 때마다
    # 매번 다시 받아간다. 헤더 형식은 "max-age=<초>" 정확히 이 포맷이어야 함 —
    # @supabase/storage-js 소스(uploadOrUpdate)에서 `cache-control: max-age=${cacheControl}`로
    # 보내는 걸 확인. (단, 2026-09-23 이후 public 엔드포인트가 이 값도 무시하는 게 확인돼
    # GCS가 기본 경로가 됨 — 이 헤더는 폴백 시 조금이라도 캐싱되길 기대하는 정도의 의미)
    upload_resp = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
        headers=_auth_headers("image/webp", cache_control="max-age=31536000"),
        data=webp_bytes,
        timeout=15,
    )
    upload_resp.raise_for_status()
    return f"{_STORAGE_PREFIX}{path}"


def _upload_bytes_to_gcs(raw_bytes: bytes, name_hint: str) -> str:
    """GCS 업로드 — 배포 서버에선 gcs_storage 직접 호출, 로컬에선 터널 경유. 실패 시 예외 전파.

    서버에서 터널 URL(127.0.0.1:8081)로 자기 자신을 호출하면 워커가 1개일 때 요청 처리 중
    같은 워커에 다시 요청을 보내는 꼴이라 막힐 수 있어, ADC가 있으면 반드시 직접 호출한다.
    """
    global _gcs_direct_ok
    if _gcs_direct_ok is not False:
        try:
            import gcs_storage
            url = gcs_storage.upload_popup_image(raw_bytes, name_hint=name_hint)
            _gcs_direct_ok = True
            return url
        except Exception as e:
            if _gcs_direct_ok:  # 직접 경로가 원래 되던 환경(서버)이면 일시 오류 — 터널로 돌리지 않음
                raise
            _gcs_direct_ok = False
            logger.info("[image_storage] GCS 직접 업로드 불가(로컬로 판단), 터널 경유로 전환: %s", e)

    if not ADMIN_SECRET_KEY:
        raise RuntimeError("ADMIN_SECRET_KEY 없음 — GCS 터널 업로드 불가")
    # 로컬에서 먼저 압축해 보낸다(전송량 절감) — 서버는 precompressed=1이면 재압축하지 않음
    upload_resp = requests.post(
        f"{NOW_BACKEND_TUNNEL_URL}/internal/gcs-upload",
        params={"name_hint": name_hint, "precompressed": "1"},
        headers={"x-admin-secret": ADMIN_SECRET_KEY, "Content-Type": "application/octet-stream"},
        data=_compress_to_webp(raw_bytes),
        timeout=20,
    )
    upload_resp.raise_for_status()
    return upload_resp.json()["url"]


def upload_bytes(raw_bytes: bytes, name_hint: str = "upload") -> str:
    """원본 이미지 바이트를 압축해 GCS에 업로드하고 공개 URL을 반환(실패 시 Supabase 폴백).

    어드민 직접 업로드·ig_studio 게시용 이미지 등 모든 업로드의 공통 진입점.
    """
    try:
        return _upload_bytes_to_gcs(raw_bytes, name_hint)
    except Exception as e:
        logger.warning("[image_storage] GCS 업로드 실패, Supabase로 폴백 (hint=%s): %s", name_hint, e)
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError("GCS 업로드 실패 + Supabase 설정 없음")
    return _upload_bytes_to_supabase(raw_bytes, name_hint)


def rehost_image(url: Optional[str], category: Optional[str] = None) -> Optional[str]:
    """외부 URL을 다운로드·압축해 내부 저장소(GCS, 실패 시 Supabase)에 올리고 URL을 반환.

    category는 예전(2026-09-23~25) 팝업만 GCS로 보내던 시절의 분기용 인자 — 지금은 카테고리와
    무관하게 전부 GCS로 가지만, 호출부 시그니처 호환을 위해 인자는 남겨둔다.

    실패 시(차단·만료·네트워크 오류 등) 원본 URL을 그대로 반환 — 장소 등록/수정 자체는
    이미지 재호스팅 실패와 무관하게 계속 진행되어야 함.
    """
    if not url:
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
    """우리 저장소(Supabase 또는 GCS)에 있는 이미지면 삭제. 외부 URL/빈 값은 무시.

    반환값은 호출부(cleanup_expired_data 등)가 성공/실패/스킵 건수를 집계해 로그로
    남길 수 있도록 함 — 고아 이미지 5,967개(2026-09-03 발견)가 어느 경로에서 새는지
    지금까지 로그가 전혀 없어 특정을 못 했던 문제를 고치기 위함.
    """
    if not is_internal_url(url):
        return "skipped"

    if url.startswith(_GCS_POPUP_PREFIX):
        if not ADMIN_SECRET_KEY:
            return "skipped"
        try:
            resp = requests.delete(
                f"{NOW_BACKEND_TUNNEL_URL}/internal/gcs-image",
                params={"url": url},
                headers={"x-admin-secret": ADMIN_SECRET_KEY},
                timeout=15,
            )
            resp.raise_for_status()
            result = resp.json().get("result", "failed")
            return "deleted" if result == "deleted" else result
        except Exception as e:
            logger.warning("[image_storage] GCS 삭제 중 오류 (url=%s): %s", url, e)
            return "failed"

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
