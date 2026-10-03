"""NOL(world.nol.com) 서울 팝업 목록과 우리 DB를 주 1회 비교해 놓친 팝업을 채워 넣는다
(2026-09-09, launchd com.nemoneai.now.collector-nol 전용 — 정기 수집원이 아니라 갭 체크).

NOL은 좌표/naver_place_id가 없어 직접 DB에 못 만든다. 대신 이미 검증된
collector_kakao.py의 카카오맵 키워드 검색(scrape_kakao_keyword)으로 제목을 재검색해
주소·좌표·카테고리를 확보한 뒤, 상위 검색결과가 NOL 제목과 충분히 비슷할 때만 자동 생성한다.
확신이 안 서는 항목(카카오 미등록 등)은 DB에 만들지 않고 텔레그램으로 "확인 필요" 목록만 보낸다.

NOL 항목 중 아래는 애초에 후보에서 제외:
- neighborhood가 now의 4개 권역(성수/홍대/강남/강북 매핑)에 안 들어가는 것(인천·수원 등 서울 밖)
- 날짜 범위가 없는 'Open'(대개 상시 관광지/장기 투어 — now가 다루는 한시 팝업이 아님)

한 번 '확인 필요'로 보고된 제목은 로컬 캐시 파일에 남겨 다음 주부터 반복 알림하지 않는다
(캐시 파일을 지우면 다시 보고 대상이 됨).
"""
import difflib
import json
import os
import re
import unicodedata
from datetime import date
from pathlib import Path

from database import engine
from sqlalchemy import text

from collector_kakao import upsert_kakao_items
from scraper_kakao import scrape_kakao_keyword
from scraper_nol_festas import scrape_nol_festas
from telegram_admin_bot import TELEGRAM_CHAT_ID, _reply

_SEEN_CACHE_PATH = Path(__file__).parent / "nol_seen_titles.json"

_NEIGHBORHOOD_REGION_MAP = {
    "Seongsu": "성수",
    "Hongik Univ.": "홍대",
    "Gangnam": "강남",
    "Gwanghwamun": "강북",
    "Dongdaemun": "강북",
    "Itaewon": "강북",
    "Myeongdong": "강북",
}
_IN_SCOPE_REGIONS = tuple(set(_NEIGHBORHOOD_REGION_MAP.values()))

# NOL은 대부분 아이돌/연예인 관련 콘텐츠라 해당되면 category_tag='엔터'로 분류(2026-09-09 요청).
# 처음엔 category='엔터'로 넣어 장소>강북 하위에 별도 지역 탭이 생겨버렸다(2026-09-11 발견,
# 사용자 지적) — 이 팝업들은 여전히 '팝업'이라는 콘텐츠 유형(category)이고, 장르만 아이돌/
# 연예인이라는 뜻이라 핫플>카테고리 축(category_tag)에 둬야 맞다. 신뢰할 만한 장르 API가
# 따로 없어 주요 그룹/아티스트명 키워드로만 판별 — 목록에 없는 신인/새 그룹은 놓칠 수 있지만
# (기본값 '종합'으로 남을 뿐 오분류는 아님), 새 그룹이 눈에 띄면 추가할 것.
_IDOL_KEYWORDS = [
    "bigbang", "big bang", "blackpink", "aespa", "ive", "anyujin", "an yu-jin", "jangwonyoung", "jang won-young",
    "enhypen", "nct", "txt", "tomorrow x together", "taemin", "cortis", "g-dragon", "gdragon", "and team", "&team",
    "exo", "twice", "seventeen", "stray kids", "le sserafim", "newjeans", "riize", "zerobaseone", "boynextdoor",
    "i-dle", "(g)i-dle", "itzy", "kep1er", "nmixx", "illit", "babymonster",
]


def _is_entertainment(title: str, subtitle: str) -> bool:
    haystack = f"{title} {subtitle}".lower()
    return any(kw in haystack for kw in _IDOL_KEYWORDS)


_KAKAO_MATCH_THRESHOLD = 0.5
_DB_MATCH_THRESHOLD = 0.8


def _normalize(s: str) -> str:
    s = unicodedata.normalize("NFKC", s or "").lower()
    return re.sub(r"[^0-9a-z가-힣]", "", s)


def _load_seen() -> set:
    try:
        return set(json.loads(_SEEN_CACHE_PATH.read_text(encoding="utf-8")))
    except Exception:
        return set()


def _save_seen(seen: set) -> None:
    _SEEN_CACHE_PATH.write_text(json.dumps(sorted(seen), ensure_ascii=False, indent=2), encoding="utf-8")


def _existing_db_titles() -> list[str]:
    # NOL은 영문 제목만 주는데 우리 DB는 한글 title로 저장돼 있어 title만 비교하면 놓친다
    # (2026-09 BIGBANG 전시 중복 생성 사고) — 이미 번역해둔 title_en도 같이 비교 풀에 넣는다.
    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT title, title_en FROM seongsu_places WHERE region = ANY(:regions)"),
            {"regions": list(_IN_SCOPE_REGIONS)},
        ).fetchall()
    titles = []
    for r in rows:
        titles.append(r[0])
        if r[1]:
            titles.append(r[1])
    return titles


