"""진입점: python -m ig_studio.cli <ranking|course|closing|crowd> [--date YYYY-MM-DD] [--dry-run]"""
from __future__ import annotations
import argparse
import signal
import sys
import traceback
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from . import approval
from . import caption as caption_mod
from . import data
from . import db as ig_db
from .render import FEED_VIEWPORT, STORY_VIEWPORT, render_card_sync

OUTPUT_ROOT = Path(__file__).with_name("output")
KST = ZoneInfo("Asia/Seoul")


def _outdir(fmt: str, target_date: date) -> Path:
    """같은 (format, target_date) 재생성(/redo, 재실행) 시 이전 회차 PNG가 파일명이 달라
    안 지워지고 섞이는 문제(예: 목록 페이지 분할 개수가 바뀌면 옛 파일이 남음)가 있어
    디렉토리를 매번 비우고 새로 만든다(2026-09-17 dry-run 반복 중 발견)."""
    d = OUTPUT_ROOT / f"{target_date.isoformat()}_{fmt}"
    if d.exists():
        for f in d.iterdir():
            f.unlink()
    d.mkdir(parents=True, exist_ok=True)
    return d


def _run_ranking(target_date: date, dry_run: bool):
    payload = data.get_ranking_payload(target_date)
    outdir = _outdir("ranking", target_date)
    png_paths, overflow_all = [], []

    p = outdir / "01_cover.png"
    overflow_all += render_card_sync("ranking_cover.html", {**payload, "items": payload["items"][:5], "has_more": len(payload["items"]) > 5}, p, FEED_VIEWPORT)
    png_paths.append(p)

    # 지시서는 "2장 6~15위 / 3장 16~25위"(10개씩)를 가정했지만, 시안의 .row 스타일(수치
    # 변경 금지) 그대로면 1350px 카드에 실측 7개까지만 넘침 없이 들어간다(2026-09-17
    # dry-run에서 10개 렌더 시 scrollHeight 1739 > clientHeight 1350로 확인) — 카드
    # 장수가 지시서보다 늘어나는 대신(25위까지 총 4장 아닌 5장 구성) row 스타일은 그대로 둠.
    _ROWS_PER_LIST_PAGE = 7
    remaining = payload["items"][5:]
    for i, chunk_start in enumerate(range(0, len(remaining), _ROWS_PER_LIST_PAGE)):
        chunk = remaining[chunk_start:chunk_start + _ROWS_PER_LIST_PAGE]
        lo, hi = chunk_start + 6, chunk_start + 6 + len(chunk) - 1
        p = outdir / f"0{i+2}_list_{lo}_{hi}.png"
        has_more = chunk_start + _ROWS_PER_LIST_PAGE < len(remaining)
        overflow_all += render_card_sync("ranking_list.html", {**payload, "items": chunk, "range_label": f"{lo}–{hi}위", "has_more": has_more, "next_range_label": hi + 1}, p, FEED_VIEWPORT)
        png_paths.append(p)

    p = outdir / "99_cta.png"
    overflow_all += render_card_sync("cta.html", {"main_line": "지도와 동선은\n프로필 링크에서", "sub_line": None}, p, FEED_VIEWPORT)
    png_paths.append(p)

    if payload["needs_review"] or overflow_all:
        payload["needs_review"] = True

    cap = caption_mod.generate_caption("ranking", payload)
    return _finalize("ranking", target_date, payload, cap, png_paths, overflow_all, dry_run, outdir)


