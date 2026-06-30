"""
collector_culture.py — 공연/축제 수집 (월 1회 권장)
대상: 서울시API 공연, 제주API, 문체부API 공연(~6만건), 문체부API 축제(~1.4만건)
"""
import asyncio
from collector_base import upsert_items, cleanup_expired
from scraper_seoul_api_concert import scrape_seoul_api_concert
from scraper_jeju_api import scrape_jeju_api
from scraper_culture_api_concert import scrape_culture_api_concert
from scraper_culture_api_festival import scrape_culture_api_festival


async def run_concert():
    print("\n🎭 [공연] 수집 시작")
    try:
        combined = await scrape_seoul_api_concert()
    except Exception as e:
        print(f"  ⚠️ [서울시API] 수집 실패: {e}")
        return
    if combined:
        upsert_items(combined, "공연")
    print("✅ [공연] 완료")


async def run_jeju():
    print("\n🏝️ [제주] 수집 시작")
    try:
        combined = await scrape_jeju_api()
    except Exception as e:
        print(f"  ⚠️ [제주API] 수집 실패: {e}")
        return
    if combined:
        upsert_items(combined, "제주")
    print("✅ [제주] 완료")


async def run_culture_concert():
    print("\n🎭 [문체부API] 공연(서울/제주) 수집 시작")
    try:
        items = await scrape_culture_api_concert()
    except Exception as e:
        print(f"  ⚠️ [문체부API] 공연 수집 실패: {e}")
        return
    if items:
        upsert_items(items)
    print("✅ [문체부API] 공연 완료")


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
    print("🏛️  공연/축제 수집 시작")
    print("=" * 50)
    await run_concert()
    await run_jeju()
    await run_culture_concert()
    await run_festival()
    cleanup_expired()
    print("\n" + "=" * 50)
    print("🏁 공연/축제 수집 완료")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(run_all())
