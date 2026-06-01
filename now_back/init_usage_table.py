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

def create_usage_table():
    query = text("""
        CREATE TABLE IF NOT EXISTS user_ai_usages (
            id SERIAL PRIMARY KEY,
            user_email VARCHAR(255) NOT NULL,
            action_type VARCHAR(50) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """)
    with engine.connect() as conn:
        conn.execute(query)
        conn.commit()
    print("✅ `user_ai_usages` table created successfully.")

if __name__ == "__main__":
    create_usage_table()
