"""수집기 실행 감시 — 응답 없는 연결에 걸려 영구 대기하는 사고를 막는다.

2026-09-30 00:00에 시작한 비짓제주 수집(scraper_visitjeju.py)이 HTTPS 소켓 read()에서 멈춘 채 14일 넘게
살아 있었다(CPU 11초). launchd는 이전 실행이 안 끝났으면 다음 예약(10/7, 10/14)을 조용히 건너뛰므로
수집이 2주간 아무 알림 없이 멈췄다. 이를 막기 위해:
  1) 최대 실행 시간을 넘기면 스택(어디서 멈췄는지)을 stderr에 남기고 텔레그램으로 알린 뒤 프로세스를 끝낸다
     → 다음 예약이 정상적으로 시작된다.
  2) socket 기본 타임아웃을 걸어, 타임아웃을 안 지정한 라이브러리 호출(GCS 업로드 등)도 무한 대기하지 않게 한다.
메인 스레드가 C 레벨 read()에서 막혀 있어도 별도 스레드라 동작한다.
"""
import faulthandler
import os
import socket
import sys
import threading

DEFAULT_SOCKET_TIMEOUT = 60


def arm(name: str, max_seconds: int) -> None:
    """수집기 진입점에서 한 번 호출. max_seconds를 넘기면 스택 덤프 + 알림 후 종료(exit code 2)."""
    socket.setdefaulttimeout(DEFAULT_SOCKET_TIMEOUT)

    def _kill() -> None:
        try:
            print(f"\n⛔ [{name}] 최대 실행 시간 {max_seconds}초 초과 — 멈춘 지점 스택을 남기고 종료합니다.",
                  file=sys.stderr, flush=True)
            faulthandler.dump_traceback(file=sys.stderr, all_threads=True)
            try:
                from notification import send_alert
                send_alert(f"⛔ {name} 수집이 {max_seconds // 60}분을 넘겨 강제 종료됐습니다 (멈춤 의심).\n"
                           f"스택은 해당 수집기의 error 로그에 남아 있습니다. 다음 예약 때 다시 실행됩니다.")
            except Exception as e:  # noqa: BLE001 — 알림 실패가 종료를 막지 않게
                print(f"  (알림 전송 실패: {e})", file=sys.stderr, flush=True)
        finally:
            os._exit(2)

    t = threading.Timer(max_seconds, _kill)
    t.daemon = True
    t.start()