def _run_course(target_date: date, dry_run: bool, region_override: str | None = None):
    payload = data.get_course_payload(target_date, region_override=region_override)
    outdir = _outdir("course", target_date)

    if payload.get("needs_review") and "stops" not in payload:
        if not dry_run:
            approval.send_no_candidate("course", target_date.isoformat(), payload.get("reason", "알 수 없음"))
        return {"created": False, "payload": payload}

    cap = caption_mod.generate_caption("course", payload)
    summaries = cap.get("stop_summaries", {})
    for s in payload["stops"]:
        s["desc"] = summaries.get(s["name"], s["activity"][:20] if s.get("activity") else None)
    payload["headline"] = cap.get("headline", f"{payload['region']} 반나절")
    lines = payload["headline"].split(" ", 1)
    payload["headline_line1"] = lines[0]
    payload["headline_line2"] = lines[1] if len(lines) > 1 else payload["region"]

    png_paths, overflow_all = [], []
    start_digits = list(payload["start_time"].replace(":", ""))
    start_digits.insert(2, ":")
    end_digits = list(payload["end_time"].replace(":", ""))
    end_digits.insert(2, ":")
    scale_count = max(2, round((_to_minutes(payload["end_time"]) - _to_minutes(payload["start_time"])) / 60) + 1)
    scale_labels = []
    start_min = _to_minutes(payload["start_time"])
    for i in range(scale_count):
        m = start_min + i * 60
        scale_labels.append(f"{m // 60:02d}:00")

    p = outdir / "01_cover.png"
    overflow_all += render_card_sync("course_cover.html", {
        **payload, "headline_line1": payload["headline_line1"], "headline_line2": payload["headline_line2"],
        "start_digits": start_digits, "end_digits": end_digits, "scale_labels": scale_labels,
    }, p, FEED_VIEWPORT)
    png_paths.append(p)

    for i, s in enumerate(payload["stops"]):
        p = outdir / f"0{i+2}_stop.png"
        overflow_all += render_card_sync("course_stop.html", {
            "where": payload["where"], "stop_no": i + 1, "stop_total": len(payload["stops"]),
            "time": s["time"], "color": s["color"], "name": s["name"], "desc": s.get("desc"),
            "duration_label": s["duration_label"], "image_url": s.get("image_url"),
            "move_to_next": s["move_to_next"] if i < len(payload["stops"]) - 1 else None,
        }, p, FEED_VIEWPORT)
        png_paths.append(p)

    p = outdir / "99_cta.png"
    overflow_all += render_card_sync("cta.html", {"main_line": "지도와 동선은\n프로필 링크에서", "sub_line": "댓글에 \"코스\" 남기면 링크를 보내드려요"}, p, FEED_VIEWPORT)
    png_paths.append(p)

    if overflow_all:
        payload["needs_review"] = True

    return _finalize("course", target_date, payload, cap, png_paths, overflow_all, dry_run, outdir)


