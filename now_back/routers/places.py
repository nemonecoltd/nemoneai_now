"""장소 CRUD·조회 — 목록/카테고리/상세/조회수/생성/수정/삭제/이미지 업로드/블로그갱신 트리거."""
import threading
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text

from database import engine
from deps import ADMIN_EMAIL, _verify_supabase_user
from enrich_service import _enrich_place_core, _revalidate_place, _translate_and_save
from gemini_service import get_embedding
from image_storage import delete_image, rehost_image, upload_bytes, is_internal_url
import ranking_service as ranking
from schemas import PlaceUpdate

router = APIRouter()

@router.get("/places")
async def list_places(region: Optional[str] = None, category: Optional[str] = None, limit: Optional[int] = None, offset: int = 0, sort: Optional[str] = None):
    # limit 미지정 시 기존 동작(전체 반환) 유지 — sitemap.ts/posts 상세 페이지가 region 없이 전체를 가져와 사용함
    where_clause = "WHERE p.region = :region AND (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)" if region else "WHERE (p.end_date IS NULL OR p.end_date >= CURRENT_DATE)"
    # 공연은 KOPIS 데이터만 목록에 노출 (구 소스는 SEO 색인 보존을 위해 DB엔 남기되 리스트에서만 제외, 만료는 기존 45일 유예 로직에 위임)
    if region == "공연":
        where_clause += " AND p.naver_place_id LIKE 'kopis_%'"
    # 제주는 2026-07-21부터 KOPIS/jeju.go.kr 수집 중단(비짓제주 API로 대체) — 기존 kopis_/jeju_ 접두
    # 레거시 데이터는 SEO 색인 보존을 위해 DB엔 남기되 새 팝업/클래스/행사/쇼핑 목록에는 섞이지 않도록 제외
    elif region == "제주":
        where_clause += " AND p.naver_place_id NOT LIKE 'kopis_%' AND p.naver_place_id NOT LIKE 'jeju_%' AND p.naver_place_id NOT LIKE 'culture_%'"
    # category: 'class'=원데이클래스/체험, 'popup'=팝업스토어(기존 데이터는 category가 NULL이라 COALESCE로 보정),
    # 'shopping'/'전시'=Visit Seoul 데이터(성수/홍대/강북/강남 하위), '행사'=비짓제주 축제/행사(제주 하위)
    # 공연(서울)은 장르 서브탭: 연극/뮤지컬/음악(대중음악)/종합(그 외 클래식·국악·무용·서커스마술·복합)
    if category == "class":
        where_clause += " AND p.category = 'class'"
    elif category == "shopping":
        where_clause += " AND p.category = 'shopping'"
    elif category == "전시":
        where_clause += " AND p.category = '전시'"
    elif category == "행사":
        where_clause += " AND p.category = '행사'"
    elif category == "popup":
        where_clause += " AND COALESCE(p.category, 'popup') = 'popup' AND p.naver_place_id NOT LIKE 'kopis_%' AND p.naver_place_id NOT LIKE 'jeju_%' AND p.naver_place_id NOT LIKE 'culture_%'"
    elif category in ("연극", "뮤지컬", "음악", "종합"):
        where_clause += f" AND p.category = '{category}'"
    limit_clause = "LIMIT :limit OFFSET :offset" if limit is not None else ""
    base_cols = "p.id, p.title, p.title_en, p.title_zh, p.content, p.content_en, p.content_zh, p.image_url, p.video_url, p.location, p.date_range, p.end_date, p.latitude, p.longitude, p.region, p.category, p.pinned_at, p.naver_place_id"
    # sort 옵션: 'latest'(신규 수집순), 'popular'(최근 30일 조회+좋아요 인기순), 'closing'(마감임박순), 기본은 랜덤
    # 예전엔 GREATEST(updated_at, created_at)를 썼는데, 블로그갱신(어드민 수동 편집 + 신규 팝업 자동갱신 스케줄러)이
    # updated_at을 계속 찍다 보니 몇 달 전 수집된 팝업이 오늘 갱신됐다는 이유만으로 "최신순" 상위에 튀어오르는
    # 문제가 생김 — "최신순"은 사용자 입장에서 "신규 추가"를 의미하므로 created_at만 기준으로 함
    if sort == "popular":
        query = text(
            f"SELECT {base_cols}, COUNT(DISTINCT l.id) * 2 + COUNT(DISTINCT v.id) AS score "
            f"FROM seongsu_places p "
            f"LEFT JOIN likes l ON l.place_id = p.id AND l.created_at >= NOW() - INTERVAL '30 days' "
            f"LEFT JOIN place_views v ON v.place_id = p.id AND v.viewed_at >= NOW() - INTERVAL '30 days' "
            f"{where_clause} "
            f"GROUP BY p.id "
            f"ORDER BY p.pinned_at DESC NULLS LAST, score DESC, p.created_at DESC {limit_clause}"
        )
    else:
        order_clause = (
            "p.created_at DESC" if sort == "latest"
            else "p.end_date ASC NULLS LAST" if sort == "closing"
            else "RANDOM()"
        )
        query = text(
            f"SELECT {base_cols} "
            f"FROM seongsu_places p {where_clause} "
            f"ORDER BY p.pinned_at DESC NULLS LAST, {order_clause} {limit_clause}"
        )
    with engine.connect() as conn:
        params = {"offset": offset}
        if limit is not None:
            params["limit"] = min(limit, 500)
        if region:
            params["region"] = region
        result = conn.execute(query, params)
        return [dict(row._mapping) for row in result]

