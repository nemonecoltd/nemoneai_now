"""텔레그램으로 플레이스 ID만 보내면 블로그갱신(pcmap 스크래핑 + Gemini 소개 재생성)을 트리거.
로컬 전용(Playwright가 로컬에만 설치돼 있음) — main.py가 TELEGRAM_BOT_ENABLED=true일 때만 폴링 스레드를 띄움.
프로덕션 서버에서 같이 폴링하면 getUpdates가 충돌하고 어차피 Playwright도 없어서 반드시 로컬 전용으로 게이트해야 함.
"""
import os
import threading
import time
from typing import Optional

import requests

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID")
_BASE = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"


def _reply(chat_id: str, text: str) -> None:
    try:
        requests.post(f"{_BASE}/sendMessage", json={"chat_id": chat_id, "text": text}, timeout=10)
    except Exception as e:
        print(f"[telegram_admin_bot] 응답 전송 실패: {e}")


def _handle_place_id(chat_id: str, place_id: int, enrich_place_sync) -> None:
    _reply(chat_id, f"⏳ #{place_id} 블로그갱신 시작...")
    try:
        result = enrich_place_sync(place_id)
        preview = (result.get("content") or "")[:300]
        review_count = len(result.get("blog_reviews") or [])
        _reply(chat_id, f"✅ #{place_id} 갱신 완료 (블로그후기 {review_count}건)\n\n{preview}")
    except ValueError as e:
        _reply(chat_id, f"❌ #{place_id} 실패: {e}")
    except Exception as e:
        _reply(chat_id, f"❌ #{place_id} 실패: {e}")


def _handle_favorite(chat_id: str, url: str, region: str, category: str, run_favorite_sync) -> None:
    _reply(chat_id, f"⏳ [{region}/{category}] 즐겨찾기 폴더 수집 시작...\n{url}")
    try:
        result = run_favorite_sync(url, region, category)
        if result["total"] == 0:
            _reply(chat_id, "⚠️ 폴더에서 장소를 찾지 못했습니다. URL을 확인해주세요.")
            return
        titles = result["titles"]
        preview = "\n".join(f"- {t}" for t in titles[:10])
        more = f"\n... 외 {len(titles) - 10}개" if len(titles) > 10 else ""
        summary = f"총 {result['total']}개 (신규 {result['new']} / 갱신 {result['updated']}"
        if result["failed"]:
            summary += f" / 실패 {result['failed']}"
        summary += ")"
        theme_note = f"\n\n🗺️ 테마지도 자동 생성됨(id={result['theme_id']})" if result.get("theme_id") else ""
        _reply(chat_id, f"✅ [{region}/{category}] 즐겨찾기 수집 완료\n{summary}\n\n{preview}{more}{theme_note}")
    except Exception as e:
        _reply(chat_id, f"❌ 즐겨찾기 수집 실패: {e}")


def _handle_kakao(chat_id: str, keyword: str, category: str, region: Optional[str], run_kakao_sync) -> None:
    label = region or "auto(구 자동매핑, 미매핑 구는 강북)"
    _reply(chat_id, f"⏳ [{label}/{category}] 카카오맵 '{keyword}' 수집 시작...")
    try:
        result = run_kakao_sync(keyword, category, region)
        if result["total"] == 0:
            _reply(chat_id, "⚠️ 검색 결과가 없습니다.")
            return
        titles = result["titles"]
        preview = "\n".join(f"- {t}" for t in titles[:10])
        more = f"\n... 외 {len(titles) - 10}개" if len(titles) > 10 else ""
        summary = f"총 {result['total']}개 (신규 {result['new']} / 갱신 {result['updated']}"
        if result["failed"]:
            summary += f" / 실패 {result['failed']}"
        summary += ")"
        theme_note = f"\n\n🗺️ 테마지도 자동 생성됨(id={result['theme_id']})" if result.get("theme_id") else ""
        _reply(chat_id, f"✅ [{label}/{category}] 카카오맵 수집 완료\n{summary}\n\n{preview}{more}{theme_note}")
    except Exception as e:
        _reply(chat_id, f"❌ 카카오맵 수집 실패: {e}")


