"use client";

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

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
  weather_summary?: {
    temp?: string;
    sky?: string;
  };
  ppltn_delta_pct?: number;
}

// 혼잡도 폴링 대상(now_back deps.py CROWD_AREA_MAP)과 동일한 지점만 순환 노출
const TICKER_AREAS = ['성수', '홍대'];
const ROTATE_MS = 10000;

const CONGEST_COLOR: Record<string, string> = {
  '여유': 'text-emerald-600',
  '보통': 'text-amber-600',
  '약간 붐빔': 'text-orange-600',
  '붐빔': 'text-rose-600',
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

export default function CrowdTicker({ lang = 'ko' }: { lang?: string }) {
  const [dataByArea, setDataByArea] = useState<Record<string, CrowdData>>({});
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      TICKER_AREAS.map((area) =>
        fetch(`/api-now/crowd?area=${encodeURIComponent(area)}`)
          .then((res) => (res.ok ? res.json() : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, CrowdData> = {};
      results.forEach((r, i) => { if (r) next[TICKER_AREAS[i]] = r; });
      // 실패한 지점은 이전 값 유지 — 화면이 통째로 비지 않도록 병합
      setDataByArea((prev) => ({ ...prev, ...next }));
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setIdx((i) => (i + 1) % TICKER_AREAS.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const area = TICKER_AREAS[idx];
  const data = dataByArea[area];

  if (!data) return null;

  const age = topAgeGroup(data.age_gender_summary);
  const gender = genderLabel(data.age_gender_summary);
  const temp = data.weather_summary?.temp ? `${Math.round(parseFloat(data.weather_summary.temp))}°` : null;
  const sky = data.weather_summary?.sky;
  const visitorPart = [age, gender, temp && sky ? `${temp}·${sky}` : temp || sky].filter(Boolean).join('·');
  const deltaText = typeof data.ppltn_delta_pct === 'number'
    ? (Math.abs(data.ppltn_delta_pct) < 1 ? '전시간 비슷' : `전시간대비 ${data.ppltn_delta_pct > 0 ? '+' : ''}${data.ppltn_delta_pct}%`)
    : null;

  return (
    <div className="px-6 pt-2.5 overflow-hidden">
      <div className="relative h-9 bg-zinc-900 rounded-2xl overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={area}
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center gap-2 px-4 text-[11px] font-bold whitespace-nowrap overflow-x-auto no-scrollbar"
          >
            <span className="text-white font-black flex-shrink-0">{area}</span>
            <span className="text-zinc-600 flex-shrink-0">|</span>
            <span className="text-white flex-shrink-0">{formatNum(data.ppltn_min)}~{formatNum(data.ppltn_max)}명</span>
            {deltaText && (
              <>
                <span className="text-zinc-600 flex-shrink-0">|</span>
                <span className="text-zinc-300 flex-shrink-0">{deltaText}</span>
              </>
            )}
            {visitorPart && (
              <>
                <span className="text-zinc-600 flex-shrink-0">|</span>
                <span className="text-zinc-300 flex-shrink-0">{visitorPart}</span>
              </>
            )}
            <span className="text-zinc-600 flex-shrink-0">|</span>
            <span className={`font-black flex-shrink-0 ${CONGEST_COLOR[data.congest_lvl] || 'text-zinc-300'}`}>
              {data.congest_lvl}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
