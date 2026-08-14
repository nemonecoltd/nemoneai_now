import { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';
import Logo from '@/components/Logo';
import BottomNav from '@/components/BottomNav';
import SiteFooter from '@/components/SiteFooter';

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
    return { title: '공유된 랭킹', alternates: { canonical } };
  }
  const top = share.items.slice(0, 5).map((it) => it.title).join(', ');
  const title = share.label;
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

export default async function RankingSharePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  const share = await getRankingShare(id);
  const { lang: rawLang } = await searchParams;
  const lang = rawLang || 'ko';
  const tr = (ko: string, en: string, zh: string, ja: string) =>
    lang === 'en' ? en : lang === 'zh' ? zh : lang === 'ja' ? ja : ko;
  const placeTitle = (p: RankingShareItem) =>
    (lang === 'en' ? p.title_en : lang === 'zh' ? p.title_zh : undefined) || p.title;

  if (!share) {
    return (
      <div className="min-h-screen bg-zinc-50 max-w-md mx-auto flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-bold text-zinc-800">{tr('공유된 랭킹을 찾을 수 없습니다', 'This shared ranking could not be found', '找不到该共享排名', '共有されたランキングが見つかりません')}</p>
        <p className="text-sm text-zinc-400">{tr('링크가 만료되었거나 삭제되었을 수 있어요.', 'The link may have expired or been deleted.', '链接可能已过期或被删除。', 'リンクの有効期限が切れたか、削除された可能性があります。')}</p>
        <Link href={`/?lang=${lang}`} className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">{tr('PACE 홈으로', 'Back to PACE', '返回PACE首页', 'PACEホームへ')}</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-28 border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-3">
          <Link href={`/?lang=${lang}`} className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600 flex-shrink-0">
            <ChevronLeft size={20} />
          </Link>
          <Logo href="/" className="h-6" />
        </div>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900 mt-2">{share.label}</h1>
        <BrandTagline lang={lang} />
      </header>

      <main className="px-6 pt-6 space-y-3">
        {share.items.map((place, idx) => (
          <Link key={place.id} href={`/posts/${place.id}?lang=${lang}`} className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm">
            <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
              {idx + 1}
            </span>
            <img
              src={place.image_url || `https://picsum.photos/seed/share-${place.id}/200`}
              className="w-12 h-12 rounded-xl object-cover border border-zinc-50 flex-shrink-0"
              alt={placeTitle(place)}
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-zinc-900 text-sm truncate">{placeTitle(place)}</h2>
              <p className="text-[10px] text-zinc-400 truncate">{place.region || ''}{place.date_range ? ` · ${place.date_range}` : ''}</p>
            </div>
            {typeof place.score === 'number' && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 flex-shrink-0">
                <Flame size={11} fill="currentColor" /> {place.score}
              </span>
            )}
            <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />
          </Link>
        ))}

        <Link href={`/?lang=${lang}`} className="block text-center mt-6 px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">
          {tr('PACE 실시간 랭킹 보러가기', 'See live PACE ranking', '查看PACE实时排名', 'PACEリアルタイムランキングを見る')}
        </Link>

        <p className="text-xs text-zinc-400 leading-relaxed pt-2">
          {tr(
            `${formatSnapshotTime(share.created_at)}으로 고정된 랭킹입니다. 지금은 순위가 달라졌을 수 있어요.`,
            `This ranking is frozen as of ${formatSnapshotTime(share.created_at)}. The current ranking may have changed.`,
            `此排名固定于${formatSnapshotTime(share.created_at)}。当前排名可能已发生变化。`,
            `${formatSnapshotTime(share.created_at)}時点で固定されたランキングです。現在は順位が変わっている場合があります。`,
          )}
        </p>

        <SiteFooter lang={lang} />
      </main>

      <BottomNav lang={lang} />
    </div>
  );
}
