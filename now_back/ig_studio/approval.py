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
        for chunk in [text[k:k + 3900] for k in range(0, len(text), 3900)] or [""]:     # 텔레그램 글 한도 4096자
            r = requests.post(f"{_BASE}/sendMessage", json={"chat_id": _CHAT_ID, "text": chunk}, timeout=10)
            if not r.ok:
                print(f"[ig_studio.approval] 텍스트 전송 거부: HTTP {r.status_code} {r.text[:200]}")
    except Exception as e:
        print(f"[ig_studio.approval] 텍스트 전송 실패: {e}")


def send_for_approval(post_id: int, fmt: str, target_date: str, caption: str, needs_review: bool, review_reason: str, png_paths: list[Path], share_url: str | None = None, reply: dict | None = None) -> None:
    warn = f" ⚠ 확인 필요: {review_reason}" if needs_review else ""
    header = f"[IG #{post_id}] {fmt} {target_date}{warn}"
    # course(3시간코스)만 실제 코스 URL이 있음 — 인스타 캡션 자체엔 안 넣는다(어차피 클릭이
    # 안 먹혀서 캡션은 "댓글 남기면 링크 전달" 방식을 그대로 씀), 대신 관리자가 댓글에
    # 답할 때 바로 쓸 수 있게 텔레그램 메시지에만 실어 보낸다(2026-09-20).
    url_line = f"\n코스 링크: {share_url}" if share_url else ""
    if reply:                                     # 댓글 "{keyword}"에 보낼 이름·링크(ig_studio/links.py 규칙)
        from . import links
        url_line = f"\n[댓글 '{reply['keyword']}' 응답]\n{links.format_reply(reply)}"
    message = f"{header}{url_line}\n---\n{caption}\n---\n/ok {post_id}  →  /publish {post_id}   /redo {post_id}   /skip {post_id}"

    if not png_paths:
        _send_text(message)
        return

    # 텔레그램 이미지 묶음의 설명(caption)은 1024자까지다 — 넘으면 요청이 400으로 거부되는데, 예전엔 응답을 확인하지 않아
    # 승인 메시지가 아예 안 온 채로 조용히 지나갔다(2026-11-13 마감 임박 #58). 길면 이미지엔 머리말만 붙이고 전체 글은 따로 보낸다.
    long_message = len(message) > 1000
    media_caption = header if long_message else message
    files = {}
    try:
        media = []
        for i, p in enumerate(png_paths):
            key = f"photo{i}"
            files[key] = (p.name, open(p, "rb"), "image/png")
            item = {"type": "photo", "media": f"attach://{key}"}
            if i == 0:
                item["caption"] = media_caption
            media.append(item)
        resp = requests.post(
            f"{_BASE}/sendMediaGroup",
            data={"chat_id": _CHAT_ID, "media": __import__("json").dumps(media, ensure_ascii=False)},
            files=files,
            timeout=30,
        )
        if not resp.ok:                              # 텔레그램이 거부(400/429 등) — 조용히 넘기지 말고 글이라도 보낸다
            raise RuntimeError(f"HTTP {resp.status_code} {resp.text[:200]}")
        if long_message:
            _send_text(message)
    except Exception as e:
        print(f"[ig_studio.approval] 미디어그룹 전송 실패: {e}")
        _send_text(f"{message}\n\n(이미지 전송에 실패했어요: {e}) — 이미지는 ig_studio/output 폴더에 있어요.")
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


def handle_publish(post_id: int) -> str:
    """/publish {id} — 승인(/ok)된 글을 인스타 API로 게시. `/publish {id} dry`는 점검만(게시 안 함)."""
    from . import publish
    return publish.publish_post(post_id, dry_run=False)["message"]


def handle_publish_dry(post_id: int) -> str:
    from . import publish
    return publish.publish_post(post_id, dry_run=True)["message"]
