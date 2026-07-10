import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def generate_answer(user_query: str, context: str, region: str = "성수", lang: str = "ko"):
    """일반 채팅용 답변 생성"""
    lang_name = {"en": "영어", "zh": "중국어(간체)"}.get(lang, "한국어")
    prompt = f"""당신은 {region} 지역 로컬 가이드입니다. 아래 장소 정보를 참고해 {lang_name}로 친절하게 답하세요.

[장소 정보]
{context}

[답변 형식 규칙 - 반드시 준수]
- 표(table) 사용 금지
- 마크다운 기호(#, **, *, ---, |) 사용 금지
- URL은 절대 그대로 출력하지 말 것. 네이버 지도 링크가 필요하면 "네이버 지도에서 확인하세요" 같은 문장으로 대체
- 줄바꿈으로 문단을 구분하고, 목록은 "• " 기호만 사용
- 짧고 명확하게 3~5문장 이내로 답변

질문: {user_query}"""
    response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt
    )
    return response.text

def generate_walking_tour(companion: str, context: str, region: str = "성수", lang: str = "ko"):
    """[핵심] 3시간 맞춤형 도보 코스를 JSON 형식으로 설계"""
    lang_name = {"en": "영어", "zh": "중국어(간체)"}.get(lang, "한국어")
    prompt = f"""
    당신은 {region} 지역 최고의 로컬 가이드입니다. 
    아래 [{region} 팝업 데이터]를 바탕으로 '{companion}'와(과) 함께하는 최적의 '3시간 도보 코스'를 설계하세요.
    모든 답변(제목, 설명, 활동 등)은 반드시 {lang_name}로 작성해야 합니다.

    [{region} 팝업 데이터]
    {context}

    [요구사항]
    1. 총 소요 시간은 약 3시간이어야 합니다.
    2. 이동 동선을 고려하여 가장 효율적인 순서로 3~4곳을 배치하세요.
    3. 각 장소에서 무엇을 해야 할지(activity)와 머무는 시간(duration)을 정하세요.
    4. 반드시 아래 JSON 형식으로만 응답하세요. 다른 설명은 금지합니다.

    [응답 JSON 형식 예시]
    {{
      "title": "Course Title in {lang_name}",
      "description": "Course description in {lang_name}",
      "steps": [
        {{
          "time": "14:00",
          "place_id": 42,
          "place_name": "Name",
          "date_range": "2026.06.01 ~ 2026.07.31",
          "activity": "Activity in {lang_name}",
          "duration": 60
        }}
      ]
    }}
    - place_id는 반드시 [id:숫자] 형식에서 추출한 정수 그대로 사용
    - date_range는 장소 정보의 운영일시를 그대로 복사 (없으면 null)
    """
    
    response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )
    
    # [방어 로직] 마크다운 기호 제거 후 JSON 추출
    clean_json = response.text.replace("```json", "").replace("```", "").strip()
    return json.loads(clean_json)

def ai_translate(title: str, content: str) -> tuple[str, str, str, str]:
    """한국어 title/content를 영어+중국어로 번역. 실패 시 빈 문자열 튜플 반환."""
    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=(
                f"다음 한국어 팝업스토어 정보를 자연스러운 영어와 중국어(간체)로 각각 번역해줘.\n"
                f"제목: {title}\n내용: {content}\n\n"
                f"조건: 아래 JSON 형식으로만 출력 (설명이나 코드블록 없이 순수 JSON만).\n"
                f'{{"title_en": "English title", "content_en": "English content", '
                f'"title_zh": "中文标题", "content_zh": "中文内容"}}'
            ),
        )
        raw = (response.text or "").strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        data = json.loads(raw)
        return (
            (data.get("title_en", "") or "").strip(),
            (data.get("content_en", "") or "").strip(),
            (data.get("title_zh", "") or "").strip(),
            (data.get("content_zh", "") or "").strip(),
        )
    except Exception as e:
        print(f"    ⚠️ 번역 실패: {e}")
        return "", "", "", ""

def get_embedding(text: str):
    """텍스트 벡터화 (최신 다국어 모델 사용). 일시적 서버 과부하(503 등) 대비 짧은 재시도 포함."""
    import time
    last_error = None
    for attempt in range(3):
        try:
            result = client.models.embed_content(
                model="gemini-embedding-2-preview",
                contents=text,
                config=types.EmbedContentConfig(output_dimensionality=3072)
            )
            return result.embeddings[0].values
        except Exception as e:
            last_error = e
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
    raise last_error
