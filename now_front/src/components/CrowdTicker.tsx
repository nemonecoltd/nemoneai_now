"use client";

import { useEffect, useState } from 'react';
import { LongFlap } from 'react-split-flap';

interface CrowdData {
  area: string;
  congest_lvl: string;
  ppltn_min: number;
  ppltn_max: number;
  age_gender_summary?: {
    male_rate?: string;
    female_rate?: string;
    age_rates?: Record<string, string>;
  };
  ppltn_delta_pct?: number;
}

const ROTATE_MS = 5000;
// /crowd/all을 SWR 없이도 계속 최신으로 유지 — 원본 데이터가 서버에서 10분 간격으로만 갱신되니
// 그보다 촘촘한 5분이면 충분(기존 프로젝트 전체가 plain fetch 컨벤션이라 새 데이터 레이어 안 얹음)
const REFRESH_MS = 5 * 60 * 1000;

// MapView.tsx REGION_COLOR와 동일한 지역 대표색 — 티커에서도 지점 구분이 되도록 재사용
const AREA_ACCENT: Record<string, string> = {
  '성수': '#10b981',
  '홍대': '#8b5cf6',
  '강남역': '#ec4899',
  '이태원': '#eab308',
  '광화문': '#eab308',
};

// 티커 탭 시 지도 탭으로 이동할 지역 — CrowdCard.tsx REGION_CROWD_POINTS의 역매핑
const AREA_TO_REGION: Record<string, string> = {
  '성수': '성수',
  '홍대': '홍대',
  '강남역': '강남',
  '이태원': '강북',
  '광화문': '강북',
};

const CONGEST_COLOR: Record<string, string> = {
  '여유': 'text-emerald-400',
  '보통': 'text-amber-400',
  '약간 붐빔': 'text-orange-400',
  '붐빔': 'text-rose-400',
};

function formatNum(n: number): string {
  return n.toLocaleString('ko-KR');
}

function topAgeGroup(ageGender?: CrowdData['age_gender_summary']): string | null {
  if (!ageGender?.age_rates) return null;
  const entries = Object.entries(ageGender.age_rates)
    .map(([age, rate]) => [age, parseFloat(rate)] as [string, number])
    .filter(([, rate]) => !Number.isNaN(rate));
  if (entries.length === 0) return null;
  const [topAge] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return `${topAge}대`;
}

function genderLabel(ageGender?: CrowdData['age_gender_summary']): string | null {
  const male = parseFloat(ageGender?.male_rate || '');
  const female = parseFloat(ageGender?.female_rate || '');
  if (Number.isNaN(male) || Number.isNaN(female)) return null;
  return Math.abs(male - female) < 5 ? '남녀비슷' : male > female ? '남성다수' : '여성다수';
}

function FlapRow({ item }: { item: CrowdData }) {
  const accent = AREA_ACCENT[item.area] || '#a1a1aa';
  const age = topAgeGroup(item.age_gender_summary);
  const gender = genderLabel(item.age_gender_summary);
  const visitorPart = [age, gender].filter(Boolean).join('·');
  const deltaText = typeof item.ppltn_delta_pct === 'number'
    ? (Math.abs(item.ppltn_delta_pct) < 1 ? '직전과 비슷' : `직전대비 ${item.ppltn_delta_pct > 0 ? '+' : ''}${item.ppltn_delta_pct}%`)
    : null;

  return (
    <span className="flex items-center gap-1.5 px-4 text-[11px] font-bold whitespace-nowrap overflow-x-auto no-scrollbar">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
        style={{ backgroundColor: accent, boxShadow: `0 0 5px ${accent}` }}
      />
      <span className="font-black flex-shrink-0" style={{ color: accent }}>{item.area}</span>
      <span className="text-zinc-700 flex-shrink-0">•</span>
      <span className="text-zinc-200 font-mono flex-shrink-0">{formatNum(item.ppltn_min)}~{formatNum(item.ppltn_max)}명</span>
      {deltaText && (
        <>
          <span className="text-zinc-700 flex-shrink-0">•</span>
          <span className="text-zinc-400 font-medium flex-shrink-0">{deltaText}</span>
        </>
      )}
      {visitorPart && (
        <>
          <span className="text-zinc-700 flex-shrink-0">•</span>
          <span className="text-zinc-400 font-medium flex-shrink-0">{visitorPart}</span>
        </>
      )}
      <span className="text-zinc-700 flex-shrink-0">•</span>
      <span className={`font-black flex-shrink-0 ${CONGEST_COLOR[item.congest_lvl] || 'text-zinc-400'}`}>
        {item.congest_lvl}
      </span>
    </span>
  );
}

export default function CrowdTicker({ lang = 'ko', onNavigateToMap }: { lang?: string; onNavigateToMap?: (region: string) => void }) {
  const [items, setItems] = useState<CrowdData[]>([]);
  const [displayId, setDisplayId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api-now/crowd/all')
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (cancelled || !Array.isArray(json) || json.length === 0) return;
          setItems(json);
          setDisplayId((prev) => prev ?? json[0].area);
        })
        .catch(() => {});
    };
    load();
    const refreshTimer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(refreshTimer); };
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const timer = setInterval(() => {
      setDisplayId((current) => {
        const i = items.findIndex((it) => it.area === current);
        return items[(i + 1) % items.length].area;
      });
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [items]);

  if (items.length === 0 || !displayId) return null;

  const flaps = items.map((item) => ({ id: item.area, component: <FlapRow item={item} /> }));

  return (
    <button
      onClick={() => onNavigateToMap?.(AREA_TO_REGION[displayId] || displayId)}
      className="w-full px-6 pt-2.5 overflow-hidden text-left"
    >
      <div className="rounded-2xl overflow-hidden border border-zinc-800/80 bg-zinc-950">
        <LongFlap
          flaps={flaps}
          displayId={displayId}
          digitHeight={36}
          theme="dark"
          hinge={false}
        />
      </div>
    </button>
  );
}
