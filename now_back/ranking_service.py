"""인기 랭킹 서비스 — 캐시 보관·재계산·조회를 전담.

주의: 캐시(_place_popularity_cache 등)는 refresh_place_popularity()가 global 재할당으로
통째로 갈아끼우는 구조라, 다른 모듈에서 `from ranking_service import _place_popularity_cache`처럼
이름을 직접 import하면 갱신 전 리스트에 영원히 고정된다(문법 오류가 아니라 배포 후에야 드러나는 버그).
반드시 아래 get_*() 접근자 함수를 통해서만 읽을 것.
"""
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import text

from database import engine
from deps import _PLACE_RANKING_REGIONS

logger = logging.getLogger(__name__)

_place_popularity_cache: list = []
_performance_popularity_cache: list = []
_festival_popularity_cache: list = []
_shopping_popularity_cache: list = []
_exhibition_popularity_cache: list = []
_place_popularity_by_region: dict = {}
_popularity_last_refreshed: Optional[str] = None

def _popularity_rows(conn, interval_days: int, limit: int = 100, only_performance: bool = False, only_festival: bool = False, min_score: int = 0, exclude_jeju: bool = False, only_region: Optional[str] = None, only_category: Optional[str] = None):
    """조회수/좋아요 기반 인기 랭킹 쿼리 — interval_days 기간 내 활동만 집계.
    only_performance=False, only_festival=False, only_category=None(기본, 플레이스=팝업 랭킹): 공연/축제 제외, 원데이클래스/체험(category='class')도 제외해 팝업만 집계
    (어드민 CSV가 "이번주 핫플 팝업" 기사 작성용이라 학원류가 섞이면 편집상 어색함).
    only_performance=True(공연 랭킹 전용): 공연(KOPIS 수집분)만 집계.
    only_festival=True(축제 랭킹 전용): region='축제'만 집계.
    only_category='shopping'|'전시'(쇼핑/전시 랭킹 전용): 해당 category만 집계, 지역 구분 없이 통합.
    only_category='전시'는 category='전시'(비짓서울) + category='행사'(비짓제주)를 함께 묶어서 집계함.
    min_score: 이 점수 미만인 항목은 아예 제외(신규 카테고리라 조회수가 거의 없을 때 0점짜리로 25위를 억지로 채우지 않기 위함).
    exclude_jeju: 화면 표시용 TOP25/인기 캐시에는 제주 팝업도 포함하되, 주간 CSV(이번주 핫플 팝업 기사용)에서만
    제주를 빼고 싶을 때 사용 — 서울권 팝업 기사에 제주가 섞이면 편집상 어색하다는 요청.
    only_region: 플레이스 랭킹 지역 서브탭용 — _PLACE_RANKING_REGIONS 중 하나만 집계(호출 전 화이트리스트 검증 필수, SQL에 직접 삽입됨)."""
    if only_performance:
        region_clause = "AND p.region = '공연' AND p.naver_place_id LIKE 'kopis_%'"
    elif only_festival:
        region_clause = "AND p.region = '축제'"
    elif only_category:
        # 전시 랭킹은 서울권(비짓서울) '전시' + 제주(비짓제주) '행사'를 하나로 합쳐서 노출 —
        # 성격은 다르지만 카테고리 메뉴가 아직 '전시' 하나뿐이라 우선 통합, 품질/분리는 추후 검토
        categories = ("전시", "행사") if only_category == "전시" else (only_category,)
        cat_in = ", ".join(f"'{c}'" for c in categories)
        region_clause = f"AND p.category IN ({cat_in})"
    else:
        region_clause = "AND p.region != '공연' AND p.region != '축제' AND COALESCE(p.category, 'popup') = 'popup' AND p.naver_place_id NOT LIKE 'kopis_%' AND p.naver_place_id NOT LIKE 'jeju_%' AND p.naver_place_id NOT LIKE 'culture_%'"
        if exclude_jeju:
            region_clause += " AND p.region != '제주'"
        if only_region:
            region_clause += f" AND p.region = '{only_region}'"
    having_clause = f"HAVING COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT v.id) >= {min_score}" if min_score > 0 else ""
    return conn.execute(text(f"""
        SELECT p.id, p.title, p.title_en, p.title_zh, p.title_ja, p.content, p.content_en, p.content_zh, p.content_ja, p.image_url, p.location, p.region, p.category, p.naver_place_id, p.updated_at, p.date_range, p.blog_reviews,
               COUNT(DISTINCT l.id) AS like_count,
               COUNT(DISTINCT v.id) AS view_count,
               COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT v.id) AS score
        FROM seongsu_places p
        LEFT JOIN likes l ON l.place_id = p.id AND l.created_at >= NOW() - INTERVAL '{interval_days} days'
        LEFT JOIN place_views v ON v.place_id = p.id AND v.viewed_at >= NOW() - INTERVAL '{interval_days} days'
        WHERE (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)
          {region_clause}
        GROUP BY p.id
        {having_clause}
        ORDER BY score DESC, p.created_at DESC
        LIMIT {limit}
    """))

