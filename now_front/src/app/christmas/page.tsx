// 핫플 > 크리스마스 팝업 모음 (SEO용 서버 렌더링). 진행 중인 팝업 중 제목·소개에 크리스마스가 들어간 것만 모은다(2026-11-13).
import type { Metadata } from 'next'
import { placeImage } from '@/lib/placeImage'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import Logo from '@/components/Logo'
import BottomNav from '@/components/BottomNav'
import SiteFooter from '@/components/SiteFooter'
import SideCardLayout from '@/components/sidecards/SideCardLayout'
import { WIDE_FRAME, WIDE_FRAME_BORDER } from '@/components/sidecards/frame'
import { cn } from '@/lib/utils'
import AdUnit from '@/components/AdUnit'
import HeaderActions from '@/components/HeaderActions'

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081'
const SITE = 'https://now.nemoneai.com'
const TITLE = '크리스마스 팝업스토어 모음 2026'
const DESCRIPTION = '2026 크리스마스 시즌에 열리는 팝업스토어·마켓·행사를 모았어요. 성수·홍대·강남·강북·부산·제주 크리스마스 팝업을 날짜·장소와 함께 확인하세요.'
const OG_IMAGE = `${SITE}/og-image.jpg`   // 페이지에 openGraph를 따로 주면 루트 레이아웃의 이미지가 상속되지 않아, 미리보기에 본문 첫 이미지(예: 닭강정)가 잡혔다

export const revalidate = 600

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE}/christmas` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE}/christmas`, type: 'website', siteName: 'NEMONE PACE', images: [OG_IMAGE] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION, images: [OG_IMAGE] },
}

type Item = { id: number; title: string; content?: string | null; region?: string | null; date_range?: string | null; location?: string | null; image_url?: string | null }

async function loadItems(): Promise<Item[]> {
  try {
    const res = await fetch(`${BACKEND}/places?sort=latest&category=popup&limit=500`, { next: { revalidate: 600 } })
    if (!res.ok) return []
    const data = await res.json()
    // 제목 또는 소개에 크리스마스가 들어간 진행 중 팝업만(공연·축제는 /places?category=popup에 포함되지 않는다)
    const re = /크리스마스|christmas|xmas/i
    return Array.isArray(data) ? (data as Item[]).filter((p) => re.test(p.title || '') || re.test(p.content || '')) : []
  } catch {
    return []
  }
}

export default async function NewPopupPage() {
  const items = await loadItems()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '크리스마스 팝업스토어',
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/posts/${p.id}`, name: p.title })),
  }
  return (
    <div className={cn("min-h-screen bg-zinc-50 relative pb-28", WIDE_FRAME, WIDE_FRAME_BORDER)}>
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-2">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600 flex-shrink-0">
            <ChevronLeft size={20} />
          </Link>
          <Logo href="/" className="h-6" />
          <HeaderActions currentLang="ko" />
        </div>
      </header>

      <main>
        <SideCardLayout lang="ko">
          <div className="px-6 pt-6 space-y-3">
            <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">크리스마스 팝업스토어</h1>
            {items.length === 0 ? (
              <p className="text-center text-zinc-400 text-sm py-20">지금 진행 중인 크리스마스 팝업이 없어요. 새 소식이 올라오면 바로 모아 둘게요.</p>
            ) : (
              <div className="space-y-3">
                {items.map((p, idx) => (
                  <div key={p.id} className="space-y-3">
                    <Link href={`/posts/${p.id}`} className="flex items-center gap-4 rounded-2xl border border-zinc-100 bg-white p-3 hover:border-zinc-300">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={placeImage(p.id, p.image_url, 200, 200)} alt={p.title} loading="lazy" referrerPolicy="no-referrer" className="h-24 w-24 flex-shrink-0 rounded-xl object-cover bg-zinc-100" />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-zinc-900">{p.title}</p>
                        <p className="mt-1 text-sm text-zinc-500">{[p.region, p.date_range].filter(Boolean).join(' · ')}</p>
                        {p.location && <p className="mt-1 truncate text-xs text-zinc-400">{p.location}</p>}
                      </div>
                    </Link>
                    {(idx === 2 || idx === 14) && (
                      <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="pt-2 text-center text-xs text-zinc-400">제목이나 소개에 크리스마스가 들어간, 지금 열려 있거나 곧 열리는 팝업스토어를 모았어요.</p>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          </div>
          <SiteFooter lang="ko" />
        </SideCardLayout>
      </main>

      <BottomNav lang="ko" wide />
    </div>
  )
}
