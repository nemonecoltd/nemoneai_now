"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DISCOVERY_REGIONS, HomeRegion, placeHref, placeTitle, regionLabel } from '@/components/home/homeUtils';
import SideCardShell from './SideCardShell';

const dict = {
  ko: { title: 'NOW TRENDING', more: '랭킹 전체보기', empty: '데이터가 아직 부족해요.' },
  en: { title: 'NOW TRENDING', more: 'See full ranking', empty: 'Not enough data yet.' },
  zh: { title: 'NOW TRENDING', more: '查看完整排行', empty: '数据还不够。' },
  ja: { title: 'NOW TRENDING', more: 'ランキング全体を見る', empty: 'まだデータが足りません。' },
};

export default function RankingCard({
  lang = 'ko',
  onSeeAll,
}: {
  lang?: string;
  onSeeAll?: (region: Exclude<HomeRegion, '전체'>) => void;
}) {
  const t = dict[lang as keyof typeof dict] || dict.ko;
  const [region, setRegion] = useState<Exclude<HomeRegion, '전체'>>(DISCOVERY_REGIONS[0]);
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api-now/places/popular?region=${encodeURIComponent(region)}&limit=5`);
        if (res.ok && !cancelled) setItems(await res.json());
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [region]);

  return (
    <SideCardShell
      label={t.title}
      moreHref={`/?tab=rec&region=${encodeURIComponent(region)}&lang=${lang}`}
      moreLabel={t.more}
      onMoreClick={onSeeAll ? () => onSeeAll(region) : undefined}
    >
      <div className="flex flex-wrap gap-1.5 mb-3">
        {DISCOVERY_REGIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRegion(r)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors ${
              region === r ? 'bg-pace-600 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            {regionLabel(r, lang)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-[11px] text-zinc-400">···</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-zinc-400">{t.empty}</div>
      ) : (
        <ul className="space-y-3">
          {items.map((p, idx) => (
            <li key={p.id}>
              <Link href={placeHref(p, lang)} className="flex items-center gap-3 group">
                <span className="text-[11px] font-bold text-zinc-300 w-3 flex-shrink-0">{idx + 1}</span>
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={placeTitle(p, lang)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  )}
                </div>
                <p className="text-[13px] font-semibold text-zinc-900 truncate flex-1 group-hover:text-pace-700">
                  {placeTitle(p, lang)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SideCardShell>
  );
}
