"""Web Push 발송 — 익명 구독(push_subscriptions) 기반.
실패한 구독(410/404 Gone)은 발송 시점에 즉시 삭제해서 별도 정리 배치 없이도 만료 구독이 쌓이지 않게 한다."""
import json
import logging
import os

from pywebpush import webpush, WebPushException
from sqlalchemy import text

from database import engine

logger = logging.getLogger(__name__)


def send_push(subscription: dict, payload: dict) -> bool:
    """단일 구독에 발송. 만료/무효(410/404)면 해당 endpoint를 DB에서 삭제하고 False 반환."""
    try:
        webpush(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth"]},
            },
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": os.environ.get("VAPID_SUBJECT", "mailto:nemonecoltd@gmail.com")},
            # pywebpush 기본 ttl=0 — 그 순간 브라우저가 푸시 서비스에 연결돼있지 않으면 즉시 폐기되는
            # 값이라, FCM이 발송 요청 자체는 성공으로 응답해도 실제로는 조용히 사라짐(2026-08-10 확인).
            # 하루 동안은 재연결 시 배달되도록 넉넉히 설정.
            ttl=86400,
        )
        return True
    except WebPushException as e:
        status = e.response.status_code if e.response is not None else None
        if status in (404, 410):
            with engine.connect() as conn:
                conn.execute(text("DELETE FROM push_subscriptions WHERE endpoint = :endpoint"), {"endpoint": subscription["endpoint"]})
                conn.commit()
            logger.info("[push] 만료 구독 삭제: %s... (status=%s)", subscription["endpoint"][:50], status)
        else:
            logger.warning("[push] 발송 실패: %s", e)
        return False


def run_weekly_push() -> dict:
    """이번주 핫플랭킹 TOP3 + 매거진 링크 요약 push 발송.
    region_pref 있는 구독자는 해당 지역 랭킹, 없으면 통합 랭킹. 결과는 텔레그램으로 관리자에게 요약."""
    import ranking_service as ranking
    from notification import send_alert

    with engine.connect() as conn:
        subs = conn.execute(text("SELECT endpoint, p256dh, auth, region_pref FROM push_subscriptions")).fetchall()

    success = 0
    failed = 0
    for row in subs:
        top = ranking.get_popular(row.region_pref)[:3]
        if not top:
            continue
        # TOP3를 전부 나열하면 클릭할 이유가 없어짐(2026-08-10, "너무 빡빡하다" 피드백) —
        # 1위만 살짝 보여주고 나머지는 궁금하게 남겨서 클릭을 유도
        region_label = row.region_pref or '전체'
        title = f"🔥 이번주 {region_label} 핫플 랭킹 업데이트"
        body = f"지금 1위는 '{top[0]['title']}' — 나머지 순위도 확인해보세요!"
        payload = {"title": title, "body": body, "url": "https://now.nemoneai.com/"}
        ok = send_push({"endpoint": row.endpoint, "p256dh": row.p256dh, "auth": row.auth}, payload)
        if ok:
            success += 1
            with engine.connect() as conn:
                conn.execute(text("UPDATE push_subscriptions SET last_sent_at = NOW() WHERE endpoint = :e"), {"e": row.endpoint})
                conn.commit()
        else:
            failed += 1

    summary = f"[Web Push] 주간 발송 완료 — 성공 {success} / 실패 {failed} / 전체 {len(subs)}"
    # 로컬 .env의 텔레그램 토큰이 프로덕션과 동일 채널이라, 로컬에서 이 함수를 테스트하면
    # 실제 운영 텔레그램으로 알림이 샌다(2026-08-10 실제 발생). 이 호출부만 개별적으로 억제 —
    # notification.send_alert() 자체를 전역으로 막으면 로컬 스크래퍼들의 정상 완료 알림까지
    # 같이 묵음 처리되는 사고로 이어짐(같은 날 실제로 발생, notification.py 참고).
    if os.getenv("TELEGRAM_ALERTS_DISABLED") == "true":
        print(f"[alert] {summary} (TELEGRAM_ALERTS_DISABLED=true — 로컬 테스트라 발송 생략)")
    else:
        send_alert(summary)
    return {"success": success, "failed": failed, "total": len(subs)}
