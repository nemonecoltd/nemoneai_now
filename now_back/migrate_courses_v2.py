"""일회성 마이그레이션 — 코스 기능 개편(scope/source/forked_from/is_public) 기존 데이터 백필.
컬럼 자체는 routers/courses.py의 _ensure_course_columns()가 앱 기동 시 자동 추가하므로,
이 스크립트는 "기존 33건에 실제 값을 채우는" 일회성 작업만 담당한다. 재실행해도 안전
(이미 채워진 행은 조건에 안 걸려 no-op).

기존 동작 그대로 유지가 원칙:
- title이 '[퍼감]'으로 시작 → 비공개 취급이었으므로 source='fork', is_public=false
- 그 외 → 코스 랭킹에 노출되고 있었으므로 source='ai_draft', is_public=true
- scope: 기존 코스는 전부 AITour(3시간)에서 나온 것 → 'timed'
"""
from sqlalchemy import text
from database import engine

with engine.connect() as conn:
    forked = conn.execute(text("""
        UPDATE saved_courses
        SET scope = 'timed', source = 'fork', is_public = false
        WHERE title LIKE '[퍼감]%' AND source = 'manual' AND scope = 'free'
    """))
    normal = conn.execute(text("""
        UPDATE saved_courses
        SET scope = 'timed', source = 'ai_draft', is_public = true
        WHERE title NOT LIKE '[퍼감]%' AND source = 'manual' AND scope = 'free'
    """))
    conn.commit()
    print(f"✅ 백필 완료 — [퍼감]/비공개 {forked.rowcount}건, 일반/공개 {normal.rowcount}건")
