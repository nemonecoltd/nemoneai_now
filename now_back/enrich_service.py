"""블로그갱신(enrich) 서비스 — pcmap 스크래핑 + Gemini 소개 재생성 + 번역/ISR 재검증.
HTTP 엔드포인트(/places/{id}/enrich), 텔레그램 봇, 신규 팝업 자동갱신 스케줄러가 공유."""
import json
import logging
import os
import threading
import urllib.request
from typing import Optional

from sqlalchemy import text

from database import engine
from gemini_service import ai_translate

logger = logging.getLogger(__name__)

def _revalidate_place(place_id: int):
    """공개 도메인으로 호출 — 127.0.0.1:3002는 프로덕션 서버 안에서만 유효한 주소라 로컬 백엔드(텔레그램 봇 등)에서
    호출하면 로컬 3002번(아무것도 없음)으로 가서 조용히 실패했음. 공개 URL로 바꾸면 로컬/프로덕션 어디서 트리거해도 동작함."""
    try:
        secret = os.getenv("ADMIN_SECRET_KEY", "")
        url = f"https://now.nemoneai.com/api/revalidate?path=/posts/{place_id}&secret={secret}"
        urllib.request.urlopen(url, timeout=8)
    except Exception:
        pass

def _translate_and_save(place_id: int, new_title: Optional[str], new_content: Optional[str]):
    """어드민 저장과 별개로 백그라운드에서 영문/중문 번역 후 DB에 반영 (저장 응답 지연 방지)."""
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT title, content FROM seongsu_places WHERE id = :id"),
                {"id": place_id}
            ).fetchone()
            if not row:
                return
            title = new_title if new_title is not None else row.title
            content = new_content if new_content is not None else row.content
            title_en, content_en, title_zh, content_zh, title_ja, content_ja = ai_translate(title, content)
            if title_en:
                conn.execute(
                    text("""
                        UPDATE seongsu_places SET
                            title_en = :title_en, content_en = :content_en,
                            title_zh = :title_zh, content_zh = :content_zh,
                            title_ja = :title_ja, content_ja = :content_ja
                        WHERE id = :id
                    """),
                    {"title_en": title_en, "content_en": content_en,
                     "title_zh": title_zh, "content_zh": content_zh,
                     "title_ja": title_ja, "content_ja": content_ja, "id": place_id}
                )
                conn.commit()
    except Exception as e:
        logger.error(f"❌ 백그라운드 번역 실패 (place_id={place_id}): {e}")
def _limit_sentences(text: str, max_sentences: int) -> str:
    """프롬프트로 문장수를 요청해도 모델이 가끔 넘겨서 줄 때가 있어 코드에서 한 번 더 상한을 강제.
    '.', '!', '?', '다.', '요.' 등 한국어 문장부호까지 포괄하려면 정규식보다 마침표 계열 기호 분리가 안전."""
    import re as _re
    sentences = [s.strip() for s in _re.split(r'(?<=[.!?])\s+', text.strip()) if s.strip()]
    return ' '.join(sentences[:max_sentences])


