import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

SEOUL_API_KEY = os.getenv("SEOUL_API_KEY")

def get_seoul_cultural_events_hongdae():
    """서울시 문화행사 API 호출 및 마포구(홍대) 필터링"""
    if not SEOUL_API_KEY or SEOUL_API_KEY == "sample":
        print("⚠️ 서울시 API 키가 설정되지 않았습니다.")
        return []

    url = f"http://openAPI.seoul.go.kr:8088/{SEOUL_API_KEY}/json/culturalEventInfo/1/100/"
    
    print(f"🏛️ 서울시 공공데이터 접속 중 (홍대 타겟)...")
    try:
        response = requests.get(url, timeout=15)
        if response.status_code != 200: return []
            
        data = response.json()
        events = data.get('culturalEventInfo', {}).get('row', [])
        
        # 마포구 지역 행사만 필터링
        mapo_events = [
            e for e in events 
            if "마포구" in e.get('GUNAME', '') or "홍대" in e.get('PLACE', '') or "서교동" in e.get('PLACE', '')
        ]
        return mapo_events
    except Exception as e:
        print(f"❌ 서울시 API 호출 실패: {e}")
        return []

async def scrape_seoul_api_hongdae():
    events = get_seoul_cultural_events_hongdae()
    results = []
    
    if not events:
        print("⚠️ 홍대 지역 공공 데이터가 없습니다.")
        return []

    print(f"📦 마포구 문화행사 {len(events)}개를 발견했습니다.")
    
    for event in events:
        results.append({
            "title": event.get('TITLE', '무제'),
            "location": event.get('PLACE', '홍대입구역 인근'),
            "date_range": f"{event.get('STRTDATE', '')[:10]} ~ {event.get('END_DATE', '')[:10]}",
            "image_url": event.get('MAIN_IMG', 'https://picsum.photos/400/300'),
            "content": event.get('PROGRAM', '') or event.get('TITLE'),
            "latitude": None,
            "longitude": None,
            "video_url": "",
            "naver_place_id": f"seoul_hongdae_{hash(event.get('TITLE')) % 10000}",
            "region": "홍대"
        })
        
    return results

if __name__ == "__main__":
    import asyncio
    res = asyncio.run(scrape_seoul_api_hongdae())
    print(f"🚀 홍대 공공데이터 {len(res)}개 수집 성공")
