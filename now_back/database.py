import logging
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# .env 파일 로드
load_dotenv()

# GCP Cloud SQL 혹은 로컬 DB 연결 설정 (SSH 터널링 Port 5433 반영)
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_NAME = os.getenv("DB_NAME", "nemone_now")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD", "postgres")

DB_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DB_URL, pool_pre_ping=True, pool_recycle=1800)

def cleanup_expired_data():
    """end_date + 45일이 지난 이벤트성 플레이스 삭제. end_date=NULL(테마 스크래핑)은 보호.

    45일 유예기간: 종료 후 검색 유입이 남아있는 동안 404 없이 페이지를 유지,
    크롤러가 자연스럽게 de-index할 시간을 확보한 뒤 삭제.
    DB row 삭제 전 Supabase Storage에 재호스팅된 이미지도 같이 삭제해 용량이 계속 쌓이지 않게 함.
    """
    from image_storage import delete_image
    from indexnow_service import ping_indexnow

    with engine.connect() as conn:
        expired = conn.execute(
            text("SELECT id, image_url FROM seongsu_places WHERE end_date IS NOT NULL AND end_date < CURRENT_DATE - INTERVAL '45 days'")
        ).fetchall()
        conn.execute(
            text("DELETE FROM seongsu_places WHERE end_date IS NOT NULL AND end_date < CURRENT_DATE - INTERVAL '45 days'")
        )
        conn.commit()

    # 2026-09-20 — 외부 SEO 진단이 "죽은 링크가 생겨도 IndexNow에 알리지 않는다"고 지적한 부분.
    # 지금까지 IndexNow는 collector_base.upsert_items()에서 "새 URL"에만 핑을 보냈고, 여기서
    # 45일 유예 후 실제로 사라지는 URL은 아무도 알리지 않아 검색엔진이 자연 재크롤로 죽은 링크를
    # 발견할 때까지 방치됐음. IndexNow 프로토콜은 "이 URL을 다시 봐달라"는 핑이라 삭제 통보에도
    # 그대로 쓸 수 있다(신규든 삭제든 같은 엔드포인트) — 재크롤 시 404를 받으면 색인에서 더 빨리 빠짐.
    if expired:
        ping_indexnow([f"https://now.nemoneai.com/posts/{row.id}" for row in expired])

    # 고아 이미지(2026-09-03, 5,967개/405MB 발견) 원인 추적용 — 건별 결과를 집계해 남긴다.
    tally = {"deleted": 0, "failed": 0, "skipped": 0, "no_image": 0}
    for row in expired:
        place_id, image_url = row[0], row[1]
        if not image_url:
            tally["no_image"] += 1
            continue
        outcome = delete_image(image_url)
        tally[outcome] += 1
        if outcome == "failed":
            logger.warning("[cleanup] 이미지 삭제 실패 (place_id=%s, url=%s)", place_id, image_url)

    if expired:
        logger.info(
            "[cleanup] 45일 경과 %d건 삭제 — 이미지: 삭제 %d / 실패 %d / 내부아님-스킵 %d / 이미지없음 %d",
            len(expired), tally["deleted"], tally["failed"], tally["skipped"], tally["no_image"],
        )

    # 공유/마이페이지 저장 랭킹 스냅샷도 동일한 45일 유예 후 삭제 — 테이블이 없으면(첫 배포 전) 조용히 스킵
    with engine.connect() as conn:
        try:
            conn.execute(text("DELETE FROM ranking_share WHERE created_at < NOW() - INTERVAL '45 days'"))
            conn.commit()
        except Exception:
            conn.rollback()
