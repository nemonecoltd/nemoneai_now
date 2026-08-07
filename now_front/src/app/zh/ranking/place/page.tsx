import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export const revalidate = 3600;

interface PopularPlace {
  id: number;
  title: string;
  title_zh?: string | null;
  region: string;
  location?: string;
  date_range?: string;
  category?: string | null;
  view_count?: number;
  like_count?: number;
  score?: number;
  is_new?: boolean;
}

// 백엔드가 아직 번역 못 넣은 로우 대비 — title_zh 없으면 한국어 title로 폴백
const REGION_LABEL_ZH: Record<string, string> = {
  '성수': '圣水洞',
  '홍대': '弘大',
  '강북': '江北',
  '강남': '江南',
  '부산': '釜山',
  '제주': '济州',
  '공연': '演出',
  '축제': '节庆',
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
  const top = places.slice(0, 5).map(p => p.title_zh || p.title).join('、');
  const title = '首尔·济州实时人气快闪店排行榜 TOP 25 | NOW HERE';
  const description = `圣水洞、弘大、江北、江南、济州快闪店、展览、活动实时人气排行榜。${top || '快来看看现在最热门的地方吧。'}`;
  return {
    title,
    description,
    alternates: {
      canonical: 'https://now.nemoneai.com/zh/ranking/place',
      languages: {
        'ko': 'https://now.nemoneai.com/ranking/place',
        'en': 'https://now.nemoneai.com/en/ranking/place',
        'zh': 'https://now.nemoneai.com/zh/ranking/place',
        'ja': 'https://now.nemoneai.com/ja/ranking/place',
        'x-default': 'https://now.nemoneai.com/ranking/place',
      },
    },
    openGraph: { title, description, url: 'https://now.nemoneai.com/zh/ranking/place', type: 'website' },
  };
}

export default async function PlaceRankingPageZh() {
  const places = await getPopularPlaces();

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-16 border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">实时人气热门地点</h1>
          <div className="ml-auto flex gap-2 text-[10px] font-bold text-zinc-400">
            <Link href="/ranking/place" className="hover:text-zinc-700">KO</Link>
            <Link href="/en/ranking/place" className="hover:text-zinc-700">EN</Link>
            <Link href="/ja/ranking/place" className="hover:text-zinc-700">日本語</Link>
          </div>
        </div>
        <BrandTagline />
      </header>

      <main className="px-6 pt-6 space-y-3">
        <p className="text-xs text-zinc-400 leading-relaxed mb-2">
          根据最近48小时的浏览量和点赞数统计，圣水洞、弘大、江北、济州、演出、节庆综合实时TOP 25排行榜。
        </p>

        {places.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-20">数据准备中。</p>
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
                <h2 className="font-bold text-zinc-900 text-sm truncate">{place.title_zh || place.title}</h2>
                {place.category === 'class' && (
                  <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">体验课程</span>
                )}
                {place.is_new && (
                  <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400">NEW</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">{REGION_LABEL_ZH[place.region] || place.region}{place.date_range ? ` · ${place.date_range}` : ''}</p>
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
