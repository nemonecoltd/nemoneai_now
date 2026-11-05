import Link from 'next/link';
import { Flame } from 'lucide-react';
import AdUnit from '@/components/AdUnit';

// 통합 인기 랭킹(/ranking/place, /en|zh|ja/ranking/place) 공용 카드 — 지역 허브(regionPopularHub)와 같은 구성:
// 1~3위는 큰 썸네일 강조, 4위부터는 좌측 썸네일 리스트.
type Lang = 'ko' | 'en' | 'zh' | 'ja';

export interface RankedPlace {
  id: number;
  title: string;
  title_en?: string | null;
  title_zh?: string | null;
  title_ja?: string | null;
  region: string;
  location?: string;
  date_range?: string;
  image_url?: string | null;
  category?: string | null;
  like_count?: number;
  score?: number;
  is_new?: boolean;
}

const REGION: Record<string, Record<Lang, string>> = {
  '성수': { ko: '성수', en: 'Seongsu', zh: '圣水洞', ja: 'ソンス' },
  '홍대': { ko: '홍대', en: 'Hongdae', zh: '弘大', ja: 'ホンデ' },
  '강북': { ko: '강북', en: 'Gangbuk', zh: '江北', ja: 'カンブク' },
  '강남': { ko: '강남', en: 'Gangnam', zh: '江南', ja: 'カンナム' },
  '부산': { ko: '부산', en: 'Busan', zh: '釜山', ja: '釜山' },
  '제주': { ko: '제주', en: 'Jeju', zh: '济州', ja: '済州' },
  '공연': { ko: '공연', en: 'Concert', zh: '演出', ja: '公演' },
  '축제': { ko: '축제', en: 'Festival', zh: '节庆', ja: 'フェス' },
};
const CLASS_LABEL: Record<Lang, string> = { ko: '클래스', en: 'Class', zh: '体验课程', ja: '体験' };

function titleOf(p: RankedPlace, lang: Lang): string {
  if (lang === 'en' && p.title_en) return p.title_en;
  if (lang === 'zh' && p.title_zh) return p.title_zh;
  if (lang === 'ja' && p.title_ja) return p.title_ja;
  return p.title;
}

export default function PopularRankingCards({ places, lang }: { places: RankedPlace[]; lang: Lang }) {
  const hrefOf = (p: RankedPlace) => `/posts/${p.id}${lang !== 'ko' ? `?lang=${lang}` : ''}`;
  const imgOf = (p: RankedPlace, size: number) => p.image_url || `https://picsum.photos/seed/${p.id}/${size}/${size}`;
  const regionOf = (p: RankedPlace) => REGION[p.region]?.[lang] || p.region;
  const rankSuffix = lang === 'en' ? 'st' : lang === 'ko' ? '위' : '位';

  return (
    <>
      {places.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {places.slice(0, 3).map((place, idx) => {
            const img = imgOf(place, 400);
            if (idx === 0) {
              return (
                <Link key={place.id} href={hrefOf(place)} className="row-span-2 relative rounded-3xl overflow-hidden bg-zinc-900 shadow-sm min-h-[240px] group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={titleOf(place, lang)} className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <span className="absolute top-2 left-2 flex items-center gap-1 bg-zinc-900/90 text-white text-[10px] font-black px-2 py-1 rounded-full">
                    <Flame size={11} className="text-rose-400" fill="currentColor" /> 1{rankSuffix}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-1">
                    <h2 className="text-sm font-bold text-white leading-snug line-clamp-2">{titleOf(place, lang)}</h2>
                    <span className="text-[10px] text-zinc-300 truncate">{place.date_range || place.location || regionOf(place)}</span>
                  </div>
                </Link>
              );
            }
            return (
              <Link key={place.id} href={hrefOf(place)} className="relative flex bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden group">
                <div className="relative w-20 aspect-square flex-shrink-0 bg-zinc-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={titleOf(place, lang)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                  <span className="absolute top-1.5 left-1.5 w-5 h-5 bg-zinc-900/90 text-white text-[10px] font-black rounded-full flex items-center justify-center">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1">
                  <h2 className="text-xs font-bold text-zinc-900 leading-snug line-clamp-2">{titleOf(place, lang)}</h2>
                  <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500"><Flame size={9} fill="currentColor" /> {place.score ?? place.like_count ?? 0}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {places.length > 0 && <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />}

      {places.slice(3).map((place, i) => {
        const idx = i + 3;
        return (
          <div key={place.id}>
            <Link href={hrefOf(place)} className="relative flex bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden group">
              <div className="relative w-24 aspect-square flex-shrink-0 bg-zinc-100 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgOf(place, 300)} alt={titleOf(place, lang)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                <span className="absolute top-1.5 left-1.5 w-5 h-5 bg-zinc-900/90 text-white text-[10px] font-black rounded-full flex items-center justify-center">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0 p-3 flex flex-col justify-center gap-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {place.category === 'class' && (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">{CLASS_LABEL[lang]}</span>
                  )}
                  {place.is_new && (
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400">NEW</span>
                  )}
                </div>
                <h2 className="text-xs font-bold text-zinc-900 leading-snug line-clamp-2">{titleOf(place, lang)}</h2>
                <span className="text-[9px] text-zinc-400 truncate">{place.location || regionOf(place)}{place.date_range ? ` · ${place.date_range}` : ''}</span>
                <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500"><Flame size={9} fill="currentColor" /> {place.score ?? place.like_count ?? 0}</span>
              </div>
            </Link>
            {idx === 14 && <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />}
          </div>
        );
      })}
    </>
  );
}
