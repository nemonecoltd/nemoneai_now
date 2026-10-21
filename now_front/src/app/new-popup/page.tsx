// 핫플 > NEW팝업 목록 (SEO용 서버 렌더링). 열려 있는 팝업을 최신 등록순으로 보여 준다.
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
const TITLE = '서울 NEW 팝업스토어 목록'
const DESCRIPTION = '성수·홍대·강남·강북 등 서울에서 지금 열리는 새 팝업스토어를 최신순으로 모아 보세요.'

export const revalidate = 600

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE}/new-popup` },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE}/new-popup`, type: 'website', siteName: 'NEMONE PACE' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

type Item = { id: number; title: string; region?: string | null; date_range?: string | null; location?: string | null; image_url?: string | null }

async function loadItems(): Promise<Item[]> {
  try {
    const res = await fetch(`${BACKEND}/places?sort=new&category=popup&limit=100`, { next: { revalidate: 600 } })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export default async function NewPopupPage() {
  const items = await loadItems()
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '서울 NEW 팝업스토어',
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
            <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">서울 NEW 팝업스토어</h1>
            {items.length === 0 ? (
              <p className="text-center text-zinc-400 text-sm py-20">표시할 팝업이 없어요.</p>
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
            <p className="pt-2 text-center text-xs text-zinc-400">최근 5일 안에 새로 등록된 팝업스토어를 모았어요.</p>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          </div>
          <SiteFooter lang="ko" />
        </SideCardLayout>
      </main>

      <BottomNav lang="ko" wide />
    </div>
  )
}
