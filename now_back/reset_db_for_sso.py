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

def reset_database():
    # 1. 기존 테이블 삭제 (순서 주의: 외래키 관계 등 고려)
    drop_tables_query = """
    DROP TABLE IF EXISTS theme_likes;
    DROP TABLE IF EXISTS course_likes;
    DROP TABLE IF EXISTS saved_courses;
    DROP TABLE IF EXISTS themes;
    DROP TABLE IF EXISTS likes;
    DROP TABLE IF EXISTS feedbacks;
    DROP TABLE IF EXISTS user_ai_usages;
    """
    
    # 2. 새로운 구조로 테이블 생성
    create_tables_query = """
    CREATE TABLE likes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        place_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, place_id)
    );

    CREATE TABLE saved_courses (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        steps JSONB NOT NULL,
        region TEXT DEFAULT '성수',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE themes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        places JSONB NOT NULL,
        region TEXT DEFAULT '성수',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE course_likes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        course_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, course_id)
    );

    CREATE TABLE theme_likes (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        theme_id INTEGER NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, theme_id)
    );

    CREATE TABLE feedbacks (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_name TEXT,
        content TEXT NOT NULL,
        admin_reply TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE user_ai_usages (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    """
    
    with engine.connect() as conn:
        print("🗑️ 기존 테이블 삭제 중...")
        conn.execute(text(drop_tables_query))
        print("🏗️ 새 구조로 테이블 생성 중...")
        conn.execute(text(create_tables_query))
        conn.commit()
    print("✅ 데이터베이스 초기화 완료 (Supabase 통합 준비 완료)")

if __name__ == "__main__":
    reset_database()
