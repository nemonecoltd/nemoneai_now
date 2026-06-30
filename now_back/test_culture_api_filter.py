"""문체부 통합 공연 API(CNV_060) 전국 데이터에서 서울/제주만 추출 + 기존 데이터와 중복 확인.

화이트리스트 구성:
1. DB(seongsu_places)에 이미 수집된 venue 이름 (구 이름 제거)
2. 주요 서울/제주 공연장 수동 큐레이션 (DB가 못 잡고 있던 곳 보강)
"""
import json
import os
import re
import time
import xml.etree.ElementTree as ET
from collections import Counter

import psycopg2
import requests
from dotenv import load_dotenv

load_dotenv()

_CACHE_PATH = "/tmp/culture_api_cache.json"


def _normalize(t: str) -> str:
    t = re.sub(r"\[[^\]]*\]", "", t)
    t = re.sub(r"[^가-힣a-zA-Z0-9]", "", t)
    return t.lower().strip()

CULTURE_API_KEY = os.getenv("CULTURE_API_KEY")
URL = "https://api.kcisa.kr/openapi/CNV_060/request"

GU_NAMES = [
    "종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구",
    "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구",
    "관악구", "서초구", "강남구", "송파구", "강동구",
]
_GU_PATTERN = re.compile(r"^(" + "|".join(GU_NAMES) + r")\s*")

# 수동 큐레이션 — DB에 없지만 실제 서울 주요 공연장 (지역명이 unique한 것만 — "소극장"/"대극장"/"씨어터" 등 범용어 제외, 타지역 오염 유발)
EXTRA_SEOUL_VENUES = [
    "서울", "아르코예술극장", "대학로예술극장", "대학로", "세종문화회관", "국립극장",
    "LG아트센터", "유니플렉스", "충무아트센터", "마포아트센터", "블루스퀘어",
    "잠실", "장충", "코엑스", "DDP", "동대문디자인플라자", "한전아트센터",
    "국립국악원", "정동극장", "남산국악당", "상상마당 홍대",  # KT&G 상상마당은 대구/부산 지점도 있어 홍대만 특정
    "롯데콘서트홀", "금호아트홀 연세", "일신홀", "다산아트홀", "서울돈화문국악당",
    "반포", "예술의전당 [서울]",
]
# 지역 태그([서울],[부산] 등)가 title/eventSite에 박힌 경우 최우선 매칭 — Seoul 동의어
SEOUL_TAG_ALIASES = {"서울", "대학로"}
EXTRA_JEJU_VENUES = ["제주아트센터", "제주", "제주특별자치도문예회관", "한라", "서귀포"]
JEJU_TAG_ALIASES = {"제주"}

_TAG_PATTERN = re.compile(r"\[([가-힣]{2,4})\]")


def get_db_venues() -> tuple[set[str], set[str]]:
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST"), port=os.getenv("DB_PORT"),
        dbname=os.getenv("DB_NAME"), user=os.getenv("DB_USER"), password=os.getenv("DB_PASSWORD"),
    )
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT location FROM seongsu_places WHERE region='공연'")
    seoul_raw = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT DISTINCT location FROM seongsu_places WHERE region='제주'")
    jeju_raw = [r[0] for r in cur.fetchall()]
    cur.execute("SELECT title FROM seongsu_places")
    existing_titles = {r[0].strip() for r in cur.fetchall()}
    conn.close()

    seoul_venues = {_GU_PATTERN.sub("", loc).strip() for loc in seoul_raw if loc}
    jeju_venues = {loc.strip() for loc in jeju_raw if loc}
    return seoul_venues | set(EXTRA_SEOUL_VENUES), (jeju_venues | set(EXTRA_JEJU_VENUES)), existing_titles


def fetch_all_items(page_size: int = 1000) -> list[dict]:
    if os.path.exists(_CACHE_PATH):
        print("  (캐시 사용)")
        with open(_CACHE_PATH) as f:
            return json.load(f)

    items = []
    page = 1
    while True:
        r = requests.get(URL, params={"serviceKey": CULTURE_API_KEY, "numOfRows": page_size, "pageNo": page}, timeout=20)
        root = ET.fromstring(r.text)
        total_count = int(root.findtext(".//totalCount", "0"))
        page_items = root.findall(".//item")
        if not page_items:
            break
        for item in page_items:
            items.append({
                "title": (item.findtext("title") or "").strip(),
                "eventPeriod": (item.findtext("eventPeriod") or "").strip(),
                "eventSite": (item.findtext("eventSite") or "").strip(),
                "contactPoint": (item.findtext("contactPoint") or "").strip(),
                "url": (item.findtext("url") or "").strip(),
                "description": (item.findtext("description") or "").strip(),
            })
        print(f"  페이지 {page} 수집 ({len(items)}/{total_count})")
        if len(items) >= total_count:
            break
        page += 1
        time.sleep(0.2)

    with open(_CACHE_PATH, "w") as f:
        json.dump(items, f, ensure_ascii=False)
    return items