async def _enrich_place_core(place_id: int) -> dict:
    """블로그갱신 실제 처리 로직 — HTTP 엔드포인트(/places/{id}/enrich)와 텔레그램 봇 둘 다에서 재사용.
    FastAPI에 종속되지 않도록 HTTPException 대신 ValueError/RuntimeError를 던짐."""
    import asyncio
    import re as _re

    # 1. DB에서 place 정보 조회
    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT title, location, naver_place_id FROM seongsu_places WHERE id = :id"),
            {"id": place_id}
        ).fetchone()
    if not row:
        raise ValueError("Place not found")

    title = row[0] or ""
    location = row[1] or ""
    naver_place_id = row[2] or ""
    if not naver_place_id:
        raise ValueError("naver_place_id 없음 — pcmap 조회 불가")

    # 2. pcmap 방문자 리뷰 탭 — 블로그 카드 스크래핑
    try:
        from playwright.async_api import async_playwright

        blog_reviews: list[dict] = []
        road_text = ""

        async def _scrape():
            nonlocal road_text
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                ctx = await browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                )
                page = await ctx.new_page()

                # 홈 탭 — Apollo state에서 road 텍스트만 수집
                await page.goto(
                    f"https://pcmap.place.naver.com/place/{naver_place_id}/home",
                    wait_until="domcontentloaded", timeout=25000
                )
                await page.wait_for_timeout(2000)
                home_html = await page.content()
                apollo_match = _re.search(r'window\.__APOLLO_STATE__\s*=\s*(\{.+?\});\s*</script>', home_html, _re.DOTALL)
                if apollo_match:
                    try:
                        apollo = json.loads(apollo_match.group(1))
                        for key, val in apollo.items():
                            if key.startswith("PlaceDetailBase:") and isinstance(val, dict):
                                road_text = val.get("road") or ""
                    except Exception:
                        pass

                async def _extract_blog_cards(pg):
                    return await pg.evaluate("""() => {
                        const result = [];
                        const links = document.querySelectorAll('a[href*="blog.naver.com"]');
                        for (const a of links) {
                            const lines = (a.innerText || '').split('\\n').map(s => s.trim()).filter(Boolean);
                            const title = lines[3] || lines[2] || lines[1] || lines[0] || '';
                            const img = a.querySelector('img');
                            if (title.length > 5) {
                                result.push({
                                    title: title.substring(0, 100),
                                    url: a.href,
                                    thumbnail: img ? img.src : ''
                                });
                            }
                            if (result.length >= 5) break;
                        }
                        return result;
                    }""")

                # 블로그 리뷰 탭
                await page.goto(
                    f"https://pcmap.place.naver.com/place/{naver_place_id}/review/ugc",
                    wait_until="domcontentloaded", timeout=25000
                )
                await page.wait_for_timeout(3000)
                cards = await _extract_blog_cards(page)

                await browser.close()
                return cards

        blog_reviews = await asyncio.wait_for(_scrape(), timeout=45)

    except Exception as e:
        logger.warning(f"pcmap 스크래핑 실패 ({naver_place_id}): {e}")
        blog_reviews = []
        road_text = ""

    # 3. Gemini로 고품질 소개 생성
    try:
        from google import genai as _genai
        client = _genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

        blog_block = ""
        if blog_reviews:
            blog_block = "\n실제 방문자 블로그 후기 제목:\n" + "\n".join(f"- {r['title']}" for r in blog_reviews)
        road_block = f"\n찾아오는 길: {road_text}" if road_text else ""

        # 문장이 길면 상세페이지에서 소개글 아래 광고 위치가 너무 아래로 밀려 UX/수익에 안 좋다는
        # 피드백(2026-08-11)으로 문단 수 대신 문장 수 상한(6문장)으로 통일 — 리뷰 유무와 무관하게 적용.
        prompt = (
            f"다음 팝업스토어 소개 글을 최대 6문장 이내로, 1문단으로 간결하게 작성해줘.\n"
            f"장소명: {title}\n위치: {location}"
            f"{blog_block}"
            f"{road_block}\n\n"
            f"조건: 방문자 입장에서, 이모지 없이, 마크다운 기호 없이, 선택지/옵션 없이 소개 문구만 출력. "
            f"블로그 후기 제목이 있다면 그 분위기와 특징을 반드시 녹여낼 것."
        )

        resp = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
        generated = (resp.text or "").strip()[:600]
        generated = _limit_sentences(generated, 6)
    except Exception as e:
        raise RuntimeError(f"Gemini 생성 실패: {e}")

    # Gemini가 드물게 빈 응답을 반환해도(세이프티 필터/일시 오류 등) 그대로 저장하면 기존 소개글이
    # 통째로 사라짐(2026-08-11 실제 발생) — 빈 응답이면 DB를 건드리지 않고 실패로 처리해 기존 글 보존.
    if not generated:
        raise RuntimeError("Gemini가 빈 응답을 반환했습니다 — 기존 소개글을 유지합니다")

    # 4. DB 저장 — content 업데이트 + blog_reviews 저장 + 갱신 시각 기록
    # blog_reviews가 빈 배열([])일 때 "if blog_reviews else None"이 False로 평가돼 NULL로 저장되던 버그 —
    # 실제로 리뷰가 0건인 장소가 영원히 "미처리(NULL)"로 보여서 자동갱신 스케줄러가 같은 곳을 무한 재시도했음.
    # 스크래핑이 실행됐다는 사실 자체를 항상 빈 배열로라도 기록해 "처리 완료"를 구분할 수 있게 함.
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE seongsu_places SET content = :content, blog_reviews = :blog_reviews, updated_at = NOW() WHERE id = :id"),
            {
                "content": generated,
                "blog_reviews": json.dumps(blog_reviews, ensure_ascii=False),
                "id": place_id,
            }
        )
        conn.commit()

    # content가 바뀌었으니 영문/중문 번역도 백그라운드로 갱신 (안 그러면 예전 번역이 새 내용과 어긋난 채 남음)
    threading.Thread(target=_translate_and_save, args=(place_id, None, generated), daemon=True).start()

    # 상세 페이지가 5분 ISR 캐시라 이걸 안 부르면 캐시 만료 전까지 옛 내용이 계속 보임(일반 저장 플로우는 이미 호출 중)
    threading.Thread(target=_revalidate_place, args=(place_id,), daemon=True).start()

    return {
        "content": generated,
        "blog_reviews": blog_reviews,
        "has_road": bool(road_text),
    }


