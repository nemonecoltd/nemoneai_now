import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export const revalidate = 3600;

// 영문 슬러그 사용 — output:'standalone' 서버가 한글(비ASCII) 동적 세그먼트의
// 정적 프리렌더 페이지를 못 찾는 Next.js 버그(HTML/매니페스트는 정상인데 404)를 피하기 위함.
// SEO에 중요한 건 URL 텍스트가 아니라 title/H1의 한글 키워드라 슬러그는 영문이어도 무방.
const SLUG_TO_REGION = {
  seongsu: '성수',
  hongdae: '홍대',
  gangbuk: '강북',
  gangnam: '강남',
  busan: '부산',
  jeju: '제주',
} as const;
type Slug = keyof typeof SLUG_TO_REGION;
const SLUGS = Object.keys(SLUG_TO_REGION) as Slug[];

const REGION_AREA: Record<Slug, string> = {
  seongsu: '성수동',
  hongdae: '홍대·상수',
  gangbuk: '용산·강북',
  gangnam: '강남·서초·송파',
  busan: '부산',
  jeju: '제주',
};

export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

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
  is_new?: boolean;
}

async function getPopularPlaces(region: string): Promise<PopularPlace[]> {
  try {
    const res = await fetch(`${BACKEND}/places/popular?region=${encodeURIComponent(region)}&limit=25`, { next: { revalidate } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const region = SLUG_TO_REGION[slug as Slug];
  if (!region) return {};

  const places = await getPopularPlaces(region);
  const top = places.slice(0, 5).map(p => p.title).join(', ');
  const title = `${region} 팝업 실시간 인기 순위 TOP 25`;
  const description = `지금 ${region}(${REGION_AREA[slug as Slug]})에서 가장 인기있는 팝업스토어 실시간 순위. ${top || `지금 ${region}에서 가장 핫한 팝업을 확인해보세요.`}`;
  const canonical = `https://now.nemoneai.com/ranking/place/${slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website' },
  };
}

export default async function PlaceRankingRegionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const region = SLUG_TO_REGION[slug as Slug];
  if (!region) notFound();

  const places = await getPopularPlaces(region);

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-16 border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-4">
          <Link href="/ranking/place" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">{region} 팝업 실시간 인기</h1>
        </div>
        <BrandTagline />
      </header>

      <main className="px-6 pt-6 space-y-3">
        <p className="text-xs text-zinc-400 leading-relaxed mb-2">
          최근 48시간 조회수·좋아요 기준, {region}({REGION_AREA[slug as Slug]}) 팝업스토어 실시간 TOP 25입니다.
        </p>

        {/* 지역 간 내부링크 — 크롤러가 다른 지역 허브도 발견하도록 */}
        <div className="flex flex-wrap gap-1.5 pb-2">
          {SLUGS.filter(s => s !== slug).map(s => (
            <Link
              key={s}
              href={`/ranking/place/${s}`}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
            >
              {SLUG_TO_REGION[s]}
            </Link>
          ))}
        </div>

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
                {place.is_new && (
                  <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400">NEW</span>
                )}
              </div>
              <p className="text-[10px] text-zinc-400">{place.location || place.region}{place.date_range ? ` · ${place.date_range}` : ''}</p>
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
