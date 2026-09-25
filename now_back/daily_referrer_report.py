#!/usr/bin/env python3
"""PACE(now.nemoneai.com) 일일 유입 리포트 — nginx 접근 로그 기반, 매일 21:00 KST 텔레그램 발송.

집계 구간(모두 KST)
  오늘   : [T-24h, T)          T = 실행 시각(21:00)
  어제   : [T-48h, T-24h)      → "전일대비"
  7일전  : [T-7d-24h, T-7d)    → "7일전대비"

'유입' = 사람으로 보이는 방문자가 외부 링크/직접입력으로 now 페이지에 도착한 페이지뷰.
사이트 안에서 이동하거나 화면 링크를 미리 불러오는 요청(Next.js 프리페치)은 리퍼러가 내부라 제외된다.

서비스 판정
  - 로그 끝에 도메인 필드가 있으면(`"$host"`, nginx log_format 확장 이후) 그걸 그대로 쓴다.
  - 없는 예전 로그는 추정: 같은 접속자(ip+UA)가 now 전용 정적파일/`/api-now/`를 함께 요청했는지로 판정.
    → 추정 구간은 캐시 등으로 실제보다 적게 잡힐 수 있어 리포트에 각주를 붙인다.

사용: python3 daily_referrer_report.py [--at "2026-09-25 21:00"] [--send]
      (--send 없으면 화면 출력만. 토큰은 now_back/.env의 TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)
"""
import argparse
import collections
import glob
import gzip
import os
import re
import sys
import datetime as dt
from urllib.parse import urlparse

LOG_GLOB = "/var/log/nginx/access.log*"
ENV_PATH = "/home/ubuntu/apps/now_back/.env"
NOW_HOST = "now.nemoneai.com"
OWN = {"now.nemoneai.com": "now", "nemoneai.com": "matmatch", "www.nemoneai.com": "matmatch",
       "plants.nemoneai.com": "plants", "msm.nemoneai.com": "msm", "admin.nemoneai.com": "admin",
       "auth.nemoneai.com": "auth", "home.nemoneai.com": "home"}

LINE = re.compile(r'^(\S+) - \S+ \[(\d+/\w+/\d+:\d+:\d+:\d+) ([+-]\d{4})\] "(\w+) (\S+)[^"]*" (\d+) (\d+) '
                  r'"([^"]*)" "([^"]*)"(?: "([^"]*)")?')
BOT = re.compile(r"bot|spider|crawl|slurp|Yeti|Daum|facebookexternalhit|Twitterbot|Slackbot|curl|python|wget|okhttp|"
                 r"Go-http|headless|Lighthouse|Apache-HttpClient|node-fetch|axios|Scrapy|monitor|uptime|Java/|libwww|"
                 r"Bingpreview|WhatsApp|Telegram|Discord|PlayStore|Mediapartners|AdsBot|Google-Read|FeedFetcher|Nexus 5X Build/MMB29P", re.I)
ASSET = re.compile(r"^/(_next|api|favicon|static|hero|brand|images|robots|sitemap|ads\.txt|\.well|apple-touch|manifest|sw\.js)"
                   r"|\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?|map|txt|xml|json)(\?|$)")
KST = dt.timedelta(hours=9)
BOT_IP_FILE = "/etc/nginx/conf.d/now_botips.geo.inc"   # 검색엔진 공식 IP 대역(update_now_bot_ips.py가 매일 갱신)
_bot_nets = None
_bot_ip_cache = {}


def is_bot_ip(ip):
    """구글 등은 UA를 'Nexus 5X'처럼 일반 기기로 위장해 이름 필터를 통과하므로, 공식 대역 IP는 봇으로 본다."""
    global _bot_nets
    if _bot_nets is None:
        import ipaddress
        _bot_nets = []
        try:
            for l in open(BOT_IP_FILE):
                parts = l.split()
                if len(parts) == 2 and parts[1].startswith("1"):
                    _bot_nets.append(ipaddress.ip_network(parts[0], strict=False))
        except OSError:
            pass
    if ip not in _bot_ip_cache:
        import ipaddress
        try:
            a = ipaddress.ip_address(ip)
            _bot_ip_cache[ip] = any(a in n for n in _bot_nets if n.version == a.version)
        except ValueError:
            _bot_ip_cache[ip] = False
    return _bot_ip_cache[ip]
