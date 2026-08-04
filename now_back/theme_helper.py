"""수집기(collector_favorite.py, collector_kakao.py)가 완료 후 자동으로 '테마지도'를
만들 때 쓰는 공용 헬퍼. 실제 유저가 만든 테마와 구분되는 고정 system user_id를 씀."""
import json
from typing import Optional

from sqlalchemy import text

from database import engine

SYSTEM_USER_ID = "now-collector-system"
SYSTEM_USER_NAME = "now 큐레이션"


def create_theme(title: str, description: str, places: list[dict], region: str) -> Optional[int]:
    """places는 프론트 테마 상세 모달이 기대하는 {title, location, content, image_url, date_range}
    형태의 dict 리스트. 빈 리스트면 생성하지 않고 None 반환."""
    if not places:
        return None
    with engine.connect() as conn:
        result = conn.execute(text("""
            INSERT INTO themes (user_id, user_name, user_image, title, description, places, region)
            VALUES (:user_id, :user_name, NULL, :title, :description, :places, :region)
            RETURNING id
        """), {
            "user_id": SYSTEM_USER_ID,
            "user_name": SYSTEM_USER_NAME,
            "title": title,
            "description": description,
            "places": json.dumps(places),
            "region": region,
        })
        theme_id = result.scalar()
        conn.commit()
    return theme_id
