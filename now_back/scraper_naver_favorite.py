"""네이버 지도 '즐겨찾기(공유 폴더)' 스크래퍼.

map.naver.com/p/favorite/.../folder/{id} 링크가 공개 공유된 경우, 이 페이지가 내부적으로
쓰는 pages.map.naver.com 공개 API를 그대로 호출한다 — 로그인/봇방지 토큰이 전혀 필요 없어
Playwright 없이 requests만으로 수집 가능(다른 네이버지도 스크래퍼들과 달리 브라우저 불필요).

주의: 폴더에 큐레이터가 남긴 memo(예: "6년째 가는 마농바게트가 맛있는 가성비 빵집")는 제3자의
저작물이라 원문 그대로 저장/노출하면 안 됨 — 이 파일은 memo를 참고용으로만 반환하고,
DB에 실제로 들어가는 소개문은 collector_favorite.py에서 memo 없이 AI가 새로 작성한다.
"""
import re
from typing import Optional

import requests

_FOLDER_ID_RE = re.compile(r"/folder/([a-zA-Z0-9]+)")


def extract_folder_id(url: str) -> Optional[str]:
    m = _FOLDER_ID_RE.search(url)
    return m.group(1) if m else None


def scrape_favorite_folder(folder_url: str) -> tuple[Optional[str], list[dict]]:
    """즐겨찾기 공유 폴더의 (폴더 이름, 장소 목록)을 가져온다."""
    folder_id = extract_folder_id(folder_url)
    if not folder_id:
        raise ValueError(f"URL에서 폴더 ID를 찾을 수 없습니다: {folder_url}")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Referer": "https://map.naver.com/",
    }

    results: list[dict] = []
    start = 0
    limit = 20  # placeInfo=true일 때 API 제약상 20이 최대(그 이상 요청하면 400)
    folder_name = None

    while True:
        url = (
            "https://pages.map.naver.com/save-pages/api/maps-bookmark/v3/shares/"
            f"{folder_id}/bookmarks?placeInfo=true&start={start}&limit={limit}"
            "&sort=lastUseTime&mcids=ALL&createIdNo=true"
        )
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        folder_name = folder_name or (data.get("folder") or {}).get("name")
        bookmarks = data.get("bookmarkList") or []
        if not bookmarks:
            break

        for b in bookmarks:
            place_info = b.get("placeInfo") or {}
            thumbs = place_info.get("thumbnailUrls") or []
            title = (b.get("name") or "").strip()
            naver_place_id = str(b.get("sid") or "")
            if not title or not naver_place_id:
                continue
            results.append({
                "naver_place_id": naver_place_id,
                "title": title,
                "location": b.get("address", ""),
                "latitude": b.get("py"),
                "longitude": b.get("px"),
                "image_url": thumbs[0] if thumbs else "",
                # 네이버가 분류한 세부 업종(예: "독립서점", "베이커리") — 어드민이 넘긴 category보다
                # 구체적이라 AI 소개문 프롬프트의 kind로 이걸 우선 사용
                "category_hint": b.get("mcidName") or place_info.get("category") or "",
                # 참고용으로만 반환 — DB에는 절대 저장하지 않음(저작권 리스크)
                "curator_memo": b.get("memo", ""),
            })

        if len(bookmarks) < limit:
            break
        start += limit

    print(f"✅ [즐겨찾기] '{folder_name}' 폴더에서 {len(results)}개 수집 완료")
    return folder_name, results


if __name__ == "__main__":
    import sys
    test_url = sys.argv[1] if len(sys.argv) > 1 else ""
    _name, _items = scrape_favorite_folder(test_url)
    print(f"폴더명: {_name}")
    for item in _items:
        print(f"  - {item['title']} / {item['location']} / {item['category_hint']}")
