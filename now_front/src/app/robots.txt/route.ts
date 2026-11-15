// robots.txt — 다음 웹마스터도구 소유 확인 주석을 넣으려고 robots.ts(MetadataRoute, 주석 불가)를 텍스트 라우트로 바꿨다(2026-11-16).
// 규칙은 이전 robots.ts와 동일: 검색봇 허용 + 비공개 경로 차단 + 사이트맵.
export const dynamic = 'force-static'

const DAUM_VERIFY = '#DaumWebMasterTool:43f1fada830224a5d3bd67c6f04ae299da4f2d12ce12f185bff9da3a38b3f8a7:CNSJIIGOISrSV2aL3hPlgQ=='

const ALLOW = ['/', '/posts/', '/privacy', '/feedback', '/ranking', '/en/ranking', '/zh/ranking', '/ja/ranking']
const DISALLOW = ['/admin', '/my', '/login', '/signup', '/auth/', '/api/']

export function GET() {
  const body = [
    DAUM_VERIFY,
    'User-Agent: *',
    ...ALLOW.map((p) => `Allow: ${p}`),
    ...DISALLOW.map((p) => `Disallow: ${p}`),
    '',
    'Sitemap: https://now.nemoneai.com/sitemap.xml',
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
