import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

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

    with engine.connect() as conn:
        expired = conn.execute(
            text("SELECT image_url FROM seongsu_places WHERE end_date IS NOT NULL AND end_date < CURRENT_DATE - INTERVAL '45 days'")
        ).fetchall()
        conn.execute(
            text("DELETE FROM seongsu_places WHERE end_date IS NOT NULL AND end_date < CURRENT_DATE - INTERVAL '45 days'")
        )
        conn.commit()

    for row in expired:
        if row[0]:
            delete_image(row[0])
