"""API로 게시한 글의 새 댓글을 보고, 응답 키워드("코스"/"링크")가 든 댓글을 텔레그램으로 알린다(2026-11-09, 1단계 = 알림만).
자동 답글·DM은 하지 않는다 — 알림에 "누가 / 어떤 글 / 보낼 이름·링크"가 들어 있어 사람이 인스타에서 답한다.
launchd(StartInterval 600초)로 실행: python -m ig_studio.comments. 게시된 글이 없거나 IG_ACCESS_TOKEN이 없으면 조용히 끝난다."""
from __future__ import annotations

import os
from pathlib import Path

from . import db as ig_db
from . import links
from .publish import IGError, _call

_ERR_FLAG = Path(__file__).resolve().parent.parent / "logs" / ".ig_comments_error"      # 같은 오류 알림 반복 방지


def _notify(text: str) -> None:
    from .approval import _send_text
    _send_text(text)


def check_once(days: int = 7) -> dict:
    posts = ig_db.recent_published(days)
    me = None
    found = 0
    for post in posts:
        spec = (post["payload"] or {}).get("reply")
        data = _call("GET", f"{post['media_id']}/comments", fields="id,text,username,timestamp", limit=50).get("data", [])
        for c in data:
            if not ig_db.mark_comment_seen(c["id"], post["id"]):
                continue
            if me is None:
                me = os.getenv("IG_USERNAME", "nemone_pace")
            if c.get("username") == me or not links.matches(spec, c.get("text", "")):
                continue
            found += 1
            who = f"@{c['username']}" if c.get("username") else "(작성자 미확인)"
            _notify(
                f"[IG #{post['id']} {post['format']}] 💬 {who} 님이 댓글을 남겼어요\n"
                f"“{(c.get('text') or '')[:100]}”\n{post.get('permalink') or ''}\n"
                f"──── 아래 내용을 답글로 보내 주세요 ────\n{links.format_reply(spec)}"
            )
    return {"posts": len(posts), "alerts": found}


def main() -> None:
    if not os.getenv("IG_ACCESS_TOKEN"):
        return
    try:
        r = check_once()
        _ERR_FLAG.unlink(missing_ok=True)
        print(f"[ig_comments] 글 {r['posts']}개 확인, 알림 {r['alerts']}건")
    except IGError as e:
        print(f"[ig_comments] 실패: {e}")
        if not _ERR_FLAG.exists():                     # 첫 실패에만 알림(10분마다 반복 방지)
            _ERR_FLAG.parent.mkdir(exist_ok=True)
            _ERR_FLAG.write_text("1")
            _notify(f"[ig_studio] 댓글 확인 실패: {e}\n(토큰 만료·권한 확인. 복구되면 자동으로 다시 동작)")


if __name__ == "__main__":
    main()
