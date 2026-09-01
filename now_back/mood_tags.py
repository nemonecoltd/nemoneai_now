"""무드 태그 고정 세트 — 장소의 분위기를 사용자에게 노출하고 필터링에 쓰는 태그.

자유 텍스트로 생성하게 두면 "감성적인"/"감성있는"처럼 표기가 흩어져 `WHERE mood_tags @> ARRAY[...]`
필터로 쓸 수 없다. 그래서 LLM에게 이 리스트 안에서만 최대 3개를 고르게 강제하고,
응답이 리스트를 벗어나면 validate_tags()가 걸러낸다.

태그 세트를 넓히려면 이 파일의 MOOD_TAGS만 수정하면 된다(다른 곳에 하드코딩 금지).
"""

MOOD_TAGS: list[str] = [
    "감성/무드있는",
    "인생샷/포토스팟",
    "아늑한/조용한",
    "활기찬/떠들썩한",
    "데이트하기좋은",
    "아이랑가기좋은",
    "혼자가기좋은",
    "실내중심",
    "야외/테라스",
]

_MOOD_TAG_SET = set(MOOD_TAGS)

MAX_MOOD_TAGS = 3


def validate_tags(raw) -> list[str]:
    """LLM 응답을 고정 세트로 정제 — 리스트 밖 값·중복·형식 오류를 모두 드랍하고 최대 3개로 자른다.

    전부 드랍돼 빈 배열이 나와도 그대로 저장한다(재시도 없음). NULL(=아직 생성 전)과
    빈 배열(=생성했으나 판단 불가)을 구분해야 백필 스크립트가 같은 곳을 무한 재시도하지 않는다.
    """
    if not isinstance(raw, list):
        return []
    seen: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        tag = item.strip()
        if tag in _MOOD_TAG_SET and tag not in seen:
            seen.append(tag)
        if len(seen) >= MAX_MOOD_TAGS:
            break
    return seen


def prompt_block() -> str:
    """소개문 생성 프롬프트에 끼워 넣을 무드 태그 지시문."""
    return (
        f"\n\n[무드 태그]\n"
        f"아래 목록에서만 최대 {MAX_MOOD_TAGS}개를 골라 mood_tags에 담아줘.\n"
        f"{', '.join(MOOD_TAGS)}\n"
        f"- 위에 제공된 텍스트와 이미지에 실제로 나타난 내용만 근거로 판단할 것.\n"
        f"- 장소명이나 브랜드명에서 연상되는 일반적 이미지로 추측하지 말 것.\n"
        f"- 목록에 없는 새 태그를 만들지 말 것.\n"
        f"- 판단 근거가 부족하면 억지로 채우지 말고 빈 배열로 둘 것."
    )