def main():
    print("📋 DB 기존 venue 화이트리스트 로딩...")
    seoul_whitelist, jeju_whitelist, existing_titles = get_db_venues()
    print(f"  서울 화이트리스트: {len(seoul_whitelist)}개, 제주 화이트리스트: {len(jeju_whitelist)}개")
    print(f"  기존 DB 제목 수: {len(existing_titles)}개")

    print("\n🌐 문체부 API 전체 데이터 수집 중...")
    items = fetch_all_items()
    print(f"  총 {len(items)}건 수집 완료")

    seoul_matched, jeju_matched = [], []
    for it in items:
        site = it["eventSite"]
        title = it["title"]

        # 1순위: [지역] 태그 (title 또는 eventSite)
        tag_match = _TAG_PATTERN.search(title) or _TAG_PATTERN.search(site)
        tag = tag_match.group(1) if tag_match else None

        if tag in SEOUL_TAG_ALIASES:
            seoul_matched.append(it)
            continue
        if tag in JEJU_TAG_ALIASES:
            jeju_matched.append(it)
            continue
        if tag is not None:
            # 다른 지역 태그가 명시적으로 박혀있으면 확실히 제외
            continue

        # 2순위: venue 화이트리스트 (태그 없는 항목만)
        if any(v in site for v in seoul_whitelist):
            seoul_matched.append(it)
        elif any(v in site for v in jeju_whitelist):
            jeju_matched.append(it)

    print(f"\n📍 서울 매칭: {len(seoul_matched)}건 / 제주 매칭: {len(jeju_matched)}건")

    # 중복 체크 (제목 완전일치 기준)
    seoul_dupe = [it for it in seoul_matched if it["title"] in existing_titles]
    jeju_dupe = [it for it in jeju_matched if it["title"] in existing_titles]
    print(f"  서울 중 기존 DB와 제목 완전일치 중복: {len(seoul_dupe)}건")
    print(f"  제주 중 기존 DB와 제목 완전일치 중복: {len(jeju_dupe)}건")

    # 중복 체크 (normalize 기준 — 공백/대괄호/특수문자 제거 후 비교)
    existing_norm = {_normalize(t) for t in existing_titles}
    seoul_dupe_norm = [it for it in seoul_matched if _normalize(it["title"]) in existing_norm]
    jeju_dupe_norm = [it for it in jeju_matched if _normalize(it["title"]) in existing_norm]
    print(f"  서울 중 기존 DB와 normalize 중복: {len(seoul_dupe_norm)}건")
    print(f"  제주 중 기존 DB와 normalize 중복: {len(jeju_dupe_norm)}건")
    for it in (seoul_dupe_norm + jeju_dupe_norm)[:10]:
        print(f"    중복 추정: {it['title']}")

    # 신규 API 내부 자체 중복 (동일 title이 여러 건 — 페이지/회차 중복 가능성)
    seoul_titles = [it["title"] for it in seoul_matched]
    jeju_titles = [it["title"] for it in jeju_matched]
    seoul_internal_dupe = sum(c - 1 for c in Counter(seoul_titles).values() if c > 1)
    jeju_internal_dupe = sum(c - 1 for c in Counter(jeju_titles).values() if c > 1)
    print(f"  서울 매칭 내부 자체 중복(같은 제목 재등장): {seoul_internal_dupe}건")
    print(f"  제주 매칭 내부 자체 중복(같은 제목 재등장): {jeju_internal_dupe}건")

    # eventSite 빈도 상위 — 화이트리스트 보강 참고용
    print("\n🏛️ 매칭 안 된 항목 중 빈도 높은 eventSite (화이트리스트 보강 후보, 상위 30개):")
    unmatched_sites = Counter(
        it["eventSite"] for it in items
        if it not in seoul_matched and it not in jeju_matched and it["eventSite"]
    )
    for site, cnt in unmatched_sites.most_common(30):
        print(f"  {cnt:4d}  {site}")

    print("\n✨ 서울 매칭 샘플 10개:")
    for it in seoul_matched[:10]:
        print(f"  - [{it['eventSite']}] {it['title']} ({it['eventPeriod']})")

    print("\n✨ 제주 매칭 샘플 10개:")
    for it in jeju_matched[:10]:
        print(f"  - [{it['eventSite']}] {it['title']} ({it['eventPeriod']})")


if __name__ == "__main__":
    main()
