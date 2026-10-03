"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { placeHref, regionLabel } from '@/components/home/homeUtils';
import SideCardShell from './SideCardShell';

interface RisingItem {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  title_ja?: string;
  region?: string;
  image_url?: string;
  mood_tags?: string[] | null;
  category_tag?: string | null;
  pct_change: number;
}

const dict = {
  ko: { title: 'RISING', subtitle: '최근 48시간 급상승한 곳', empty: '아직 급상승한 곳이 없어요.' },
  en: { title: 'RISING', subtitle: 'Fast movers in the last 48 hours', empty: 'Nothing trending up yet.' },
  zh: { title: 'RISING', subtitle: '最近48小时急速上升', empty: '暂无急速上升的地方。' },
  ja: { title: 'RISING', subtitle: '直近48時間で急上昇', empty: 'まだ急上昇の場所がありません。' },
};

// 홈 'PACE NOW' 섹션 전용(2026-09-09) — 직전 48시간 대비 점수 증가율 상위 4개
// (now_back ranking_service.refresh_rising(), 새 테이블 없이 likes/place_views 원본
// 이벤트를 2구간으로 비교해 계산). 다른 사이드카드와 달리 지금은 홈 본문에서만 쓰이지만
// 완전히 자기 완결형이라 사이드레일(aside)에 그대로 옮겨 써도 무방하게 만들었다.
// 처음엔 썸네일 없이 텍스트만 있어 옆 카드(POP-UP NOW/PACE PICK)보다 휑해 보였다는
// 피드백(2026-09-09)으로 썸네일을 추가하고 3개→4개로 늘렸다.
export default function RisingCard({ lang = 'ko' }: { lang?: string }) {
  const t = dict[lang as keyof typeof dict] || dict.ko;
  const [items, setItems] = useState<RisingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api-now/places/rising');
        if (res.ok && !cancelled) setItems(await res.json());
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const titleOf = (p: RisingItem) =>
    (lang === 'en' && p.title_en) ? p.title_en
    : (lang === 'zh' && p.title_zh) ? p.title_zh
    : (lang === 'ja' && p.title_ja) ? p.title_ja
    : p.title;

  return (
    <SideCardShell label={t.title} subtitle={t.subtitle} subtitleInline>
      {isLoading ? (
        <div className="py-6 text-center text-[11px] text-zinc-400">···</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-zinc-400">{t.empty}</div>
      ) : (
        <ul className="space-y-3">
          {items.map((p) => {
            const tag = p.mood_tags?.[0] || p.category_tag;
            return (
              <li key={p.id}>
                <Link href={placeHref(p, lang)} className="flex items-center gap-3 group">
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-100 flex-shrink-0">
                    {p.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt={titleOf(p)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-zinc-900 truncate group-hover:text-pace-700">{titleOf(p)}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] text-zinc-400">{regionLabel(p.region, lang)}</span>
                      {tag && <span className="text-[11px] text-zinc-400 truncate">· {tag}</span>}
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 rounded flex-shrink-0">
                        <TrendingUp size={10} /> {p.pct_change}%
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SideCardShell>
  );
}
