"""네이버 지도 '즐겨찾기(공유 폴더)' 기반 수집 — 텔레그램으로 폴더 URL+지역(+카테고리)을 보내면 실행.

collector_naver.py와 달리 팝업이 아니라 상시 운영 매장(서점/베이커리/카페 등)을 다루므로
end_date를 항상 NULL로 저장한다 — database.cleanup_expired_data()는 end_date IS NULL인 행을
건드리지 않으므로 45일 후 자동 삭제 대상에서 자연히 빠짐.

큐레이터 memo는 절대 DB에 저장하지 않음(저작권 리스크) — 소개문은 memo 없이 title/location/
category_hint만으로 AI가 새로 작성.
"""
import os
from typing import Optional

from sqlalchemy import text

from database import engine
from gemini_service import ai_translate, get_embedding
from image_storage import rehost_image
from scraper_naver_favorite import scrape_favorite_folder
from theme_helper import create_theme


def _ai_generate_intro(title: str, location: str, kind: str) -> str:
    try:
        from google import genai
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=(
                f"다음 {kind}의 소개 문구를 정확히 2~3문장으로 작성해줘.\n"
                f"장소명: {title}\n위치: {location}\n"
                f"조건: 방문자 시각, 이모지 없이, 선택지/옵션 없이 소개 문구만 출력."
            ),
        )
        text_result = (response.text or "").strip()
        return text_result[:400] if text_result else ""
    except Exception as e:
        print(f"    ⚠️ AI 생성 실패: {e}")
        return ""


def _build_content(item: dict, intro: str) -> str:
    # 네이버 지도 링크는 텍스트로 넣지 않음 — 프론트에서 naver_place_id 기반으로
    # "네이버지도에서 보기" 박스를 이미 별도로 렌더링하므로 중복.
    if intro:
        return intro
    location = item.get("location", "")
    return f"{item['title']}{f' ({location})' if location else ''}"


def upsert_favorite_items(items: list[dict], region: str, category: Optional[str]) -> tuple[int, int, int]:
    print(f"📋 [{region}/{category}] 즐겨찾기 {len(items)}개 DB 반영 시작")
    new_count = updated_count = fail_count = 0

    for item in reversed(items):
        title = item["title"]
        naver_place_id = item["naver_place_id"]
        print(f"  ✨ [{region}] '{title}' 처리 중...")
        try:
            kind = item.get("category_hint") or category or "가게"
            intro = _ai_generate_intro(title, item.get("location", ""), kind)
            content = _build_content(item, intro)
            title_en, content_en, title_zh, content_zh, title_ja, content_ja = ai_translate(title, content)
            embedding = get_embedding(content)
            image_url = rehost_image(item.get("image_url")) or ""

            params = {
                "title": title,
                "title_en": title_en or title,
                "title_zh": title_zh or title,
                "title_ja": title_ja or title,
                "content": content,
                "content_en": content_en,
                "content_zh": content_zh,
                "content_ja": content_ja,
                "location": item.get("location", ""),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "naver_place_id": naver_place_id,
                "image_url": image_url,
                "embedding": f"[{','.join(map(str, embedding))}]",
                "region": region,
                "category": category,
            }

            with engine.connect() as conn:
                existing_id = conn.execute(
                    text("SELECT id FROM seongsu_places WHERE naver_place_id = :naver_place_id OR title = :title LIMIT 1"),
                    {"naver_place_id": naver_place_id, "title": title},
                ).scalar()

                if existing_id:
                    conn.execute(text("""
                        UPDATE seongsu_places SET
                            title = :title, title_en = :title_en, title_zh = :title_zh, title_ja = :title_ja,
                            content = :content, content_en = :content_en, content_zh = :content_zh, content_ja = :content_ja,
                            location = :location, latitude = COALESCE(:latitude, latitude), longitude = COALESCE(:longitude, longitude),
                            naver_place_id = :naver_place_id, image_url = COALESCE(:image_url, image_url),
                            embedding = :embedding, region = :region, category = COALESCE(:category, category)
                        WHERE id = :id
                    """), {**params, "id": existing_id})
                    updated_count += 1
                else:
                    conn.execute(text("""
                        INSERT INTO seongsu_places
                        (title, title_en, title_zh, title_ja, content, content_en, content_zh, content_ja,
                         location, latitude, longitude, naver_place_id, image_url, embedding, region, category, end_date)
                        VALUES
                        (:title, :title_en, :title_zh, :title_ja, :content, :content_en, :content_zh, :content_ja,
                         :location, :latitude, :longitude, :naver_place_id, :image_url, :embedding, :region, :category, NULL)
                    """), params)
                    new_count += 1
                conn.commit()
                print("    ✅ 저장 완료")
        except Exception as e:
            fail_count += 1
            print(f"    ❌ 저장 실패: {e}")

    return new_count, updated_count, fail_count


def run_favorite(folder_url: str, region: str, category: Optional[str] = "shopping") -> dict:
    """텔레그램 봇에서 호출하는 동기 진입점. Playwright 불필요라 asyncio 래핑 없이 그대로 동기 실행."""
    folder_name, items = scrape_favorite_folder(folder_url)
    if not items:
        return {"total": 0, "new": 0, "updated": 0, "failed": 0, "titles": [], "theme_id": None}

    new_count, updated_count, fail_count = upsert_favorite_items(items, region, category)

    theme_id = None
    try:
        naver_ids = [i["naver_place_id"] for i in items]
        with engine.connect() as conn:
            rows = conn.execute(
                text("SELECT id, title, location, content, image_url, date_range FROM seongsu_places WHERE naver_place_id = ANY(:ids)"),
                {"ids": naver_ids},
            ).fetchall()
        places = [
            {"id": r.id, "title": r.title, "location": r.location, "content": r.content,
             "image_url": r.image_url, "date_range": r.date_range}
            for r in rows
        ]
        theme_title = folder_name or f"{region} 즐겨찾기 컬렉션"
        theme_id = create_theme(theme_title, f"{region} 엄선 장소 {len(places)}곳을 모았습니다.", places, region)
    except Exception as e:
        print(f"⚠️ 테마 자동 생성 실패: {e}")

    return {
        "total": len(items),
        "new": new_count,
        "updated": updated_count,
        "failed": fail_count,
        "titles": [i["title"] for i in items],
        "theme_id": theme_id,
    }


if __name__ == "__main__":
    import sys
    url_arg = sys.argv[1] if len(sys.argv) > 1 else ""
    region_arg = sys.argv[2] if len(sys.argv) > 2 else "제주"
    category_arg = sys.argv[3] if len(sys.argv) > 3 else "shopping"
    print(run_favorite(url_arg, region_arg, category_arg))