def _to_minutes(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def _run_closing(target_date: date, dry_run: bool):
    payload = data.get_closing_payload(target_date)
    outdir = _outdir("closing", target_date)

    if not payload["items"]:
        if not dry_run:
            approval.send_no_candidate("closing", target_date.isoformat(), "이번 주 마감 임박 없음")
        return {"created": False, "payload": payload}

    p = outdir / "01_cover.png"
    overflow = render_card_sync("closing_cover.html", payload, p, FEED_VIEWPORT)
    png_paths = [p]
    if overflow:
        payload["needs_review"] = True

    cap = caption_mod.generate_caption("closing", payload)
    return _finalize("closing", target_date, payload, cap, png_paths, overflow, dry_run, outdir)


def _run_crowd(now_kst: datetime, dry_run: bool):
    payload = data.get_crowd_payload(now_kst)
    outdir = _outdir("crowd", now_kst.date())

    if not payload["spots"]:
        if not dry_run:
            approval.send_no_candidate("crowd", now_kst.date().isoformat(), payload.get("reason", "데이터 없음"))
        return {"created": False, "payload": payload}
    if payload.get("stale"):
        if not dry_run:
            approval.send_no_candidate("crowd", now_kst.date().isoformat(), "혼잡도 데이터가 30분 이상 오래됨")
        return {"created": False, "payload": payload}

    p = outdir / "01_crowd.png"
    overflow = render_card_sync("crowd_story.html", payload, p, STORY_VIEWPORT)
    if overflow:
        payload["needs_review"] = True

    if dry_run:
        return {"created": True, "payload": payload, "png_paths": [p]}

    post_id = ig_db.create_pending("crowd", now_kst.date(), payload, payload["needs_review"], str(outdir), None)
    approval.send_for_approval(post_id, "crowd", now_kst.date().isoformat(), "(스토리 — 캡션 없음)", payload["needs_review"], ", ".join(overflow) if overflow else "-", [p])
    return {"created": True, "post_id": post_id, "payload": payload}


def _finalize(fmt: str, target_date: date, payload: dict, cap: dict, png_paths: list[Path], overflow: list[str], dry_run: bool, outdir: Path) -> dict:
    needs_review = payload.get("needs_review", False) or cap.get("needs_review", False)
    reason_parts = []
    if overflow:
        reason_parts.append(f"넘침: {', '.join(set(overflow))}")
    if cap.get("problems"):
        reason_parts.append(f"캡션: {', '.join(cap['problems'])}")
    reason = " / ".join(reason_parts) if reason_parts else "-"

    (outdir / "payload.json").write_text(__import__("json").dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    (outdir / "caption.txt").write_text(cap.get("caption", ""), encoding="utf-8")

    if dry_run:
        return {"created": True, "payload": payload, "caption": cap, "png_paths": png_paths, "needs_review": needs_review}

    post_id = ig_db.create_pending(fmt, target_date, payload, needs_review, str(outdir), cap.get("caption", ""))
    approval.send_for_approval(post_id, fmt, target_date.isoformat(), cap.get("caption", ""), needs_review, reason, png_paths, share_url=payload.get("share_url"))
    return {"created": True, "post_id": post_id, "payload": payload}


class _JobTimeout(Exception):
    pass


def _alarm_handler(signum, frame):
    raise _JobTimeout("전체 타임아웃(5분) 초과")


def run_format(fmt: str, target_date: date, dry_run: bool = False, region_override: str | None = None) -> dict:
    # 지시서 6절 "각 잡은 전체 타임아웃 5분" — launchd 자체엔 실행시간 상한 옵션이 없고
    # macOS 기본 셸엔 GNU timeout(gtimeout)도 없어서, signal.alarm으로 자체 구현
    # (Playwright hang 재발 이력 있음 — cli.py 최상위에서 잡아서 다음 10분 주기를 막지 않게).
    if not dry_run and hasattr(signal, "SIGALRM"):
        signal.signal(signal.SIGALRM, _alarm_handler)
        signal.alarm(300)
    try:
        if fmt == "ranking":
            return _run_ranking(target_date, dry_run)
        if fmt == "course":
            return _run_course(target_date, dry_run, region_override=region_override)
        if fmt == "closing":
            return _run_closing(target_date, dry_run)
        if fmt == "crowd":
            return _run_crowd(datetime.now(KST), dry_run)
        raise ValueError(f"알 수 없는 포맷: {fmt}")
    except Exception as e:
        if not dry_run:
            from notification import send_alert
            send_alert(f"[ig_studio] {fmt} 생성 실패: {e}\n{traceback.format_exc()[-500:]}")
        raise
    finally:
        if not dry_run and hasattr(signal, "SIGALRM"):
            signal.alarm(0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("format", choices=["ranking", "course", "closing", "crowd"])
    parser.add_argument("--date", type=str, default=None)
    parser.add_argument("--region", type=str, default=None, help="course 포맷 지역 강제 지정(로테이션 무시)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    target = date.fromisoformat(args.date) if args.date else datetime.now(KST).date()

    result = run_format(args.format, target, dry_run=args.dry_run, region_override=args.region)
    print(f"완료: created={result.get('created')} needs_review={result.get('payload', {}).get('needs_review')}")


if __name__ == "__main__":
    main()
