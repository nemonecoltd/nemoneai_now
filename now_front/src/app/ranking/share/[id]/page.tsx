import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

interface RankingShareItem {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  image_url?: string;
  region?: string;
  category?: string | null;
  date_range?: string;
  score?: number;
  description?: string;
}

interface RankingShare {
  id: number;
  tab: string;
  region: string | null;
  label: string;
  items: RankingShareItem[];
  created_at: string;
}

async function getRankingShare(id: string): Promise<RankingShare | null> {
  try {
    const res = await fetch(`${BACKEND}/ranking/share/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatSnapshotTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${d.getHours()}시 기준`;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const share = await getRankingShare(id);
  const canonical = `https://now.nemoneai.com/ranking/share/${id}`;
  if (!share) {
    return { title: '공유된 랭킹 | 지금여기', alternates: { canonical } };
  }
  const top = share.items.slice(0, 5).map((it) => it.title).join(', ');
  const title = `${share.label} | 지금여기`;
  const description = `${formatSnapshotTime(share.created_at)} — ${top}`;
  const image = share.items[0]?.image_url || '/og-image.jpg';
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, images: [image], type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
    robots: { index: false, follow: true }, // 특정 시점 스냅샷이라 검색 색인은 제외, 링크 공유용으로만 사용
  };
}

export default async function RankingSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await getRankingShare(id);

  if (!share) {
    return (
      <div className="min-h-screen bg-zinc-50 max-w-md mx-auto flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold text-zinc-800">공유된 랭킹을 찾을 수 없습니다</p>
        <p className="text-sm text-zinc-400">링크가 만료되었거나 삭제되었을 수 있어요.</p>
        <Link href="/" className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">지금여기 홈으로</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-16 border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">{share.label}</h1>
        </div>
        <BrandTagline />
      </header>

      <main className="px-6 pt-6 space-y-3">
        <p className="text-xs text-zinc-400 leading-relaxed mb-2">
          {formatSnapshotTime(share.created_at)}으로 고정된 랭킹입니다. 지금은 순위가 달라졌을 수 있어요.
        </p>

        {share.items.map((place, idx) => {
          const card = (
            <>
              <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </span>
              <img
                src={place.image_url || `https://picsum.photos/seed/share-${place.id}/200`}
                className="w-12 h-12 rounded-xl object-cover border border-zinc-50 flex-shrink-0"
                alt={place.title}
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-zinc-900 text-sm truncate">{place.title}</h2>
                <p className="text-[10px] text-zinc-400 truncate">
                  {share.tab === 'theme' ? place.description : `${place.region || ''}${place.date_range ? ` · ${place.date_range}` : ''}`}
                </p>
              </div>
              {typeof place.score === 'number' && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 flex-shrink-0">
                  <Flame size={11} fill="currentColor" /> {place.score}
                </span>
              )}
              {share.tab !== 'theme' && <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />}
            </>
          );
          return share.tab === 'theme' ? (
            <div key={place.id} className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
              {card}
            </div>
          ) : (
            <Link key={place.id} href={`/posts/${place.id}`} className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
              {card}
            </Link>
          );
        })}

        <Link href="/" className="block text-center mt-6 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">
          지금 실시간 랭킹 보러가기
        </Link>
      </main>
    </div>
  );
}