# 리포트 채널은 5개만 — 다음·카카오/인스타/페이스북/유튜브/X/빙 등은 전부 "기타"로 묶는다(사용자 요청 2026-09-25)
CHANNELS = ["직접", "구글", "네이버", "AI", "기타"]
NAVER_SUB = ["검색", "카페", "블로그", "지도", "기타"]


def host_of(ref):
    try:
        return urlparse(ref).hostname or ""
    except ValueError:
        return ""


def classify(ref):
    """리퍼러 → (채널, 네이버 세부). 내부 리퍼러는 ("내부", None)."""
    h = host_of(ref)
    if not h:
        return "직접", None
    if h in OWN:
        return "내부", None
    if "naver" in h or h.endswith("naver.me"):
        sub = "검색" if "search.naver" in h else "카페" if "cafe" in h else "블로그" if "blog" in h else "지도" if "map" in h else "기타"
        return "네이버", sub
    if any(k in h for k in ("chatgpt", "openai", "perplexity", "claude", "gemini")):
        return "AI", None
    if "google" in h:
        return "구글", None
    return "기타", None


def load(lo, hi):
    """[lo, hi) KST 구간 로그만 로드. 회전 파일(.gz 포함) 전부 훑되 시각으로 거른다."""
    rows = []
    files = sorted(glob.glob(LOG_GLOB))
    for f in files:
        op = gzip.open if f.endswith(".gz") else open
        with op(f, "rt", errors="ignore") as fh:
            for l in fh:
                m = LINE.match(l)
                if not m:
                    continue
                ip, ts, tz, meth, path, st, _sz, ref, ua, host = m.groups()
                try:
                    t = dt.datetime.strptime(ts, "%d/%b/%Y:%H:%M:%S")
                except ValueError:
                    continue
                off = dt.timedelta(hours=int(tz[1:3]), minutes=int(tz[3:5])) * (1 if tz[0] == "+" else -1)
                t = t - off + KST
                if lo <= t < hi:
                    rows.append((t, ip, meth, path, int(st), ref, ua, host or ""))
    rows.sort(key=lambda r: r[0])
    return rows


def entries(rows):
    """구간 내 now 사람 유입 목록 [(t, ip, ua, path, channel, sub, estimated)]"""
    # 호스트 정보가 없는 줄에 대한 추정용 학습: now 전용 정적파일 + /api-now/
    seen = collections.defaultdict(set)
    for t, ip, meth, path, st, ref, ua, host in rows:
        if path.startswith("/_next/static/") and OWN.get(host_of(ref)):
            seen[path.split("?")[0]].add(OWN[host_of(ref)])
    now_asset = {p for p, s in seen.items() if s == {"now"}}
    idx = collections.defaultdict(list)
    for t, ip, meth, path, st, ref, ua, host in rows:
        if host:
            continue
        p = path.split("?")[0]
        if p in now_asset or path.startswith("/api-now/") or OWN.get(host_of(ref)) == "now":
            idx[(ip, ua)].append(t)

    out = []
    for t, ip, meth, path, st, ref, ua, host in rows:
        if meth != "GET" or st != 200 or ASSET.search(path) or BOT.search(ua) or "_rsc=" in path or is_bot_ip(ip):
            continue
        ch, sub = classify(ref)
        if ch == "내부":
            continue
        if host:
            if host != NOW_HOST:
                continue
            est = False
        else:
            if not any(-3 <= (x - t).total_seconds() <= 120 for x in idx.get((ip, ua), ())):
                continue
            est = True
        out.append((t, ip, ua, path, ch, sub, est))
    return out


