"""Visit Seoul(쇼핑/축제) 주 1회 재수집 — 순차 실행(동시 호출 시 API 부하/레이트리밋 피하려고).

launchd(com.nemoneai.now.collector-visitseoul)가 venv python으로 직접 실행한다. 원래는
run_visitseoul_weekly.sh를 /bin/bash로 돌렸는데, macOS 개인정보 보호(TCC)가 /bin/bash의
~/Desktop 접근을 막아 "Operation not permitted"(exit 126)로 매주 실패하고 있었다(2026-09-25 발견).
다른 수집기들처럼 venv python을 진입점으로 쓰면 이 제약에 걸리지 않는다.
"""
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

failed = []
for category in ("shopping", "festival"):
    print(f"[visitseoul-weekly] {category} 시작", flush=True)
    rc = subprocess.call([sys.executable, os.path.join(HERE, "scraper_visitseoul.py"), category], cwd=HERE)
    print(f"[visitseoul-weekly] {category} 종료 (exit={rc})", flush=True)
    if rc != 0:
        failed.append(category)

sys.exit(1 if failed else 0)
