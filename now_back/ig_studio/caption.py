"""Gemini 캡션(+수요일 스톱 한줄요약/헤드라인) 생성 — 5절 규칙을 프롬프트+코드 양쪽에서 강제.
스토리(story)는 인스타그램 스토리 자체에 캡션 필드가 없어 이 모듈을 호출하지 않는다(cli.py 참고)."""
from __future__ import annotations
import json
import time

from gemini_service import client, types

_FORBIDDEN = [
    "네이버", "무조건", "역대급", "크롤링", "수집", "스크래핑",
    # 2026-09-17 실사고 — "PACE에서만 만날 수 있는 독점 혜택"처럼 실제로 없는 제휴/특전을
    # AI가 지어낸 문구가 그대로 나감(PACE는 큐레이션만 할 뿐 운영사·제휴사가 아님).
    "독점", "단독 혜택", "단독혜택", "제휴 혜택", "제휴혜택", "특별 할인", "할인 혜택",
]
_MAX_CAPTION_LEN = 500
_MIN_TAGS, _MAX_TAGS = 3, 5

_CTA_LINE = {
    "mon": "댓글에 \"링크\" 남기면 보내드려요",
    "wed": "댓글에 \"코스\" 남기면 링크를 보내드려요",
    "fri": "댓글에 \"링크\" 남기면 보내드려요",
}


# 2026-09-17 실사고 — "PACE에서만 만날 수 있는 독점 혜택" 같은 실재하지 않는 제휴/특전을
# AI가 지어내 그대로 발송됨. PACE는 발견/큐레이션 서비스일 뿐 팝업 운영사·제휴사가 아니라는
# 전제를 프롬프트에 명시해 애초에 생성 단계에서 안 나오게 한다(검증 단계 차단은 2차 방어선).
_NO_FABRICATION_RULE = (
    "PACE는 이 장소들을 발견해 소개하는 큐레이션 서비스일 뿐, 운영사도 제휴사도 아니다. "
    "\"PACE 단독 혜택\", \"독점 할인\", \"PACE에서만\" 같이 실재하지 않는 특전·제휴·독점 관계를 "
    "지어내지 말 것 — 장소 자체의 매력만 사실대로 소개할 것."
)


def _prompt_for(fmt: str, payload: dict) -> str:
    if fmt == "mon":
        # 2026-10-03 — 이 포맷은 원래 월요일 발행이었다가 토요일로 스케줄이 바뀌었는데
        # 프롬프트엔 "월요일"이 문자열로 박혀 있어서, 토요일에 올라간 글이 "월요일 시작!!"으로
        # 시작하는 사고가 있었다(wed가 이미 2026-09-20에 겪은 것과 같은 함정 — outing_day처럼
        # 발행 요일을 프롬프트에서 아예 안 쓰는 쪽으로 고친다. 특정 요일 언급 금지).
        names = ", ".join(i["title"] for i in payload["items"][:5])
        return f"""PACE(로컬 가이드 서비스) 인스타그램 "주간 조회 랭킹" 게시물 캡션을 써줘.
이번 주 조회수 상위 장소: {names}
규칙: 특정 요일(월요일/화요일 등)을 언급하지 말 것 — "이번 주", "매주" 같은 표현만 사용.
규칙: 캡션 500자 이내, 첫 줄은 "이번 주 진짜 많이 본 곳"과 다른 문장으로 시작, 해시태그 3~5개(#포함),
"PACE 이용자들의 실제 조회수 기준 집계"라는 취지의 문장을 반드시 포함, 과장 표현·날씨 언급·가격/대기시간 단정 금지.
{_NO_FABRICATION_RULE}
마지막 줄에 {_CTA_LINE['mon']}를 그대로 포함.
JSON으로만 응답: {{"caption": "...", "hashtags": ["...", ...]}}"""
    if fmt == "fri":
        # 2026-10-03 — mon과 같은 이유로 요일 하드코딩 제거(지금은 금요일 발행이라 안 어긋나지만,
        # 나중에 스케줄이 또 바뀌면 똑같은 사고가 재발하므로 애초에 요일 언급 자체를 안 함).
        names = ", ".join(i["title"] for i in payload["items"])
        return f"""PACE 인스타그램 "마감 임박" 게시물 캡션을 써줘.
곧 종료되는 장소: {names}
규칙: 캡션 500자 이내, 해시태그 3~5개, 과장 표현·날씨 언급·가격/대기시간 단정 금지.
특정 요일(월요일/화요일 등)을 언급하지 말 것.
{_NO_FABRICATION_RULE}
마지막 줄에 {_CTA_LINE['fri']}를 그대로 포함.
JSON으로만 응답: {{"caption": "...", "hashtags": ["...", ...]}}"""
    if fmt == "wed":
        stops_text = "\n".join(f"- {s['name']}: {s['activity'] or s['raw_content']}" for s in payload["stops"])
        outing_day = payload.get("outing_day", "주말")
        # 2026-09-20 — "수요일"을 프롬프트에 문자열로 박아뒀던 게, 이미지 표지가 계산해서 보여주는
        # "다음 {outing_day}" 라벨과 어긋나는 원인이었다(발행 요일이 언제든 캡션은 늘 "이번 주
        # 수요일"이라고 썼음). payload의 outing_day(이미지와 동일한 계산식)를 그대로 써서
        # 캡션도 같은 날을 가리키게 한다 — "코스를 언제 즐기면 좋은지"를 말하는 것이지 "이 글이
        # 언제 올라갔는지"가 아니므로, 발행 시점(오늘 요일)이 아니라 outing_day를 써야 맞다.
        return f"""PACE 인스타그램 "3시간 코스"({payload['region']}) 게시물용 텍스트를 생성해줘.
이 코스는 {outing_day}에 즐기기 좋은 코스로 소개한다(글이 언제 올라가는지는 무관 — 캡션엔
"{outing_day}"라고만 쓰고 다른 날짜·요일은 언급하지 말 것. "이번 주"는 outing_day가 다음 달로
넘어갈 수도 있어 붙이지 않는다).
코스 스톱:
{stops_text}
다음을 모두 생성:
1. headline: "{{조건/무드}} {payload['region']} 반나절" 형태, 16자 이내, 날씨 언급 금지(실제 예보 조회 안 함)
2. stop_summaries: 각 스톱을 20자 이내 한 줄로 요약(장소명을 key로), 사실만·과장 금지
3. caption: 500자 이내, 첫 줄은 headline과 다른 문장, "{outing_day}" 표현을 자연스럽게 포함,
   해시태그 3~5개, 과장·날씨·가격 단정 금지
   {_NO_FABRICATION_RULE}
   마지막 줄에 "{_CTA_LINE['wed']}"를 그대로 포함
JSON으로만 응답: {{"headline": "...", "stop_summaries": {{"장소명": "..."}}, "caption": "...", "hashtags": ["...", ...]}}"""
    raise ValueError(f"caption 지원 안 하는 포맷: {fmt}")


