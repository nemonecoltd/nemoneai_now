"""now 이미지 GCS 업로드 — Supabase Storage의 Cached Egress 문제 회피.

2026-09-25: 팝업 전용으로 시작했으나 비팝업 상세페이지 스크래핑으로 Supabase Cached Egress가
다시 폭등해 전 카테고리로 확대(image_storage.upload_bytes가 공통 진입점). 함수명·프리픽스의
"popup"은 기존 URL 호환을 위해 그대로 둔 이름일 뿐이다.

2026-09-23: Supabase Storage의 public 엔드포인트(/object/public/...)가 업로드 시 지정한
cache-control 헤더를 무시하고 항상 no-cache로 서빙하는 게 확인됨(Free 플랜 한정 이슈로 추정,
storage-js 라이브러리·REST API 양쪽 다 동일 — 웹 검색으로 Supabase 자체의 알려진 이슈임을
확인). 매 조회마다 원본 그대로 재전송되어 Cached Egress 5GB/월 쿼터를 초과.

전체 이미지를 GCS로 옮기는 대신 팝업 카테고리만 옮기는 이유: 실측(GA4 아님, place_views 테이블
직접 집계, 2026-09-23) 결과 이미지 보유 장소의 15%(popup)가 조회의 82%를 차지함. 나머지
카테고리(쇼핑/클래스/공연/전시/행사)는 트래픽이 적어 Supabase에 남겨둬도 쿼터 영향이 작음.

이 모듈은 반드시 배포된 now_backend(msm VM) 안에서만 동작한다 — GCS 인증이 VM에 붙은 GCE
서비스 계정의 Application Default Credentials(ADC)에 의존하기 때문. 로컬 스크래퍼
(collector_naver.py 등)는 로컬에 GCS 자격증명이 없으므로 여기를 직접 import하지 않고,
routers/internal.py의 HTTP 엔드포인트를 거쳐 이 모듈을 호출한다.
"""
import io
import time
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# nemoneai-thumbnails는 matmatch가 쓰는 버킷을 그대로 공유(같은 프로젝트, VM 서비스 계정에
# 이미 쓰기 권한이 있는 걸 실측 확인함 — 새 버킷 생성/IAM 설정 불필요). now 이미지는
# now-popup/ 프리픽스로 분리해 matmatch 쪽과 섞이지 않게 한다.
BUCKET = "nemoneai-thumbnails"
PREFIX = "now-popup/"
MAX_DIMENSION = 1000

_client = None


def _get_bucket():
    global _client
    from google.cloud import storage as gcs_storage
    if _client is None:
        _client = gcs_storage.Client()
    return _client.bucket(BUCKET)


def _compress_to_webp(raw_bytes: bytes) -> bytes:
    from PIL import Image

    img = Image.open(io.BytesIO(raw_bytes))
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


def upload_popup_image(raw_bytes: bytes, name_hint: str = "popup", precompressed: bool = False) -> str:
    """이미지 바이트를 압축해 GCS에 업로드하고 공개 URL 반환. 실패 시 예외 전파(호출부에서 처리).

    precompressed=True면 호출부(로컬 스크래퍼)가 이미 같은 _compress_to_webp를 거친 webp —
    다시 압축하면 화질만 한 번 더 깎이므로 그대로 올린다.
    """
    webp_bytes = raw_bytes if precompressed else _compress_to_webp(raw_bytes)
    path = f"{PREFIX}{int(time.time() * 1000)}-{abs(hash(name_hint)) % 100000}.webp"
    bucket = _get_bucket()
    blob = bucket.blob(path)
    blob.cache_control = "public, max-age=31536000, immutable"
    blob.upload_from_string(webp_bytes, content_type="image/webp")
    return f"https://storage.googleapis.com/{BUCKET}/{path}"


def delete_popup_image(url: Optional[str]) -> str:
    """우리 GCS 경로의 이미지면 삭제. 외부/Supabase URL이면 skip."""
    prefix_url = f"https://storage.googleapis.com/{BUCKET}/{PREFIX}"
    if not url or not url.startswith(prefix_url):
        return "skipped"
    path = url[len(f"https://storage.googleapis.com/{BUCKET}/"):]
    try:
        bucket = _get_bucket()
        bucket.blob(path).delete()
        return "deleted"
    except Exception as e:
        logger.warning("[gcs_storage] 삭제 실패 (path=%s): %s", path, e)
        return "failed"
