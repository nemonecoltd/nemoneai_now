"""
collector_kopis.py — 공연/축제 수집
대상: KOPIS 공연 (연극/뮤지컬/대중음악/서커스,마술 · 서울) — 주 1회, 주말 기점 권장
     문체부API 축제 — 월 1회 권장 (공연보다 갱신 빈도 낮음, 별도 스케줄로 분리 실행)
collector_culture.py 대체 — 공연 소스만 KOPIS로 교체.
제주는 더 이상 KOPIS로 수집하지 않음(2026-07-21) — scraper_visitjeju.py(비짓제주 API)로 대체,
기존 kopis_ 접두 제주 행 SEO 색인 보존을 위해 DB엔 남아있지만 목록에는 노출 안 됨(main.py 참고).

실행:
  python3 collector_kopis.py concert   # 공연만 (주 1회, 주말 기점)
  python3 collector_kopis.py festival  # 축제만 (월 1회)
  python3 collector_kopis.py          # 둘 다 (인자 없이 실행 시)
"""
import asyncio
import sys
from collector_base import upsert_items, cleanup_expired
from scraper_kopis_concert import scrape_kopis_concert
from scraper_culture_api_festival import scrape_culture_api_festival
from notification import send_alert


# 직전까지 DB에 있는 "진행 중/예정" KOPIS 공연 수 대비 이 비율 미만이면 불완전 수집으로 본다.
# 정상 실행은 목록이 보통 DB 진행 중 건수와 비슷하거나 더 많다(2026-10-14 기준 정상 1,100~1,200건, 불완전 97~100건).
INCOMPLETE_RATIO = 0.3
RECOLLECT_WAIT_SEC = 90


def _active_kopis_count() -> int:
    from sqlalchemy import text
    from database import engine
    with engine.connect() as conn:
        return conn.execute(text("""
            SELECT count(*) FROM seongsu_places
            WHERE naver_place_id LIKE 'kopis_%' AND region = '공연' AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        """)).scalar() or 0


def _assess(n_items: int, baseline: int) -> tuple[bool, str]:
    """수집 결과가 불완전한지와 사유. 목록 조회 실패가 있거나, 기존 DB 진행 중 건수 대비 너무 적으면 불완전."""
    import scraper_kopis_concert as sc
    st = sc.LAST_STATS
    reasons = []
    if st.get("list_failures"):
        reasons.append(f"목록 조회 실패 {st['list_failures']}회")
    if baseline >= 200 and n_items < baseline * INCOMPLETE_RATIO:
        reasons.append(f"수집 {n_items}건 < DB 진행 중 {baseline}건의 {int(INCOMPLETE_RATIO * 100)}%")
    return bool(reasons), " · ".join(reasons)


async def run_concert():
    print("\n🎭 [KOPIS] 공연(서울) 수집 시작")
    import scraper_kopis_concert as sc
    try:
        baseline = _active_kopis_count()
    except Exception as e:  # DB 확인 실패가 수집 자체를 막지 않게
        print(f"  ⚠️ [KOPIS] 기존 건수 조회 실패(불완전 판정 일부 생략): {e}")
        baseline = 0

    items, incomplete, why = [], False, ""
    for attempt in (1, 2):
        try:
            items = await scrape_kopis_concert()
        except Exception as e:
            print(f"  ⚠️ [KOPIS] 공연 수집 실패: {e}")
            send_alert(f"KOPIS 공연 수집 실패\n{e}")
            return
        incomplete, why = _assess(len(items), baseline)
        if not incomplete:
            break
        if attempt == 1:
            print(f"  ⚠️ [KOPIS] 불완전 수집 감지({why}) — {RECOLLECT_WAIT_SEC}초 뒤 한 번 더 수집합니다.")
            await asyncio.sleep(RECOLLECT_WAIT_SEC)

    # 불완전해도 받은 만큼은 저장한다(업서트라 안전) — 다만 알림에서 "완료"와 구분한다.
    counts = upsert_items(items) if items else (0, 0, 0)
    cleanup_expired()
    st = sc.LAST_STATS
    print("✅ [KOPIS] 공연 완료" if not incomplete else "⚠️ [KOPIS] 공연 불완전 수집")
    body = f"신규 {counts[0]} · 갱신 {counts[1]}" + (f" · 실패 {counts[2]}" if counts[2] else "")
    if st.get("detail_failures"):
        body += f"\n상세 조회 실패 {st['detail_failures']}건"
    if incomplete:
        send_alert(f"⚠️ KOPIS 공연 수집 불완전 — 재실행 필요\n{body}\n사유: {why}\n"
                   f"(python3 collector_kopis.py concert 로 다시 실행)")
    else:
        send_alert(f"KOPIS 공연 수집 완료\n{body}")


async def run_festival():
    print("\n🎪 [축제] 수집 시작")
    try:
        items = await scrape_culture_api_festival()
    except Exception as e:
        print(f"  ⚠️ [축제API] 수집 실패: {e}")
        send_alert(f"축제 수집 실패\n{e}")
        return
    counts = upsert_items(items) if items else (0, 0, 0)
    cleanup_expired()
    print("✅ [축제] 완료")
    send_alert(f"축제 수집 완료\n신규 {counts[0]} · 갱신 {counts[1]}" + (f" · 실패 {counts[2]}" if counts[2] else ""))


async def run_all():
    print("=" * 50)
    print("🏛️  공연(KOPIS)/축제 수집 시작")
    print("=" * 50)
    await run_concert()
    await run_festival()
    print("\n" + "=" * 50)
    print("🏁 공연/축제 수집 완료")
    print("=" * 50)


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "all"
    if target == "concert":
        asyncio.run(run_concert())
    elif target == "festival":
        asyncio.run(run_festival())
    else:
        asyncio.run(run_all())
