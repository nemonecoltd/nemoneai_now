import requests
import xml.etree.ElementTree as ET
from datetime import date

JEJU_API_URL = "http://www.jeju.go.kr/rest/JejuExhibitionService/getJejucultureExhibitionList"


def get_jeju_culture_events() -> list:
    today = date.today().isoformat()

    try:
        r = requests.get(JEJU_API_URL, params={"page": 1, "pageSize": 1}, timeout=10)
        root = ET.fromstring(r.text)
        total_rows = int(root.findtext(".//rows", "0"))
        total_pages = (total_rows // 100) + 1
    except Exception as e:
        print(f"❌ 제주 API 전체 건수 조회 실패: {e}")
        return []

    raw_items = []
    # 최신 데이터는 마지막 페이지에 있음 — 뒤 5페이지만 탐색
    start_page = max(1, total_pages - 4)
    for page in range(start_page, total_pages + 1):
        try:
            r = requests.get(JEJU_API_URL, params={"page": page, "pageSize": 100}, timeout=10)
            root = ET.fromstring(r.text)
            for item in root.findall(".//item"):
                if (
                    item.findtext("stat", "") == "READY"
                    and item.findtext("end", "") >= today
                ):
                    raw_items.append(item)
        except Exception as e:
            print(f"❌ 제주 API 페이지 {page} 조회 실패: {e}")

    return raw_items


async def scrape_jeju_api() -> list[dict]:
    raw_items = get_jeju_culture_events()
    if not raw_items:
        print("⚠️ 제주 문화행사 활성 데이터 없음")
        return []

    # 공연 먼저, 전시 뒤 / 각 카테고리 내 시작일 오름차순
    raw_items.sort(key=lambda x: (
        0 if x.findtext("categoryName", "") == "공연" else 1,
        x.findtext("start", "")
    ))
    seen: set[str] = set()
    results: list[dict] = []

    for item in raw_items:
        title = item.findtext("title", "").strip()
        if not title or title in seen:
            continue
        seen.add(title)

        category = item.findtext("categoryName", "")
        loc_raw = item.findtext("locNames", "")
        # 제주아트센터 홀 이름 정규화
        _artcenter_halls = {"대극장", "소극장", "제1전시실", "제2전시실", "제3전시실"}
        loc = f"제주아트센터 {loc_raw}" if loc_raw in _artcenter_halls else loc_raw
        owner = item.findtext("owner", "")
        start = item.findtext("start", "")
        end = item.findtext("end", "")
        hour = item.findtext("hour", "")
        pay = item.findtext("pay", "")
        cover = item.findtext("cover", "").strip()

        parts = [f"[{category}] {title}"]
        if loc:
            parts.append(f"장소: {loc}")
        if start:
            parts.append(f"기간: {start} ~ {end}")
        if hour:
            parts.append(f"시간: {hour}")
        if pay:
            parts.append(f"요금: {pay}")
        if owner:
            parts.append(f"주최: {owner}")

        results.append({
            "title": title,
            "title_en": "",
            "location": loc if loc else "제주",
            "date_range": f"{start} ~ {end}",
            "image_url": cover,
            "content": " | ".join(parts),
            "content_en": "",
            "latitude": None,
            "longitude": None,
            "video_url": "",
            "naver_place_id": f"jeju_{abs(hash(title)) % 1000000}",
            "region": "제주",
            "end_date_actual": end,  # 실제 행사 종료일 (DB end_date에 사용)
        })

    print(f"✅ 제주 데이터 {len(results)}개 정제 완료")
    return results


if __name__ == "__main__":
    import asyncio
    res = asyncio.run(scrape_jeju_api())
    for r in res:
        img = "🖼" if r["image_url"] else "  "
        print(f"{img} [{r['location']}] {r['date_range']} | {r['title'][:50]}")
