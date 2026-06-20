"""
기존 DB 레코드 중 content가 비어있거나 메타 텍스트(카테고리:/주소:)인 것에
AI 소개 문구 + 네이버 링크 일괄 적용.
한 번만 실행하면 됨.
"""
import os
from dotenv import load_dotenv
from sqlalchemy import text
from database import engine
from gemini_service import get_embedding

load_dotenv()


def ai_generate_intro(title: str, location: str) -> str:
    try:
        from google import genai
        client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=(
                f"다음 팝업스토어의 소개 문구를 정확히 2~3문장으로 작성해줘.\n"
                f"장소명: {title}\n위치: {location}\n"
                f"조건: 방문자 시각, 이모지 없이, 선택지/옵션 없이 소개 문구만 출력."
            ),
        )
        result = (response.text or "").strip()
        return result[:400] if result else ""
    except Exception as e:
        print(f"    ⚠️ AI 실패: {e}")
        return ""


def needs_update(content: str) -> bool:
    if not content or not content.strip():
        return True
    if "카테고리:" in content or "주소:" in content or "영업:" in content:
        return True
    return False


def main():
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, title, location, content, naver_place_id FROM seongsu_places ORDER BY id"
        )).fetchall()

    targets = [r for r in rows if needs_update(r.content or "")]
    print(f"업데이트 대상: {len(targets)}개 / 전체 {len(rows)}개\n")

    for row in targets:
        print(f"  [{row.id}] {row.title}")
        intro = ai_generate_intro(row.title, row.location or "")
        naver_url = f"https://map.naver.com/p/entry/place/{row.naver_place_id}" if row.naver_place_id else ""
        link_line = f"네이버 지도 바로가기: {naver_url}" if naver_url else ""

        if intro:
            new_content = "\n\n".join(filter(None, [intro, link_line]))
            print(f"    소개: {intro[:60]}...")
        else:
            new_content = link_line or row.title
            print(f"    소개 생성 실패, 링크만 저장")

        try:
            embedding = get_embedding(new_content)
            with engine.connect() as conn:
                conn.execute(text(
                    "UPDATE seongsu_places SET content = :content, embedding = :embedding WHERE id = :id"
                ), {
                    "content": new_content,
                    "embedding": f"[{','.join(map(str, embedding))}]",
                    "id": row.id,
                })
                conn.commit()
            print(f"    ✅ 완료")
        except Exception as e:
            print(f"    ❌ 실패: {e}")

    print(f"\n🏁 마이그레이션 완료 ({len(targets)}개 업데이트)")


if __name__ == "__main__":
    main()
