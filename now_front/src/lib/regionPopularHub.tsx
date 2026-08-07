import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import BrandTagline from '@/components/BrandTagline';
import Logo from '@/components/Logo';
import BottomNav from '@/components/BottomNav';
import SiteFooter from '@/components/SiteFooter';
import AdUnit from '@/components/AdUnit';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';
export const revalidate = 3600;

export type Lang = 'ko' | 'en' | 'zh' | 'ja';

// 영문 슬러그 — output:'standalone' 서버가 한글(비ASCII) 동적 세그먼트의 정적 프리렌더
// 페이지를 못 찾는 Next.js 버그(HTML/매니페스트는 정상인데 404)를 피하기 위함.
const SLUG_TO_REGION_KO = {
  seongsu: '성수', hongdae: '홍대', gangbuk: '강북', gangnam: '강남', busan: '부산', jeju: '제주',
} as const;
export type Slug = keyof typeof SLUG_TO_REGION_KO;
export const SLUGS = Object.keys(SLUG_TO_REGION_KO) as Slug[];

const REGION_LABEL: Record<Slug, Record<Lang, string>> = {
  seongsu: { ko: '성수', en: 'Seongsu', zh: '圣水洞', ja: 'ソンス' },
  hongdae: { ko: '홍대', en: 'Hongdae', zh: '弘大', ja: 'ホンデ' },
  gangbuk: { ko: '강북', en: 'Gangbuk', zh: '江北', ja: 'カンブク' },
  gangnam: { ko: '강남', en: 'Gangnam', zh: '江南', ja: 'カンナム' },
  busan:   { ko: '부산', en: 'Busan', zh: '釜山', ja: '釜山' },
  jeju:    { ko: '제주', en: 'Jeju', zh: '济州', ja: '済州' },
};

const AREA_LABEL: Record<Slug, Record<Lang, string>> = {
  seongsu: { ko: '성수동', en: 'Seongsu-dong', zh: '圣水洞', ja: 'ソンス洞' },
  hongdae: { ko: '홍대·상수', en: 'Hongdae·Sangsu', zh: '弘大·上水', ja: 'ホンデ·サンス' },
  gangbuk: { ko: '용산·강북', en: 'Yongsan·Gangbuk', zh: '龙山·江北', ja: '龍山·江北' },
  gangnam: { ko: '강남·서초·송파', en: 'Gangnam·Seocho·Songpa', zh: '江南·瑞草·松坡', ja: '江南·瑞草·松坡' },
  busan:   { ko: '부산', en: 'Busan', zh: '釜山', ja: '釜山' },
  jeju:    { ko: '제주', en: 'Jeju', zh: '济州', ja: '済州' },
};

const COPY: Record<Lang, {
  heading: (region: string) => string;
  desc: (region: string, area: string) => string;
  metaDesc: (region: string, area: string, top: string) => string;
  fallback: (region: string) => string;
  empty: string;
  metaTitle: (region: string) => string;
}> = {
  ko: {
    heading: (r) => `${r} 팝업 실시간 인기`,
    desc: (r, a) => `최근 48시간 조회수·좋아요 기준, ${r}(${a}) 팝업스토어 실시간 TOP 25입니다.`,
    metaDesc: (r, a, top) => `지금 ${r}(${a})에서 가장 인기있는 팝업스토어 실시간 순위. ${top || `지금 ${r}에서 가장 핫한 팝업을 확인해보세요.`}`,
    fallback: (r) => `지금 ${r}에서 가장 핫한 팝업을 확인해보세요.`,
    empty: '데이터를 준비 중입니다.',
    metaTitle: (r) => `${r} 팝업 실시간 인기 순위 TOP 25`,
  },
  en: {
    heading: (r) => `${r} Pop-up Trending Now`,
    desc: (r, a) => `Real-time TOP 25 pop-up stores in ${r} (${a}), based on views & likes in the last 48 hours.`,
    metaDesc: (r, a, top) => `Real-time ranking of the hottest pop-up stores in ${r} (${a}) right now. ${top || `Check out the hottest pop-ups in ${r}.`}`,
    fallback: (r) => `Check out the hottest pop-ups in ${r} right now.`,
    empty: 'Preparing data...',
    metaTitle: (r) => `${r} Pop-up Store Real-time Ranking TOP 25`,
  },
  zh: {
    heading: (r) => `${r} 快闪店实时人气`,
    desc: (r, a) => `根据最近48小时浏览量·点赞数统计，${r}(${a})快闪店实时TOP 25。`,
    metaDesc: (r, a, top) => `${r}(${a})当下最受欢迎的快闪店实时排名。${top || `快来看看${r}最热门的快闪店吧。`}`,
    fallback: (r) => `快来看看${r}最热门的快闪店吧。`,
    empty: '数据准备中。',
    metaTitle: (r) => `${r} 快闪店实时人气排名 TOP 25`,
  },
  ja: {
    heading: (r) => `${r} ポップアップ リアルタイム人気`,
    desc: (r, a) => `直近48時間の閲覧数・いいね基準、${r}(${a})ポップアップストア リアルタイムTOP25です。`,
    metaDesc: (r, a, top) => `今${r}(${a})で一番人気のポップアップストア リアルタイムランキング。${top || `今${r}で一番ホットなポップアップをチェック。`}`,
    fallback: (r) => `今${r}で一番ホットなポップアップをチェックしてみて。`,
    empty: 'データ準備中です。',
    metaTitle: (r) => `${r} ポップアップ リアルタイム人気ランキング TOP25`,
  },
};