@router.get("/places/categories")
async def list_place_categories(region: str):
    """지역별 서브탭 동적 렌더링용 — 해당 지역에 실제(만료 안 된) 데이터가 있는 category 목록만 반환."""
    query = text("""
        SELECT DISTINCT COALESCE(category, 'popup') AS category
        FROM seongsu_places
        WHERE region = :region AND (end_date IS NULL OR end_date >= CURRENT_DATE)
          AND naver_place_id NOT LIKE 'kopis_%' AND naver_place_id NOT LIKE 'jeju_%' AND naver_place_id NOT LIKE 'culture_%'
    """)
    with engine.connect() as conn:
        result = conn.execute(query, {"region": region})
        return [row[0] for row in result]

@router.get("/places/{place_id}")
async def get_place(place_id: int):
    query = text("SELECT id, title, title_en, title_zh, content, content_en, content_zh, image_url, video_url, location, date_range, end_date, latitude, longitude, region, category, naver_place_id, blog_reviews, link_url, link_title, created_at FROM seongsu_places WHERE id = :id")
    with engine.connect() as conn:
        result = conn.execute(query, {"id": place_id})
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Place not found")
        place = dict(row._mapping)
        # 핫플인증 배지 — 현재 TOP25 인기 랭킹에 들어있는지 + 랭킹 갱신 시각
        hot_rank = next((i + 1 for i, r in enumerate(ranking.get_popular()[:25]) if r["id"] == place_id), None)
        place["hot_rank"] = hot_rank
        place["hot_rank_updated_at"] = ranking.get_last_refreshed() if hot_rank else None
        return place

@router.post("/places/{place_id}/view")
async def record_place_view(place_id: int):
    """장소 조회수 기록 — 상세 페이지 진입 시 호출"""
    with engine.connect() as conn:
        conn.execute(text("INSERT INTO place_views (place_id) VALUES (:place_id)"), {"place_id": place_id})
        conn.commit()
    return {"ok": True}

@router.post("/places/upload-image")
async def upload_place_image(file: UploadFile = File(...)):
    """어드민 장소 등록/수정 화면에서 이미지 파일 직접 업로드 (압축 후 Supabase Storage 저장)."""
    try:
        raw_bytes = await file.read()
        url = upload_bytes(raw_bytes, name_hint=file.filename or "upload")
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/places")
async def create_place(place: PlaceUpdate):
    try:
        data = place.dict(exclude_unset=True)
        # 필수값 기본 설정 (DB 스키마 오류 방지)
        if "title" not in data:
            raise HTTPException(status_code=400, detail="title is required")
        if "content" not in data:
            data["content"] = ""

        # 외부 이미지 URL → Supabase Storage 재호스팅 (hotlink 차단/SEO 색인 오류 방지)
        if data.get("image_url"):
            data["image_url"] = rehost_image(data["image_url"])

        # 임베딩 생성
        data["embedding"] = f"[{','.join(map(str, get_embedding(data['content'])))}]"
        
        columns = ", ".join(data.keys())
        placeholders = ", ".join([f":{k}" for k in data.keys()])
        
        query = text(f"INSERT INTO seongsu_places ({columns}) VALUES ({placeholders})")
        with engine.connect() as conn:
            conn.execute(query, data)
            conn.commit()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/places/{place_id}")
