"""
collector_kopis.py — 공연/축제 수집
대상: KOPIS 공연 (연극/뮤지컬/대중음악/서커스,마술 · 서울/제주) — 주 1회, 주말 기점 권장
     문체부API 축제 — 월 1회 권장 (공연보다 갱신 빈도 낮음, 별도 스케줄로 분리 실행)
collector_culture.py 대체 — 공연 소스만 KOPIS로 교체.

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


async def run_concert():
    print("\n🎭 [KOPIS] 공연(서울/제주) 수집 시작")
    try:
        items = await scrape_kopis_concert()
    except Exception as e:
        print(f"  ⚠️ [KOPIS] 공연 수집 실패: {e}")
        send_alert(f"KOPIS 공연 수집 실패\n{e}")
        return
    counts = upsert_items(items) if items else (0, 0, 0)
    cleanup_expired()
    print("✅ [KOPIS] 공연 완료")
    send_alert(f"KOPIS 공연 수집 완료\n신규 {counts[0]} · 갱신 {counts[1]}" + (f" · 실패 {counts[2]}" if counts[2] else ""))


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
