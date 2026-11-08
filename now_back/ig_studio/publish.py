"""인스타그램 API 게시 (2026-11-09) — 텔레그램 `/publish {id}`로만 실행된다(승인 /ok → /publish 두 단계).
흐름: PNG → JPEG 변환 → 서버(/internal/ig-image-upload)로 GCS 업로드(공개 URL) → 이미지 컨테이너 → (2장 이상이면 캐러셀 컨테이너) → 처리 완료 대기 → media_publish.
이미지 1장(마감 임박)은 단일 이미지 게시, 2~10장(랭킹·코스)은 캐러셀. 영상·스토리는 하지 않는다(사용자 결정, 혼잡도 스토리 삭제).

안전장치
- IG_PUBLISH_ENABLED=true 가 아니면 아무것도 하지 않는다. 토큰은 .env의 IG_ACCESS_TOKEN / 계정은 IG_USER_ID (코드·문서·로그에 값을 남기지 않는다)
- 중복 게시 방지: status 'approved' → 'publishing' 을 한 번의 UPDATE로 선점한 쪽만 진행. 같은 글은 media_id가 있으면 거부.
- media_publish 호출이 응답 없이 끝난 경우(실제로 올라갔을 수 있음)는 자동 재시도 없이 'publish_unknown'으로 두고 사람이 인스타를 확인한다.
- dry_run=True: 변환·검증·토큰 점검만 한다(업로드·컨테이너·게시 없음)."""
from __future__ import annotations

import io
import os
import time
from pathlib import Path

import requests

from . import db as ig_db

GRAPH = "https://graph.facebook.com/v21.0"
MAX_IMAGES = 10
MAX_CAPTION = 2200
MAX_JPEG_BYTES = 8 * 1024 * 1024
MIN_RATIO, MAX_RATIO = 0.8, 1.91          # 가로/세로 허용 범위(4:5 ~ 1.91:1) — 피드 카드는 1080x1350(0.8)로 하한 경계


class IGError(Exception):
    pass


def _enabled() -> bool:
    return os.getenv("IG_PUBLISH_ENABLED") == "true"


def _creds() -> tuple[str, str]:
    tok, uid = os.getenv("IG_ACCESS_TOKEN", ""), os.getenv("IG_USER_ID", "")
    if not tok or not uid:
        raise IGError("IG_ACCESS_TOKEN / IG_USER_ID 가 .env에 없음")
    return tok, uid


def _call(method: str, path: str, **params) -> dict:
    """Graph API 호출. 오류 메시지에 토큰이 섞이지 않게 Graph가 준 error.message만 쓴다."""
    tok, _ = _creds()
    params["access_token"] = tok
    try:
        r = requests.request(method, f"{GRAPH}/{path}", **({"params": params} if method == "GET" else {"data": params}), timeout=60)
    except requests.RequestException as e:
        raise IGError(f"네트워크 오류({type(e).__name__})") from None
    try:
        body = r.json()
    except Exception:
        raise IGError(f"응답 해석 실패(HTTP {r.status_code})") from None
    if r.status_code >= 400 or "error" in body:
        err = body.get("error", {})
        raise IGError(f"Graph {r.status_code}: {err.get('message', '?')} (code {err.get('code')}, sub {err.get('error_subcode')})")
    return body


# ── 이미지 준비 ─────────────────────────────────────────────

def to_jpeg(png_path: str | Path) -> bytes:
    """인스타 API는 JPEG만 받는다(PNG·WebP 불가). 카드는 RGB 평면이라 품질 92로 변환."""
    from PIL import Image

    img = Image.open(png_path)
    if img.mode != "RGB":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode in ("RGBA", "LA"):
            bg.paste(img, mask=img.split()[-1])
            img = bg
        else:
            img = img.convert("RGB")
    ratio = img.width / img.height
    if not (MIN_RATIO - 1e-6 <= ratio <= MAX_RATIO):
        raise IGError(f"{Path(png_path).name}: 비율 {ratio:.2f} (허용 {MIN_RATIO}~{MAX_RATIO})")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92, optimize=True)
    data = buf.getvalue()
    if len(data) > MAX_JPEG_BYTES:
        raise IGError(f"{Path(png_path).name}: JPEG {len(data)//1024}KB > 8MB")
    return data


def upload_jpeg(data: bytes) -> str:
    """서버 내부 API가 GCS에 올리고 공개 URL을 돌려준다(로컬엔 GCS 쓰기 권한이 없다 — image_storage와 같은 SSH 터널 경유)."""
    base = os.getenv("NOW_BACKEND_TUNNEL_URL", "http://127.0.0.1:18081")
    secret = os.getenv("ADMIN_SECRET_KEY", "")
    try:
        r = requests.post(f"{base}/internal/ig-image-upload", data=data, headers={"x-admin-secret": secret, "Content-Type": "image/jpeg"}, timeout=90)
    except requests.RequestException as e:
        raise IGError(f"이미지 업로드 연결 실패({type(e).__name__}) — SSH 터널(gcs-tunnel) 확인") from None
    if r.status_code != 200 or not r.json().get("url"):
        raise IGError(f"이미지 업로드 실패(HTTP {r.status_code})")
    return r.json()["url"]


# ── Graph API 단계 ───────────────────────────────────────────

def _wait_finished(container_id: str, timeout: int = 90) -> None:
    deadline = time.time() + timeout
    while True:
        st = _call("GET", container_id, fields="status_code").get("status_code")
        if st == "FINISHED":
            return
        if st in ("ERROR", "EXPIRED"):
            raise IGError(f"컨테이너 처리 실패({st})")
        if time.time() > deadline:
            raise IGError("컨테이너 처리 시간 초과")
        time.sleep(3)