def summarize(ent, lo, hi):
    ent = [e for e in ent if lo <= e[0] < hi]
    ch = collections.Counter(e[4] for e in ent)
    nav = collections.Counter(e[5] for e in ent if e[4] == "네이버")
    return {"ch": ch, "nav": nav, "total": len(ent), "visitors": len({(e[1], e[2]) for e in ent}),
            "est": sum(1 for e in ent if e[6])}


def delta(cur, prev, has_prev):
    if not has_prev:
        return "-"
    d = cur - prev
    if prev == 0:
        return "%+d(신규)" % d if cur else "0"
    return "%+d(%+.0f%%)" % (d, 100.0 * d / prev)


def build(T):
    d1 = dt.timedelta(days=1)
    w = {"오늘": (T - d1, T), "어제": (T - 2 * d1, T - d1), "7일전": (T - 8 * d1, T - 7 * d1)}
    ent = entries(load(T - 8 * d1, T))   # 로그는 한 번만 읽는다(가장 오래된 비교 구간부터)
    S = {k: summarize(ent, *v) for k, v in w.items()}
    # 비교 구간에 로그가 하나도 없으면(로그 보관 밖 등) '-'로 표시
    has = {k: S[k]["total"] > 0 for k in S}
    fmt = lambda t: t.strftime("%m/%d %H:%M")
    lines = ["📊 PACE 유입 리포트", "%s ~ %s (최근 24시간)" % (fmt(w["오늘"][0]), fmt(w["오늘"][1])), "",
             "채널: 오늘 | 전일대비 | 7일전대비"]
    for c in CHANNELS:
        cur, y, wk = S["오늘"]["ch"][c], S["어제"]["ch"][c], S["7일전"]["ch"][c]
        if cur == 0 and y == 0 and wk == 0:
            continue
        lines.append("%s: %d | %s | %s" % (c, cur, delta(cur, y, has["어제"]), delta(cur, wk, has["7일전"])))
        if c == "네이버" and cur:
            subs = ["%s %d" % (s, S["오늘"]["nav"][s]) for s in NAVER_SUB if S["오늘"]["nav"][s]]
            lines.append("   └ " + " / ".join(subs))
    tc, ty, tw = S["오늘"]["total"], S["어제"]["total"], S["7일전"]["total"]
    lines += ["────────", "합계: %d | %s | %s" % (tc, delta(tc, ty, has["어제"]), delta(tc, tw, has["7일전"])),
              "방문자(고유): %d" % S["오늘"]["visitors"]]
    notes = []
    if not has["어제"]:
        notes.append("전일 데이터 없음")
    if not has["7일전"]:
        notes.append("7일 전 데이터 없음")
    if notes:
        lines += ["", "※ " + " / ".join(notes)]
    return "\n".join(lines)


def send(text):
    import requests
    env = {}
    for l in open(ENV_PATH, errors="ignore"):
        if "=" in l and not l.lstrip().startswith("#"):
            k, v = l.strip().split("=", 1)
            env[k] = v.strip().strip('"').strip("'")
    token, chat = env.get("TELEGRAM_BOT_TOKEN"), env.get("TELEGRAM_CHAT_ID")
    if not token or not chat:
        raise SystemExit("텔레그램 토큰/채팅 ID가 없어 발송하지 못했습니다.")
    r = requests.post("https://api.telegram.org/bot%s/sendMessage" % token, json={"chat_id": chat, "text": text}, timeout=15)
    r.raise_for_status()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--at", help="기준 시각(KST) 'YYYY-MM-DD HH:MM'. 기본: 현재 시각")
    ap.add_argument("--send", action="store_true", help="텔레그램 발송(없으면 출력만)")
    a = ap.parse_args()
    T = dt.datetime.strptime(a.at, "%Y-%m-%d %H:%M") if a.at else (dt.datetime.utcnow() + KST).replace(second=0, microsecond=0)
    text = build(T)
    print(text)
    if a.send:
        send(text)
        print("\n[텔레그램 발송 완료]")


if __name__ == "__main__":
    sys.exit(main())
