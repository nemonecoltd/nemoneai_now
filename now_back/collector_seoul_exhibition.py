"""
collector_seoul_exhibition.py — 서울시 전시/미술 정보 수집 (주 1회, 매주 월요일 14시 권장)
scraper_seoul_exhibition.py로 수집한 결과를 DB에 반영.
"""
import asyncio
from collector_base import upsert_items, cleanup_expired
from scraper_seoul_exhibition import scrape_seoul_exhibition
from notification import send_alert


async def run_all():
    print("=" * 50)
    print("🖼️  서울시 전시/미술 수집 시작")
    print("=" * 50)
    try:
        items = await scrape_seoul_exhibition()
    except Exception as e:
        print(f"  ⚠️ 수집 실패: {e}")
        items = []

    new_count = updated_count = fail_count = 0
    if items:
        new_count, updated_count, fail_count = upsert_items(items, region="강북")

    cleanup_expired()
    print("\n" + "=" * 50)
    print(f"🏁 완료 — 신규 {new_count} / 갱신 {updated_count} / 실패 {fail_count}")
    print("=" * 50)
    send_alert(
        f"서울시 전시/미술 수집 완료\n신규 {new_count} · 갱신 {updated_count}"
        + (f" · 실패 {fail_count}" if fail_count else "")
    )


if __name__ == "__main__":
    asyncio.run(run_all())
