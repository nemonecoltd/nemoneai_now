"""서울시 실시간 도시데이터(혼잡도) 조회 — 지도 탭 상단 카드용.
scraper_seoul_crowd.py(launchd, 1시간 간격)가 채워둔 crowd_status를 읽기만 한다."""
from fastapi import APIRouter, HTTPException
from sqlalchemy import text

from database import engine
from deps import CROWD_AREA_MAP

router = APIRouter()


def _delta_pct(curr: float, prev: float) -> float:
    return round((curr - prev) / prev * 100, 1)


@router.get("/crowd")
async def get_crowd(area: str):
    if area not in CROWD_AREA_MAP:
        raise HTTPException(status_code=400, detail=f"area는 {list(CROWD_AREA_MAP.keys())} 중 하나여야 합니다")

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT area_nm, congest_lvl, prev_congest_lvl, ppltn_min, ppltn_max,
                       prev_ppltn_min, prev_ppltn_max, fcst_text, age_gender_summary,
                       weather_summary, updated_at
                FROM crowd_status WHERE area_nm = :area
            """),
            {"area": area},
        ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="아직 수집된 데이터가 없습니다")

    result = {
        "area": row["area_nm"],
        "congest_lvl": row["congest_lvl"],
        "ppltn_min": row["ppltn_min"],
        "ppltn_max": row["ppltn_max"],
        "fcst_text": row["fcst_text"],
        "age_gender_summary": row["age_gender_summary"],
        "weather_summary": row["weather_summary"],
        "updated_at": row["updated_at"],
    }

    # prev가 없는 최초 수집 직후엔 델타 필드 자체를 생략(프론트가 0%/화살표를 오해석하지 않도록)
    if row["prev_ppltn_min"] is not None and row["prev_ppltn_max"] is not None:
        prev_mid = (row["prev_ppltn_min"] + row["prev_ppltn_max"]) / 2
        curr_mid = (row["ppltn_min"] + row["ppltn_max"]) / 2
        if prev_mid > 0:
            result["ppltn_delta_pct"] = _delta_pct(curr_mid, prev_mid)
        result["prev_congest_lvl"] = row["prev_congest_lvl"]

    return result
