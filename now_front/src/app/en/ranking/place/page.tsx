import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import Logo from '@/components/Logo';
import BottomNav from '@/components/BottomNav';
import SiteFooter from '@/components/SiteFooter';
import SideCardLayout from '@/components/sidecards/SideCardLayout';
import { WIDE_FRAME, WIDE_FRAME_BORDER } from '@/components/sidecards/frame';
import { cn } from '@/lib/utils';
import PopularRankingCards from '@/components/PopularRankingCards';
import RankingHeaderActions from '@/components/RankingHeaderActions';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export const revalidate = 3600;

interface PopularPlace {
  id: number;
  title: string;
  image_url?: string | null;
  title_zh?: string | null;
  title_ja?: string | null;
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
  '부산': 'Busan',
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
  // root layout의 title.template("%s | NEMONE PACE")이 접미사를 붙이므로 여기선 안 붙임(이중 방지)
  const title = 'Real-Time Popular Pop-ups & Hot Spots in Seoul & Jeju TOP 25';
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
        'ja': 'https://now.nemoneai.com/ja/ranking/place',
        'x-default': 'https://now.nemoneai.com/ranking/place',
      },
    },
    openGraph: { title, description, url: 'https://now.nemoneai.com/en/ranking/place', images: ['https://now.nemoneai.com/og-image.jpg'], type: 'website' },
  };
}

export default async function PlaceRankingPageEn() {
  const places = await getPopularPlaces();

  return (
    <div className={cn("min-h-screen bg-zinc-50 relative pb-28", WIDE_FRAME, WIDE_FRAME_BORDER)}>
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600 flex-shrink-0">
            <ChevronLeft size={20} />
          </Link>
          <Logo href="/" className="h-6" />
          <RankingHeaderActions lang="en" path="/ranking/place" />
        </div>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900 mt-2">Popular Hot Spots</h1>
      </header>

      <main>
      <SideCardLayout lang="en">
      <div className="px-6 pt-6 space-y-3">
        {places.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-20">Data is being prepared.</p>
        )}

        <PopularRankingCards places={places} lang="en" />

        <p className="text-xs text-zinc-400 leading-relaxed pt-2">
          Real-time TOP 25 ranking based on views and likes over the last 48 hours, across Seongsu, Hongdae, Gangbuk, Jeju, concerts, and festivals.
        </p>

        <SiteFooter lang="en" />
      </div>
      </SideCardLayout>
      </main>

      <BottomNav lang="en" wide />
    </div>
  );
}