const BACK_LABEL: Record<Lang, string> = { ko: '', en: '', zh: '', ja: '' };
const PATH_PREFIX: Record<Lang, string> = { ko: '', en: '/en', zh: '/zh', ja: '/ja' };

interface PopularPlace {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  title_ja?: string;
  region: string;
  location?: string;
  date_range?: string;
  category?: string | null;
  view_count?: number;
  like_count?: number;
  score?: number;
  is_new?: boolean;
}

async function getPopularPlaces(regionKo: string): Promise<PopularPlace[]> {
  try {
    const res = await fetch(`${BACKEND}/places/popular?region=${encodeURIComponent(regionKo)}&limit=25`, { next: { revalidate } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

function placeTitle(p: PopularPlace, lang: Lang): string {
  if (lang === 'en' && p.title_en) return p.title_en;
  if (lang === 'zh' && p.title_zh) return p.title_zh;
  if (lang === 'ja' && p.title_ja) return p.title_ja;
  return p.title;
}

export function generateRegionStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export async function generateRegionMetadata(slug: string, lang: Lang): Promise<Metadata> {
  if (!SLUGS.includes(slug as Slug)) return {};
  const s = slug as Slug;
  const region = REGION_LABEL[s][lang];
  const area = AREA_LABEL[s][lang];
  const places = await getPopularPlaces(SLUG_TO_REGION_KO[s]);
  const top = places.slice(0, 5).map(p => placeTitle(p, lang)).join(', ');
  const c = COPY[lang];
  const title = c.metaTitle(region);
  const description = c.metaDesc(region, area, top);
  const path = `${PATH_PREFIX.ko}/ranking/place/${slug}`; // ko가 canonical 기준
  const canonical = `https://now.nemoneai.com${PATH_PREFIX[lang]}/ranking/place/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: {
        ko: `https://now.nemoneai.com/ranking/place/${slug}`,
        en: `https://now.nemoneai.com/en/ranking/place/${slug}`,
        zh: `https://now.nemoneai.com/zh/ranking/place/${slug}`,
        ja: `https://now.nemoneai.com/ja/ranking/place/${slug}`,
        'x-default': `https://now.nemoneai.com/ranking/place/${slug}`,
      },
    },
    openGraph: { title, description, url: canonical, type: 'website' },
  };
}

export async function RegionPopularHubPage({ slug, lang }: { slug: string; lang: Lang }) {
  if (!SLUGS.includes(slug as Slug)) notFound();
  const s = slug as Slug;
  const region = REGION_LABEL[s][lang];
  const area = AREA_LABEL[s][lang];
  const c = COPY[lang];
  const places = await getPopularPlaces(SLUG_TO_REGION_KO[s]);
  const backHref = `${PATH_PREFIX[lang]}/ranking/place`;

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-28 border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-50 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600 flex-shrink-0">
            <ChevronLeft size={20} />
          </Link>
          <Logo href={`${PATH_PREFIX[lang]}/`} className="h-6" />
          <div className="flex-1" />
          {/* 언어 스위처 — 지금 보고 있는 지역 페이지의 다른 언어 버전으로 바로 이동 */}
          <div className="flex bg-zinc-100 p-0.5 rounded-lg text-[10px] font-bold flex-shrink-0">
            {(['ko', 'en', 'zh', 'ja'] as Lang[]).map((l) => (
              <Link
                key={l}
                href={`${PATH_PREFIX[l]}/ranking/place/${slug}`}
                className={`px-2 py-1 rounded-md uppercase transition-colors ${l === lang ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'}`}
              >
                {l}
              </Link>
            ))}
          </div>
        </div>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900 mt-2">{c.heading(region)}</h1>
        <BrandTagline />
      </header>

      <main className="px-6 pt-6 space-y-3">
        <div className="flex flex-wrap gap-1.5 pb-2">
          {SLUGS.filter(x => x !== slug).map(x => (
            <Link
              key={x}
              href={`${PATH_PREFIX[lang]}/ranking/place/${x}`}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors"
            >
              {REGION_LABEL[x][lang]}
            </Link>
          ))}
        </div>

        {places.length === 0 && (
          <p className="text-center text-zinc-400 text-sm py-20">{c.empty}</p>
        )}

        {places.map((place, idx) => (
          <div key={place.id}>
          <Link
            href={`/posts/${place.id}${lang !== 'ko' ? `?lang=${lang}` : ''}`}
            className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm"
          >
            <span className="w-7 h-7 rounded-lg bg-zinc-900 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="font-bold text-zinc-900 text-sm truncate">{placeTitle(place, lang)}</h2>
                {place.category === 'class' && (
                  <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">
                    {lang === 'en' ? 'Class' : lang === 'zh' ? '体验课程' : lang === 'ja' ? '体験' : '클래스'}
                  </span>
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
          {idx === 1 && (
            <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
          )}
          {idx === 14 && (
            <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
          )}
          </div>
        ))}

        <p className="text-xs text-zinc-400 leading-relaxed pt-2">{c.desc(region, area)}</p>

        <SiteFooter lang={lang} />
      </main>

      <BottomNav region={SLUG_TO_REGION_KO[s]} lang={lang} />
    </div>
  );
}
