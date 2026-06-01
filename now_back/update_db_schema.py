import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "nemone_now")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASS = os.getenv("DB_PASSWORD", "postgres")

DB_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(DB_URL)

def add_user_id_columns():
    tables = ['likes', 'saved_courses', 'themes', 'course_likes', 'theme_likes', 'feedbacks', 'user_ai_usages']
    
    with engine.connect() as conn:
        for table in tables:
            try:
                # 1. user_id 컬럼 추가 (null 허용으로 시작하여 기존 데이터 보존)
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS user_id TEXT;"))
                print(f"✅ '{table}' 테이블에 user_id 컬럼 추가 완료.")
            except Exception as e:
                print(f"❌ '{table}' 처리 중 오류: {e}")
        
        conn.commit()
    print("✨ 모든 테이블 구조 변경 완료.")

if __name__ == "__main__":
    add_user_id_columns()
