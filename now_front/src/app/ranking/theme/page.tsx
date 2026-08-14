import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, Heart } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

export const revalidate = 3600;

interface ThemePlace {
  title: string;
  content: string;
  location: string;
}

interface Theme {
  id: number;
  title: string;
  description: string;
  places: ThemePlace[];
  user_name: string | null;
  like_count: number;
  created_at: string;
}

async function getThemes(): Promise<Theme[]> {
  try {
    const res = await fetch(`${BACKEND}/themes`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const themes = await getThemes();
  const top = themes.slice(0, 5).map(t => t.title).join(', ');
  const title = '이번 주 인기 테마 랭킹';
  const description = `유저들이 직접 큐레이션한 성수·홍대·강북·제주 테마 랭킹. ${top || '지금 인기 있는 테마를 확인해보세요.'}`;
  return {
    title,
    description,
    alternates: { canonical: 'https://now.nemoneai.com/ranking/theme' },
    openGraph: { title, description, url: 'https://now.nemoneai.com/ranking/theme', type: 'website' },
  };
}

export default async function ThemeRankingPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const themes = await getThemes();
  const { lang: rawLang } = await searchParams;
  const lang = rawLang || 'ko';
  const tr = (ko: string, en: string, zh: string, ja: string) =>
    lang === 'en' ? en : lang === 'zh' ? zh : lang === 'ja' ? ja : ko;

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-16 border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-4">
          <Link href={`/?lang=${lang}`} className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
            <ChevronLeft size={24} />
          </Link>
          <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">{tr('테마 랭킹', 'Theme Ranking', '主题排名', 'テーマランキング')}</h1>
        </div>
        <BrandTagline lang={lang} />
      </header>

      <main className="px-6 pt-6 space-y-4">
        <p className="text-xs text-zinc-400 leading-relaxed">
          {tr(
            '유저들이 직접 만든 장소 테마 모음을 좋아요 순으로 보여드립니다.',
            'A collection of place themes created by users, sorted by likes.',
            '为您展示用户亲自创建的地点主题合集,按点赞数排序。',
            'ユーザーが直接作成した場所テーマのコレクションを、いいね順にご紹介します。',
          )}
        </p>

        {themes.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-20">{tr('아직 저장된 테마가 없습니다.', 'There are no saved themes yet.', '还没有保存的主题。', 'まだ保存されたテーマがありません。')}</p>
        )}

        {themes.map((theme, idx) => (
          <div key={theme.id} className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-500 text-white text-[11px] font-black flex items-center justify-center flex-shrink-0">
                {idx + 1}
              </span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 ml-auto">
                <Heart size={11} fill="currentColor" /> {theme.like_count}
              </span>
            </div>
            <div>
              <h2 className="font-bold text-zinc-900 text-base tracking-tight">{theme.title}</h2>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{theme.description}</p>
              <p className="text-[10px] text-zinc-400 mt-1">{tr(`${theme.user_name || '아무개'} 님이 만든 테마`, `Theme by ${theme.user_name || 'Someone'}`, `由${theme.user_name || '某人'}创建的主题`, `${theme.user_name || '名無し'}さんが作ったテーマ`)}</p>
            </div>
            <ul className="space-y-1.5 pt-1 border-t border-zinc-50">
              {theme.places.map((place, i) => (
                <li key={i} className="text-xs text-zinc-600">
                  <span className="font-bold text-zinc-800">{place.title}</span>
                  <span className="text-zinc-400"> · {place.location}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </main>
    </div>
  );
}
