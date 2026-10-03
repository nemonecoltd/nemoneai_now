"use client";

import { cn } from '@/lib/utils';
import { DISCOVERY_REGIONS, HomeRegion, REGION_CHIP_ACTIVE, regionLabel } from './homeUtils';

const dict = {
  ko: { title: '지금, 어디가\n뜨고 있을까?', desc: '실시간 랭킹으로 확인하는 서울·부산·제주의 지금 이 순간', all: '전체' },
  en: { title: 'Where is\ntrending right now?', desc: 'Real-time rankings across Seoul, Busan & Jeju', all: 'All' },
  zh: { title: '现在，哪里\n最火？', desc: '首尔·釜山·济州的实时人气排行', all: '全部' },
  ja: { title: '今、どこが\n人気？', desc: 'ソウル・釜山・済州のリアルタイムランキング', all: '全体' },
};

export default function HeroSection({
  lang,
  region,
  onRegionChange,
}: {
  lang: string;
  region: HomeRegion;
  onRegionChange: (r: HomeRegion) => void;
}) {
  const t = dict[lang as keyof typeof dict] || dict.ko;
  const chips: HomeRegion[] = ['전체', ...DISCOVERY_REGIONS];

  return (
    <section className="relative overflow-hidden">
      {/* 부제("실시간 랭킹으로...") 삭제, 그만큼 이미지 높이도 줄임(2026-09-07) —
          메인 화면 위쪽 공간을 아껴 아래 실제 콘텐츠(지금 뜨는 곳)가 더 빨리 보이게 함. */}
      <div className="relative h-[340px] md:h-[410px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero/pace-hero.jpg"
          alt="서울·부산·제주 팝업스토어 실시간 랭킹 - NEMONE PACE"
          className="absolute inset-0 w-full h-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-10 pb-6 md:pb-8 max-w-6xl md:mx-auto">
          <h2 className="text-white text-[28px] md:text-[44px] font-black leading-[1.2] tracking-tight whitespace-pre-line drop-shadow-sm">
            {t.title}
          </h2>
        </div>
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
    </section>
  );
}
