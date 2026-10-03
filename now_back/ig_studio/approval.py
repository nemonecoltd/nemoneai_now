"""ig_posts 기록 + 텔레그램 승인 발송/명령 처리. telegram_admin_bot.py가 /ok /redo /skip /posted를
이 모듈의 함수로 위임한다(봇 자체의 폴링·라우팅 구조는 건드리지 않음)."""
from __future__ import annotations
import os
from pathlib import Path

import requests

from . import db as ig_db

_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
_BASE = f"https://api.telegram.org/bot{_TOKEN}"


def _send_text(text: str) -> None:
    try:
        requests.post(f"{_BASE}/sendMessage", json={"chat_id": _CHAT_ID, "text": text}, timeout=10)
    except Exception as e:
        print(f"[ig_studio.approval] 텍스트 전송 실패: {e}")


def send_for_approval(post_id: int, fmt: str, target_date: str, caption: str, needs_review: bool, review_reason: str, png_paths: list[Path], share_url: str | None = None) -> None:
    warn = f" ⚠ 확인 필요: {review_reason}" if needs_review else ""
    header = f"[IG #{post_id}] {fmt} {target_date}{warn}"
    # wed(3시간코스)만 실제 코스 URL이 있음 — 인스타 캡션 자체엔 안 넣는다(어차피 클릭이
    # 안 먹혀서 캡션은 "댓글 남기면 링크 전달" 방식을 그대로 씀), 대신 관리자가 댓글에
    # 답할 때 바로 쓸 수 있게 텔레그램 메시지에만 실어 보낸다(2026-09-20).
    url_line = f"\n코스 링크: {share_url}" if share_url else ""
    message = f"{header}{url_line}\n---\n{caption}\n---\n/ok {post_id}   /redo {post_id}   /skip {post_id}"

    if not png_paths:
        _send_text(message)
        return

    try:
        files = {}
        media = []
        for i, p in enumerate(png_paths):
            key = f"photo{i}"
            files[key] = (p.name, open(p, "rb"), "image/png")
            item = {"type": "photo", "media": f"attach://{key}"}
            if i == 0:
                item["caption"] = message
            media.append(item)
        requests.post(
            f"{_BASE}/sendMediaGroup",
            data={"chat_id": _CHAT_ID, "media": __import__("json").dumps(media, ensure_ascii=False)},
            files=files,
            timeout=30,
        )
    except Exception as e:
        print(f"[ig_studio.approval] 미디어그룹 전송 실패: {e}")
        _send_text(message)
    finally:
        for f in files.values():
            try:
                f[1].close()
            except Exception:
                pass


def send_no_candidate(fmt: str, target_date: str, reason: str) -> None:
    _send_text(f"[IG] {fmt} {target_date} — 생성 안 함\n사유: {reason}")


def handle_ok(post_id: int) -> str:
    post = ig_db.get_post(post_id)
    if not post:
        return f"#{post_id} 없음"
    ig_db.set_status(post_id, "approved")
    output_dir = post.get("output_dir")
    if output_dir:
        for p in sorted(Path(output_dir).glob("*.png")):
            try:
                requests.post(
                    f"{_BASE}/sendDocument",
                    data={"chat_id": _CHAT_ID},
                    files={"document": (p.name, open(p, "rb"), "image/png")},
                    timeout=30,
                )
            except Exception as e:
                print(f"[ig_studio.approval] 원본 재전송 실패({p}): {e}")
    return f"#{post_id} 승인 — 원본 PNG 재전송 완료"


def handle_skip(post_id: int) -> str:
    post = ig_db.get_post(post_id)
    if not post:
        return f"#{post_id} 없음"
    ig_db.set_status(post_id, "skipped")
    return f"#{post_id} 스킵"


def handle_posted(post_id: int) -> str:
    post = ig_db.get_post(post_id)
    if not post:
        return f"#{post_id} 없음"
    ig_db.set_status(post_id, "posted")
    return f"#{post_id} 게시완료로 기록 — 월요일 비교/수요일 로테이션에 반영됨"


def handle_redo(post_id: int) -> str:
    """같은 포맷·날짜로 재생성 — cli.py의 실제 생성 로직을 다시 호출."""
    post = ig_db.get_post(post_id)
    if not post:
        return f"#{post_id} 없음"
    from . import cli as ig_cli
    from datetime import date as _date

    fmt, target_date = post["format"], post["target_date"]
    if isinstance(target_date, str):
        target_date = _date.fromisoformat(target_date)
    ig_db.set_status(post_id, "skipped")
    ig_cli.run_format(fmt, target_date, dry_run=False)
    return f"#{post_id} 재생성 요청 — 새 카드로 다시 발송됨"