def _publish_container(creation_id: str) -> str:
    """media_publish — 여기서 예외가 나면 실제로 올라갔는지 알 수 없으므로 호출부가 'publish_unknown' 처리한다."""
    _, uid = _creds()
    return _call("POST", f"{uid}/media_publish", creation_id=creation_id)["id"]


def post_images(urls: list[str], caption: str) -> tuple[str, str | None]:
    """공개 URL들을 게시하고 (media_id, permalink) 반환. 호출 전 검증은 publish_post가 한다."""
    _, uid = _creds()
    if len(urls) == 1:
        creation = _call("POST", f"{uid}/media", image_url=urls[0], caption=caption)["id"]
    else:
        children = [_call("POST", f"{uid}/media", image_url=u, is_carousel_item="true")["id"] for u in urls]
        for c in children:
            _wait_finished(c)
        creation = _call("POST", f"{uid}/media", media_type="CAROUSEL", children=",".join(children), caption=caption)["id"]
    _wait_finished(creation)
    try:
        media_id = _publish_container(creation)
    except IGError as e:
        raise PublishUnknown(str(e)) from None
    permalink = None
    try:
        permalink = _call("GET", media_id, fields="permalink").get("permalink")
    except IGError:
        pass
    return media_id, permalink


class PublishUnknown(IGError):
    """media_publish 결과를 확정 못 함 — 인스타에 올라갔는지 사람이 확인해야 한다(자동 재시도 금지)."""


# ── 진입점 ───────────────────────────────────────────────────

def _png_list(post: dict) -> list[Path]:
    out = post.get("output_dir")
    return sorted(Path(out).glob("*.png")) if out else []


def check_post(post: dict) -> list[Path]:
    """게시 전 정적 검증 — 실패하면 IGError. 통과하면 이미지 경로 목록."""
    if post.get("media_id"):
        raise IGError(f"이미 게시됨(media {post['media_id']})")
    if post["format"] not in ("ranking", "course", "closing"):
        raise IGError(f"게시 대상 포맷 아님: {post['format']}")
    caption = post.get("caption") or ""
    if not caption.strip():
        raise IGError("캡션이 비어 있음")
    if len(caption) > MAX_CAPTION:
        raise IGError(f"캡션 {len(caption)}자 > {MAX_CAPTION}")
    pngs = _png_list(post)
    if not pngs:
        raise IGError("카드 이미지(PNG) 없음 — output_dir 확인")
    if len(pngs) > MAX_IMAGES:
        raise IGError(f"이미지 {len(pngs)}장 > {MAX_IMAGES}")
    return pngs


def publish_post(post_id: int, dry_run: bool = False) -> dict:
    """반환: {"ok", "message", ...}. 실제 게시는 IG_PUBLISH_ENABLED=true + status 'approved' 일 때만."""
    post = ig_db.get_post(post_id)
    if not post:
        return {"ok": False, "message": f"#{post_id} 없음"}
    try:
        pngs = check_post(post)
        jpegs = [to_jpeg(p) for p in pngs]               # 변환·비율·용량 검증 (dry-run도 여기까지는 한다)
        _, uid = _creds()
        who = _call("GET", uid, fields="username").get("username")      # 토큰·계정 점검(읽기 전용)
    except IGError as e:
        return {"ok": False, "message": f"#{post_id} 사전 점검 실패: {e}"}

    plan = f"{len(jpegs)}장({'캐러셀' if len(jpegs) > 1 else '단일'}) → @{who}, 캡션 {len(post['caption'])}자"
    if dry_run:
        return {"ok": True, "dry_run": True, "message": f"#{post_id} 점검 통과 — {plan} (게시 안 함)"}
    if not _enabled():
        return {"ok": False, "message": f"#{post_id} 게시 꺼짐(IG_PUBLISH_ENABLED != true) — {plan}"}
    if post["status"] != "approved":
        return {"ok": False, "message": f"#{post_id} 상태가 '{post['status']}' — 먼저 /ok {post_id} 로 승인하세요"}

    if not ig_db.claim_for_publish(post_id):             # 동시 /publish 방지
        return {"ok": False, "message": f"#{post_id} 이미 게시 처리 중이거나 상태가 바뀜"}
    try:
        urls = [upload_jpeg(j) for j in jpegs]
        media_id, permalink = post_images(urls, post["caption"])
    except PublishUnknown as e:
        ig_db.finish_publish(post_id, "publish_unknown", error=str(e))
        return {"ok": False, "message": f"#{post_id} ⚠ 게시 결과 불확실: {e}\n인스타 @{who} 를 직접 확인하세요. 올라가 있으면 /posted {post_id}, 없으면 /ok {post_id} 후 다시 /publish (자동 재시도 안 함)"}
    except IGError as e:
        ig_db.finish_publish(post_id, "approved", error=str(e))       # 게시 전 단계 실패 — 승인 상태로 되돌려 다시 시도 가능
        return {"ok": False, "message": f"#{post_id} 게시 실패(올라가지 않음): {e}"}
    ig_db.finish_publish(post_id, "posted", media_id=media_id, permalink=permalink)
    return {"ok": True, "media_id": media_id, "permalink": permalink, "message": f"#{post_id} 게시 완료 ✅ {permalink or media_id}\n{plan}"}


if __name__ == "__main__":             # python -m ig_studio.publish <id> [--dry-run]
    import sys
    r = publish_post(int(sys.argv[1]), dry_run="--dry-run" in sys.argv)
    print(r["message"])
