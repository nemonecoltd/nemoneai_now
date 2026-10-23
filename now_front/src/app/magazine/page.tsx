import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import Logo from '@/components/Logo';
import BottomNav from '@/components/BottomNav';
import SiteFooter from '@/components/SiteFooter';
import SideCardLayout from '@/components/sidecards/SideCardLayout';
import { WIDE_FRAME, WIDE_FRAME_BORDER } from '@/components/sidecards/frame';
import { cn } from '@/lib/utils';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export const revalidate = 600;

interface MagazineItem {
  id: number;
  title: string;
  image_url?: string | null;
  category?: string | null;
  created_at?: string | null;
  excerpt?: string;
}

async function getMagazine(): Promise<MagazineItem[]> {
  try {
    const res = await fetch(`${BACKEND}/magazine`, { next: { revalidate: 600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// 2026-10-24: PACE 소속 기사(맛매치 Special #5)의 색인·정본이 PACE로 이동 — 크롤러가 개별 기사를 발견하도록
// 서버에서 목록을 그려 둔 인덱스 페이지(푸터 링크 + 사이트맵에 포함).
const PER_PAGE = 20;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const { page: pageParam } = await searchParams;
  // 범위를 벗어난 ?page=N은 마지막 페이지로 보여 주므로 정본도 그쪽으로(임의 번호로 중복 페이지가 생기지 않게)
  const total = Math.max(1, Math.ceil((await getMagazine()).length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(pageParam || '1', 10) || 1), total);
  const canonical = page > 1 ? `https://now.nemoneai.com/magazine?page=${page}` : 'https://now.nemoneai.com/magazine';
  return { ...baseMetadata, title: page > 1 ? `${baseMetadata.title} (${page}페이지)` : baseMetadata.title, alternates: { canonical } };
}

const baseMetadata: Metadata = {
  title: 'NEMONE PACE 매거진 — 서울 팝업·핫플레이스 이야기',
  description: '서울·부산·제주 팝업스토어 주간 랭킹과 핫플레이스 이야기. NEMONE PACE가 직접 쓰는 매거진.',
  alternates: { canonical: 'https://now.nemoneai.com/magazine' },
  openGraph: {
    title: 'NEMONE PACE 매거진',
    description: '서울·부산·제주 팝업스토어 주간 랭킹과 핫플레이스 이야기.',
    url: 'https://now.nemoneai.com/magazine',
    type: 'website',
    locale: 'ko_KR',
  },
};

export default async function MagazineIndexPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageParam } = await searchParams;
  const all = await getMagazine();
  const totalPages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const page = Math.min(Math.max(1, parseInt(pageParam || '1', 10) || 1), totalPages);
  const posts = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  return (
    <div className={cn('min-h-screen bg-zinc-50 relative pb-28', WIDE_FRAME, WIDE_FRAME_BORDER)}>
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600 flex-shrink-0">
            <ChevronLeft size={20} />
          </Link>
          <Logo href="/" className="h-6" />
        </div>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900 mt-2">NEMONE PACE 매거진</h1>
      </header>

      <main>
        <SideCardLayout lang="ko">
          <div className="px-6 pt-6 space-y-3">
            {posts.length === 0 && (
              <p className="text-center text-zinc-400 text-sm py-20">기사를 준비 중입니다.</p>
            )}
            <ul className="space-y-3">
              {posts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/magazine/${p.id}`}
                    className="flex gap-4 rounded-2xl border border-zinc-100 bg-white p-3 hover:border-zinc-300"
                  >
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={p.title} loading="lazy" className="h-24 w-24 flex-shrink-0 rounded-xl object-cover bg-zinc-100" />
                    ) : (
                      <div className="h-24 w-24 flex-shrink-0 rounded-xl bg-zinc-100" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-zinc-900 line-clamp-2">{p.title}</p>
                      {p.excerpt && <p className="mt-1 text-sm text-zinc-500 line-clamp-2">{p.excerpt}</p>}
                      {p.created_at && <p className="mt-1 text-xs text-zinc-400">{p.created_at.slice(0, 10).replace(/-/g, '.')}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            {totalPages > 1 && (
              <nav className="flex items-center justify-center gap-4 pt-4 text-sm font-bold" aria-label="매거진 페이지">
                {page > 1 ? <Link href={page === 2 ? '/magazine' : `/magazine?page=${page - 1}`} rel="prev" className="text-pace-600">← 이전</Link> : <span className="text-zinc-300">← 이전</span>}
                <span className="text-zinc-500">{page} / {totalPages}</span>
                {page < totalPages ? <Link href={`/magazine?page=${page + 1}`} rel="next" className="text-pace-600">다음 →</Link> : <span className="text-zinc-300">다음 →</span>}
              </nav>
            )}
            <SiteFooter lang="ko" />
          </div>
        </SideCardLayout>
      </main>

      <BottomNav lang="ko" wide />
    </div>
  );
}
