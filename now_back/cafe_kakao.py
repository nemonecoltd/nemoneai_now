"""제주 카페 — 네이버로 먼저 넣은 카페(category='cafe') 중 카카오맵에서 같은 곳을 찾으면 그 카페만 카카오 정보로 보강한다.
(2026-11-04) AI 호출 없음 — 번역·소개문·임베딩 모두 쓰지 않고, 카카오가 주는 사실 정보(카테고리·전화·키워드 태그·평점·리뷰 수·홈페이지)만 정리한다.
매칭이 안 된 카페는 네이버 기본 정보(주소·지도 링크) 그대로 둔다. 카카오에만 있는 곳은 추가하지 않는다.

카카오 검색: search.map.kakao.com/mapsearch/map.daum (scraper_kakao.py와 같은 공개 엔드포인트, 순수 HTTP). 실행: collector_naver.py cafe 가 이어서 호출.
"""
import math
import re
import time
from typing import Optional

import httpx
from sqlalchemy import text

from database import engine

_BASE = "https://search.map.kakao.com/mapsearch/map.daum"
_HEADERS = {
    "User-Agent": ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"),
    "Referer": "https://map.kakao.com/",
}
QUERY = "제주 로스터리 카페"


def fetch_kakao_places(query: str = QUERY, max_pages: int = 20) -> list[dict]:
    """카카오맵 검색 결과 원본(키워드 태그 포함)을 마지막 페이지까지 가져온다(광고는 별도 필드라 섞이지 않음)."""
    items: dict[str, dict] = {}
    with httpx.Client(headers=_HEADERS, timeout=15) as client:
        for page in range(1, max_pages + 1):
            resp = client.get(_BASE, params={"q": query, "msFlag": "S", "sort": 1, "page": page})
            resp.raise_for_status()
            places = resp.json().get("place") or []
            if not places:
                break
            for p in places:
                items.setdefault(str(p.get("confirmid")), p)
            time.sleep(0.3)   # 속도 제한 우회가 아니라 예의상의 간격
    return list(items.values())


def _norm(s: Optional[str]) -> str:
    return re.sub(r"[^\w가-힣]", "", s or "").lower()


def _dist_m(lat1, lon1, lat2, lon2) -> float:
    try:
        la1, lo1, la2, lo2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except (TypeError, ValueError):
        return 1e9
    return math.hypot((la1 - la2) * 111000, (lo1 - lo2) * 111000 * math.cos(math.radians(33.4)))


def match_places(rows: list, kakao: list[dict]) -> dict[int, tuple[dict, float, str]]:
    """DB 카페(row: id,title,latitude,longitude) → 카카오 항목 매칭. 한 카카오 항목은 한 카페에만 붙는다(가까운 순).
    규칙: ① 이름이 같고 400m 이내 ② 한쪽 이름이 다른 쪽을 포함하고 60m 이내. 그 밖에는 매칭하지 않는다(오매칭보다 미매칭이 낫다)."""
    cands = []
    for r in rows:
        tn = _norm(r.title)
        for k in kakao:
            kn = _norm(k.get("name"))
            d = _dist_m(r.latitude, r.longitude, k.get("lat"), k.get("lon"))
            if kn == tn and d < 400:
                cands.append((d, 0, r.id, k, "이름 같음"))
            elif d < 60 and tn and kn and (tn in kn or kn in tn):
                cands.append((d, 1, r.id, k, "이름 포함+근접"))
    cands.sort(key=lambda c: (c[1], c[0]))
    used_r, used_k, out = set(), set(), {}
    for d, _, rid, k, why in cands:
        kid = str(k.get("confirmid"))
        if rid in used_r or kid in used_k:
            continue
        used_r.add(rid); used_k.add(kid)
        out[rid] = (k, d, why)
    return out


def build_content(row, k: dict) -> str:
    """카카오 정보로 구성한 사실 정보 — AI 문장 없음."""
    lines = []
    cate = k.get("last_cate_name") or ""
    if cate:
        lines.append(f"카테고리: {cate}")
    if row.location:
        lines.append(f"주소: {row.location}")
    if k.get("tel"):
        lines.append(f"전화: {k['tel']}")
    kws = [w for w in (k.get("meta_keywords_disp") or "").split("|") if w]
    if kws:
        lines.append("키워드: " + " · ".join(kws))
    if k.get("rating_average") and str(k.get("rating_average")) not in ("0", "0.0"):
        lines.append(f"평점(카카오맵): {k['rating_average']} ({k.get('rating_count') or 0}명)")
    if k.get("reviewCount"):
        lines.append(f"리뷰(카카오맵): {k['reviewCount']}건")
    links = [f"네이버 지도 바로가기: https://map.naver.com/p/entry/place/{row.naver_place_id}"]
    if k.get("confirmid"):
        links.append(f"카카오맵 바로가기: https://place.map.kakao.com/{k['confirmid']}")
    return "\n".join(lines) + "\n\n" + "\n".join(links)


def enrich_cafes_from_kakao(dry_run: bool = False) -> dict:
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT id, title, location, latitude, longitude, naver_place_id FROM seongsu_places WHERE category = 'cafe' AND region = '제주'"
        )).fetchall()
    kakao = fetch_kakao_places()
    matched = match_places(rows, kakao)
    print(f"☕ [카페] DB 카페 {len(rows)}곳 · 카카오 {len(kakao)}곳 → 매칭 {len(matched)}곳 / 미매칭 {len(rows) - len(matched)}곳{' (dry-run)' if dry_run else ''}")
    if not dry_run:
        with engine.connect() as conn:
            for r in rows:
                if r.id not in matched:
                    continue
                k = matched[r.id][0]
                conn.execute(
                    text("UPDATE seongsu_places SET content = :content, link_url = COALESCE(:link, link_url) WHERE id = :id"),
                    {"content": build_content(r, k), "link": k.get("homepage") or None, "id": r.id},
                )
            conn.commit()
    return {"cafes": len(rows), "kakao": len(kakao), "matched": len(matched), "unmatched": len(rows) - len(matched),
            "pairs": [(r.title, matched[r.id][0].get("name"), round(matched[r.id][1]), matched[r.id][2]) for r in rows if r.id in matched]}


if __name__ == "__main__":
    import sys
    res = enrich_cafes_from_kakao(dry_run="--write" not in sys.argv)
    print({k: v for k, v in res.items() if k != "pairs"})
    for t, kn, d, why in res["pairs"]:
        print(f"  {t} ↔ {kn} ({d}m, {why})")
