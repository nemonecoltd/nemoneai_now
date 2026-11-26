"""
collector_busan_cafe_kakao.py — 부산 카페(로스터리 중심) 수집, 카카오맵만 사용 (2026-11-26)

제주 카페(collector_naver.run_cafe + cafe_kakao)와 같은 모양으로 저장한다 — category='cafe', 상시 운영(end_date NULL), AI·번역·임베딩 없음,
noindex·사이트맵 제외(카페 카테고리 규칙). 다른 점: 네이버 없이 카카오맵 검색 결과(주소·좌표·대표 사진·평점·리뷰 수)만으로 만들고,
naver_place_id 칸에는 'kakao_<카카오 장소 번호>'를 넣는다(상세 페이지가 이 접두어를 보고 카카오맵 링크를 보여 준다).

선별(C안): 카페만 → 이름이 로스터리(로스터·로스팅·roaster…)인 곳을 먼저 모두, 그다음 카카오 리뷰 수 많은 순으로 채워 총 TARGET개.
이미 DB에 있는 곳(같은 카카오 번호·같은 제목)과 관리자가 삭제한 곳(deleted_places_blocklist)은 건너뛴다.
이미지는 제주 카페와 같이 우리 저장소로 복사(rehost_image)한다 — 가게가 공개한 대표 사진이며, 삭제 요청이 오면 즉시 삭제(블록리스트 등록 + 이미지 삭제).

실행:
  python3 collector_busan_cafe_kakao.py                 # 시험 실행: 카카오에서 읽고 선별 목록만 출력(DB·저장소 변경 없음)
  python3 collector_busan_cafe_kakao.py --json 파일      # 시험 실행: 이미 받아 둔 카카오 결과(JSON)로 선별
  python3 collector_busan_cafe_kakao.py --write         # 실제 저장
되돌리기: DELETE FROM seongsu_places WHERE region='부산' AND category='cafe' AND naver_place_id LIKE 'kakao_%'  (이미지는 삭제 시 delete_image 필요)
"""
from __future__ import annotations

import json
import re
import sys
import time

from sqlalchemy import text

from cafe_kakao import fetch_kakao_places
from collector_base import _load_blocklist
from database import engine
from image_storage import rehost_image

QUERY = "부산로스터리"
REGION = "부산"
TARGET = 100
ROASTERY_RE = re.compile(r"로스터|로스팅|roaster|roastery|roasting", re.I)


