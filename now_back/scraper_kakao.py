"""카카오맵 키워드 검색 스크래퍼.

map.kakao.com이 내부적으로 쓰는 search.map.kakao.com/mapsearch/map.daum API를 그대로 호출.
네이버지도와 달리 브라우저/봇방지 토큰이 전혀 필요 없어 순수 HTTP 요청만으로 전체 페이지를
끝까지 수집할 수 있고, 광고는 응답의 'place' 배열과 분리된 별도 필드(ad_info_list 등)로
오기 때문에 별도 필터링 없이도 광고가 섞이지 않는다.

정렬은 '정확도순'(msFlag=A&sort=0)이 아니라 실제 사이트의 '인기도순' 토글과 동일한
msFlag=S&sort=1을 쓴다 — 반환 순서 자체가 인기도 랭킹이라 collector 쪽에서 상위 N개만
추릴 때(예: 테마지도) 그대로 앞에서 자르면 됨.
"""
from typing import Optional

import httpx

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://map.kakao.com/",
}
_BASE = "https://search.map.kakao.com/mapsearch/map.daum"


def scrape_kakao_keyword(query: str, max_pages: int = 20) -> list[dict]:
    """카카오맵 키워드 검색 결과를 마지막 페이지까지(또는 max_pages까지) 전부 가져온다."""
    results: list[dict] = []
    seen_ids: set = set()

    with httpx.Client(headers=_HEADERS, timeout=15) as client:
        for page in range(1, max_pages + 1):
            resp = client.get(_BASE, params={"q": query, "msFlag": "S", "sort": 1, "page": page})
            resp.raise_for_status()
            data = resp.json()
            places = data.get("place") or []
            if not places:
                break

            new_in_page = 0
            for p in places:
                cid = p.get("confirmid")
                title = (p.get("name") or "").strip()
                if not cid or not title or cid in seen_ids:
                    continue
                seen_ids.add(cid)
                new_in_page += 1
                address_parts = (p.get("address_disp") or "").split("|")
                results.append({
                    "kakao_place_id": cid,
                    "title": title,
                    "location": p.get("new_address") or p.get("address") or "",
                    "district": address_parts[1] if len(address_parts) > 1 else "",
                    "latitude": p.get("lat"),
                    "longitude": p.get("lon"),
                    "tel": p.get("tel", ""),
                    "homepage": p.get("homepage", ""),
                    "image_url": p.get("img", ""),
                    "category_path": p.get("last_cate_name", ""),
                    "rating_average": p.get("rating_average"),
                    "rating_count": p.get("rating_count"),
                    "review_count": p.get("reviewCount"),
                })

            # 마지막 페이지를 넘어가면 카카오가 마지막 페이지를 그대로 반복 응답하므로,
            # 이번 페이지에서 새로 확보한 게 하나도 없으면 종료.
            if new_in_page == 0:
                break

    print(f"✅ [카카오맵] '{query}' 검색 {len(results)}개 수집 완료")
    return results


if __name__ == "__main__":
    import sys
    q = sys.argv[1] if len(sys.argv) > 1 else "서울 독립서점"
    for item in scrape_kakao_keyword(q):
        print(f"  - {item['title']} / {item['district']} / {item['location']}")
