import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export const revalidate = 3600;

interface PopularPlace {
  id: number;
  title: string;
  title_en?: string | null;
  region: string;
  location?: string;
  date_range?: string;
  category?: string | null;
  view_count?: number;
  like_count?: number;
  score?: number;
  is_new?: boolean;
}

// 백엔드가 아직 번역 못 넣은 로우 대비 — title_en 없으면 한국어 title로 폴백
const REGION_LABEL_EN: Record<string, string> = {
  '성수': 'Seongsu',
  '홍대': 'Hongdae',
  '강북': 'Gangbuk',
  '강남': 'Gangnam',
  '제주': 'Jeju',
  '공연': 'Concert',
  '축제': 'Festival',
};

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
  const top = places.slice(0, 5).map(p => p.title_en || p.title).join(', ');
  const title = 'Real-Time Popular Pop-ups & Hot Spots in Seoul & Jeju TOP 25 | NOW HERE';
  const description = `Live ranking of the most popular pop-up stores, exhibitions, and events across Seongsu, Hongdae, Gangbuk, Gangnam, and Jeju. ${top || 'Check out the hottest spots right now.'}`;
  return {
    title,
    description,
    alternates: {
      canonical: 'https://now.nemoneai.com/en/ranking/place',
      languages: {
        'ko': 'https://now.nemoneai.com/ranking/place',
        'en': 'https://now.nemoneai.com/en/ranking/place',
        'zh': 'https://now.nemoneai.com/zh/ranking/place',
        'x-default': 'https://now.nemoneai.com/ranking/place',
      },
    },
    openGraph: { title, description, url: 'https://now.nemoneai.com/en/ranking/place', type: 'website' },
  };
}

export default async function PlaceRankingPageEn() {
  const places = await getPopularPlaces();

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-16 border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">Popular Hot Spots</h1>
          <div className="ml-auto flex gap-2 text-[10px] font-bold text-zinc-400">
            <Link href="/ranking/place" className="hover:text-zinc-700">KO</Link>
            <Link href="/zh/ranking/place" className="hover:text-zinc-700">中文</Link>
          </div>
        </div>
        <BrandTagline />
      </header>

      <main className="px-6 pt-6 space-y-3">
        <p className="text-xs text-zinc-400 leading-relaxed mb-2">
          Real-time TOP 25 ranking based on views and likes over the last 48 hours, across Seongsu, Hongdae, Gangbuk, Jeju, concerts, and festivals.
        </p>

        {places.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-20">Data is being prepared.</p>
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
                <h2 className="font-bold text-zinc-900 text-sm truncate">{place.title_en || place.title}</h2>
                {place.category === 'class' && (
                  <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">Class</span>
                )}
                {place.is_new && (
                  <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400">NEW</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">{REGION_LABEL_EN[place.region] || place.region}{place.date_range ? ` · ${place.date_range}` : ''}</p>
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
