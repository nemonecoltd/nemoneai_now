"""기존 진행중 팝업 중 title_en은 있지만 title_ja가 없는 row에 일본어 번역 백필.
전체 4487건이 아니라 '진행중 & title_en 있음'으로 범위를 좁힌 이유: 랭킹에 실제 노출되는
건 대부분 최근/진행중 데이터이고, title_en이 이미 있다는 건 en/zh 번역 가치가 검증된
인기글이라는 뜻이라 이 서브셋만 우선 백필."""
from database import engine
from sqlalchemy import text
from gemini_service import ai_translate_ja


def translate_places_ja():
    with engine.connect() as conn:
        places = conn.execute(text("""
            SELECT id, title, content FROM seongsu_places
            WHERE end_date >= CURRENT_DATE
              AND title_en IS NOT NULL AND title_en != ''
              AND (title_ja IS NULL OR title_ja = '')
        """)).fetchall()
    print(f"📦 일본어 번역 대상: 총 {len(places)}건")

    done, fail = 0, 0
    for i, p in enumerate(places, 1):
        place_id, title, content = p
        title_ja, content_ja = ai_translate_ja(title, content or "")
        if not title_ja:
            fail += 1
            print(f"  [{i}/{len(places)}] ❌ 실패: [{place_id}] {title}")
            continue
        with engine.connect() as conn:
            conn.execute(
                text("UPDATE seongsu_places SET title_ja = :title_ja, content_ja = :content_ja WHERE id = :id"),
                {"title_ja": title_ja, "content_ja": content_ja, "id": place_id}
            )
            conn.commit()
        done += 1
        print(f"  [{i}/{len(places)}] ✅ [{place_id}] {title} → {title_ja}")

    print(f"✨ 완료: 성공 {done}건, 실패 {fail}건")


if __name__ == "__main__":
    translate_places_ja()