def _poll_loop(enrich_place_sync, run_favorite_sync, run_kakao_sync) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[telegram_admin_bot] TELEGRAM_BOT_TOKEN/CHAT_ID 미설정 — 봇 비활성화")
        return
    print("[telegram_admin_bot] 폴링 시작 — 플레이스 ID: 블로그갱신 / /fav: 즐겨찾기 폴더 수집 / /kakao: 카카오맵 키워드 수집")
    offset = 0
    while True:
        try:
            r = requests.get(f"{_BASE}/getUpdates", params={"offset": offset, "timeout": 30}, timeout=35)
            data = r.json()
            for update in data.get("result", []):
                offset = update["update_id"] + 1
                msg = update.get("message") or {}
                chat_id = str((msg.get("chat") or {}).get("id", ""))
                text = (msg.get("text") or "").strip()
                if chat_id != str(TELEGRAM_CHAT_ID):
                    continue  # 등록된 chat_id 아니면 무시 (인증되지 않은 사용자가 봇을 알아도 트리거 불가)
                if text.lstrip("#").isdigit():
                    _handle_place_id(chat_id, int(text.lstrip("#")), enrich_place_sync)
                elif text.startswith("/fav"):
                    parts = text[len("/fav"):].strip().split()
                    if len(parts) < 2:
                        _reply(chat_id, "형식: /fav <즐겨찾기폴더URL> <지역> [카테고리]\n예) /fav https://map.naver.com/p/favorite/.../folder/xxxx 제주 shopping\n카테고리 생략 시 기본값 shopping")
                    else:
                        url, region = parts[0], parts[1]
                        category = parts[2] if len(parts) > 2 else "shopping"
                        _handle_favorite(chat_id, url, region, category, run_favorite_sync)
                elif text.startswith("/kakao"):
                    parts = text[len("/kakao"):].strip().split()
                    if len(parts) < 2:
                        _reply(
                            chat_id,
                            "형식: /kakao <키워드> <카테고리> [지역]\n"
                            "예) /kakao 서울 독립서점 shopping (지역 생략 → 구 단위 자동매핑, 성수/홍대/강남 외엔 전부 강북)\n"
                            "예) /kakao 제주 베이커리 shopping 제주 (구 매핑표에 없는 지역은 반드시 명시)",
                        )
                    else:
                        known_regions = {"성수", "홍대", "강북", "강남", "제주", "auto"}
                        if parts[-1] in known_regions and len(parts) >= 3:
                            region_token = parts[-1]
                            category = parts[-2]
                            keyword = " ".join(parts[:-2])
                        else:
                            region_token = "auto"
                            category = parts[-1]
                            keyword = " ".join(parts[:-1])
                        region = None if region_token == "auto" else region_token
                        _handle_kakao(chat_id, keyword, category, region, run_kakao_sync)
                elif text == "/start":
                    _reply(
                        chat_id,
                        "플레이스 ID(숫자)를 보내면 블로그갱신을 실행합니다.\n"
                        "/fav <즐겨찾기폴더URL> <지역> [카테고리] 로 즐겨찾기 폴더를 수집할 수 있습니다.\n"
                        "/kakao <키워드> <카테고리> [지역] 로 카카오맵 키워드 검색을 수집할 수 있습니다(지역 생략 시 구 자동매핑).",
                    )
        except Exception as e:
            print(f"[telegram_admin_bot] 폴링 오류: {e}")
            time.sleep(5)


def start_bot(enrich_place_sync, run_favorite_sync, run_kakao_sync) -> None:
    """enrich_place_sync: place_id(int) -> dict를 받는 동기 함수 (asyncio.run으로 감싼 버전을 main.py에서 넘김).
    run_favorite_sync: (folder_url, region, category) -> dict를 받는 동기 함수(collector_favorite.run_favorite).
    run_kakao_sync: (keyword, category, region) -> dict를 받는 동기 함수(collector_kakao.run_kakao_keyword)."""
    threading.Thread(target=_poll_loop, args=(enrich_place_sync, run_favorite_sync, run_kakao_sync), daemon=True).start()
