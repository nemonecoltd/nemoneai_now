"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { placeHref, regionLabel } from '@/components/home/homeUtils';
import SideCardShell from './SideCardShell';

interface PopupItem {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  title_ja?: string;
  region?: string;
  end_date?: string;
  category?: string | null;
  image_url?: string;
  mood_tags?: string[] | null;
  category_tag?: string | null;
}

const dict = {
  ko: { title: 'NEW POP-UP', empty: '표시할 팝업이 없어요.' },
  en: { title: 'NEW POP-UP', empty: 'No pop-ups to show.' },
  zh: { title: 'NEW POP-UP', empty: '暂无快闪店。' },
  ja: { title: 'NEW POP-UP', empty: '表示できるポップアップがありません。' },
};

// 마감임박(D-3 이내) 계산 — PlaceDetailClient.tsx의 daysUntilClose와 동일 로직(2026-09-08,
// 목업의 아이템별 D-N 뱃지 재현). 원데이클래스는 상시 운영이라 대상에서 제외.
function daysUntilClose(item: PopupItem): number | null {
  if (!item.end_date || item.category === 'class') return null;
  const today = new Date().toISOString().split('T')[0];
  if (item.end_date < today) return null;
  const days = Math.ceil(
    (new Date(item.end_date + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000
  );
  return days >= 0 && days <= 3 ? days : null;
}

// 사이드카드는 전부 자기 완결형(props 없이 자체 fetch) — HomeClient/MagazineDetailClient는
// 배치만 담당(2026-09-07, PC 사이드카드 계획). lang은 브라우저 표시 언어를 굳이 안 물려받고
// 카드 UI 자체는 한국어 고정으로 단순화 — 사이드카드는 부가 위젯이라 본문처럼 다국어 완전
// 대응이 필요하진 않다고 판단(제목만 다국어, place 타이틀은 원래 place의 다국어 필드 사용).
export default function PopupCard({ lang = 'ko', onSeeAll }: { lang?: string; onSeeAll?: () => void }) {
  const t = dict[lang as keyof typeof dict] || dict.ko;
  const [items, setItems] = useState<PopupItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 원래 NEW/마감임박 토글이 있었는데, 목업엔 탭 없이 최신순 리스트 하나 + 아이템별 D-day
  // 뱃지로 통합돼 있어(2026-09-08 피드백 — "포털 위젯" 느낌의 원인 중 하나) 토글을 없앴다.
  // sort=latest(created_at DESC)는 스크래핑이 지역을 순차 처리해 마지막 지역(부산)이 최신
  // 슬롯을 독점하는 문제가 있어(2026-09-10), sort=new(랜덤)로 교체했다. 처음엔 48시간
  // 이내로 모수를 좁혔는데 수집 주기에 따라 후보가 1건뿐인 날이 생겨 "신규 5개"가 사실상
  // 고정 1개로 보이는 문제가 있었음(2026-09-12) — 백엔드에서 5일로 넓혀 해결.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api-now/places?sort=new&category=popup&limit=5');
        if (res.ok && !cancelled) setItems(await res.json());
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const titleOf = (p: PopupItem) =>
    (lang === 'en' && p.title_en) ? p.title_en
    : (lang === 'zh' && p.title_zh) ? p.title_zh
    : (lang === 'ja' && p.title_ja) ? p.title_ja
    : p.title;

  return (
    <SideCardShell label={t.title} moreHref={`/?tab=list&category=popup&lang=${lang}`} onMoreClick={onSeeAll}>
      {isLoading ? (
        <div className="py-6 text-center text-[11px] text-zinc-400">···</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center text-[11px] text-zinc-400">{t.empty}</div>
      ) : (
        <ul className="space-y-3">
          {items.map((p, idx) => {
            const dLeft = daysUntilClose(p);
            const tag = p.mood_tags?.[0] || p.category_tag;
            return (
              <li key={p.id}>
                <Link href={placeHref(p, lang)} className="flex items-center gap-3 group">
                  <span className="text-[11px] font-bold text-zinc-300 w-3 flex-shrink-0">{idx + 1}</span>
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
                      {dLeft !== null && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 rounded flex-shrink-0">
                          {dLeft === 0 ? 'D-DAY' : `D-${dLeft}`}
                        </span>
                      )}
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
