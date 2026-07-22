#!/bin/bash
# Visit Seoul(쇼핑/축제) 주 1회 재수집 — 순차 실행(동시 호출 시 API 부하/레이트리밋 피하려고)
cd /Users/hansjung/Desktop/now/now_back
VENV_PY=/Users/hansjung/Desktop/matmatch/backend/venv/bin/python3

"$VENV_PY" scraper_visitseoul.py shopping
"$VENV_PY" scraper_visitseoul.py festival