def _f(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def _gu(p: dict) -> str:
    a = (p.get("address") or "").split()
    return " ".join(a[:2]) if len(a) > 1 else (a[0] if a else "?")


def select_candidates(items: list[dict]) -> list[dict]:
    """카페만, 부산 주소·좌표·사진이 있는 곳 → 이름이 로스터리인 곳 먼저, 나머지는 리뷰 수 순으로 TARGET개."""
    ok = [
        p for p in items
        if p.get("cate_name_depth2") == "카페" and "부산" in (p.get("address") or "")
        and p.get("lat") and p.get("lon") and p.get("img") and p.get("confirmid") and p.get("name")
    ]
    ok.sort(key=lambda p: _f(p.get("rating_count")), reverse=True)
    roast = [p for p in ok if ROASTERY_RE.search(p["name"])]
    rest = [p for p in ok if not ROASTERY_RE.search(p["name"])]
    picked = (roast + rest)[:TARGET]
    return picked


def build_content(p: dict) -> str:
    """카카오가 주는 사실 정보만 — AI 문장 없음(제주 카페 cafe_kakao.build_content와 같은 형식, 카카오 링크만)."""
    lines = []
    if p.get("last_cate_name"):
        lines.append(f"카테고리: {p['last_cate_name']}")
    if p.get("address"):
        lines.append(f"주소: {p['address']}")
    if p.get("tel"):
        lines.append(f"전화: {p['tel']}")
    kws = [w for w in (p.get("meta_keywords_disp") or "").split("|") if w]
    if kws:
        lines.append("키워드: " + " · ".join(kws))
    if _f(p.get("rating_average")) > 0:
        lines.append(f"평점(카카오맵): {p['rating_average']} ({p.get('rating_count') or 0}명)")
    if p.get("reviewCount"):
        lines.append(f"리뷰(카카오맵): {p['reviewCount']}건")
    return "\n".join(lines) + f"\n\n카카오맵 바로가기: https://place.map.kakao.com/{p['confirmid']}"


def run(write: bool = False, json_path: str | None = None) -> dict:
    items = json.load(open(json_path, encoding="utf-8")) if json_path else fetch_kakao_places(QUERY, max_pages=50)
    picked = select_candidates(items)
    with engine.connect() as conn:
        blocked_ids, blocked_titles = _load_blocklist(conn)
        conn.commit()
        have_ids = {r[0] for r in conn.execute(text("SELECT naver_place_id FROM seongsu_places WHERE naver_place_id LIKE 'kakao_%'"))}
        have_titles = {r[0] for r in conn.execute(text("SELECT title FROM seongsu_places"))}
    todo, skipped = [], []
    seen_titles = set()
    for p in picked:
        pid = f"kakao_{p['confirmid']}"
        name = p["name"].strip()
        if pid in have_ids or pid in blocked_ids or name in have_titles or name in blocked_titles or name in seen_titles:
            skipped.append((name, "이미 있음/삭제됨/중복"))
            continue
        seen_titles.add(name)
        todo.append(p)
    n_roast = sum(1 for p in todo if ROASTERY_RE.search(p["name"]))
    print(f"카카오 {len(items)}개 → 선별 {len(picked)}개 → 신규 등록 대상 {len(todo)}개 (이름이 로스터리 {n_roast} + 리뷰순 {len(todo) - n_roast}), 건너뜀 {len(skipped)}")
    for i, p in enumerate(todo, 1):
        tag = "로스터리" if ROASTERY_RE.search(p["name"]) else "인기"
        print(f"  {i:3d}. [{tag}] {p['name']} · {_gu(p)} · 리뷰 {int(_f(p.get('rating_count')))} · 평점 {p.get('rating_average')}")
    for name, why in skipped:
        print(f"  (건너뜀) {name}: {why}")
    if not write:
        print("시험 실행입니다. DB·저장소는 바꾸지 않았습니다. 저장하려면 --write")
        return {"planned": len(todo), "written": 0}

    written = failed = 0
    for p in todo:
        pid = f"kakao_{p['confirmid']}"
        try:
            image = rehost_image(p["img"], category="cafe") or ""
            with engine.connect() as conn:
                conn.execute(text("""
                    INSERT INTO seongsu_places
                    (title, title_en, title_zh, title_ja, content, content_en, content_zh, content_ja, location, latitude, longitude,
                     naver_place_id, video_url, image_url, embedding, end_date, date_range, region, category, link_url)
                    VALUES
                    (:t, :t, :t, :t, :content, '', '', '', :loc, :lat, :lon,
                     :pid, '', :img, NULL, NULL, '', :region, 'cafe', :link)
                """), {
                    "t": p["name"].strip(), "content": build_content(p), "loc": p.get("address") or "",
                    "lat": _f(p.get("lat")), "lon": _f(p.get("lon")), "pid": pid, "img": image, "region": REGION,
                    "link": p.get("homepage") or None,
                })
                conn.commit()
            written += 1
            print(f"    ✅ 저장 {written}/{len(todo)}: {p['name']}")
        except Exception as e:  # 한 곳이 실패해도 나머지는 계속
            failed += 1
            print(f"    ❌ 저장 실패: {p.get('name')} — {str(e)[:120]}")
        time.sleep(0.4)   # 이미지 내려받기·저장 사이 예의상의 간격
    print(f"완료: 저장 {written} · 실패 {failed}")
    return {"planned": len(todo), "written": written, "failed": failed}


if __name__ == "__main__":
    args = sys.argv[1:]
    jp = args[args.index("--json") + 1] if "--json" in args else None
    run(write="--write" in args, json_path=jp)
