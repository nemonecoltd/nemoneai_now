#!/bin/bash -l
set -euo pipefail

# now_front 배포 스크립트 (로컬 빌드 → msm VM standalone 배포)
# public/, .next/static/ 을 --delete 옵션으로 전체 동기화 — 로컬에서 지운 파일이
# 서버에 남아있는 채로 방치되던 문제(2026-08-05, matmatch-icon.png 삭제 미반영) 재발 방지

cd "$(dirname "$0")"

SSH_KEY="$HOME/.ssh/msm_ci"
SSH_TARGET="ubuntu@34.64.111.65"
REMOTE_DIR="/home/ubuntu/apps/now_front"

echo "▶ 빌드"
npm run build

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
