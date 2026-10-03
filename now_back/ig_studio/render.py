"""Jinja2 → HTML → Playwright PNG + 넘침(overflow) 검사. payload만 알고 DB는 모른다."""
from __future__ import annotations
import asyncio
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from playwright.async_api import async_playwright

TEMPLATES_DIR = Path(__file__).with_name("templates")
_env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))

_OVERFLOW_CHECK_JS = """
() => {
  // body * 전체를 검사하면 제목의 text-overflow:ellipsis(의도적으로 처리된 넘침)까지
  // "넘침"으로 오탐한다 — 지시서 4절 의도는 "카드 규격(1080x1350/1920) 밖으로 실제
  // 내용이 밀려나는" 진짜 문제만 잡는 것이므로, 고정 높이 카드 루트(.feed/.story)
  // 자체가 자기 콘텐츠를 못 담는지만 본다(2026-09-17, 첫 dry-run에서 롱타이틀이
  // 전부 오탐되는 걸 발견해 수정).
  const bad = [];
  document.querySelectorAll('.feed, .story').forEach(el => {
    if (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2) {
      bad.push(el.id || el.className);
    }
  });
  return bad;
}
"""


async def render_card(template_name: str, payload: dict, output_path: Path, viewport: tuple[int, int]) -> list[str]:
    """template_name(예: 'mon_cover.html')을 렌더해 output_path에 PNG 저장.
    반환값: 넘침이 감지된 요소 클래스 목록(비어있으면 정상)."""
    template = _env.get_template(template_name)
    html = template.render(**payload)

    # _base.css가 `href="_base.css"`(상대경로) + 그 안의 폰트도 `../assets/fonts/...`(templates/
    # 기준 상대경로)라, 렌더된 임시 HTML을 output/ 아래 쓰면 두 경로 다 깨져서 CSS 변수(--navy 등)
    # 미정의로 배경·타일 색이 통째로 안 먹는 사고가 남(2026-09-17 첫 dry-run에서 발견 — 텍스트는
    # 뜨는데 남색 배경/타일이 하얗게 나옴). templates/ 안에 임시로 썼다가 스샷 후 지운다.
    import uuid
    tmp_html = TEMPLATES_DIR / f"_tmp_{uuid.uuid4().hex}.html"
    tmp_html.write_text(html, encoding="utf-8")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(viewport={"width": viewport[0], "height": viewport[1]})
            await page.goto(tmp_html.resolve().as_uri())
            await page.evaluate("document.fonts.ready")
            # wed_stop.html이 처음으로 원격 https 이미지(팝업 대표 사진)를 쓰기 시작하면서
            # (2026-09-20) 생긴 새 레이스 컨디션 — 폰트만 기다리고 스샷하면 이미지 다운로드가
            # 안 끝난 채로 캡처될 수 있다. 이미지가 없는 기존 템플릿에선 Array.every가 빈
            # 배열에 대해 즉시 true라 영향 없음.
            await page.wait_for_function(
                "Array.from(document.images).every(img => img.complete)", timeout=15000
            )
            await page.wait_for_timeout(300)
            overflow = await page.evaluate(_OVERFLOW_CHECK_JS)
            target = page.locator("section")
            await target.screenshot(path=str(output_path))
            await browser.close()
    finally:
        tmp_html.unlink(missing_ok=True)
        output_path.with_suffix(".html").write_text(html, encoding="utf-8")  # 디버깅용 사본은 output/에 남김
    return overflow


def render_card_sync(template_name: str, payload: dict, output_path: Path, viewport: tuple[int, int]) -> list[str]:
    return asyncio.run(render_card(template_name, payload, output_path, viewport))


FEED_VIEWPORT = (1080, 1350)
STORY_VIEWPORT = (1080, 1920)
