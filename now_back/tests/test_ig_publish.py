"""ig_studio API 게시·댓글 알림 시험 — Graph/업로드/텔레그램은 가짜로 대체, DB는 임시 Postgres(DB_PORT=5544, DB_NAME=pace_test)만 쓴다."""
import io, os, sys, tempfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
assert os.getenv("DB_PORT") == "5544", "임시 DB(5544)에서만 실행"
from PIL import Image
from sqlalchemy import text
from database import engine
from ig_studio import db as ig_db, publish as pub, comments, links, approval
from datetime import date

CALLS = []
def fake_call(method, path, **p):
    CALLS.append((method, path, {k: v for k, v in p.items() if k != "access_token"}))
    if method == "GET" and path == "17841426884964540": return {"username": "nemone_pace"}
    if method == "GET" and path.endswith("/comments"): return {"data": COMMENTS if path.startswith("MEDIA1/") else []}
    if method == "GET" and "status_code" in p.get("fields", ""): return {"status_code": "FINISHED"}
    if method == "GET" and p.get("fields") == "permalink": return {"permalink": "https://www.instagram.com/p/XYZ/"}
    if path.endswith("/media_publish"):
        if FAIL_PUBLISH: raise pub.IGError("timeout")
        return {"id": "MEDIA1"}
    if path.endswith("/media"): return {"id": f"C{len(CALLS)}"}
    raise AssertionError((method, path))
COMMENTS = []; FAIL_PUBLISH = False; SENT = []
pub._call = fake_call; comments._call = fake_call
pub.upload_jpeg = lambda b: "https://storage.googleapis.com/b/ig/x.jpg"
comments._notify = lambda t: SENT.append(t)
os.environ.update(IG_ACCESS_TOKEN="T", IG_USER_ID="17841426884964540")

def mk_dir(n, size=(1080, 1350)):
    d = tempfile.mkdtemp()
    for i in range(n):
        Image.new("RGB", size, (200, 30 + i, 40)).save(f"{d}/0{i}.png")
    return d

def mk_post(fmt="course", n=3, caption="본문\n\n#a #b #c", status="approved", payload=None, d=None):
    pid = ig_db.create_pending(fmt, date(2026, 11, 9), payload or {}, False, mk_dir(n), caption)
    ig_db.set_status(pid, status)
    return pid

def test_all():
    ig_db.ensure_schema()
    with engine.connect() as c:
        c.execute(text("DELETE FROM ig_posts")); c.execute(text("DELETE FROM ig_comment_seen")); c.commit()
    # JPEG 변환·비율
    assert pub.to_jpeg(Path(mk_dir(1)) / "00.png")[:3] == b"\xff\xd8\xff"
    try: pub.to_jpeg(Path(mk_dir(1, (1080, 1920))) / "00.png"); assert False
    except pub.IGError as e: assert "비율" in str(e)
    # dry-run: 게시·업로드 호출 없음
    pid = mk_post(); CALLS.clear()
    r = pub.publish_post(pid, dry_run=True)
    assert r["ok"] and "3장(캐러셀)" in r["message"] and all(m == "GET" for m, _, _ in CALLS), CALLS
    # 스위치 꺼짐 → 게시 안 함
    os.environ.pop("IG_PUBLISH_ENABLED", None); CALLS.clear()
    r = pub.publish_post(pid); assert not r["ok"] and "꺼짐" in r["message"] and all(m == "GET" for m, _, _ in CALLS)
    os.environ["IG_PUBLISH_ENABLED"] = "true"
    # 미승인 상태
    p2 = mk_post(status="pending"); assert "먼저 /ok" in pub.publish_post(p2)["message"]
    # 캐러셀 게시 성공
    CALLS.clear(); r = pub.publish_post(pid)
    assert r["ok"] and r["media_id"] == "MEDIA1", r
    kinds = [(m, p.split("/")[-1]) for m, p, _ in CALLS if m == "POST"]
    assert kinds == [("POST", "media")] * 4 + [("POST", "media_publish")], kinds       # 자식3 + 캐러셀 + publish
    carousel = [x for x in CALLS if x[2].get("media_type") == "CAROUSEL"][0]
    assert carousel[2]["caption"].endswith("#a #b #c") and carousel[2]["children"].count(",") == 2
    post = ig_db.get_post(pid); assert post["status"] == "posted" and post["media_id"] == "MEDIA1" and post["permalink"]
    # 재게시 거부
    assert not pub.publish_post(pid)["ok"]
    # 단일 이미지(마감 임박)
    p3 = mk_post("closing", 1); CALLS.clear(); assert pub.publish_post(p3)["ok"]
    assert [m for m, _, _ in CALLS if m == "POST"] == ["POST", "POST"] and [x for x in CALLS if x[0] == "POST"][0][2].get("image_url") and [x for x in CALLS if x[0] == "POST"][0][2].get("caption")
    # media_publish 실패 → publish_unknown, 재시도 안 함
    global FAIL_PUBLISH; FAIL_PUBLISH = True
    p4 = mk_post(); r = pub.publish_post(p4)
    assert not r["ok"] and "불확실" in r["message"] and ig_db.get_post(p4)["status"] == "publish_unknown"
    assert "먼저 /ok" in pub.publish_post(p4)["message"]; FAIL_PUBLISH = False
    # 동시 선점은 한 번만
    p5 = mk_post(); assert ig_db.claim_for_publish(p5) and not ig_db.claim_for_publish(p5)
    # 게시 전 단계 실패(업로드) → approved로 복귀
    def bad(b): raise pub.IGError("업로드 실패")
    pub.upload_jpeg = bad; p6 = mk_post(); r = pub.publish_post(p6)
    assert not r["ok"] and ig_db.get_post(p6)["status"] == "approved" and "올라가지 않음" in r["message"]
    pub.upload_jpeg = lambda b: "https://x/y.jpg"
    # 댓글 알림: 키워드만, 중복 없음, 내 계정 제외
    spec = links.reply_spec("course", {"share_url": "https://now.nemoneai.com/course/66", "where": "홍대"})
    with engine.connect() as c:
        import json
        c.execute(text("UPDATE ig_posts SET payload = CAST(:p AS jsonb) WHERE id = :i"), {"p": json.dumps({"reply": spec}), "i": pid}); c.commit()
    with engine.connect() as c:
        c.execute(text("UPDATE ig_posts SET media_id = 'MEDIA_OTHER' WHERE media_id = 'MEDIA1' AND id <> :i"), {"i": pid}); c.commit()
    COMMENTS[:] = [
        {"id": "c1", "text": "코스 보내주세요!", "username": "fan1"},
        {"id": "c2", "text": "예뻐요", "username": "fan2"},
        {"id": "c3", "text": "코스", "username": "nemone_pace"},
    ]
    SENT.clear(); r = comments.check_once()
    assert r["alerts"] == 1 and "fan1" in SENT[0] and "/course/66" in SENT[0], SENT
    SENT.clear(); assert comments.check_once()["alerts"] == 0 and not SENT          # 두 번째 실행은 조용
    COMMENTS.append({"id": "c4", "text": "코스요", "username": "fan4"})
    assert comments.check_once()["alerts"] == 1
    print("PASS ig_publish")

if __name__ == "__main__":
    test_all()
