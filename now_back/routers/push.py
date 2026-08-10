"""Web Push 구독 관리 — 로그인 여부와 무관하게 브라우저 단위(endpoint)로만 구독.
PII(user_id/이메일 등)는 저장하지 않는다."""
import os

from fastapi import APIRouter
from sqlalchemy import text

from database import engine

router = APIRouter()


def _ensure_table(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS push_subscriptions (
            id SERIAL PRIMARY KEY,
            endpoint TEXT UNIQUE NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            region_pref TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            last_sent_at TIMESTAMPTZ
        )
    """))
    conn.commit()


@router.get("/push/vapid-public-key")
async def get_vapid_public_key():
    return {"publicKey": os.environ.get("VAPID_PUBLIC_KEY", "")}


@router.post("/push/subscribe")
async def subscribe(payload: dict):
    endpoint = payload.get("endpoint")
    keys = payload.get("keys") or {}
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    region_pref = payload.get("region_pref")
    if not endpoint or not p256dh or not auth:
        return {"status": "error", "detail": "endpoint/keys 필요"}

    with engine.connect() as conn:
        _ensure_table(conn)
        conn.execute(
            text("""
                INSERT INTO push_subscriptions (endpoint, p256dh, auth, region_pref)
                VALUES (:endpoint, :p256dh, :auth, :region_pref)
                ON CONFLICT (endpoint) DO UPDATE SET
                    p256dh = :p256dh, auth = :auth, region_pref = :region_pref
            """),
            {"endpoint": endpoint, "p256dh": p256dh, "auth": auth, "region_pref": region_pref},
        )
        conn.commit()
    return {"status": "success"}


@router.post("/push/unsubscribe")
async def unsubscribe(payload: dict):
    endpoint = payload.get("endpoint")
    if not endpoint:
        return {"status": "error", "detail": "endpoint 필요"}
    with engine.connect() as conn:
        _ensure_table(conn)
        conn.execute(text("DELETE FROM push_subscriptions WHERE endpoint = :endpoint"), {"endpoint": endpoint})
        conn.commit()
    return {"status": "success"}
