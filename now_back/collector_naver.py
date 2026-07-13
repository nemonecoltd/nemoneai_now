"""
collector_naver.py — 네이버 지도 팝업스토어 수집 (주 1회 권장)
대상: 성수, 홍대
AI 소개 자동 생성 후 DB upsert
"""
import asyncio
import os
from datetime import date, timedelta
from typing import Optional
from sqlalchemy import text
from dotenv import load_dotenv
from database import engine
from gemini_service import get_embedding, ai_translate
from scraper_naver_map_v2 import scrape_naver_map_popups
from collector_base import cleanup_expired
from image_storage import rehost_image
from notification import send_alert

load_dotenv()


def ai_generate_intro(title: str, location: str, category: Optional[str] = None) -> str:
    kind = "원데이클래스/체험 공방" if category == "class" else "팝업스토어"
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


def _existing_translation(naver_place_id: str) -> tuple[str, str, str, str]:
    """DB에 이미 저장된 title_en/content_en/title_zh/content_zh 반환. 없으면 빈 문자열 튜플."""
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT title_en, content_en, title_zh, content_zh FROM seongsu_places WHERE naver_place_id = :id"),
                {"id": naver_place_id}
            ).fetchone()
            return (row.title_en or "", row.content_en or "", row.title_zh or "", row.content_zh or "") if row else ("", "", "", "")
    except Exception:
        return "", "", "", ""


def build_content(item: dict, intro: str) -> str:
    naver_url = f"https://map.naver.com/p/entry/place/{item.get('naver_place_id', '')}"
    link_line = f"네이버 지도 바로가기: {naver_url}"
    if intro:
        return "\n\n".join([intro, link_line])
    return link_line


def _existing_content(naver_place_id: str) -> str:
    """DB에 이미 저장된 content 반환. 없으면 빈 문자열."""
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT content FROM seongsu_places WHERE naver_place_id = :id"),
                {"id": naver_place_id}
            ).fetchone()
            return (row.content or "") if row else ""
    except Exception:
        return ""


def upsert_naver_items(items: list[dict], region: str, category: Optional[str] = None):
    """naver_place_id 기준 upsert. 기존 content 있으면 AI 생성 건너뜀.
    category: None=팝업스토어(기본), 'class'=원데이클래스/체험 — 지금은 region(성수/홍대) 리스트에 병합해 노출하되,
    나중에 '체험' 메뉴로 분리하고 싶을 때 이 값으로 필터링할 수 있도록 태깅만 해둠."""
    print(f"📋 [{region}/{category or '팝업'}] {len(items)}개 DB 반영 시작")
    new_count = 0
    updated_count = 0
    fail_count = 0
    for item in reversed(items):
        title = item["title"].strip()
        naver_place_id = item.get("naver_place_id", "")
        print(f"  ✨ [{region}] '{title}' 처리 중...")

        existing = _existing_content(naver_place_id)
        regenerated = False
        if existing and "카테고리:" not in existing and "주소:" not in existing:
            print(f"    ⏭️ 기존 content 있음, AI 생성 건너뜀")
            intro = ""
            content = existing
        else:
            intro = ai_generate_intro(title, item.get("location", ""), category)
            content = build_content(item, intro)
            regenerated = True
        if intro:
            print(f"    소개: {intro[:60]}...")

        existing_title_en, existing_content_en, existing_title_zh, existing_content_zh = _existing_translation(naver_place_id)
        if not regenerated and existing_title_en and existing_content_en and existing_title_zh and existing_content_zh:
            title_en, content_en, title_zh, content_zh = existing_title_en, existing_content_en, existing_title_zh, existing_content_zh
        else:
            title_en, content_en, title_zh, content_zh = ai_translate(title, content)
            if not title_en:
                title_en, content_en, title_zh, content_zh = existing_title_en, existing_content_en, existing_title_zh, existing_content_zh
            elif title_en:
                print(f"    🌐 번역(EN/ZH): {title_en[:40]} / {title_zh[:20]}...")

        try:
            embedding = get_embedding(content)
            # 네이버 popupstore/list에서 실제 운영 시작/종료일을 가져온 경우 그걸 쓰고,
            # 못 찾았을 때만 today+30일 임시값으로 fallback (정확한 기간 모름을 의미)
            start_date = item.get("start_date")
            end_date = item.get("end_date") or (date.today() + timedelta(days=30))
            date_range = (
                f"{start_date.strftime('%Y.%m.%d.')} ~ {end_date.strftime('%Y.%m.%d.')}"
                if start_date and item.get("end_date") else ""
            )

            params = {
                "title":          title,
                "title_en":       title_en or title,
                "title_zh":       title_zh or title,
                "content":        content,
                "content_en":     content_en,
                "content_zh":     content_zh,
                "location":       item.get("location", ""),
                "latitude":       item.get("latitude"),
                "longitude":      item.get("longitude"),
                "naver_place_id": naver_place_id,
                "video_url":      item.get("video_url", ""),
                "image_url":      rehost_image(item.get("image_url")) or "",
                "embedding":      f"[{','.join(map(str, embedding))}]",
                "end_date":       end_date,
                "real_end_date":  item.get("end_date"),
                "date_range":     date_range,
                "region":         region,
                "category":       category,
            }

            with engine.connect() as conn:
                # naver_place_id가 바뀌어도(팝업 재등록 등) title이 같으면 같은 장소로 취급해 병합
                existing_id = conn.execute(
                    text("SELECT id FROM seongsu_places WHERE naver_place_id = :naver_place_id OR title = :title LIMIT 1"),
                    {"naver_place_id": naver_place_id, "title": title}
                ).scalar()

                if existing_id:
                    conn.execute(text("""
                        UPDATE seongsu_places SET
                            title          = :title,
                            title_en       = :title_en,
                            title_zh       = :title_zh,
                            content        = :content,
                            content_en     = :content_en,
                            content_zh     = :content_zh,
                            location       = :location,
                            latitude       = COALESCE(:latitude, latitude),
                            longitude      = COALESCE(:longitude, longitude),
                            naver_place_id = :naver_place_id,
                            image_url      = COALESCE(:image_url, image_url),
                            embedding      = :embedding,
                            region         = :region,
                            category       = COALESCE(:category, category),
                            end_date       = COALESCE(:real_end_date, end_date),
                            date_range     = CASE WHEN :date_range != '' THEN :date_range ELSE date_range END
                        WHERE id = :id
                    """), {**params, "id": existing_id})
                    updated_count += 1
                else:
                    conn.execute(text("""
                        INSERT INTO seongsu_places
                        (title, title_en, title_zh, content, content_en, content_zh, location, latitude, longitude,
                         naver_place_id, video_url, image_url, embedding, end_date, date_range, region, category)
                        VALUES
                        (:title, :title_en, :title_zh, :content, :content_en, :content_zh, :location, :latitude, :longitude,
                         :naver_place_id, :video_url, :image_url, :embedding, :end_date, :date_range, :region, :category)
                    """), params)
                    new_count += 1
                conn.commit()
                print(f"    ✅ 저장 완료")
        except Exception as e:
            conn.rollback()
            fail_count += 1
            print(f"    ❌ 저장 실패: {e}")

    return new_count, updated_count, fail_count


