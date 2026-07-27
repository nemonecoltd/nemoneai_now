"""유저 소셜 기능 — 좋아요/코스/테마/피드백."""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from database import engine
from deps import ADMIN_EMAIL, _verify_supabase_user
from schemas import (
    CourseLikeToggle,
    CourseSave,
    FeedbackCreate,
    FeedbackUpdate,
    LikeToggle,
    ThemeLikeToggle,
    ThemeSave,
)

router = APIRouter()

@router.post("/likes/toggle")
async def toggle_like(req: LikeToggle):
    """장소 좋아요 토글"""
    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM likes WHERE user_id = :user_id AND place_id = :place_id"),
            {"user_id": req.user_id, "place_id": req.place_id}
        ).fetchone()
        if existing:
            conn.execute(text("DELETE FROM likes WHERE id = :id"), {"id": existing[0]})
            liked = False
        else:
            conn.execute(
                text("INSERT INTO likes (user_id, place_id) VALUES (:user_id, :place_id)"),
                {"user_id": req.user_id, "place_id": req.place_id}
            )
            liked = True
        conn.commit()
        return {"liked": liked}

@router.get("/users/{user_id}/likes")
async def get_user_likes(user_id: str):
    query = text("""
        SELECT p.* FROM seongsu_places p
        JOIN likes l ON p.id = l.place_id
        WHERE l.user_id = :user_id
        ORDER BY l.created_at DESC
    """)
    with engine.connect() as conn:
        result = conn.execute(query, {"user_id": user_id})
        return [dict(row._mapping) for row in result]

@router.post("/courses/save")
async def save_course(course: CourseSave):
    """[하위호환] 구 AI투어 저장 버튼 — /courses/draft?scope=timed 도입 후에도 구 프론트가
    당분간 이 경로를 쓸 수 있어 유지. 기존 동작(저장=즉시 공개)을 그대로 보존하기 위해
    scope='timed', source='ai_draft', is_public=true로 명시(신규 draft의 기본값 false와 다름)."""
    import json
    try:
        with engine.connect() as conn:
            query = text("""
                INSERT INTO saved_courses (user_id, user_name, user_image, title, description, steps, region, scope, source, is_public)
                VALUES (:user_id, :user_name, :user_image, :title, :description, :steps, :region, 'timed', 'ai_draft', true)
            """)
            conn.execute(query, {
                "user_id": course.user_id,
                "user_name": course.user_name,
                "user_image": course.user_image,
                "title": course.title,
                "description": course.description, "steps": json.dumps(course.steps),
                "region": course.region or "성수"
            })
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/{user_id}/courses")
async def get_user_courses(user_id: str):
    query = text("SELECT * FROM saved_courses WHERE user_id = :user_id ORDER BY created_at DESC LIMIT 10")
    with engine.connect() as conn:
        result = conn.execute(query, {"user_id": user_id})
        return [dict(row._mapping) for row in result]

@router.get("/courses")
async def get_all_courses():
    """[랭킹] 공개 코스 조회 (자체 보관된 유저 정보 사용).
    기존엔 title이 '[퍼감]'으로 시작하는지로 공개 여부를 판별하는 임시방편이었는데,
    is_public 컬럼이 생겨서 이제 그걸로 명시적으로 판별."""
    query = text("""
        SELECT c.*, COUNT(cl.id) as like_count
        FROM saved_courses c
        LEFT JOIN course_likes cl ON c.id = cl.course_id
        WHERE c.is_public = true
          AND c.created_at >= NOW() - INTERVAL '45 days'
        GROUP BY c.id
        ORDER BY like_count DESC, c.created_at DESC
    """)
    with engine.connect() as conn:
        result = conn.execute(query)
        return [dict(row._mapping) for row in result]

@router.post("/courses/like/toggle")
async def toggle_course_like(req: CourseLikeToggle):
    """코스 좋아요 토글"""
    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM course_likes WHERE user_id = :user_id AND course_id = :course_id"),
            {"user_id": req.user_id, "course_id": req.course_id}
        ).fetchone()
        if existing:
            conn.execute(text("DELETE FROM course_likes WHERE id = :id"), {"id": existing[0]})
            liked = False
        else:
            conn.execute(
                text("INSERT INTO course_likes (user_id, course_id) VALUES (:user_id, :course_id)"),
                {"user_id": req.user_id, "course_id": req.course_id}
            )
            liked = True
        conn.commit()
        return {"liked": liked}

@router.post("/themes/save")
async def save_theme(theme: ThemeSave):
    import json
    try:
        with engine.connect() as conn:
            query = text("""
                INSERT INTO themes (user_id, user_name, user_image, title, description, places, region)
                VALUES (:user_id, :user_name, :user_image, :title, :description, :places, :region)
            """)
            conn.execute(query, {
                "user_id": theme.user_id, 
                "user_name": theme.user_name,
                "user_image": theme.user_image,
                "title": theme.title,
                "description": theme.description, 
                "places": json.dumps(theme.places),
                "region": theme.region or "성수"
            })
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/themes")
async def get_all_themes():
    """테마 랭킹 (자체 보관된 유저 정보 사용)"""
    query = text("""
        SELECT t.*, COUNT(tl.id) as computed_like_count
        FROM themes t
        LEFT JOIN theme_likes tl ON t.id = tl.theme_id
        WHERE t.title NOT LIKE '[퍼감]%'
        GROUP BY t.id
        ORDER BY t.pinned_at DESC NULLS LAST, computed_like_count DESC, t.created_at DESC
    """)
    with engine.connect() as conn:
        result = conn.execute(query)
        themes = []
        for row in result:
            theme_dict = dict(row._mapping)
            theme_dict['like_count'] = theme_dict.pop('computed_like_count')
            themes.append(theme_dict)
        return themes

