"""카카오맵 키워드 검색 기반 수집 — 정기 스케줄 없이 필요할 때(텔레그램 /kakao 명령 등)로 실행.

collector_favorite.py와 달리 AI 소개문 생성·번역을 하지 않음 — 카카오가 이미 제공하는 정보
(주소·전화·평점·카테고리)를 그대로 content로 구성한다. 큐레이터 개인 메모 같은 제3자 저작물이
아니라 업체가 등록한 정형 정보라 그대로 써도 저작권 이슈가 없음.

'서울 독립서점'처럼 넓은 지역을 검색하면 결과가 여러 구에 흩어지는데, now는 아직 서울 전체가
아니라 성수/홍대/강북/강남 4개 권역만 다루므로 구(區) 단위로 기존 region 라벨에 자동 매핑한다.
성동구/마포구/강남권(강남·서초·송파) 외의 모든 구는 '강북'으로 편입(용산/더현대서울과 같은
편의상 '기타 서울' 버킷). region을 명시하면 자동 매핑 없이 전부 그 region으로 고정
(제주처럼 구 매핑표에 없는 지역 키워드일 때 반드시 명시해야 함).
"""
from collections import Counter
from typing import Optional

from sqlalchemy import text

from database import engine
from gemini_service import get_embedding
from image_storage import rehost_image
from scraper_kakao import scrape_kakao_keyword
from theme_helper import create_theme

# 구(區) → now 기존 region 라벨. 여기 없는 구는 전부 '강북'(기타 서울 버킷)으로 편입.
DISTRICT_REGION_MAP = {
    "성동구": "성수",
    "마포구": "홍대",
    "강남구": "강남",
    "서초구": "강남",
    "송파구": "강남",
}
_DEFAULT_REGION = "강북"


def _resolve_region(item: dict, region: Optional[str]) -> str:
    if region:
        return region
    return DISTRICT_REGION_MAP.get(item.get("district", ""), _DEFAULT_REGION)


def _build_content(item: dict) -> str:
    lines = []
    if item.get("category_path"):
        lines.append(f"카테고리: {item['category_path']}")
    if item.get("location"):
        lines.append(f"주소: {item['location']}")
    if item.get("tel"):
        lines.append(f"전화: {item['tel']}")
    if item.get("rating_average"):
        lines.append(f"평점: {item['rating_average']} ({item.get('rating_count') or 0}명)")
    if item.get("review_count"):
        lines.append(f"리뷰: {item['review_count']}건")
    if not lines:
        lines.append(item["title"])
    return "\n".join(lines)


def upsert_kakao_items(items: list[dict], category: Optional[str], region: Optional[str]) -> dict:
    """region이 주어지면 전부 그 region으로 고정, 없으면 구 단위로 DISTRICT_REGION_MAP에서 자동 결정
    (매핑 없는 구는 '강북')."""
    new_count = updated_count = fail_count = 0

    for item in items:
        title = item["title"]
        item_region = _resolve_region(item, region)
        kakao_place_id = f"kakao_{item['kakao_place_id']}"
        print(f"  ✨ [{item_region}] '{title}' 처리 중...")
        try:
            content = _build_content(item)
            embedding = get_embedding(content)
            image_url = rehost_image(item.get("image_url")) or ""

            params = {
                "title": title,
                "content": content,
                "location": item.get("location", ""),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "naver_place_id": kakao_place_id,
                "image_url": image_url,
                # 매장 자체 홈페이지(인스타그램 등) — 큐레이터 개인 글이 아니라 업체가 직접
                "link_url": item.get("homepage") or None,
                "embedding": f"[{','.join(map(str, embedding))}]",
                "region": item_region,
                "category": category,
            }

            with engine.connect() as conn:
                existing_id = conn.execute(
                    text("SELECT id FROM seongsu_places WHERE naver_place_id = :naver_place_id OR title = :title LIMIT 1"),
                    {"naver_place_id": kakao_place_id, "title": title},
                ).scalar()

                if existing_id:
                    conn.execute(text("""
                        UPDATE seongsu_places SET
                            title = :title, content = :content, location = :location,
                            latitude = COALESCE(:latitude, latitude), longitude = COALESCE(:longitude, longitude),
                            naver_place_id = :naver_place_id, image_url = COALESCE(:image_url, image_url),
                            link_url = COALESCE(:link_url, link_url),
                            embedding = :embedding, region = :region, category = COALESCE(:category, category)
                        WHERE id = :id
                    """), {**params, "id": existing_id})
                    updated_count += 1
                else:
                    conn.execute(text("""
                        INSERT INTO seongsu_places
                        (title, title_en, title_zh, title_ja, content, location, latitude, longitude,
                         naver_place_id, image_url, link_url, embedding, region, category, end_date)
                        VALUES
                        (:title, :title, :title, :title, :content, :location, :latitude, :longitude,
                         :naver_place_id, :image_url, :link_url, :embedding, :region, :category, NULL)
                    """), params)
                    new_count += 1
                conn.commit()
                print("    ✅ 저장 완료")
        except Exception as e:
            fail_count += 1
            print(f"    ❌ 저장 실패: {e}")

    return {"new": new_count, "updated": updated_count, "failed": fail_count}


def run_kakao_keyword(query: str, category: Optional[str] = "shopping", region: Optional[str] = None) -> dict:
    """텔레그램 봇에서 호출하는 동기 진입점. Playwright/AI 번역 불필요라 순수 동기 실행.
    완료 후 이번에 수집된 장소들을 묶어 테마지도도 자동 생성한다."""
    items = scrape_kakao_keyword(query)
    if not items:
        return {"total": 0, "new": 0, "updated": 0, "failed": 0, "titles": [], "theme_id": None}

    result = upsert_kakao_items(items, category, region)

    theme_id = None
    try:
        # DB에는 전부 등록하되, 테마지도는 인기도순(스크래퍼가 이미 이 순서로 반환) 상위 15개만.
        top_items = items[:15]
        top_ids = [f"kakao_{i['kakao_place_id']}" for i in top_items]
        with engine.connect() as conn:
            rows = conn.execute(
                text("SELECT id, title, location, content, image_url, naver_place_id FROM seongsu_places WHERE naver_place_id = ANY(:ids)"),
                {"ids": top_ids},
            ).fetchall()
        row_by_id = {r.naver_place_id: r for r in rows}
        places = [
            {"id": row_by_id[kid].id, "title": row_by_id[kid].title, "location": row_by_id[kid].location,
             "content": row_by_id[kid].content, "image_url": row_by_id[kid].image_url}
            for kid in top_ids if kid in row_by_id
        ]
        dominant_region = region or Counter(_resolve_region(i, None) for i in top_items).most_common(1)[0][0]
        theme_id = create_theme(query, f"'{query}' 인기 장소 {len(places)}곳을 모았습니다.", places, dominant_region)
    except Exception as e:
        print(f"⚠️ 테마 자동 생성 실패: {e}")

    return {
        "total": len(items),
        "new": result["new"],
        "updated": result["updated"],
        "failed": result["failed"],
        "titles": [i["title"] for i in items],
        "theme_id": theme_id,
    }


if __name__ == "__main__":
    import sys
    query_arg = sys.argv[1] if len(sys.argv) > 1 else "서울 독립서점"
    category_arg = sys.argv[2] if len(sys.argv) > 2 else "shopping"
    region_arg = sys.argv[3] if len(sys.argv) > 3 else None
    print(run_kakao_keyword(query_arg, category_arg, region_arg))
