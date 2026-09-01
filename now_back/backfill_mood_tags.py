"""기존 팝업 장소에 무드 태그 일괄 생성 (2026-09-02).

대상 선정 기준이 중요하다 — content는 1차 수집(장소명+위치만으로 AI 소개 생성) 때도
채워지므로 전체 5,500여 곳이 다 갖고 있다. 그걸 기준으로 잡으면 정작 이 기능이 피하려던
"이름만 보고 추측한 태그"가 대량 생성된다. 실제 관찰 근거(블로그 후기 스크래핑)가 있는
곳은 blog_reviews IS NOT NULL인 곳뿐이라 이걸 기준으로 삼는다.

클래스(category='class')는 무드 태그 대상이 아니라 제외 — 정규 enrich 스케줄러
(_auto_enrich_new_popups)도 같은 조건으로 팝업만 처리하고 있어 기준이 일관된다.

_enrich_place_core를 그대로 재사용하지 않는 이유: 그 함수는 Playwright로 pcmap을 다시
스크래핑해서 느리고(건당 최대 45초) 무겁다. 이미 저장된 blog_reviews를 근거로 쓰면
Gemini 호출만 하면 되므로 훨씬 빠르고 싸다.

사용법:
  python backfill_mood_tags.py [건수]   # 생략 시 전체
"""
import json
import os
import sys
import time
from typing import Optional

import requests
from dotenv import load_dotenv
from sqlalchemy import text

from database import engine
from mood_tags import prompt_block, validate_tags

load_dotenv()

TARGET_SQL = """
    SELECT id, title, location, content, image_url, blog_reviews
    FROM seongsu_places
    WHERE blog_reviews IS NOT NULL
      AND COALESCE(category, 'popup') = 'popup'
      AND mood_tags IS NULL
    ORDER BY id
"""


def _blog_titles(raw) -> list[str]:
    """blog_reviews는 JSON 문자열 또는 이미 파싱된 리스트로 올 수 있다(드라이버/컬럼타입에 따라)."""
    if not raw:
        return []
    data = raw
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except Exception:
            return []
    if not isinstance(data, list):
        return []
    return [r.get("title", "") for r in data if isinstance(r, dict) and r.get("title")]


def generate_mood_tags(row) -> list[str]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

    titles = _blog_titles(row.blog_reviews)
    blog_block = ("\n실제 방문자 블로그 후기 제목:\n" + "\n".join(f"- {t}" for t in titles)) if titles else ""

    prompt = (
        f"다음 팝업스토어의 분위기를 판단해줘.\n"
        f"장소명: {row.title}\n위치: {row.location or ''}\n"
        f"소개: {(row.content or '')[:600]}"
        f"{blog_block}"
        f"{prompt_block()}\n\n"
        f'다음 JSON 형식으로만 응답: {{"mood_tags": ["태그1", "태그2"]}}'
    )

    contents: list = [prompt]
    if row.image_url:
        try:
            resp = requests.get(
                row.image_url, timeout=8,
                headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"},
            )
            resp.raise_for_status()
            mime = resp.headers.get("content-type", "image/jpeg").split(";")[0]
            if mime.startswith("image/") and len(resp.content) < 8 * 1024 * 1024:
                contents.insert(0, types.Part.from_bytes(data=resp.content, mime_type=mime))
        except Exception as e:
            print(f"    ⚠️ 이미지 로드 실패: {e}")

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(response_mime_type="application/json"),
    )
    raw = (response.text or "").strip().replace("```json", "").replace("```", "").strip()
    return validate_tags(json.loads(raw).get("mood_tags"))


def run(limit: Optional[int]) -> None:
    with engine.connect() as conn:
        rows = conn.execute(text(TARGET_SQL)).fetchall()

    if limit:
        rows = rows[:limit]
    print(f"대상: {len(rows)}건\n")

    done = 0
    empty = 0
    failed = 0
    for row in rows:
        try:
            tags = generate_mood_tags(row)
        except Exception as e:
            print(f"  [{row.id}] {row.title} — ❌ {e}")
            failed += 1
            time.sleep(0.5)
            continue

        with engine.connect() as conn:
            conn.execute(
                text("UPDATE seongsu_places SET mood_tags = :tags WHERE id = :id"),
                {"tags": tags, "id": row.id},
            )
            conn.commit()

        if tags:
            done += 1
            print(f"  [{row.id}] {row.title} — {', '.join(tags)}")
        else:
            empty += 1
            print(f"  [{row.id}] {row.title} — (근거 부족, 빈 배열)")

        time.sleep(0.4)

    print(f"\n완료: 태그 생성 {done}건, 근거부족 {empty}건, 실패 {failed}건")


if __name__ == "__main__":
    run(int(sys.argv[1]) if len(sys.argv) > 1 else None)
