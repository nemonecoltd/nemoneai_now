"""DB region 값 → 인스타 표시명 매핑. 2026-09-17 실측(seongsu_places.region DISTINCT)
결과 용산 잔재 값은 이미 없고(전부 강북으로 이관 완료), 공연/축제만 태그 대상 제외."""
from __future__ import annotations

DISPLAY_REGIONS = ("성수", "홍대", "강북", "강남", "부산", "제주")

_NON_TAG_REGIONS = {"공연", "축제"}


def region_label(region: str | None) -> str | None:
    """표시명 반환, 매핑 대상 아니면 None(호출부에서 needs_review 처리)."""
    if region == "용산":  # 실측상 이미 없지만 방어적으로 유지
        return "강북"
    if region in DISPLAY_REGIONS:
        return region
    return None
