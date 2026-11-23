"use client";

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DISCOVERY_REGIONS, HomeRegion, REGION_CHIP_ACTIVE, regionLabel } from './homeUtils';
import type { HeroTile } from '@/app/page';
import './heroTiles.css';

const dict = {
  ko: { title: '지금, 어디가\n뜨고 있을까?', desc: '실시간 랭킹으로 확인하는 서울·부산·제주의 지금 이 순간', all: '전체' },
  en: { title: 'Where is\ntrending right now?', desc: 'Real-time rankings across Seoul, Busan & Jeju', all: 'All' },
  zh: { title: '现在，哪里\n最火？', desc: '首尔·釜山·济州的实时人气排行', all: '全部' },
  ja: { title: '今、どこが\n人気？', desc: 'ソウル・釜山・済州のリアルタイムランキング', all: '全体' },
};

// 타일 문구: 한 줄 강조어(b) + 보조어(i). 매거진은 보조어가 없다.
const TILE_LABEL: Record<HeroTile['key'], { b: string; i: string }> = {
  new: { b: 'NEW', i: '팝업' },
  xmas: { b: '크리스마스', i: '팝업' },
  mag: { b: '매거진', i: '' },
  search: { b: '팝업', i: '검색' },
};

// 큰 히어로가 접히는 연출은 페이지를 새로 불러올 때 한 번만 보여준다(탭 이동 후 돌아왔을 때 다시 재생하지 않음).
let introPlayed = false;
const INTRO_MS = 1700;

function Tiles({ tiles }: { tiles: HeroTile[] }) {
  return (
    <>
      {tiles.map((tile, idx) => {
        const l = TILE_LABEL[tile.key];
        return (
          <a
            key={tile.key}
            href={tile.href}
            // 검색 타일은 홈과 같은 주소(쿼리만 다름)라 크롤러가 따라가지 않게 한다
            {...(tile.key === 'search' ? { rel: 'nofollow' } : {})}
            className={cn('ph-tile', `ph-t${idx + 1}`, tile.key === 'search' && 'ph-search')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {tile.image && <img src={tile.image} alt="" loading="eager" decoding="async" />}
            {tile.key === 'search' && <Search className="ph-search-ic" aria-hidden="true" strokeWidth={2.4} />}
            <span className="ph-tx">
              <b>{l.b}</b>
              {l.i && <i>{l.i}</i>}
            </span>
          </a>
        );
      })}
    </>
  );
}

export default function HeroSection({
  lang,
  region,
  onRegionChange,
  tiles = [],
}: {
  lang: string;
  region: HomeRegion;
  onRegionChange: (r: HomeRegion) => void;
  tiles?: HeroTile[];
}) {
  const t = dict[lang as keyof typeof dict] || dict.ko;
  const chips: HomeRegion[] = ['전체', ...DISCOVERY_REGIONS];

  // 처음 불러온 화면은 큰 히어로(서버 HTML 그대로)로 시작해 잠시 뒤 접는다. 스크롤·터치·키 입력이 먼저 오면 바로 접는다.
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && introPlayed);
  useEffect(() => {
    if (collapsed) return;
    const fold = () => {
      introPlayed = true;
      setCollapsed(true);
    };
    const timer = window.setTimeout(fold, INTRO_MS);
    const events = ['scroll', 'touchstart', 'wheel', 'keydown'] as const;
    events.forEach((e) => window.addEventListener(e, fold, { passive: true, once: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, fold));
    };
  }, [collapsed]);

  return (
    <section className="relative">
      <div className="ph">
        {/* 접힌 상태(본문 배치의 기준 높이). 큰 덮개가 사라지면 이 모습이 그대로 보인다. */}
        <div className="ph-compact">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero/pace-hero.jpg"
            alt="서울·부산·제주 팝업스토어 실시간 랭킹 - NEMONE PACE"
            className="ph-bgimg"
            fetchPriority="high"
          />
        </div>
        <div className={cn('ph-cc', collapsed && 'is-on')}>
          <div className="ph-shade-c" />
          <h2 className="ph-title ph-title-c">{t.title.replace('\n', ' ')}</h2>
          <Tiles tiles={tiles} />
        </div>

        {/* 큰 덮개 — 첫 화면에서만 위에 겹쳐 있다가 접힌다. 제목만 있는 장식 복제본이라 보조기기에는 숨긴다. 바로가기 타일은 접힌 뒤에만 나온다(큰 상태는 이미지가 복잡해 보여 뺌). */}
        <div className={cn('ph-big', collapsed && 'is-collapsed')} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero/pace-hero.jpg" alt="" className="ph-bgimg" />
          <div className="ph-shade-big" />
          <p className="ph-title ph-title-big ph-fade">{t.title}</p>
        </div>

      {/* 지역 필터 칩 — 히어로 아래 살짝 겹치게, 아래 섹션들의 지역 필터를 함께 제어 */}
      <div className="relative z-10 -mt-6 md:-mt-7 px-6 md:px-10 max-w-6xl md:mx-auto">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar bg-white rounded-2xl shadow-lg border border-zinc-100 p-2">
          {chips.map((r) => (
            <button
              key={r}
              onClick={() => onRegionChange(r)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shrink-0",
                region === r ? REGION_CHIP_ACTIVE[r] : "text-zinc-500 border-transparent hover:bg-zinc-50"
              )}
            >
              {r === '전체' ? t.all : regionLabel(r, lang)}
            </button>
          ))}
        </div>
      </div>
      </div>
    </section>
  );
}
