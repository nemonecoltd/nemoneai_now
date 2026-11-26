"""
collector_cafe_kakao.py — 카카오맵 기반 카페(로스터리 중심) 월간 갱신 (2026-11-26)

지역별 설정(AREAS)만 바꿔 같은 방식으로 쓴다. 지금은 부산만. 제주 카페(collector_naver.py cafe)와 같은 모양으로 저장한다:
category='cafe', 상시 운영(end_date NULL), AI·번역·임베딩 없음, noindex·사이트맵 제외, naver_place_id='kakao_<카카오 장소 번호>'.

매달 한 번 이렇게 맞춘다(C안, TARGET곳 유지):
  선별  카카오맵 검색 풀(최대 500) → 카페만, 대상 지역 주소, 사진·좌표 있음 → 이름이 로스터리인 곳 먼저(리뷰 많은 순) → 나머지는 리뷰 많은 순 → TARGET곳
  신규  선별에 새로 들어온 곳 → 등록(이미지는 우리 저장소로 복사). 삭제 목록(deleted_places_blocklist)에 있는 곳은 건너뜀
  갱신  이미 있는 곳 → 평점·리뷰 수·전화·사진 링크 등 사실 정보만 갱신(이미지는 이미 우리 저장소에 있으면 다시 받지 않음)
  숨김  선별에서 밀려난 곳 → 삭제하지 않고 end_date를 어제로 해서 목록에서 숨김(1년 뒤 자동 삭제 규칙은 기존 그대로)
  복구  숨겨져 있다가 다시 선별에 들어온 곳 → end_date를 비워 다시 노출
안전장치: 검색 풀이 MIN_POOL개 미만이거나, 한 번에 숨길 곳이 너무 많으면(MAX_HIDE_RATIO) 아무것도 바꾸지 않고 알림만 보낸다(일시 장애로 대량 숨김 방지).
"인기"의 기준: 카카오가 주는 리뷰 수(rating_count). 카카오맵 화면의 "인기도순"은 브라우저 전용 경로라 쓰지 않는다.

실행:
  python3 collector_cafe_kakao.py busan                # 시험 실행(계획만 출력, DB·저장소 변경 없음)
  python3 collector_cafe_kakao.py busan --write        # 실제 반영 + 텔레그램 알림
  python3 collector_cafe_kakao.py busan --json 파일     # 받아 둔 카카오 결과(JSON)로 시험
되돌리기(부산 카페 전체): DELETE FROM seongsu_places WHERE region='부산' AND category='cafe' AND naver_place_id LIKE 'kakao_%'
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

AREAS = {
    "busan": {
        "label": "부산",
        "query": "부산로스터리",
        "region": "부산",        # PACE 지역(DB region)
        "city": "부산",          # 카카오 주소의 시·도
        "exclude_districts": set(),   # 서울 강북 확장 때: {"강남구", "서초구", "송파구", "마포구", "성동구"}
        "target": 100,
        "min_pool": 300,          # 검색 풀이 이보다 작으면 이상으로 보고 중단(정상은 약 500)
    },
}
ROASTERY_RE = re.compile(r"로스터|로스팅|roaster|roastery|roasting", re.I)
MAX_HIDE_RATIO = 0.4      # 한 번에 숨길 수 있는 최대 비율(현재 노출 중인 곳 대비)
MAX_HIDE_FLOOR = 30       # 노출 중인 곳이 적어도 이만큼까지는 숨기는 것을 허용


def _f(v) -> float:
    try:
        return float(v or 0)
    except (TypeError, ValueError):
        return 0.0


def district(p: dict) -> str:
    a = (p.get("address") or "").split()
    return a[1] if len(a) > 1 else "?"


def select_candidates(items: list[dict], area: dict) -> list[dict]:
    """카페만·대상 지역·사진·좌표 → 이름이 로스터리인 곳 먼저, 나머지는 리뷰 수 순 → target개."""
    ok = [
        p for p in items
        if p.get("cate_name_depth2") == "카페" and (p.get("address") or "").startswith(area["city"])
        and district(p) not in area["exclude_districts"]
        and p.get("lat") and p.get("lon") and p.get("img") and p.get("confirmid") and p.get("name")
    ]
    ok.sort(key=lambda p: _f(p.get("rating_count")), reverse=True)
    roast = [p for p in ok if ROASTERY_RE.search(p["name"])]
    rest = [p for p in ok if not ROASTERY_RE.search(p["name"])]
    return (roast + rest)[: area["target"]]


def build_content(p: dict) -> str:
    """카카오가 주는 사실 정보만 — AI 문장 없음(제주 카페와 같은 형식, 카카오 링크만)."""
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


def plan_changes(selected: list[dict], existing: list[dict], blocked_ids: set, blocked_titles: set, other_titles: set) -> dict:
    """선별 결과와 DB 현황을 비교해 할 일을 계산한다(DB·네트워크를 쓰지 않는 순수 함수).
    existing: [{id, title, naver_place_id, end_date, image_url, content, link_url, location, latitude, longitude}]
    other_titles: 이 갱신이 관리하는 행이 아닌 다른 장소들의 제목(제목 중복 방지)."""
    by_pid = {r["naver_place_id"]: r for r in existing}
    sel_pids = {f"kakao_{p['confirmid']}" for p in selected}
    out = {"insert": [], "update": [], "unhide": [], "hide": [], "skipped": []}
    seen_titles = set()
    for p in selected:
        pid = f"kakao_{p['confirmid']}"
        row = by_pid.get(pid)
        if row is not None:
            changed = (row["content"] != build_content(p)) or ((row["link_url"] or None) != (p.get("homepage") or None)) \
                or (row["location"] != (p.get("address") or "")) or abs(_f(row["latitude"]) - _f(p.get("lat"))) > 1e-6 \
                or abs(_f(row["longitude"]) - _f(p.get("lon"))) > 1e-6
            if row["end_date"] is not None:
                out["unhide"].append((row, p))
            elif changed:
                out["update"].append((row, p))
            continue
        name = p["name"].strip()
        if pid in blocked_ids or name in blocked_titles:
            out["skipped"].append((name, "삭제 목록"))
        elif name in other_titles or name in seen_titles:
            out["skipped"].append((name, "제목 중복"))
        else:
            seen_titles.add(name)
            out["insert"].append(p)
    out["hide"] = [r for r in existing if r["naver_place_id"] not in sel_pids and r["end_date"] is None]
    return out


def load_existing(conn, region: str) -> list[dict]:
    rows = conn.execute(text("""
        SELECT id, title, naver_place_id, end_date, image_url, content, link_url, location, latitude, longitude
        FROM seongsu_places WHERE region = :r AND category = 'cafe' AND naver_place_id LIKE 'kakao_%'
    """), {"r": region}).fetchall()
    return [dict(r._mapping) for r in rows]


def apply_plan(conn, plan: dict, region: str, rehost) -> dict:
    """계획을 DB에 반영한다. 커밋은 호출한 쪽이 한다(테스트에서 롤백 가능). rehost(url)->우리 저장소 URL."""
    from image_storage import is_internal_url
    n = {"inserted": 0, "updated": 0, "unhidden": 0, "hidden": 0, "failed": 0}
    for p in plan["insert"]:
        try:
            conn.execute(text("""
                INSERT INTO seongsu_places
                (title, title_en, title_zh, title_ja, content, content_en, content_zh, content_ja, location, latitude, longitude,
                 naver_place_id, video_url, image_url, embedding, end_date, date_range, region, category, link_url)
                VALUES (:t, :t, :t, :t, :content, '', '', '', :loc, :lat, :lon, :pid, '', :img, NULL, NULL, '', :region, 'cafe', :link)
            """), {"t": p["name"].strip(), "content": build_content(p), "loc": p.get("address") or "",
                   "lat": _f(p.get("lat")), "lon": _f(p.get("lon")), "pid": f"kakao_{p['confirmid']}",
                   "img": rehost(p["img"]) or "", "region": region, "link": p.get("homepage") or None})
            n["inserted"] += 1
        except Exception as e:  # 한 곳이 실패해도 나머지는 계속
            n["failed"] += 1
            print(f"    ❌ 등록 실패: {p.get('name')} — {str(e)[:100]}")
    for row, p in plan["update"] + plan["unhide"]:
        img = row["image_url"]
        if not img or not is_internal_url(img):      # 사진이 비었거나 외부 주소로 남아 있으면 다시 복사
            img = rehost(p["img"]) or img
        conn.execute(text("""
            UPDATE seongsu_places SET content = :content, link_url = :link, location = :loc, latitude = :lat, longitude = :lon,
                   image_url = :img, end_date = NULL WHERE id = :id
        """), {"content": build_content(p), "link": p.get("homepage") or None, "loc": p.get("address") or "",
               "lat": _f(p.get("lat")), "lon": _f(p.get("lon")), "img": img, "id": row["id"]})
    n["updated"] = len(plan["update"])
    n["unhidden"] = len(plan["unhide"])
    for row in plan["hide"]:
        conn.execute(text("UPDATE seongsu_places SET end_date = CURRENT_DATE - 1 WHERE id = :id AND end_date IS NULL"), {"id": row["id"]})
        n["hidden"] += 1
    return n


def run(area_key: str, write: bool = False, json_path: str | None = None) -> dict:
    area = AREAS[area_key]
    label = area["label"]
    items = json.load(open(json_path, encoding="utf-8")) if json_path else fetch_kakao_places(area["query"], max_pages=50)
    if len(items) < area["min_pool"]:
        msg = f"☕ [{label} 카페 갱신] 카카오 검색 결과가 {len(items)}개뿐이라(정상 약 500개) 중단했습니다. DB는 바꾸지 않았습니다."
        print(msg)
        if write:
            from notification import send_alert
            send_alert(msg)
        return {"aborted": "pool"}
    selected = select_candidates(items, area)
    with engine.connect() as conn:
        existing = load_existing(conn, area["region"])
        blocked_ids, blocked_titles = _load_blocklist(conn)
        conn.commit()
        mine = {r["title"] for r in existing}
        other_titles = {r[0] for r in conn.execute(text("SELECT title FROM seongsu_places"))} - mine
    plan = plan_changes(selected, existing, blocked_ids, blocked_titles, other_titles)
    visible = sum(1 for r in existing if r["end_date"] is None)
    n_roast = sum(1 for p in selected if ROASTERY_RE.search(p["name"]))
    print(f"☕ [{label} 카페] 카카오 {len(items)}개 → 선별 {len(selected)}곳(이름이 로스터리 {n_roast} + 리뷰순 {len(selected) - n_roast}) | 현재 노출 {visible}곳")
    print(f"   신규 {len(plan['insert'])} · 갱신 {len(plan['update'])} · 복구 {len(plan['unhide'])} · 숨김 {len(plan['hide'])} · 건너뜀 {len(plan['skipped'])}")
    for p in plan["insert"]:
        print(f"   + 신규: {p['name']} ({district(p)}, 리뷰 {int(_f(p.get('rating_count')))})")
    for r in plan["hide"]:
        print(f"   - 숨김: {r['title']}")
    for row, p in plan["unhide"]:
        print(f"   ↑ 복구: {row['title']}")
    for name, why in plan["skipped"]:
        print(f"   (건너뜀) {name}: {why}")
    max_hide = max(MAX_HIDE_FLOOR, int(visible * MAX_HIDE_RATIO))
    if len(plan["hide"]) > max_hide:
        msg = f"☕ [{label} 카페 갱신] 숨길 곳이 {len(plan['hide'])}곳으로 한도({max_hide}곳)를 넘어 중단했습니다. DB는 바꾸지 않았습니다. 확인이 필요합니다."
        print(msg)
        if write:
            from notification import send_alert
            send_alert(msg)
        return {"aborted": "hide_limit", "hide": len(plan["hide"])}
    if not write:
        print("시험 실행입니다. DB·저장소는 바꾸지 않았습니다. 반영하려면 --write")
        return {"plan": {k: len(v) for k, v in plan.items()}}

    from image_storage import rehost_image

    def rehost(url):
        time.sleep(0.4)   # 이미지 내려받기 사이 예의상의 간격
        return rehost_image(url, category="cafe")

    with engine.connect() as conn:
        res = apply_plan(conn, plan, area["region"], rehost)
        conn.commit()
    msg = (f"☕ {label} 카페 월간 갱신 완료\n신규 {res['inserted']} · 갱신 {res['updated']} · 복구 {res['unhidden']} · 숨김 {res['hidden']}"
           + (f" · 실패 {res['failed']}" if res["failed"] else "") + f"\n현재 노출 {visible + res['inserted'] + res['unhidden'] - res['hidden']}곳")
    print(msg)
    from notification import send_alert
    send_alert(msg)
    return res


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    key = args[0] if args else "busan"
    if key not in AREAS:
        sys.exit(f"알 수 없는 지역: {key} (가능: {', '.join(AREAS)})")
    jp = sys.argv[sys.argv.index("--json") + 1] if "--json" in sys.argv else None
    if "--json" in sys.argv:
        args = [a for a in args if a != jp]
    if "--write" in sys.argv:
        import run_watchdog
        run_watchdog.arm(f"{AREAS[key]['label']} 카페 갱신", 60 * 60)   # 정상 실행은 몇 분
    run(key, write="--write" in sys.argv, json_path=jp)
