"""인스타 게시물 → 댓글 응답 규칙(2026-11-09, 사용자 확정).
게시물 끝의 "댓글에 ○○ 남기면 링크를 보내드려요"에 대해 무엇을 보낼지를 포맷별로 정한다. 프로필 링크(바이오)는 now.nemoneai.com.
- 코스: 그 게시물의 코스 페이지(/course/{번호}) — 코스 생성 때 실제 공개 저장돼 주소가 존재한다(data._generate_course)
- 랭킹: PACE 랭킹 페이지(/ranking/place)
- 마감 임박: 마감 임박 장소 최대 3곳을 "이름 + 링크"로(각 장소 상세 /posts/{id})
혼잡도 스토리 포맷은 삭제됐다. 링크가 정해지지 않은 게시물(spec=None)은 자동 응답하지 않는다."""
from __future__ import annotations

SITE = "https://now.nemoneai.com"
KEYWORD = {"ranking": "링크", "course": "코스", "closing": "링크"}
PROFILE_LINK = SITE


def reply_spec(fmt: str, payload: dict) -> dict | None:
    """{"keyword": 댓글 키워드, "items": [{"name", "url"}…]} 또는 None(보낼 링크 없음)."""
    kw = KEYWORD.get(fmt)
    if not kw:
        return None
    if fmt == "course":
        url = payload.get("share_url")
        if not url:
            return None
        title = payload.get("title") or (f"{payload.get('where')} 3시간 코스" if payload.get("where") else "PACE 3시간 코스")
        return {"keyword": kw, "items": [{"name": title, "url": url}]}
    if fmt == "ranking":
        return {"keyword": kw, "items": [{"name": "PACE 주간 인기 랭킹", "url": f"{SITE}/ranking/place"}]}
    if fmt == "closing":
        items = [{"name": i["title"], "url": f"{SITE}/posts/{i['id']}"} for i in (payload.get("items") or [])[:3] if i.get("id") and i.get("title")]
        return {"keyword": kw, "items": items} if items else None
    return None


def format_reply(spec: dict) -> str:
    """댓글 답글/DM 본문 — 이름과 링크를 줄바꿈으로."""
    lines = ["PACE에서 안내드려요 🙌"]
    for it in spec["items"]:
        lines.append(f"{it['name']}\n{it['url']}")
    lines.append(f"더 많은 팝업과 코스는 프로필 링크({PROFILE_LINK})에서 확인하세요.")
    return "\n\n".join(lines)


def matches(spec: dict | None, comment_text: str) -> bool:
    """댓글에 응답 키워드가 들어 있는가(공백·대소문자 무시)."""
    if not spec or not comment_text:
        return False
    return spec["keyword"] in comment_text.replace(" ", "")