@router.get("/users/{user_id}/themes")
async def get_user_themes(user_id: str):
    query = text("SELECT * FROM themes WHERE user_id = :user_id ORDER BY created_at DESC")
    with engine.connect() as conn:
        result = conn.execute(query, {"user_id": user_id})
        return [dict(row._mapping) for row in result]

@router.put("/themes/{theme_id}")
async def update_theme(theme_id: int, theme: ThemeSave):
    import json
    try:
        with engine.connect() as conn:
            existing = conn.execute(text("SELECT user_id FROM themes WHERE id = :id"), {"id": theme_id}).fetchone()
            if not existing:
                raise HTTPException(status_code=404, detail="Theme not found")
            if existing[0] != theme.user_id:
                raise HTTPException(status_code=403, detail="Not authorized")

            query = text("""
                UPDATE themes 
                SET title = :title, description = :description, places = :places
                WHERE id = :id
            """)
            conn.execute(query, {
                "id": theme_id, "title": theme.title,
                "description": theme.description, "places": json.dumps(theme.places)
            })
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/themes/{theme_id}")
async def delete_theme(theme_id: int, user_id: str):
    """테마 삭제 (작성자)"""
    with engine.connect() as conn:
        theme = conn.execute(text("SELECT user_id FROM themes WHERE id = :id"), {"id": theme_id}).fetchone()
        if not theme:
            raise HTTPException(status_code=404, detail="Theme not found")
        
        if theme[0] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")
            
        conn.execute(text("DELETE FROM themes WHERE id = :id"), {"id": theme_id})
        conn.commit()
        return {"status": "success"}

@router.post("/themes/like/toggle")
async def toggle_theme_like(req: ThemeLikeToggle):
    """테마 좋아요 토글"""
    with engine.connect() as conn:
        existing = conn.execute(
            text("SELECT id FROM theme_likes WHERE user_id = :user_id AND theme_id = :theme_id"),
            {"user_id": req.user_id, "theme_id": req.theme_id}
        ).fetchone()
        if existing:
            conn.execute(text("DELETE FROM theme_likes WHERE id = :id"), {"id": existing[0]})
            liked = False
        else:
            conn.execute(
                text("INSERT INTO theme_likes (user_id, theme_id) VALUES (:user_id, :theme_id)"),
                {"user_id": req.user_id, "theme_id": req.theme_id}
            )
            liked = True
        conn.commit()
        return {"liked": liked}

@router.get("/feedbacks")
async def get_feedbacks():
    query = text("SELECT * FROM feedbacks ORDER BY created_at DESC")
    with engine.connect() as conn:
        result = conn.execute(query)
        return [dict(row._mapping) for row in result]

@router.post("/feedbacks")
async def create_feedback(req: FeedbackCreate, viewer: dict = Depends(_verify_supabase_user)):
    query = text("INSERT INTO feedbacks (user_id, user_name, content) VALUES (:user_id, :name, :content)")
    with engine.connect() as conn:
        conn.execute(query, {"user_id": viewer["id"], "name": req.user_name, "content": req.content})
        conn.commit()
    return {"status": "success"}

@router.put("/feedbacks/{feedback_id}")
async def update_feedback(feedback_id: int, req: FeedbackUpdate, viewer: dict = Depends(_verify_supabase_user)):
    with engine.connect() as conn:
        feedback = conn.execute(text("SELECT user_id FROM feedbacks WHERE id = :id"), {"id": feedback_id}).fetchone()
        if not feedback:
            raise HTTPException(status_code=404, detail="Not Found")
        if feedback[0] != viewer["id"] and viewer["email"] != ADMIN_EMAIL:
            raise HTTPException(status_code=403, detail="Unauthorized")

        conn.execute(text("UPDATE feedbacks SET content = :content WHERE id = :id"), {"content": req.content, "id": feedback_id})
        conn.commit()
    return {"status": "success"}

@router.delete("/feedbacks/{feedback_id}")
async def delete_feedback(feedback_id: int, viewer: dict = Depends(_verify_supabase_user)):
    with engine.connect() as conn:
        feedback = conn.execute(text("SELECT user_id FROM feedbacks WHERE id = :id"), {"id": feedback_id}).fetchone()
        if not feedback:
            raise HTTPException(status_code=404, detail="Not Found")
        if feedback[0] != viewer["id"] and viewer["email"] != ADMIN_EMAIL:
            raise HTTPException(status_code=403, detail="Unauthorized")

        conn.execute(text("DELETE FROM feedbacks WHERE id = :id"), {"id": feedback_id})
        conn.commit()
    return {"status": "success"}

@router.post("/feedbacks/{feedback_id}/reply")
async def reply_feedback(feedback_id: int, req: dict, viewer: dict = Depends(_verify_supabase_user)):
    if viewer["email"] != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="Admin only")
    with engine.connect() as conn:
        conn.execute(text("UPDATE feedbacks SET admin_reply = :reply WHERE id = :id"), {"reply": req.get("reply", ""), "id": feedback_id})
        conn.commit()
    return {"status": "success"}
