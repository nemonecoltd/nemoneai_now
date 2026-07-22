import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export const revalidate = 3600;

interface PopularPlace {
  id: number;
  title: string;
  region: string;
  location?: string;
  date_range?: string;
  category?: string | null;
  view_count?: number;
  like_count?: number;
  score?: number;
}

async function getPopularPlaces(): Promise<PopularPlace[]> {
  try {
    const res = await fetch(`${BACKEND}/places/popular?limit=25`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const places = await getPopularPlaces();
  const top = places.slice(0, 5).map(p => p.title).join(', ');
  const title = '실시간 인기 핫플 TOP 25 | 지금여기';
  const description = `성수·홍대·강북·제주·공연·축제 통합 실시간 인기 핫플. ${top || '지금 가장 인기있는 장소를 확인해보세요.'}`;
  return {
    title,
    description,
    alternates: { canonical: 'https://now.nemoneai.com/ranking/place' },
    openGraph: { title, description, url: 'https://now.nemoneai.com/ranking/place', type: 'website' },
  };
}

export default async function PlaceRankingPage() {
  const places = await getPopularPlaces();

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-16 border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">실시간 인기 핫플</h1>
        </div>
        <BrandTagline />
      </header>

      <main className="px-6 pt-6 space-y-3">
        <p className="text-xs text-zinc-400 leading-relaxed mb-2">
          최근 48시간 조회수·좋아요 기준, 성수·홍대·강북·제주·공연·축제 통합 실시간 TOP 25입니다.
        </p>

        {places.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-20">데이터를 준비 중입니다.</p>
        )}

        {places.map((place, idx) => (
          <Link
            key={place.id}
            href={`/posts/${place.id}`}
            className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm"
          >
            <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-zinc-900 text-sm truncate">{place.title}</h2>
                {place.category === 'class' && (
                  <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">클래스</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">{place.region}{place.date_range ? ` · ${place.date_range}` : ''}</p>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 flex-shrink-0">
              <Flame size={11} fill="currentColor" /> {place.score ?? place.like_count ?? 0}
            </span>
            <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
          </Link>
        ))}
      </main>
    </div>
  );
}
