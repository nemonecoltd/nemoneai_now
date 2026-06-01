import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def generate_answer(user_query: str, context: str, region: str = "성수", lang: str = "ko"):
    """일반 채팅용 답변 생성"""
    lang_name = "영어" if lang == "en" else "한국어"
    prompt = f"당신은 {region} 지역 최고의 로컬 가이드입니다. 다음 정보를 바탕으로 {lang_name}로 답하세요: {context}\n\n질문: {user_query}"
    response = client.models.generate_content(
        model="gemini-2.5-pro",
        contents=prompt
    )
    return response.text

def generate_walking_tour(companion: str, context: str, region: str = "성수", lang: str = "ko"):
    """[핵심] 3시간 맞춤형 도보 코스를 JSON 형식으로 설계"""
    lang_name = "영어" if lang == "en" else "한국어"
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
          "place_name": "Name",
          "activity": "Activity in {lang_name}",
          "duration": 60
        }}
      ]
    }}
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

def get_embedding(text: str):
    """텍스트 벡터화 (최신 다국어 모델 사용)"""
    result = client.models.embed_content(
        model="gemini-embedding-2-preview",
        contents=text,
        config=types.EmbedContentConfig(output_dimensionality=3072)
    )
    return result.embeddings[0].values
