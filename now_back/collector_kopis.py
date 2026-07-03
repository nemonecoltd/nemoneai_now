"""
collector_kopis.py — 공연/축제 수집 (월 1회 권장)
대상: KOPIS 공연 (연극/뮤지컬/대중음악/서커스,마술 · 서울/제주), 문체부API 축제
collector_culture.py 대체 — 공연 소스만 KOPIS로 교체, 축제는 추후 별도 업데이트 예정.
"""
import asyncio
from collector_base import upsert_items, cleanup_expired
from scraper_kopis_concert import scrape_kopis_concert
from scraper_culture_api_festival import scrape_culture_api_festival


async def run_concert():
    print("\n🎭 [KOPIS] 공연(서울/제주) 수집 시작")
    try:
        items = await scrape_kopis_concert()
    except Exception as e:
        print(f"  ⚠️ [KOPIS] 공연 수집 실패: {e}")
        return
    if items:
        upsert_items(items)
    print("✅ [KOPIS] 공연 완료")


async def run_festival():
    print("\n🎪 [축제] 수집 시작")
    try:
        items = await scrape_culture_api_festival()
    except Exception as e:
        print(f"  ⚠️ [축제API] 수집 실패: {e}")
        return
    if items:
        upsert_items(items)
    print("✅ [축제] 완료")


async def run_all():
    print("=" * 50)
    print("🏛️  공연(KOPIS)/축제 수집 시작")
    print("=" * 50)
    await run_concert()
    await run_festival()
    cleanup_expired()
    print("\n" + "=" * 50)
    print("🏁 공연/축제 수집 완료")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(run_all())
