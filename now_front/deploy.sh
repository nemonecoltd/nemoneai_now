#!/bin/bash -l
set -euo pipefail

# now_front 배포 스크립트 (로컬 빌드 → msm VM standalone 배포)
# public/, .next/static/ 을 --delete 옵션으로 전체 동기화 — 로컬에서 지운 파일이
# 서버에 남아있는 채로 방치되던 문제(2026-08-05, matmatch-icon.png 삭제 미반영) 재발 방지

cd "$(dirname "$0")"

SSH_KEY="$HOME/.ssh/msm_ci"
SSH_TARGET="ubuntu@34.64.111.65"
REMOTE_DIR="/home/ubuntu/apps/now_front"

# .env.local의 BACKEND_URL=http://127.0.0.1:8081은 로컬 dev 서버용인데, 빌드 시점에
# /ranking/place/[slug] 등 generateStaticParams 페이지가 이 주소로 실제 데이터를
# fetch하려다 로컬에 아무것도 없어 실패 → 빈 데이터로 그대로 정적 프리렌더되는 버그가
# 있었음(부산 등 신규 지역 페이지가 "데이터 준비 중"으로 굳어버림). 빌드 직전에 SSH
# 터널을 열어 127.0.0.1:8081이 실제 운영 백엔드를 가리키게 만든 뒤 빌드한다.
echo "▶ 백엔드 SSH 터널 연결 (빌드 시점 데이터 fetch용)"
# 기존에 떠있는 동일 터널이 있으면 정리(포트 충돌로 새 터널이 조용히 안 붙는 경우 방지)
pkill -f "ssh -i $SSH_KEY -L 8081:127.0.0.1:8081" 2>/dev/null || true
sleep 1
ssh -i "$SSH_KEY" -L 8081:127.0.0.1:8081 -N "$SSH_TARGET" &
TUNNEL_PID=$!
trap "kill $TUNNEL_PID 2>/dev/null || true" EXIT

# 고정 sleep 대신 실제로 8081이 응답할 때까지 재시도 — 환경에 따라 SSH 핸드셰이크
# 시간이 들쭉날쭉해서 고정 sleep 3초로는 준비 전에 빌드가 시작되는 경우가 있었음
# (부산 등 신규 지역 페이지가 데이터 없이 그대로 정적 프리렌더된 원인)
for i in $(seq 1 15); do
  if curl -s -o /dev/null -w "" --max-time 1 "http://127.0.0.1:8081/places/popular?region=%EC%84%B1%EC%88%98" 2>/dev/null; then
    echo "  터널 준비 완료 (${i}초)"
    break
  fi
  if [ "$i" = "15" ]; then
    echo "  ⚠️ 터널이 15초 내에 안 열림 — 백엔드 fetch 실패 데이터로 빌드될 수 있음"
  fi
  sleep 1
done

echo "▶ 빌드"
npm run build

kill $TUNNEL_PID 2>/dev/null || true

echo "▶ standalone 서버 코드 동기화 (.env는 서버 전용 파일이라 제외)"
rsync -az --delete --exclude='.env' \
  -e "ssh -i $SSH_KEY" \
  .next/standalone/ "$SSH_TARGET:$REMOTE_DIR/"

echo "▶ 정적 자산 동기화"
rsync -az --delete -e "ssh -i $SSH_KEY" \
  .next/static/ "$SSH_TARGET:$REMOTE_DIR/.next/static/"

echo "▶ public 폴더 전체 동기화 (삭제된 파일도 서버에서 함께 제거됨)"
rsync -az --delete -e "ssh -i $SSH_KEY" \
  public/ "$SSH_TARGET:$REMOTE_DIR/public/"

echo "▶ PM2 재시작"
ssh -i "$SSH_KEY" "$SSH_TARGET" "pm2 restart now_frontend"

echo "✅ now_front 배포 완료: $(date)"
