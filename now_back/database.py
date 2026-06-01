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
    """end_date가 지난 이벤트성 플레이스 삭제. end_date=NULL(테마 스크래핑)은 보호."""
    with engine.connect() as conn:
        query = text(
            "DELETE FROM seongsu_places WHERE end_date IS NOT NULL AND end_date < CURRENT_DATE"
        )
        conn.execute(query)
        conn.commit()
