"""나우 매거진 — 맛매치 기사 프록시(원본·색인은 맛매치 유지, 나우는 열람 UX만)."""
import json
import re
import urllib.error
import urllib.request

from fastapi import APIRouter, HTTPException

router = APIRouter()

MATMATCH_API_BASE = "https://nemoneai.com/api"

@router.get("/magazine")
async def get_magazine():
    """나우 매거진 피드 — 맛매치 Special #5(나우 관련 기사 모음)를 그대로 프록시.
    콘텐츠 원본·검색 색인은 맛매치 쪽으로 유지, 나우는 앱 내 열람 UX만 제공."""
    try:
        with urllib.request.urlopen(f"{MATMATCH_API_BASE}/specials/5", timeout=5) as res:
            data = json.loads(res.read())
    except Exception:
        raise HTTPException(status_code=502, detail="매거진을 불러올 수 없습니다")

    # 맛매치 특성상 post_ids에 오래된 기사부터 쌓임 — 나우는 최신 기사가 위로 오도록 역순 정렬
    posts = sorted(data.get("posts", []), key=lambda p: p.get("created_at") or "", reverse=True)
    return [
        {
            "id": p["id"],
            "title": p["title"],
            "image_url": p.get("image_url"),
            "category": p.get("category"),
            "created_at": p.get("created_at"),
            "excerpt": re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", p.get("body_text") or "")).strip()[:80],
        }
        for p in posts
    ]

@router.get("/magazine/{post_id}")
async def get_magazine_post(post_id: int):
    try:
        with urllib.request.urlopen(f"{MATMATCH_API_BASE}/posts/{post_id}", timeout=5) as res:
            data = json.loads(res.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise HTTPException(status_code=404, detail="게시글을 찾을 수 없습니다")
        raise HTTPException(status_code=502, detail="매거진을 불러올 수 없습니다")
    except Exception:
        raise HTTPException(status_code=502, detail="매거진을 불러올 수 없습니다")

    return {
        "id": data["id"],
        "title": data["title"],
        "body_text": data.get("body_text"),
        "image_url": data.get("image_url"),
        "category": data.get("category"),
        "created_at": data.get("created_at"),
    }
