"""비짓부산(visitbusan.net) 이용안내 정보 수집 — 정기 스케줄(매주 화요일 00시, 로컬 launchd)로 실행.

en/ja는 비짓부산 공식 번역을 그대로 가져오고, zh만 ai_translate_zh로 자체 번역
(2026-08-15, scraper_visitbusan.py 조사 결과 비짓부산에 중국어 이용안내가 아예 없음 확인 —
페이지가 한글로 그대로 노출됨). content는 블로그식 본문이 아니라 이용안내(주소/전화/휴무일/
운영시간/교통정보)만 구조화해서 담음 — 비짓부산 에디터가 쓴 기사 본문은 제3자 저작물이라 안 씀.
"""
from typing import Optional

from sqlalchemy import text

from database import engine
from gemini_service import ai_translate_zh, get_embedding
from image_storage import rehost_image
from scraper_visitbusan import build_content, get_visitbusan_detail, get_visitbusan_list


def _existing_zh(place_id: str) -> tuple[str, str]:
    """DB에 이미 저장된 title_zh/content_zh 반환(있으면 재번역 안 함). 없으면 빈 문자열."""
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT title_zh, content_zh FROM seongsu_places WHERE naver_place_id = :id"),
                {"id": place_id}
            ).fetchone()
            return (row.title_zh or "", row.content_zh or "") if row else ("", "")
    except Exception:
        return "", ""


def upsert_visitbusan_items(detail_menu_cd: str, items: list[dict], region: str, category: str) -> dict:
    new_count = updated_count = fail_count = 0

    for item in items:
        uc_seq = item["uc_seq"]
        place_id = f"visitbusan_{uc_seq}"
        try:
            ko = get_visitbusan_detail(detail_menu_cd, uc_seq, "ko")
            title = ko["title"]
            if not title:
                print(f"  ⏭️ uc_seq={uc_seq} 제목 없음, 건너뜀")
                continue
            print(f"  ✨ [{region}] '{title}' 처리 중...")

            content = build_content(ko["info"], "ko")
            if not content:
                print(f"    ⏭️ uc_seq={uc_seq} 이용안내 없음, 건너뜀")
                continue

            en = get_visitbusan_detail(detail_menu_cd, uc_seq, "en")
            ja = get_visitbusan_detail(detail_menu_cd, uc_seq, "ja")
            title_en = en["title"] or title
            content_en = build_content(en["info"], "en") or content
            title_ja = ja["title"] or title
            content_ja = build_content(ja["info"], "ja") or content

            title_zh, content_zh = _existing_zh(place_id)
            if not title_zh:
                title_zh, content_zh = ai_translate_zh(title, content)
                if title_zh:
                    print(f"    🌐 중국어 번역: {title_zh[:30]}...")
            title_zh = title_zh or title
            content_zh = content_zh or content

            embedding = get_embedding(content)
            image_url = rehost_image(item.get("thumb")) or ""

            params = {
                "title": title, "title_en": title_en, "title_zh": title_zh, "title_ja": title_ja,
                "content": content, "content_en": content_en, "content_zh": content_zh, "content_ja": content_ja,
                "location": ko["info"].get("address", ""),
                "naver_place_id": place_id,
                "image_url": image_url,
                "link_url": ko["info"].get("homepage") or None,
                "embedding": f"[{','.join(map(str, embedding))}]",
                "region": region,
                "category": category,
            }

            with engine.connect() as conn:
                existing_id = conn.execute(
                    text("SELECT id FROM seongsu_places WHERE naver_place_id = :naver_place_id OR title = :title LIMIT 1"),
                    {"naver_place_id": place_id, "title": title},
                ).scalar()

                if existing_id:
                    conn.execute(text("""
                        UPDATE seongsu_places SET
                            title = :title, title_en = :title_en, title_zh = :title_zh, title_ja = :title_ja,
                            content = :content, content_en = :content_en, content_zh = :content_zh, content_ja = :content_ja,
                            location = :location, naver_place_id = :naver_place_id,
                            image_url = COALESCE(:image_url, image_url), link_url = COALESCE(:link_url, link_url),
                            embedding = :embedding, region = :region, category = COALESCE(:category, category)
                        WHERE id = :id
                    """), {**params, "id": existing_id})
                    updated_count += 1
                else:
                    conn.execute(text("""
                        INSERT INTO seongsu_places
                        (title, title_en, title_zh, title_ja, content, content_en, content_zh, content_ja,
                         location, naver_place_id, image_url, link_url, embedding, region, category, end_date)
                        VALUES
                        (:title, :title_en, :title_zh, :title_ja, :content, :content_en, :content_zh, :content_ja,
                         :location, :naver_place_id, :image_url, :link_url, :embedding, :region, :category, NULL)
                    """), params)
                    new_count += 1
                conn.commit()
                print("    ✅ 저장 완료")
        except Exception as e:
            fail_count += 1
            print(f"    ❌ 저장 실패(uc_seq={uc_seq}): {e}")

    return {"new": new_count, "updated": updated_count, "failed": fail_count}


def run_visitbusan(list_menu_cd: str, detail_menu_cd: str, ucc2_seq: Optional[str], region: str, category: str) -> dict:
    """list_menu_cd(목록 페이지)와 detail_menu_cd(상세 페이지)는 비짓부산에서 서로 다른 값 —
    목록의 a href가 실제로 가리키는 menuCd를 그대로 써야 함(2026-08-15, 같은 값으로 잘못 넣었다가
    상세페이지가 아닌 엉뚱한 페이지가 나와 title='명소'/content 빈 값으로 전량 실패했던 버그 수정)."""
    items = get_visitbusan_list(list_menu_cd, ucc2_seq)
    if not items:
        return {"total": 0, "new": 0, "updated": 0, "failed": 0}
    result = upsert_visitbusan_items(detail_menu_cd, items, region, category)
    return {"total": len(items), **result}


def run_busan_exhibition() -> None:
    """매주 화요일 00시(launchd) — 부산 '전시' 카테고리(명소 메뉴 > ucc2_seq=36) 자동 갱신."""
    from notification import send_alert
    result = run_visitbusan(
        list_menu_cd="DOM_000000201001000000",
        detail_menu_cd="DOM_000000201001001000",
        ucc2_seq="36",
        region="부산",
        category="전시",
    )
    send_alert(
        f"비짓부산 부산 전시 수집 완료\n"
        f"총 {result['total']} · 신규 {result['new']} · 갱신 {result['updated']}"
        + (f" · 실패 {result['failed']}" if result['failed'] else "")
    )


if __name__ == "__main__":
    run_busan_exhibition()
