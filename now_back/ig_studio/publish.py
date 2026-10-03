"""인스타그램 자동 게시 골격 — IG_PUBLISH_ENABLED=true가 아니면 항상 즉시 return.
2026-09-17 기준 Meta Graph API 캐러셀/스토리 게시 사양은 공식 문서로 확인하지 않았음
(이번 작업 스코프 밖 — 지시서 7절). 아래 TODO는 실제 구현 전 반드시 문서로 재검증할 것:
  - TODO: 캐러셀은 각 장을 IMAGE 컨테이너로 먼저 만들고(POST /{ig-user-id}/media),
    그 id들을 children으로 묶어 CAROUSEL 컨테이너를 만든 뒤(POST /{ig-user-id}/media),
    /{ig-user-id}/media_publish로 게시하는 3단계 흐름으로 알고 있으나 미검증.
  - TODO: 스토리는 media_type=STORIES로 단일 컨테이너 게시, 캡션 미지원 여부 확인 필요.
  - TODO: 필요 권한(instagram_content_publish 등)과 하루 게시 한도(25/24h로 알려짐, 미검증).
  - TODO: 이미지 컨테이너 생성 시 image_url이 반드시 공개 접근 가능해야 함 — 아래 업로드
    단계(Supabase ig/ prefix)까지는 확정, 그 다음 Graph API 호출 자체는 TODO.
"""
import os

IG_PUBLISH_ENABLED = os.getenv("IG_PUBLISH_ENABLED") == "true"


def publish_to_instagram(post_id: int) -> dict:
    if not IG_PUBLISH_ENABLED:
        return {"published": False, "reason": "IG_PUBLISH_ENABLED != true"}

    # 골격만 — 위 TODO 확인 전에는 여기 아래로 진행하지 않는다.
    raise NotImplementedError("Graph API 사양 미검증 — publish.py 상단 TODO 참고")


def upload_for_publish(local_png_path: str) -> str:
    """게시용 공개 URL 업로드 — 기존 image_storage.upload_bytes 재사용.
    TODO: upload_bytes는 name_hint를 해시 시드로만 쓰고 실제 저장 경로는 항상 버킷
    루트에 평평하게 저장한다(image_storage.py 확인, 2026-09-17) — "별도 prefix ig/"로
    분리하려면 업로드 경로를 직접 지정하는 변형이 필요, 이번엔 골격만이라 보류."""
    from image_storage import upload_bytes

    with open(local_png_path, "rb") as f:
        raw = f.read()
    return upload_bytes(raw, name_hint=os.path.basename(local_png_path))
