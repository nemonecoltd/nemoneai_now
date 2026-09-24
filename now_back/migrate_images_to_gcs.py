"""seongsu_places.image_url 중 Supabase Storage에 남은 이미지를 GCS(now-popup/)로 일괄 이관.

2026-09-25: 9/23에 팝업만 GCS로 옮긴 뒤에도 비팝업 이미지 4,644장이 Supabase에 남아 있었고,
9/24 AWS 대역 분산 스크래퍼가 비팝업 상세페이지를 대량으로 긁으면서 Supabase Cached Egress가
하루 120MB→600MB로 폭등 — 남은 이미지 전부를 옮긴다.

- 반드시 배포 서버(now_backend VM)에서 실행 — GCS 쓰기 권한이 VM의 ADC에만 있음.
- 원본은 public URL(/object/public/, CDN 경유 = Cached Egress 과금)이 아니라 service role 키로
  /object/authenticated/ 경로에서 받는다.
- 이미 webp로 압축된 파일이라 재압축 없이 바이트 그대로 올린다(화질 이중 손실 방지).
- DB는 image_url이 아직 옛 값일 때만 바꾼다(실행 중 수집기가 값을 바꿨으면 건드리지 않음).
- Supabase 원본은 삭제하지 않는다 — 롤백용. 결과 매핑은 CSV로 남긴다.

사용법: python migrate_images_to_gcs.py [--dry-run] [--limit N]
"""
import argparse
import csv
import os
import sys
import time

import requests
from sqlalchemy import text

from database import engine
from gcs_storage import BUCKET, PREFIX, _get_bucket
from image_storage import SUPABASE_URL, _STORAGE_PREFIX, _auth_headers, BUCKET as SUPABASE_BUCKET


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    with engine.connect() as conn:
        rows = conn.execute(
            text("SELECT id, image_url FROM seongsu_places WHERE image_url LIKE :p ORDER BY id"),
            {"p": f"{_STORAGE_PREFIX}%"},
        ).fetchall()
    if args.limit:
        rows = rows[: args.limit]
    print(f"대상 {len(rows)}건 (dry_run={args.dry_run})", flush=True)

    bucket = None if args.dry_run else _get_bucket()
    log_path = f"migrate_images_to_gcs_{time.strftime('%Y%m%d_%H%M%S')}.csv"
    done = failed = skipped = total_bytes = 0
    with open(log_path, "w", newline="") as fp:
        w = csv.writer(fp)
        w.writerow(["id", "old_url", "new_url", "result"])
        for i, (place_id, old_url) in enumerate(rows, 1):
            path = old_url[len(_STORAGE_PREFIX):]
            try:
                resp = requests.get(
                    f"{SUPABASE_URL}/storage/v1/object/authenticated/{SUPABASE_BUCKET}/{path}",
                    headers=_auth_headers(),
                    timeout=20,
                )
                if resp.status_code in (400, 404):
                    w.writerow([place_id, old_url, "", "missing"])
                    skipped += 1
                    continue
                resp.raise_for_status()
                data = resp.content
                total_bytes += len(data)
                # 옛 파일명(타임스탬프-해시.webp)을 그대로 써서 추적을 쉽게 한다 — 서로 다른
                # Supabase 경로가 같은 이름일 수는 없으므로 GCS에서도 충돌하지 않음.
                gcs_path = f"{PREFIX}{path.replace('/', '_')}"
                new_url = f"https://storage.googleapis.com/{BUCKET}/{gcs_path}"
                if args.dry_run:
                    w.writerow([place_id, old_url, new_url, "dry-run"])
                    done += 1
                    continue
                blob = bucket.blob(gcs_path)
                blob.cache_control = "public, max-age=31536000, immutable"
                blob.upload_from_string(data, content_type=resp.headers.get("content-type") or "image/webp")
                with engine.begin() as conn:
                    updated = conn.execute(
                        text("UPDATE seongsu_places SET image_url = :new WHERE id = :id AND image_url = :old"),
                        {"new": new_url, "id": place_id, "old": old_url},
                    ).rowcount
                w.writerow([place_id, old_url, new_url, "migrated" if updated else "changed-meanwhile"])
                done += 1
            except Exception as e:
                w.writerow([place_id, old_url, "", f"failed: {e}"])
                failed += 1
            if i % 200 == 0:
                print(f"  {i}/{len(rows)} 완료={done} 실패={failed} 누락={skipped} "
                      f"{total_bytes / 1024 / 1024:.1f}MB", flush=True)
                fp.flush()

    print(f"끝: 완료={done} 실패={failed} 누락={skipped} 전송={total_bytes / 1024 / 1024:.1f}MB 로그={log_path}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
