"""IndexNow — 새 페이지가 생기는 즉시 Bing 등 참여 검색엔진에 알려 색인을 앞당긴다
(2026-09-11, fire-your-seo-agency 스킬 권고). 사이트맵/크롤링은 발견까지 시간이 걸리는데,
IndexNow는 "이 URL이 새로 생겼다"고 직접 핑을 보내는 방식이라 훨씬 빠르다.
키 파일은 now_front가 /{key}.txt로 서빙(키 소유 증명용, 도메인에 실제로 떠 있어야 함) —
now_front/src/app/{key}.txt/route.ts 참고. 실패해도 조용히 무시(색인 자체엔 지장 없음,
사이트맵이 항상 백업 경로로 남아있음)."""
import logging
import time

import requests

logger = logging.getLogger(__name__)

INDEXNOW_KEY = "30172562437cbd08e7de30f934ce7bcd"
INDEXNOW_HOST = "now.nemoneai.com"


def ping_indexnow(urls: list) -> None:
    """실패해도 호출자 흐름은 안 끊는다(색인 자체엔 지장 없음, 사이트맵이 항상 백업 경로)
    — 다만 "조용히 무시"가 지나쳐서 HTTP 에러 응답(4xx/5xx)은 예외가 안 나 성공으로
    오인되고, 네트워크 실패도 재시도 없이 그 배치 URL이 영구히 안 알려진 채 묻히던
    문제가 있었음(2026-09-20, 외부 SEO 진단이 "최근 게시물이 IndexNow에 제출 안 됨"을
    지적하면서 발견). raise_for_status + 최대 2회 재시도, 최종 실패는 send_alert로
    남겨서 최소한 눈에는 띄게 한다."""
    if not urls:
        return
    payload = {
        "host": INDEXNOW_HOST,
        "key": INDEXNOW_KEY,
        "keyLocation": f"https://{INDEXNOW_HOST}/{INDEXNOW_KEY}.txt",
        "urlList": urls,
    }
    last_error = None
    for attempt in range(2):
        try:
            resp = requests.post("https://api.indexnow.org/indexnow", json=payload, timeout=10)
            resp.raise_for_status()
            logger.info("[indexnow] %d개 URL 핑 전송", len(urls))
            return
        except Exception as e:
            last_error = e
            if attempt == 0:
                time.sleep(2)
    logger.warning("[indexnow] 핑 실패(2회 시도): %s", last_error)
    try:
        from notification import send_alert
        send_alert(f"[indexnow] {len(urls)}개 URL 핑 실패(2회 시도): {last_error}")
    except Exception:
        pass
