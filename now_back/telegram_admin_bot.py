"""텔레그램으로 플레이스 ID만 보내면 블로그갱신(pcmap 스크래핑 + Gemini 소개 재생성)을 트리거.
로컬 전용(Playwright가 로컬에만 설치돼 있음) — main.py가 TELEGRAM_BOT_ENABLED=true일 때만 폴링 스레드를 띄움.
프로덕션 서버에서 같이 폴링하면 getUpdates가 충돌하고 어차피 Playwright도 없어서 반드시 로컬 전용으로 게이트해야 함.
"""
import os
import threading
import time
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


def _poll_loop(enrich_place_sync) -> None:
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[telegram_admin_bot] TELEGRAM_BOT_TOKEN/CHAT_ID 미설정 — 봇 비활성화")
        return
    print("[telegram_admin_bot] 폴링 시작 — 플레이스 ID를 텔레그램으로 보내면 블로그갱신 실행")
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
                elif text == "/start":
                    _reply(chat_id, "플레이스 ID(숫자)를 보내면 블로그갱신을 실행합니다.")
        except Exception as e:
            print(f"[telegram_admin_bot] 폴링 오류: {e}")
            time.sleep(5)


def start_bot(enrich_place_sync) -> None:
    """enrich_place_sync: place_id(int) -> dict를 받는 동기 함수 (asyncio.run으로 감싼 버전을 main.py에서 넘김)."""
    threading.Thread(target=_poll_loop, args=(enrich_place_sync,), daemon=True).start()