# 신규 팝업 자동 블로그갱신 — 10분마다 blog_reviews가 비어있는 네이버 팝업(공연/축제/코피스/비짓제주 등
# 레거시 소스 제외)을 찾아 자동으로 갱신. Playwright가 로컬에만 있어 프로덕션에선 절대 켜면 안 됨 —
# 로컬 .env에만 AUTO_ENRICH_POPUPS=true를 넣어서 게이트.
# created_at 7일(지난주치까지) 이내로 한정 — 매주 목요일 스크래핑분만 대상으로 하고 그보다 예전부터
# 쌓인 미갱신 백로그는 안 건드림(백로그는 기존처럼 어드민/텔레그램 수동 트리거로 처리).
_auto_enrich_success_count = 0
_auto_enrich_fail_count = 0

def _auto_enrich_new_popups() -> None:
    import asyncio as _asyncio
    global _auto_enrich_success_count, _auto_enrich_fail_count
    BATCH_LIMIT = 1  # 10분마다 1건 — 안전하게 천천히
    ITEM_TIMEOUT_SEC = 120  # 한 건이 멈춰도 다음 10분 주기를 막지 않도록 상한
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT id FROM seongsu_places
            WHERE blog_reviews IS NULL
              AND COALESCE(category, 'popup') = 'popup'
              AND region NOT IN ('공연', '축제')
              AND naver_place_id NOT LIKE 'kopis_%'
              AND naver_place_id NOT LIKE 'jeju_%'
              AND naver_place_id NOT LIKE 'culture_%'
              AND naver_place_id NOT LIKE 'visitjeju_%'
              AND (end_date IS NULL OR end_date >= CURRENT_DATE)
              AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY created_at ASC
            LIMIT :limit
        """), {"limit": BATCH_LIMIT}).fetchall()

    if not rows:
        # 처리할 게 없어짐 = 이번 배치 종료. 뭔가 했었으면(카운터>0) 요약 알림 후 리셋, 이미 0이면(계속 idle) 조용히 넘어감
        if _auto_enrich_success_count or _auto_enrich_fail_count:
            from notification import send_alert
            send_alert(
                f"[신규 팝업 자동 블로그갱신] 배치 완료 — 성공 {_auto_enrich_success_count}건, 실패 {_auto_enrich_fail_count}건"
            )
            _auto_enrich_success_count = 0
            _auto_enrich_fail_count = 0
        return

    for row in rows:
        try:
            _asyncio.run(_asyncio.wait_for(_enrich_place_core(row.id), timeout=ITEM_TIMEOUT_SEC))
            logger.info("[auto_enrich] 완료 (place_id=%s)", row.id)
            _auto_enrich_success_count += 1
        except _asyncio.TimeoutError:
            logger.error("[auto_enrich] 타임아웃(%ss 초과) — 건너뜀 (place_id=%s)", ITEM_TIMEOUT_SEC, row.id)
            _auto_enrich_fail_count += 1
        except Exception as e:
            logger.error("[auto_enrich] 실패 (place_id=%s): %s", row.id, e)
            _auto_enrich_fail_count += 1