def _call_gemini(prompt: str) -> dict:
    last_error = None
    for attempt in range(3):
        try:
            resp = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            raw = (resp.text or "").strip().replace("```json", "").replace("```", "").strip()
            return json.loads(raw)
        except Exception as e:
            last_error = e
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
    raise last_error


def _validate(result: dict, fmt: str) -> list[str]:
    problems = []
    caption = result.get("caption", "")
    if not caption or len(caption) > _MAX_CAPTION_LEN:
        problems.append("caption 길이")
    tags = result.get("hashtags", [])
    if not (_MIN_TAGS <= len(tags) <= _MAX_TAGS):
        problems.append("해시태그 개수")
    lower = caption.lower()
    for word in _FORBIDDEN:
        if word.lower() in lower:
            problems.append(f"금지어({word})")
    if fmt == "mon" and "조회" not in caption:
        problems.append("조회수 집계 기준 문장 누락")
    # 끝에 마침표/느낌표를 붙이는 등 사소한 구두점 변형까지 "문구 누락"으로 오탐하지 않게
    # 양쪽 다 구두점을 벗기고 비교(2026-09-17 dry-run에서 실제로 오탐 발견).
    cta = _CTA_LINE.get(fmt, "")
    if cta and cta.rstrip(".!") not in caption.rstrip(".!\n "):
        problems.append("CTA 문구 누락")
    if fmt == "wed":
        headline = result.get("headline", "")
        if not headline or len(headline) > 16:
            problems.append("headline 길이")
        if caption.split("\n")[0].strip() == headline.strip():
            problems.append("caption 첫 줄이 headline과 동일")
    return problems


def generate_caption(fmt: str, payload: dict) -> dict:
    """반환: {"caption", "hashtags", "headline"?, "stop_summaries"?, "needs_review", "problems"}"""
    prompt = _prompt_for(fmt, payload)
    for attempt in range(2):  # 최초 1회 + 검증 실패 시 재생성 1회(5절)
        try:
            result = _call_gemini(prompt)
        except Exception as e:
            return {"caption": "", "hashtags": [], "needs_review": True, "problems": [f"Gemini 호출 실패: {e}"]}
        problems = _validate(result, fmt)
        if not problems:
            result["needs_review"] = False
            result["problems"] = []
            return result
    result["needs_review"] = True
    result["problems"] = problems
    return result