_MIN_RANKING_SCORE = 3  # 이 미만 점수(조회1~2건 수준)는 25위 안이라도 노출 안 함 — 신생 카테고리(축제 등) 0점 채우기 방지

def refresh_place_popularity(is_cron: bool = False):
    """장소 인기 랭킹 재계산 — 조회수(최근48시간, 부족시 30일 확장) + 좋아요*2. 하루 6회(한국시간 4시간 간격) 실행.
    메인 페이지 '추천' 탭(/places/popular)과 어드민 랭킹(/admin/ranking/weekly)이 공통으로 사용.
    48시간으로 좁힌 이유: 7일 창에서는 소수 인기 항목의 트래픽 쏠림(자기강화)으로 순위가 거의 안 바뀌는 문제 완화.
    _MIN_RANKING_SCORE 미만 항목은 아예 제외해, 활동이 적을 땐 25개를 억지로 채우지 않고 그보다 적게 노출될 수 있음.
    is_cron: True면 스케줄러가 정확히 4시간 간격으로 호출한 것 — 이때만 NEW 배지 기준 스냅샷을 갱신함."""
    global _place_popularity_cache, _performance_popularity_cache, _festival_popularity_cache, _shopping_popularity_cache, _exhibition_popularity_cache, _place_popularity_by_region, _popularity_last_refreshed
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS place_views (
                id SERIAL PRIMARY KEY,
                place_id INTEGER NOT NULL,
                viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS idx_place_views_place_viewed ON place_views (place_id, viewed_at)"))
        # 톱25 'NEW' 배지용 — 프로세스 재시작에도 이전 톱25 목록이 유지되도록 DB에 스냅샷 저장(메모리 캐시만 쓰면 재배포할 때마다 전부 NEW로 오탐)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ranking_snapshot (
                id INTEGER PRIMARY KEY DEFAULT 1,
                top25_ids JSONB NOT NULL,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CHECK (id = 1)
            )
        """))
        conn.execute(text("ALTER TABLE ranking_snapshot ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()"))
        # NEW 배지 계산 검증용 — 직전 한 사이클치 톱25도 같이 보관(그 이전 이력은 안 쌓음)
        conn.execute(text("ALTER TABLE ranking_snapshot ADD COLUMN IF NOT EXISTS prev_top25_ids JSONB"))
        conn.commit()

        prev_snapshot = conn.execute(text("SELECT top25_ids, updated_at FROM ranking_snapshot WHERE id = 1")).fetchone()
        prev_top25_ids = set(prev_snapshot[0]) if prev_snapshot else set()
        # 배포/재시작 때마다 이 함수가 module-level에서 다시 호출되는데(is_cron=False), 그걸로 스냅샷을
        # 갱신하면 재배포 타이밍에 따라 기준점이 "4시간 전"이 아니라 "마지막 재시작 시점"으로 흔들림
        # (실제로 하루에 여러 번 재배포하면서 기준점이 그때그때 달라졌던 적 있음) — 그래서 스케줄러가
        # 정확히 4시간 간격으로 호출한 경우(is_cron=True)에만 스냅샷을 갱신, 재시작 호출은 절대 안 건드림
        is_real_cycle = is_cron or (prev_snapshot is None)

        result = list(_popularity_rows(conn, 2, min_score=_MIN_RANKING_SCORE))
        if len(result) < 25:
            result = list(_popularity_rows(conn, 30, min_score=_MIN_RANKING_SCORE))
        _place_popularity_cache = [dict(row._mapping) for row in result]

        current_top25_ids = [item["id"] for item in _place_popularity_cache[:25]]
        new_ids = set(current_top25_ids) - prev_top25_ids
        for item in _place_popularity_cache:
            item["is_new"] = item["id"] in new_ids
        if is_real_cycle:
            logger.info("[ranking] NEW 배지 계산 — 직전 톱25=%s / 이번 톱25=%s / new_ids=%s", sorted(prev_top25_ids), sorted(current_top25_ids), sorted(new_ids))
            conn.execute(
                text("""
                    INSERT INTO ranking_snapshot (id, top25_ids, prev_top25_ids, updated_at)
                    VALUES (1, CAST(:ids AS jsonb), CAST(:prev_ids AS jsonb), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        prev_top25_ids = ranking_snapshot.top25_ids,
                        top25_ids = CAST(:ids AS jsonb),
                        updated_at = NOW()
                """),
                {"ids": json.dumps(current_top25_ids), "prev_ids": json.dumps(sorted(prev_top25_ids))},
            )
            conn.commit()

        # 플레이스 랭킹 지역 서브탭 — 종합과 같은 산식으로 지역별 톱25만 따로 캐시 + 지역별 NEW 배지
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS place_region_ranking_snapshot (
                region TEXT PRIMARY KEY,
                top25_ids JSONB NOT NULL,
                prev_top25_ids JSONB,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))
        conn.commit()

        by_region: dict = {}
        for r in _PLACE_RANKING_REGIONS:
            r_result = list(_popularity_rows(conn, 2, min_score=_MIN_RANKING_SCORE, only_region=r))
            if len(r_result) < 25:
                r_result = list(_popularity_rows(conn, 30, min_score=_MIN_RANKING_SCORE, only_region=r))
            region_cache = [dict(row._mapping) for row in r_result]

            prev_r_snapshot = conn.execute(text("SELECT top25_ids FROM place_region_ranking_snapshot WHERE region = :region"), {"region": r}).fetchone()
            prev_r_ids = set(prev_r_snapshot[0]) if prev_r_snapshot else set()
            current_r_ids = [item["id"] for item in region_cache[:25]]
            r_new_ids = set(current_r_ids) - prev_r_ids
            for item in region_cache:
                item["is_new"] = item["id"] in r_new_ids
            by_region[r] = region_cache

            if is_real_cycle:
                conn.execute(
                    text("""
                        INSERT INTO place_region_ranking_snapshot (region, top25_ids, prev_top25_ids, updated_at)
                        VALUES (:region, CAST(:ids AS jsonb), CAST(:prev_ids AS jsonb), NOW())
                        ON CONFLICT (region) DO UPDATE SET
                            prev_top25_ids = place_region_ranking_snapshot.top25_ids,
                            top25_ids = CAST(:ids AS jsonb),
                            updated_at = NOW()
                    """),
                    {"region": r, "ids": json.dumps(current_r_ids), "prev_ids": json.dumps(sorted(prev_r_ids))},
                )
                conn.commit()
        _place_popularity_by_region = by_region

        # 공연 랭킹 전용 NEW 배지 — 플레이스 랭킹과 동일한 스냅샷 방식(직전 사이클 대비 신규 진입만 표시)
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS performance_ranking_snapshot (
                id INTEGER PRIMARY KEY DEFAULT 1,
                top25_ids JSONB NOT NULL,
                prev_top25_ids JSONB,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CHECK (id = 1)
            )
        """))
        conn.commit()
        prev_perf_snapshot = conn.execute(text("SELECT top25_ids FROM performance_ranking_snapshot WHERE id = 1")).fetchone()
        prev_perf_top25_ids = set(prev_perf_snapshot[0]) if prev_perf_snapshot else set()

        perf_result = list(_popularity_rows(conn, 2, only_performance=True, min_score=_MIN_RANKING_SCORE))
        if len(perf_result) < 25:
            perf_result = list(_popularity_rows(conn, 30, only_performance=True, min_score=_MIN_RANKING_SCORE))
        _performance_popularity_cache = [dict(row._mapping) for row in perf_result]

        current_perf_top25_ids = [item["id"] for item in _performance_popularity_cache[:25]]
        perf_new_ids = set(current_perf_top25_ids) - prev_perf_top25_ids
        for item in _performance_popularity_cache:
            item["is_new"] = item["id"] in perf_new_ids
        if is_real_cycle:
            conn.execute(
                text("""
                    INSERT INTO performance_ranking_snapshot (id, top25_ids, prev_top25_ids, updated_at)
                    VALUES (1, CAST(:ids AS jsonb), CAST(:prev_ids AS jsonb), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        prev_top25_ids = performance_ranking_snapshot.top25_ids,
                        top25_ids = CAST(:ids AS jsonb),
                        updated_at = NOW()
                """),
                {"ids": json.dumps(current_perf_top25_ids), "prev_ids": json.dumps(sorted(prev_perf_top25_ids))},
            )
            conn.commit()

        # 축제 랭킹 전용 NEW 배지 — 위 공연 랭킹과 동일한 스냅샷 방식
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS festival_ranking_snapshot (
                id INTEGER PRIMARY KEY DEFAULT 1,
                top25_ids JSONB NOT NULL,
                prev_top25_ids JSONB,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CHECK (id = 1)
            )
        """))
        conn.commit()
        prev_fest_snapshot = conn.execute(text("SELECT top25_ids FROM festival_ranking_snapshot WHERE id = 1")).fetchone()
        prev_fest_top25_ids = set(prev_fest_snapshot[0]) if prev_fest_snapshot else set()

        fest_result = list(_popularity_rows(conn, 2, only_festival=True, min_score=_MIN_RANKING_SCORE))
        if len(fest_result) < 25:
            fest_result = list(_popularity_rows(conn, 30, only_festival=True, min_score=_MIN_RANKING_SCORE))
        _festival_popularity_cache = [dict(row._mapping) for row in fest_result]

        current_fest_top25_ids = [item["id"] for item in _festival_popularity_cache[:25]]
        fest_new_ids = set(current_fest_top25_ids) - prev_fest_top25_ids
        for item in _festival_popularity_cache:
            item["is_new"] = item["id"] in fest_new_ids
        if is_real_cycle:
            conn.execute(
                text("""
                    INSERT INTO festival_ranking_snapshot (id, top25_ids, prev_top25_ids, updated_at)
                    VALUES (1, CAST(:ids AS jsonb), CAST(:prev_ids AS jsonb), NOW())
                    ON CONFLICT (id) DO UPDATE SET
                        prev_top25_ids = festival_ranking_snapshot.top25_ids,
                        top25_ids = CAST(:ids AS jsonb),
                        updated_at = NOW()
                """),
                {"ids": json.dumps(current_fest_top25_ids), "prev_ids": json.dumps(sorted(prev_fest_top25_ids))},
            )
            conn.commit()

        # 쇼핑/전시 랭킹 — 지역 구분 없이 통합 집계(트래픽 쌓이면 플레이스처럼 지역 서브탭 분리 예정), NEW 배지는 공연/축제와 동일한 스냅샷 방식
        for cat_key, cache_attr, snapshot_table in (
            ("shopping", "_shopping_popularity_cache", "shopping_ranking_snapshot"),
            ("전시", "_exhibition_popularity_cache", "exhibition_ranking_snapshot"),
        ):
            conn.execute(text(f"""
                CREATE TABLE IF NOT EXISTS {snapshot_table} (
                    id INTEGER PRIMARY KEY DEFAULT 1,
                    top25_ids JSONB NOT NULL,
                    prev_top25_ids JSONB,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    CHECK (id = 1)
                )
            """))
            conn.commit()
            prev_snap = conn.execute(text(f"SELECT top25_ids FROM {snapshot_table} WHERE id = 1")).fetchone()
            prev_ids = set(prev_snap[0]) if prev_snap else set()

            cat_result = list(_popularity_rows(conn, 2, only_category=cat_key, min_score=_MIN_RANKING_SCORE))
            if len(cat_result) < 25:
                cat_result = list(_popularity_rows(conn, 30, only_category=cat_key, min_score=_MIN_RANKING_SCORE))
            cat_cache = [dict(row._mapping) for row in cat_result]

            current_ids = [item["id"] for item in cat_cache[:25]]
            new_ids = set(current_ids) - prev_ids
            for item in cat_cache:
                item["is_new"] = item["id"] in new_ids
            globals()[cache_attr] = cat_cache

            if is_real_cycle:
                conn.execute(
                    text(f"""
                        INSERT INTO {snapshot_table} (id, top25_ids, prev_top25_ids, updated_at)
                        VALUES (1, CAST(:ids AS jsonb), CAST(:prev_ids AS jsonb), NOW())
                        ON CONFLICT (id) DO UPDATE SET
                            prev_top25_ids = {snapshot_table}.top25_ids,
                            top25_ids = CAST(:ids AS jsonb),
                            updated_at = NOW()
                    """),
                    {"ids": json.dumps(current_ids), "prev_ids": json.dumps(sorted(prev_ids))},
                )
                conn.commit()

    _popularity_last_refreshed = datetime.now(timezone.utc).isoformat()
    refresh_closing_soon()  # 랭킹과 같은 주기(4시간)로 같이 갱신 — 랜덤 12개라 자주 바뀌어도 자연스러움


_closing_soon_cache: list = []

def refresh_closing_soon():
    """핫플 탭 상단 '마감임박' 전광판용 — refresh_place_popularity()와 같은 주기(4시간)로 갱신.
    14일 이내 마감 예정 중 랜덤 12개를 뽑아 캐시. 팝업 전용(공연/축제/클래스/쇼핑/전시/행사 등은 제외해
    성수/홍대/강북/강남/제주의 순수 팝업스토어만 노출, 정확도 불필요라 랜덤으로 충분)."""
    global _closing_soon_cache
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT id, title, title_en, title_zh, title_ja, image_url, region
            FROM seongsu_places
            WHERE end_date IS NOT NULL
              AND end_date >= CURRENT_DATE
              AND end_date <= CURRENT_DATE + INTERVAL '14 days'
              AND COALESCE(category, 'popup') = 'popup'
              AND naver_place_id NOT LIKE 'kopis_%'
              AND naver_place_id NOT LIKE 'jeju_%'
              AND naver_place_id NOT LIKE 'culture_%'
              AND region IN ('성수', '홍대', '강북', '강남', '제주')
            ORDER BY RANDOM()
            LIMIT 12
        """))
        _closing_soon_cache = [dict(row._mapping) for row in result]

# --- 접근자 (라우터는 캐시 변수를 직접 만지지 말고 반드시 이 함수들로 읽을 것) ---

def get_popular(region: Optional[str] = None) -> list:
    """통합(region=None) 또는 지역별 인기 랭킹 캐시."""
    if region:
        return _place_popularity_by_region.get(region, [])
    return _place_popularity_cache

def get_performance() -> list:
    return _performance_popularity_cache

def get_festival() -> list:
    return _festival_popularity_cache

def get_shopping() -> list:
    return _shopping_popularity_cache

def get_exhibition() -> list:
    return _exhibition_popularity_cache

def get_closing_soon() -> list:
    return _closing_soon_cache

def get_last_refreshed() -> Optional[str]:
    return _popularity_last_refreshed
