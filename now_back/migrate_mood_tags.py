"""seongsu_places에 mood_tags 컬럼 추가 (2026-09-02).

NULL      = 아직 2차 생성(enrich) 전 — 백필/정규 크론의 처리 대상
빈 배열 [] = 생성은 됐으나 근거 부족으로 태그 없음 — 재시도 대상 아님
이 구분을 유지해야 같은 장소를 무한 재시도하지 않는다.
"""
from sqlalchemy import text

from database import engine

ALTER = """
ALTER TABLE seongsu_places
    ADD COLUMN IF NOT EXISTS mood_tags TEXT[] DEFAULT NULL;
"""

# mood 필터(WHERE mood_tags @> ARRAY['...'])가 5천 건 전체 스캔을 타지 않도록 GIN 인덱스
INDEX = """
CREATE INDEX IF NOT EXISTS idx_seongsu_places_mood_tags
    ON seongsu_places USING GIN (mood_tags);
"""


def migrate() -> None:
    with engine.begin() as conn:
        conn.execute(text(ALTER))
        conn.execute(text(INDEX))
    print("완료: seongsu_places.mood_tags 컬럼 + GIN 인덱스 추가됨")


if __name__ == "__main__":
    migrate()