async def run_seongsu():
    print("\n🚀 [성수] 수집 시작")
    try:
        result = await scrape_naver_map_popups("성수 팝업스토어")
        counts = upsert_naver_items(result, "성수") if result else (0, 0, 0)
    except Exception as e:
        print(f"  ⚠️ [성수] 실패: {e}")
        return "성수", 0, 0, 1
    print("✅ [성수] 완료")
    return ("성수", *counts)


async def run_hongdae():
    print("\n🚀 [홍대] 수집 시작")
    try:
        result = await scrape_naver_map_popups("홍대 팝업스토어")
        counts = upsert_naver_items(result, "홍대") if result else (0, 0, 0)
    except Exception as e:
        print(f"  ⚠️ [홍대] 실패: {e}")
        return "홍대", 0, 0, 1
    print("✅ [홍대] 완료")
    return ("홍대", *counts)


async def run_yongsan():
    print("\n🚀 [용산] 수집 시작")
    try:
        result = await scrape_naver_map_popups("용산 팝업스토어")
        counts = upsert_naver_items(result, "용산") if result else (0, 0, 0)
    except Exception as e:
        print(f"  ⚠️ [용산] 실패: {e}")
        return "용산", 0, 0, 1
    print("✅ [용산] 완료")
    return ("용산", *counts)


async def run_gangnam():
    print("\n🚀 [강남] 수집 시작")
    try:
        # '강남 팝업스토어' 검색 결과가 실제로는 성동구(성수)/강동구 등이 대량 섞여있어
        # commonAddress로 강남구/서초구/송파구만 필터링
        result = await scrape_naver_map_popups("강남 팝업스토어", allowed_districts=["강남구", "서초구", "송파구"])
        counts = upsert_naver_items(result, "강남") if result else (0, 0, 0)
    except Exception as e:
        print(f"  ⚠️ [강남] 실패: {e}")
        return "강남", 0, 0, 1
    print("✅ [강남] 완료")
    return ("강남", *counts)


async def run_class(region: str, query: str, allowed_districts: Optional[list] = None):
    print(f"\n🚀 [{region}/원데이클래스] 수집 시작 ('{query}')")
    try:
        result = await scrape_naver_map_popups(query, allowed_districts=allowed_districts)
        counts = upsert_naver_items(result, region, category="class") if result else (0, 0, 0)
    except Exception as e:
        print(f"  ⚠️ [{region}/원데이클래스] 실패: {e}")
        return f"{region}/클래스", 0, 0, 1
    print(f"✅ [{region}/원데이클래스] 완료")
    return (f"{region}/클래스", *counts)


async def run_all():
    print("=" * 50)
    print("🗺️  네이버 팝업스토어 수집 시작")
    print("=" * 50)
    results = [
        await run_seongsu(),
        await run_hongdae(),
        await run_yongsan(),
        await run_gangnam(),
        await run_class("성수", "성수 원데이클래스"),
        await run_class("성수", "성수 공방 체험"),
        await run_class("홍대", "홍대 원데이클래스"),
        await run_class("용산", "용산 원데이클래스"),
        await run_class("용산", "용산 공방 체험"),
        await run_class("강남", "강남 원데이클래스", allowed_districts=["강남구"]),
        await run_class("강남", "강남 공방 체험", allowed_districts=["강남구"]),
    ]
    cleanup_expired()
    print("\n" + "=" * 50)
    print("🏁 네이버 수집 완료")
    print("=" * 50)

    total_new = sum(r[1] for r in results)
    total_updated = sum(r[2] for r in results)
    total_fail = sum(r[3] for r in results)
    lines = [f"- {r[0]}: 신규 {r[1]} / 갱신 {r[2]}" + (f" / 실패 {r[3]}" if r[3] else "") for r in results]
    send_alert(
        f"네이버 팝업/클래스 수집 완료\n총 신규 {total_new} · 갱신 {total_updated}" + (f" · 실패 {total_fail}" if total_fail else "")
        + "\n" + "\n".join(lines)
    )


if __name__ == "__main__":
    asyncio.run(run_all())
