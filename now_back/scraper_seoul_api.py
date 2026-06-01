import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

SEOUL_API_KEY = os.getenv("SEOUL_API_KEY")

def get_seoul_cultural_events():
    """서울시 문화행사 API 호출 및 성동구 필터링"""
    if not SEOUL_API_KEY or SEOUL_API_KEY == "sample":
        print("⚠️ 서울시 API 키가 설정되지 않았습니다. .env 파일을 확인하세요.")
        return []

    # API 호출 주소 (culturalEventInfo 서비스)
    url = f"http://openAPI.seoul.go.kr:8088/{SEOUL_API_KEY}/json/culturalEventInfo/1/100/"
    
    print(f"🏛️ 서울시 공공데이터 접속 시도 중...")
    try:
        response = requests.get(url, timeout=15)
        
        # JSON 응답인지 확인
        if response.status_code != 200:
            print(f"❌ API 서버 응답 에러: {response.status_code}")
            return []
            
        try:
            data = response.json()
        except json.JSONDecodeError:
            print("❌ 응답 데이터가 JSON 형식이 아닙니다. API 키를 확인하세요.")
            return []

        events = data.get('culturalEventInfo', {}).get('row', [])
        
        # 성동구 지역 행사만 필터링
        seongdong_events = [
            e for e in events 
            if "성동구" in e.get('GUNAME', '') or "성수" in e.get('PLACE', '')
        ]
        return seongdong_events
    except Exception as e:
        print(f"❌ 서울시 API 호출 중 예외 발생: {e}")
        return []

async def scrape_seoul_api():
    events = get_seoul_cultural_events()
    results = []
    
    if not events:
        print("⚠️ 수집된 서울시 문화행사 데이터가 없습니다.")
        return []

    print(f"📦 성동구 문화행사 {len(events)}개를 발견했습니다.")
    
    for event in events:
        # 공공데이터 포맷을 우리 DB 규격에 맞게 변환
        results.append({
            "title": event.get('TITLE', '무제'),
            "location": event.get('PLACE', '성수동 어딘가'),
            "date_range": f"{event.get('STRTDATE', '')[:10]} ~ {event.get('END_DATE', '')[:10]}",
            "image_url": event.get('MAIN_IMG', 'https://picsum.photos/400/300'),
            "content": event.get('PROGRAM', '') or event.get('TITLE'),
            "latitude": None,
            "longitude": None,
            "video_url": "",
            "naver_place_id": f"seoul_{hash(event.get('TITLE')) % 10000}"
        })
        
    return results

if __name__ == "__main__":
    import asyncio
    res = asyncio.run(scrape_seoul_api())
    print(f"🚀 총 {len(res)}개 수집 성공")
