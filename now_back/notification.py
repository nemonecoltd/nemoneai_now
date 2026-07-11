"""텔레그램 알림 — 로컬 스크래퍼(collector_naver.py, collector_kopis.py) 실행 결과 요약 전송용."""
import os
import logging

import requests
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def send_alert(message: str) -> None:
    """텔레그램 알림 전송. 토큰 미설정 시 로그만 출력."""
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    print(f"[alert] {message}")
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": f"🗺️ NOW 스크래퍼 알림\n{message}"},
            timeout=10,
        )
    except Exception as e:
        logger.error(f"[alert] 텔레그램 전송 실패: {e}")
