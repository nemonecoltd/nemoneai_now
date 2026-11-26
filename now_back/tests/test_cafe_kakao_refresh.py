"""카카오 카페 월간 갱신(collector_cafe_kakao) — 선별·계획 계산(순수 함수)과 반영(롤백되는 트랜잭션, 가짜 지역).
실행: PYTHONPATH=. python tests/test_cafe_kakao_refresh.py  (matmatch venv). 로컬 DB는 운영 프록시이므로 DB 테스트는 반드시 롤백한다."""
import datetime

from sqlalchemy import text

import collector_cafe_kakao as cc
from database import engine

AREA = {"label": "시험", "query": "x", "region": "시험지역", "city": "부산", "exclude_districts": set(), "target": 4, "min_pool": 1}


def mk(i, name, reviews, gu="해운대구", city="부산", cate="카페", img="http://i/x.jpg"):
    return {"confirmid": str(9000 + i), "name": name, "address": f"{city} {gu} 어딘가 {i}", "lat": 35.1 + i / 1000, "lon": 129.1,
            "img": img, "cate_name_depth2": cate, "rating_count": reviews, "rating_average": 4.2, "homepage": f"http://h/{i}",
            "last_cate_name": "커피전문점"}


def row(p, end_date=None, content=None, image="https://storage.googleapis.com/nemoneai-thumbnails/now-popup/x.webp"):
    return {"id": 1, "title": p["name"], "naver_place_id": f"kakao_{p['confirmid']}", "end_date": end_date, "image_url": image,
            "content": content if content is not None else cc.build_content(p), "link_url": p["homepage"], "location": p["address"],
            "latitude": p["lat"], "longitude": p["lon"]}


def test_select_roastery_first_then_reviews():
    items = [mk(1, "인기카페A", 900), mk(2, "작은로스터리", 3), mk(3, "인기카페B", 800), mk(4, "큰 커피로스터스", 50), mk(5, "인기카페C", 700),
             mk(6, "식당", 9999, cate="음식점"), mk(7, "서울카페", 5000, city="서울"), mk(8, "사진없음로스터리", 400, img="")]
    names = [p["name"] for p in cc.select_candidates(items, AREA)]
    assert names == ["큰 커피로스터스", "작은로스터리", "인기카페A", "인기카페B"], names      # 로스터리 먼저(리뷰순) → 나머지 리뷰순, 비카페·타지역·사진없음 제외, 4곳 상한


def test_exclude_districts():
    area = dict(AREA, exclude_districts={"수영구"})
    items = [mk(1, "A", 10, gu="수영구"), mk(2, "B", 5, gu="중구")]
    assert [p["name"] for p in cc.select_candidates(items, area)] == ["B"]


def test_plan_insert_update_unhide_hide_skip():
    a, b, c, d, e, f = (mk(i, n, 10) for i, n in enumerate(["유지", "갱신", "복구", "탈락", "신규", "삭제목록"], 1))
    stale = dict(row(b), content="옛 내용")
    existing = [row(a), stale, row(c, end_date=datetime.date(2026, 11, 1)), row(d)]
    plan = cc.plan_changes([a, b, c, e, f], existing, {"kakao_" + f["confirmid"]}, set(), set())
    assert [p["name"] for p in plan["insert"]] == ["신규"]
    assert [r["title"] for r, _ in plan["update"]] == ["갱신"]             # 내용이 바뀐 곳만(유지는 변경 없음 → 쓰기 없음)
    assert [r["title"] for r, _ in plan["unhide"]] == ["복구"]
    assert [r["title"] for r in plan["hide"]] == ["탈락"]
    assert plan["skipped"] == [("삭제목록", "삭제 목록")]


def test_plan_title_duplicate_skipped_and_hidden_not_rehidden():
    a, b = mk(1, "같은이름", 10), mk(2, "같은이름", 9)
    plan = cc.plan_changes([a, b], [], set(), set(), set())
    assert len(plan["insert"]) == 1 and plan["skipped"] == [("같은이름", "제목 중복")]
    gone = row(mk(3, "이미숨김", 1), end_date=datetime.date(2026, 11, 1))
    assert cc.plan_changes([], [gone], set(), set(), set())["hide"] == []     # 이미 숨겨진 곳은 다시 숨기지 않는다


def test_apply_plan_roundtrip_rolled_back():
    conn = engine.connect()
    trans = conn.begin()
    try:
        calls = []
        rehost = lambda url: (calls.append(url) or "https://storage.googleapis.com/nemoneai-thumbnails/now-popup/test.webp")
        a, b = mk(1, "시험카페갑", 10), mk(2, "시험카페을", 5)
        cc.apply_plan(conn, cc.plan_changes([a, b], [], set(), set(), set()), AREA["region"], rehost)
        ex = {r["title"]: r for r in cc.load_existing(conn, AREA["region"])}
        assert set(ex) == {"시험카페갑", "시험카페을"} and all(r["end_date"] is None for r in ex.values()) and len(calls) == 2
        # 2회차: 을이 선별에서 밀려남, 갑은 평점이 바뀜, 병이 새로 들어옴
        a2, c = dict(a, rating_average=4.9), mk(3, "시험카페병", 7)
        plan = cc.plan_changes([a2, c], list(ex.values()), set(), set(), set())
        res = cc.apply_plan(conn, plan, AREA["region"], rehost)
        assert (res["inserted"], res["updated"], res["hidden"], res["unhidden"]) == (1, 1, 1, 0), res
        ex = {r["title"]: r for r in cc.load_existing(conn, AREA["region"])}
        assert ex["시험카페을"]["end_date"] == datetime.date.today() - datetime.timedelta(days=1)    # 숨김 = 어제 종료
        assert "4.9" in ex["시험카페갑"]["content"] and ex["시험카페병"]["end_date"] is None
        assert len(calls) == 3, calls                                    # 기존 곳은 이미지를 다시 받지 않는다(신규 1회만 추가)
        # 3회차: 을이 다시 선별에 들어옴 → 복구
        plan = cc.plan_changes([a2, c, b], list(ex.values()), set(), set(), set())
        res = cc.apply_plan(conn, plan, AREA["region"], rehost)
        assert res["unhidden"] == 1 and {r["title"]: r for r in cc.load_existing(conn, AREA["region"])}["시험카페을"]["end_date"] is None
        # 숨김 상태는 목록 필터(end_date IS NULL OR >= 오늘)에서 빠진다
        conn.execute(text("UPDATE seongsu_places SET end_date = CURRENT_DATE - 1 WHERE region = :r AND title = '시험카페갑'"), {"r": AREA["region"]})
        vis = conn.execute(text("SELECT count(*) FROM seongsu_places WHERE region = :r AND category='cafe' AND (end_date IS NULL OR end_date >= CURRENT_DATE)"), {"r": AREA["region"]}).scalar()
        assert vis == 2
    finally:
        trans.rollback()
        conn.close()


if __name__ == "__main__":
    n = 0
    for k, v in sorted(globals().items()):
        if k.startswith("test_") and callable(v):
            v(); n += 1; print("ok", k)
    print(n, "passed")
