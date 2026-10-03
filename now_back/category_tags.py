"""장르/성격 카테고리 태그 고정 세트 — mood_tags.py와 동일한 이유로 고정 목록 강제.

무드 태그(분위기, 최대 3개)와 달리 카테고리는 "이 팝업이 패션인지 캐릭터인지" 같은
성격 분류라 장소당 정확히 1개만 고른다. 목록을 넓히려면 이 파일의 CATEGORY_TAGS만
수정하면 된다(다른 곳에 하드코딩 금지).
"""

from typing import Optional

CATEGORY_TAGS: list[str] = [
    "패션",
    "뷰티",
    "캐릭터",
    "애니웹툰",
    "엔터",
    "종합",
]

_CATEGORY_TAG_SET = set(CATEGORY_TAGS)

DEFAULT_CATEGORY_TAG = "종합"


def validate_category_tag(raw) -> str:
    """LLM 응답을 고정 세트로 정제 — 목록 밖 값·형식 오류는 전부 "종합"으로 폴백.

    mood_tags와 달리 category_tag는 NULL(=미생성)과 값 없음을 구분할 필요가 없다 —
    반드시 5개 중 하나로 떨어지는 분류라 "판단 불가"를 표현할 이유가 없고,
    애매하면 "종합"이 이미 그 역할(나머지 전부)을 한다.
    """
    if isinstance(raw, str):
        tag = raw.strip()
        if tag in _CATEGORY_TAG_SET:
            return tag
    return DEFAULT_CATEGORY_TAG


def resolve_category_input(raw: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    """텔레그램 /fav, /kakao 명령은 "카테고리" 인자를 하나만 받는데, 사람이 보기엔 팝업/클래스/
    쇼핑/전시/행사(지역 서브탭용 category)와 패션/뷰티/캐릭터/애니웹툰/엔터/종합(장르용
    category_tag)이 똑같이 "카테고리"라 구분 없이 입력한다. 값 자체가 category_tag 고정
    목록에 있으면 그쪽으로, 아니면 기존처럼 category로 돌린다 — 안 그러면 사람이 직접
    URL을 주며 "엔터"라고 지정해도 엉뚱한 축(category)에 저장돼버린다(2026-09-11 발견:
    NOL 자동판별뿐 아니라 /fav·/kakao로 사용자가 직접 지정한 것도 같은 함정에 걸려 있었음).
    """
    if raw and raw in _CATEGORY_TAG_SET:
        return None, raw
    return raw, None


def prompt_block() -> str:
    """소개문 생성 프롬프트에 끼워 넣을 카테고리 태그 지시문."""
    return (
        f"\n\n[카테고리 태그]\n"
        f"아래 목록 중 이 장소의 성격에 가장 맞는 것 딱 1개를 category_tag에 담아줘.\n"
        f"{', '.join(CATEGORY_TAGS)}\n"
        f"- 패션: 의류·잡화·액세서리 브랜드 팝업\n"
        f"- 뷰티: 화장품·향수·스킨케어 브랜드 팝업\n"
        f"- 캐릭터: 특정 캐릭터 IP(산리오, 카카오프렌즈 등) 굿즈/체험 팝업\n"
        f"- 애니웹툰: 애니메이션·웹툰·게임 IP 팝업\n"
        f"- 엔터: 아이돌·연예인 관련 굿즈/체험 팝업\n"
        f"- 종합: 위 5개에 뚜렷이 속하지 않는 나머지 전부(식품, 라이프스타일, 전시, 클래스 등)\n"
        f"- 애매하면 억지로 세부 카테고리에 끼워 맞추지 말고 종합을 고를 것."
    )
