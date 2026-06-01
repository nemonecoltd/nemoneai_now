import os
import requests
from dotenv import load_dotenv

load_dotenv()

SEOUL_API_KEY = os.getenv("SEOUL_API_KEY")

CONCERT_CODENAMES = {"공연마당", "콘서트", "뮤지컬/오페라", "클래식/국악", "전통/무용", "연극"}

def get_seoul_concert_events():
    """서울시 문화행사 API 호출 — 공연 카테고리 전체 (구 제한 없음)"""
    if not SEOUL_API_KEY or SEOUL_API_KEY == "sample":
        print("⚠️ 서울시 API 키가 설정되지 않았습니다.")
        return []

    all_events = []
    # 최대 200개 수집 (1~100, 101~200)
    for start in [1, 101]:
        end = start + 99
        url = f"http://openAPI.seoul.go.kr:8088/{SEOUL_API_KEY}/json/culturalEventInfo/{start}/{end}/"
        print(f"🏛️ 서울시 공연 데이터 수집 중 ({start}~{end})...")
        try:
            response = requests.get(url, timeout=15)
            if response.status_code != 200:
                print(f"❌ API 응답 에러: {response.status_code}")
                break
            data = response.json()
            events = data.get("culturalEventInfo", {}).get("row", [])
            if not events:
                break
            all_events.extend(events)
        except Exception as e:
            print(f"❌ 서울시 API 호출 실패: {e}")
            break

    # 공연 카테고리 필터링
    concert_events = [
        e for e in all_events
        if e.get("CODENAME", "") in CONCERT_CODENAMES
    ]
    return concert_events


async def scrape_seoul_api_concert():
    events = get_seoul_concert_events()
    if not events:
        print("⚠️ 서울시 공연 데이터가 없습니다.")
        return []

    print(f"📦 서울시 공연 행사 {len(events)}개 발견.")

    results = []
    for event in events:
        title = event.get("TITLE", "").strip()
        if not title:
            continue
        codename = event.get("CODENAME", "")
        place = event.get("PLACE", "서울 어딘가")
        guname = event.get("GUNAME", "")
        strt = event.get("STRTDATE", "")[:10]
        end = event.get("END_DATE", "")[:10]
        program = event.get("PROGRAM", "") or title

        content = f"[{codename}] {program}"
        if guname:
            content += f" | 지역: {guname}"
        if strt:
            content += f" | 기간: {strt} ~ {end}"

        results.append({
            "title": title,
            "title_en": "",
            "location": f"{guname} {place}".strip() if guname else place,
            "date_range": f"{strt} ~ {end}",
            "image_url": event.get("MAIN_IMG", ""),
            "content": content,
            "content_en": "",
            "latitude": None,
            "longitude": None,
            "video_url": "",
            "naver_place_id": f"concert_{hash(title) % 100000}",
            "region": "공연",
        })

    print(f"✅ 공연 데이터 {len(results)}개 정제 완료.")
    return results


if __name__ == "__main__":
    import asyncio
    res = asyncio.run(scrape_seoul_api_concert())
    for r in res:
        print(f"  - [{r['location']}] {r['title']}")
