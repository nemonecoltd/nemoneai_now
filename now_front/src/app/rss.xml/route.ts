// 네이버 서치어드바이저 등 RSS 제출용 피드(2026-11-16 신설) — PACE 매거진 글(주간 랭킹 등).
// 정본이 PACE인 글(SERVICE_OWNED_SINCE 이후 발행분, 사이트맵과 같은 기준)만 싣는다. 그 전 글은 맛매치가 정본이다.
// 팝업 목록은 발행일이 없어(목록 API에 날짜 필드 없음) 싣지 않는다 — 신규 팝업 발견은 /new-popup·사이트맵이 맡는다.
// 요청 시 생성(force-dynamic): 정적 생성이면 로컬 빌드(백엔드 없음) 때 빈 피드가 굳는다(2026-11-16 플랜트 사고). 데이터 fetch는 10분 캐시.
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const BASE = 'https://now.nemoneai.com'
const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081'

const esc = (s: string) =>
  (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Post = { id: string | number; title: string; created_at?: string | null; excerpt?: string | null; category?: string | null }

// created_at은 시간대 표기가 없는 KST 값이라 +09:00을 붙여 해석한다
const toDate = (v?: string | null) => {
  if (!v) return null
  const d = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(v) ? v : `${v}+09:00`)
  return isNaN(d.getTime()) ? null : d
}

export async function GET() {
  let posts: Post[] = []
  try {
    const res = await fetch(`${BACKEND}/magazine`, { next: { revalidate: 600 } })
    if (res.ok) {
      const data = await res.json()
      posts = Array.isArray(data) ? data : []
    }
  } catch (e) {
    console.error('RSS fetch error:', e)
  }

  const ownedSince = process.env.SERVICE_OWNED_SINCE || '2026-10-24'
  const items = posts
    .filter((p) => p.title && String(p.created_at || '').slice(0, 10) >= ownedSince && toDate(p.created_at))
    .sort((a, b) => toDate(b.created_at)!.getTime() - toDate(a.created_at)!.getTime())
    .slice(0, 50)

  const lastBuild = (items[0] ? toDate(items[0].created_at)! : new Date()).toUTCString()
  const body = items
    .map((p) => {
      const url = `${BASE}/magazine/${p.id}`
      return `    <item>
      <title>${esc(p.title.trim())}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${toDate(p.created_at)!.toUTCString()}</pubDate>
      ${p.category ? `<category>${esc(p.category)}</category>` : ''}
      <description>${esc((p.excerpt || p.title).trim())}</description>
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>NEMONE PACE</title>
    <link>${BASE}</link>
    <description>${esc('당신의 다음 3시간을 AI가 설계합니다 — 핫플 매거진·주간 랭킹')}</description>
    <language>ko</language>
    <lastBuildDate>${lastBuild}</lastBuildDate>
${body}
  </channel>
</rss>`

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=1800, s-maxage=1800' },
  })
}
