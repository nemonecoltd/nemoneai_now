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
  title_en?: string | null;
  title_zh?: string | null;
  title_ja?: string | null;
  region: string;
  location?: string;
  date_range?: string;
  category?: string | null;
  view_count?: number;
  like_count?: number;
  score?: number;
  is_new?: boolean;
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
  // "핫플"은 자체 용어라 실제 검색량이 있는 "서울 팝업스토어"로 유입이 안 되던 문제
  // (2026-09-05) — 검색어를 정면으로 쓰는 제목으로 교체
  const title = '서울 팝업스토어 실시간 인기 순위 TOP 25';
  const description = `지금 서울에서 가장 인기있는 팝업스토어 실시간 순위. 성수·홍대·강북·강남과 부산·제주 팝업, 전시·공연·축제까지 한눈에. ${top || '지금 가장 인기있는 장소를 확인해보세요.'}`;
  return {
    title,
    description,
    alternates: {
      canonical: 'https://now.nemoneai.com/ranking/place',
      languages: {
        'ko': 'https://now.nemoneai.com/ranking/place',
        'en': 'https://now.nemoneai.com/en/ranking/place',
        'zh': 'https://now.nemoneai.com/zh/ranking/place',
        'ja': 'https://now.nemoneai.com/ja/ranking/place',
        'x-default': 'https://now.nemoneai.com/ranking/place',
      },
    },
    openGraph: { title, description, url: 'https://now.nemoneai.com/ranking/place', images: ['https://now.nemoneai.com/og-image.jpg'], type: 'website' },
  };
}

export default async function PlaceRankingPage() {
  const places = await getPopularPlaces();

  return (
    <div className={cn("min-h-screen bg-zinc-50 relative pb-28", WIDE_FRAME, WIDE_FRAME_BORDER)}>
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600 flex-shrink-0">
            <ChevronLeft size={20} />
          </Link>
          <Logo href="/" className="h-6" />
          <RankingHeaderActions lang="ko" path="/ranking/place" />
        </div>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900 mt-2">서울 팝업스토어 실시간 인기 순위</h1>
      </header>

      <main>
      <SideCardLayout lang="ko">
      <div className="px-6 pt-6 space-y-3">
        {/* 지역별 허브 — 크롤러가 지역별 랭킹 페이지를 발견하도록 내부링크 (URL은 영문 슬러그, 텍스트는 한글) */}
        <div className="flex flex-wrap gap-1.5 pb-2">
          {([
            ['seongsu', '성수'], ['hongdae', '홍대'], ['gangbuk', '강북'],
            ['gangnam', '강남'], ['busan', '부산'], ['jeju', '제주'],
          ] as const).map(([slug, label]) => (
            <Link
              key={slug}
              href={`/ranking/place/${slug}`}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
            >
              {label} 팝업
            </Link>
          ))}
        </div>

        {places.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-20">데이터를 준비 중입니다.</p>
        )}

        <PopularRankingCards places={places} lang="ko" />

        <p className="text-xs text-zinc-400 leading-relaxed pt-2">
          최근 48시간 조회수·좋아요 기준, 성수·홍대·강북·강남·부산·제주·공연·축제 통합 실시간 TOP 25입니다.
        </p>

        <SiteFooter lang="ko" />
      </div>
      </SideCardLayout>
      </main>

      <BottomNav lang="ko" wide />
    </div>
  );
}