def _parse_nol_date_range(date_text: str, today: date):
    """NOL의 'M.D – M.D'(연도 없음)를 places.py 어드민 파서와 동일한
    'YYYY.MM.DD. ~ YYYY.MM.DD.' 포맷 + end_date로 변환. 연도는 오늘 기준으로 추정하고,
    끝월이 시작월보다 작으면(연말→연초 이월) 끝 연도만 +1."""
    m = re.search(r"(\d{1,2})\.(\d{1,2})\s*[–-]\s*(\d{1,2})\.(\d{1,2})", date_text or "")
    if not m:
        return None
    sm, sd, em, ed = map(int, m.groups())
    try:
        start = date(today.year, sm, sd)
        end = date(today.year + (1 if em < sm else 0), em, ed)
    except ValueError:
        return None
    return f"{start.strftime('%Y.%m.%d.')} ~ {end.strftime('%Y.%m.%d.')}", end


def _apply_nol_dates(naver_place_id: str, date_text: str) -> None:
    parsed = _parse_nol_date_range(date_text, date.today())
    if not parsed:
        return
    date_range, end_date = parsed
    with engine.connect() as conn:
        conn.execute(
            text("UPDATE seongsu_places SET date_range = :dr, end_date = :ed WHERE naver_place_id = :npid"),
            {"dr": date_range, "ed": end_date, "npid": naver_place_id},
        )
        conn.commit()


def _best_ratio(target_norm: str, candidates_norm: list[str]) -> float:
    best = 0.0
    for c in candidates_norm:
        if not c:
            continue
        r = difflib.SequenceMatcher(None, target_norm, c).ratio()
        if target_norm in c or c in target_norm:
            r = max(r, 0.9)
        best = max(best, r)
    return best


def run_nol_compare() -> dict:
    nol_items = scrape_nol_festas()
    db_titles_norm = [_normalize(t) for t in _existing_db_titles()]
    seen = _load_seen()

    missing = []
    for item in nol_items:
        region = _NEIGHBORHOOD_REGION_MAP.get((item["neighborhood"] or "").strip())
        if not region or not item["has_date_range"]:
            continue
        title_norm = _normalize(item["title"])
        if not title_norm or title_norm in seen:
            continue
        if _best_ratio(title_norm, db_titles_norm) >= _DB_MATCH_THRESHOLD:
            continue
        missing.append({**item, "region": region, "title_norm": title_norm})

    auto_added: list[str] = []
    needs_review: list[str] = []

    for item in missing:
        try:
            kakao_results = scrape_kakao_keyword(item["title"])
        except Exception as e:
            print(f"⚠️ [NOL비교] 카카오 검색 실패 '{item['title']}': {e}")
            kakao_results = []

        best_match = None
        best_ratio = 0.0
        for r in kakao_results:
            ratio = difflib.SequenceMatcher(None, item["title_norm"], _normalize(r["title"])).ratio()
            if ratio > best_ratio:
                best_ratio, best_match = ratio, r

        if best_match and best_ratio >= _KAKAO_MATCH_THRESHOLD:
            category_tag = "엔터" if _is_entertainment(item["title"], item["subtitle"]) else None
            result = upsert_kakao_items([best_match], None, item["region"], category_tag=category_tag)
            if result["new"] > 0:
                # 카카오 수집은 원래 상시매장 전제라 end_date를 NULL로 남기는데, NOL 항목은
                # 실제로 기간제 팝업/전시라 방치하면 마감돼도 영구 노출된다 — NOL 날짜로 덮어써서 동기화.
                _apply_nol_dates(f"kakao_{best_match['kakao_place_id']}", item["date_text"])
                auto_added.append(f"{item['title']} ({item['region']})")
            else:
                needs_review.append(item["title"])
        else:
            needs_review.append(item["title"])

        seen.add(item["title_norm"])

    _save_seen(seen)

    lines = ["📋 [NOL 팝업 갭체크] 이번 주 결과"]
    lines.append(f"자동 추가 {len(auto_added)}개, 확인 필요 {len(needs_review)}개")
    if auto_added:
        lines.append("\n✅ 자동 추가:")
        lines += [f"  - {t}" for t in auto_added]
    if needs_review:
        lines.append("\n❓ 확인 필요(카카오 미검색/제목 불일치 — 필요하면 /kakao 로 직접 추가):")
        lines += [f"  - {t}" for t in needs_review]
    message = "\n".join(lines)
    print(message)

    if TELEGRAM_CHAT_ID:
        _reply(TELEGRAM_CHAT_ID, message)

    return {"auto_added": auto_added, "needs_review": needs_review}


if __name__ == "__main__":
    run_nol_compare()