async def update_place(place_id: int, place: PlaceUpdate):
    try:
        import re as _re
        from datetime import date as _date
        update_data = place.dict(exclude_unset=True)
        old_image = None
        if update_data.get("image_url"):
            with engine.connect() as _c:
                old_image = _c.execute(
                    text("SELECT image_url FROM seongsu_places WHERE id = :id"), {"id": place_id}
                ).scalar()
            update_data["image_url"] = rehost_image(update_data["image_url"])
            # 교체 전 옛 내부 이미지 삭제 — 안 그러면 Supabase Storage에 고아 객체가 쌓임.
            # 새 값이 유효한 내부 이미지일 때만(재호스팅 실패로 외부 URL이면 기존 보존).
            new_image = update_data["image_url"]
            if is_internal_url(new_image) and is_internal_url(old_image) and new_image != old_image:
                delete_image(old_image)
        if "content" in update_data:
            update_data["embedding"] = f"[{','.join(map(str, get_embedding(update_data['content'])))}]"
        # 어드민이 title/content를 직접 수정하면 영문 번역도 같이 갱신 (안 그러면 예전 번역이 새 내용과 어긋난 채 남음)
        # AI 호출(수 초 소요)로 저장 응답이 느려지지 않도록 백그라운드 스레드로 분리 — title/content 저장은 즉시 반영되고, 번역은 잠시 후 뒤따라 채워짐
        if "title" in update_data or "content" in update_data:
            _new_title = update_data.get("title")
            _new_content = update_data.get("content")
            threading.Thread(
                target=_translate_and_save, args=(place_id, _new_title, _new_content), daemon=True
            ).start()
        # date_range → end_date 자동 파싱 (어드민에서 운영일시만 수정해도 삭제 기준 동기화)
        if "date_range" in update_data and "end_date" not in update_data:
            dr = update_data["date_range"] or ""
            end_part = dr.split("~")[-1]
            # 어드민은 보통 "26.06.09."처럼 2자리 연도로 입력하므로 2~4자리 모두 허용
            m = _re.search(r"(\d{2,4})[.\-/](\d{1,2})[.\-/](\d{1,2})", end_part)
            if m:
                try:
                    year = int(m.group(1))
                    if year < 100:
                        year += 2000
                    update_data["end_date"] = _date(year, int(m.group(2)), int(m.group(3)))
                except ValueError:
                    pass
            else:
                # "미정" 등 종료일을 특정할 수 없는 경우 — end_date를 비워 무기한(자동삭제 대상 아님)으로 처리
                # (기존엔 여기서 아무것도 안 해서 스크래핑 당시의 임시 end_date가 그대로 남아있었음)
                update_data["end_date"] = None
        # pinned bool → pinned_at timestamp
        if "pinned" in update_data:
            update_data["pinned_at"] = "NOW()" if update_data.pop("pinned") else None
        set_parts = []
        for k in update_data.keys():
            if k == "pinned_at" and update_data[k] == "NOW()":
                set_parts.append("pinned_at = NOW()")
            else:
                set_parts.append(f"{k} = :{k}")
        if update_data.get("pinned_at") == "NOW()":
            del update_data["pinned_at"]
        # 어드민 저장 시각 기록 — 리스트/랭킹에서 "블로그갱신됨" 표기용
        set_parts.append("updated_at = NOW()")
        set_clause = ", ".join(set_parts)
        query = text(f"UPDATE seongsu_places SET {set_clause} WHERE id = :place_id")
        with engine.connect() as conn:
            conn.execute(query, {**update_data, "place_id": place_id})
            conn.commit()
        threading.Thread(target=_revalidate_place, args=(place_id,), daemon=True).start()
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/places/{place_id}/enrich")
async def enrich_place_content(place_id: int):
    """pcmap에서 방문자 리뷰 텍스트를 수집해 Gemini로 고품질 소개 생성. 어드민 수동 트리거용."""
    try:
        return await _enrich_place_core(place_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/places/{place_id}")
async def delete_place(place_id: int, viewer: dict = Depends(_verify_supabase_user)):
    if viewer["email"] != ADMIN_EMAIL:
        raise HTTPException(status_code=403, detail="관리자만 삭제할 수 있습니다")
    with engine.connect() as conn:
        row = conn.execute(text("SELECT image_url, title, naver_place_id FROM seongsu_places WHERE id = :place_id"), {"place_id": place_id}).fetchone()
        if row:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS deleted_places_blocklist (
                    id SERIAL PRIMARY KEY,
                    naver_place_id TEXT,
                    title TEXT,
                    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """))
            # 관리자가 지운 항목은 title/naver_place_id로 블록리스트에 남겨, 원본 소스(오픈API 등)에
            # stale 데이터가 계속 남아있어도 재수집(upsert_items) 때 다시 살아나지 않도록 함.
            conn.execute(
                text("INSERT INTO deleted_places_blocklist (naver_place_id, title) VALUES (:naver_place_id, :title)"),
                {"naver_place_id": row.naver_place_id, "title": row.title},
            )
        conn.execute(text("DELETE FROM seongsu_places WHERE id = :place_id"), {"place_id": place_id})
        conn.commit()
    if row and row[0]:
        delete_image(row[0])
    return {"status": "success"}
