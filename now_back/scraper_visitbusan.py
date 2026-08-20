"""비짓부산(visitbusan.net) 이용안내 정보 스크래퍼.

순수 서버 렌더링 페이지라 requests+HTML 파싱만으로 충분(JS/API 불필요, Playwright 불필요).
목록 페이지의 블로그식 헤드라인·본문은 전부 건너뛰고, 상세페이지의 "이용안내"(주소/전화/
홈페이지/휴무일/운영시간/교통정보) 구조화 정보만 추출한다 — 비짓부산 에디터가 쓴 기사 본문은
제3자 저작물이라 그대로 안 씀(2026-08-15).

장소명은 상세페이지 h4.tit(헤드라인)에서 뽑는다. "음악과 함께 혼술하고 싶은 날, '광안리 골방'"
처럼 에디토리얼 문구+따옴표 안에 실제 이름이 들어있는 경우가 있고, "지그재그아트센터"처럼
헤드라인 자체가 이미 이름인 경우도 있어서 — 따옴표 안 텍스트 우선 추출, 없으면 쉼표 뒤
마지막 구절, 그것도 없으면 헤드라인 전체를 그대로 씀(실측 3건으로 검증, 2026-08-15).
대표 이미지는 상세페이지에서 JS(imgLoadComm2)로 나중에 채워지는 자리라 정적 HTML엔 없음 —
대신 목록 페이지 썸네일을 그대로 씀.

영어(en)/일본어(ja)는 lang_cd 파라미터로 비짓부산 공식 번역이 나오지만 항목마다 있을 수도
없을 수도 있음(실측: 특정 항목은 이용안내 자체가 EN 버전에 없었음 — 없으면 빈 dict로 처리하고
collector 쪽에서 한글로 폴백). 중국어(zh/zht)는 이용안내가 아예 번역 안 되고 한글 그대로
나옴(실측 확인) — 중국어만 collector에서 ai_translate_zh로 자체 번역 필요.
"""
import re
from typing import Optional

import httpx
from bs4 import BeautifulSoup

_BASE = "https://www.visitbusan.net/index.do"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
}

_LABEL_KEY_MAP = {
    "주소": "address", "전화번호": "tel", "홈페이지": "homepage",
    "휴무일": "closed", "운영요일 및 시간": "hours", "교통정보": "traffic",
}

# content에 이 순서대로 노출(라벨 통일 — ko/en/ja 필드 라벨이 언어별로 다르므로 key 기준으로 재구성)
_CONTENT_LABEL = {
    "ko": {"address": "주소", "tel": "전화번호", "homepage": "홈페이지", "closed": "휴무일", "hours": "운영시간", "traffic": "교통정보"},
    "en": {"address": "Address", "tel": "Phone", "homepage": "Website", "closed": "Closed", "hours": "Hours", "traffic": "Directions"},
    "ja": {"address": "住所", "tel": "電話番号", "homepage": "ホームページ", "closed": "休業日", "hours": "営業時間", "traffic": "交通情報"},
}

_QUOTE_RE = re.compile(r"[‘’']([^‘’']+)[‘’']")


def _clean_place_name(headline: str) -> str:
    m = _QUOTE_RE.search(headline)
    if m:
        return m.group(1).strip()
    if "," in headline:
        return headline.rsplit(",", 1)[-1].strip()
    return headline.strip()


def _parse_list_page(html: str) -> list[dict]:
    """목록 페이지에서 uc_seq + 썸네일 이미지 순서대로(중복 제거) 추출."""
    soup = BeautifulSoup(html, "html.parser")
    seen: set[str] = set()
    result: list[dict] = []
    for item in soup.select("div.hot_item_list div.hot-item"):
        a = item.select_one("a[href*='uc_seq=']")
        if not a:
            continue
        m = re.search(r"uc_seq=(\d+)", a.get("href", ""))
        if not m:
            continue
        uc_seq = m.group(1)
        if uc_seq in seen:
            continue
        seen.add(uc_seq)
        img = item.select_one("img")
        thumb = img.get("src") if img else None
        if thumb and thumb.startswith("/"):
            thumb = "https://www.visitbusan.net" + thumb
        result.append({"uc_seq": uc_seq, "thumb": thumb})
    return result


def get_visitbusan_list(menu_cd: str, ucc2_seq: Optional[str] = None, max_pages: int = 15) -> list[dict]:
    """목록을 마지막 페이지까지(또는 max_pages까지) 순회해 {uc_seq, thumb} 목록 수집."""
    all_items: list[dict] = []
    seen: set[str] = set()
    with httpx.Client(headers=_HEADERS, timeout=15) as client:
        for page in range(1, max_pages + 1):
            params = {
                "menuCd": menu_cd,
                "list_type": "TYPE_SMALL_CARD",
                "order_type": "NEW",
                "listCntPerPage2": 16,
                "page_no": page,
            }
            if ucc2_seq:
                params["ucc2_seq"] = ucc2_seq
            resp = client.get(_BASE, params=params)
            resp.raise_for_status()
            page_items = [i for i in _parse_list_page(resp.text) if i["uc_seq"] not in seen]
            if not page_items:
                break
            for i in page_items:
                seen.add(i["uc_seq"])
            all_items.extend(page_items)
    return all_items


def _parse_detail_page(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    h4 = soup.select_one("h4.tit")
    title = _clean_place_name(h4.get_text(strip=True)) if h4 else ""

    info: dict[str, str] = {}
    for li in soup.select("ul.InfoD-List > li"):
        label_tag = li.select_one("p")
        value_tag = li.select_one("span")
        if not label_tag or not value_tag:
            continue
        label = label_tag.get_text(strip=True)
        value = value_tag.get_text(" ", strip=True)
        key = _LABEL_KEY_MAP.get(label, label)
        info[key] = value

    return {"title": title, "info": info}


def get_visitbusan_detail(menu_cd: str, uc_seq: str, lang_cd: str = "ko") -> dict:
    with httpx.Client(headers=_HEADERS, timeout=15) as client:
        resp = client.get(_BASE, params={"menuCd": menu_cd, "uc_seq": uc_seq, "lang_cd": lang_cd})
        resp.raise_for_status()
    return _parse_detail_page(resp.text)


def build_content(info: dict, lang: str = "ko") -> str:
    labels = _CONTENT_LABEL.get(lang, _CONTENT_LABEL["ko"])
    lines = [f"{labels.get(k, k)}: {v}" for k, v in info.items() if v]
    return "\n".join(lines)
