"""요청 본문 Pydantic 모델 모음 — 라우터에서 import해서 사용."""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel, field_validator

from deps import _PLACE_RANKING_REGIONS


class FeedbackCreate(BaseModel):
    user_name: str
    content: str

class FeedbackUpdate(BaseModel):
    content: str

class PlaceCollect(BaseModel):
    title: str
    content: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    location: Optional[str] = None
    date_range: Optional[str] = None
    end_date: Optional[date] = None

class PlaceUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date_range: Optional[str] = None
    region: Optional[str] = None
    pinned: Optional[bool] = None
    naver_place_id: Optional[str] = None
    link_url: Optional[str] = None
    link_title: Optional[str] = None

class Question(BaseModel):
    user_query: str

class TourRequest(BaseModel):
    companion: str
    user_id: Optional[str] = None

class LikeToggle(BaseModel):
    user_id: str
    place_id: int

class CourseSave(BaseModel):
    user_id: str
    user_name: Optional[str] = "User"
    user_image: Optional[str] = None
    title: str
    description: str
    steps: List[dict]
    region: Optional[str] = "성수"

class CourseLikeToggle(BaseModel):
    user_id: str
    course_id: int

class CourseDraftCreate(BaseModel):
    """3시간코스/자유코스 생성 — user_id는 인증 토큰(viewer)에서 가져오므로 여기 없음.
    user_name/user_image는 Supabase 세션의 표시정보(클라이언트 로컬 상태)라 body로 받음."""
    user_name: Optional[str] = "User"
    user_image: Optional[str] = None
    companion: Optional[str] = "solo"  # scope=timed일 때만 사용

class CourseUpdate(BaseModel):
    """편집화면 임시저장 — is_public은 여기서 바꾸지 않음(전용 publish 엔드포인트로만 전환)."""
    title: Optional[str] = None
    description: Optional[str] = None
    steps: Optional[List[dict]] = None

class CoursePublish(BaseModel):
    title: Optional[str] = None  # 미입력 시 서버가 자동 제안

class PlaceReportCreate(BaseModel):
    query: str
    region: Optional[str] = None

    @field_validator("query")
    @classmethod
    def _validate_query(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("query는 비어 있을 수 없습니다.")
        return v[:200]

class ThemeSave(BaseModel):
    user_id: str
    user_name: Optional[str] = "User"
    user_image: Optional[str] = None
    title: str
    description: str
    places: List[dict]
    region: Optional[str] = "성수"

_ALLOWED_RANKING_SHARE_TABS = {"place", "concert", "festival", "theme", "shopping", "exhibition"}
_ALLOWED_RANKING_SHARE_ITEM_KEYS = {"id", "title", "title_en", "title_zh", "image_url", "region", "category", "date_range", "score"}
_RANKING_SHARE_MAX_STR_LEN = 300

class RankingShareCreate(BaseModel):
    """랭킹 공유/마이페이지 저장 요청 — 인증 없이(공유는 로그인 불필요) 누구나 호출 가능한 엔드포인트라
    스팸/어뷰징 방지를 위해 모든 필드를 화이트리스트·길이 기준으로 엄격 검증(항목별 허용 키만 통과, 문자열 길이 제한,
    tab/region은 실제 존재하는 값만 허용). 요청 빈도 제한은 create_ranking_share()의 IP 기반 레이트리밋에서 별도 처리."""
    tab: str  # 'place' | 'concert' | 'festival' | 'theme'
    region: Optional[str] = None  # place 탭만 해당(종합/성수/홍대/강북/강남/제주), concert/festival/theme은 None
    label: str  # 화면 표시용 문구, 프론트에서 조합해서 보냄 (예: "성수 팝업 랭킹")
    items: List[dict]  # 공유/저장 시점의 top-N 스냅샷
    user_id: Optional[str] = None  # 마이페이지 저장이면 값 있음, 공유만 하면 None

    @field_validator("tab")
    @classmethod
    def _validate_tab(cls, v):
        if v not in _ALLOWED_RANKING_SHARE_TABS:
            raise ValueError(f"허용되지 않은 tab 값입니다: {v}")
        return v

    @field_validator("region")
    @classmethod
    def _validate_region(cls, v):
        if v is not None and v not in {"종합", *_PLACE_RANKING_REGIONS}:
            raise ValueError(f"허용되지 않은 region 값입니다: {v}")
        return v

    @field_validator("label")
    @classmethod
    def _validate_label(cls, v):
        v = v.strip()
        if not v:
            raise ValueError("label은 비어 있을 수 없습니다.")
        return v[:100]

    @field_validator("items")
    @classmethod
    def _validate_items(cls, v):
        if not v:
            raise ValueError("items는 최소 1개 이상이어야 합니다.")
        cleaned = []
        for raw in v[:10]:  # 서버에서도 top10으로 강제 절단(클라이언트가 더 많이 보내도 무시)
            if not isinstance(raw, dict):
                continue
            item = {}
            for key in _ALLOWED_RANKING_SHARE_ITEM_KEYS:  # 화이트리스트 밖 키는 전부 버림
                val = raw.get(key)
                if val is None:
                    continue
                if isinstance(val, str):
                    val = val[:_RANKING_SHARE_MAX_STR_LEN]
                item[key] = val
            if "id" in item and "title" in item:
                cleaned.append(item)
        if not cleaned:
            raise ValueError("유효한 item이 없습니다(id/title 필수).")
        return cleaned

class ThemeLikeToggle(BaseModel):
    user_id: str
    theme_id: int
