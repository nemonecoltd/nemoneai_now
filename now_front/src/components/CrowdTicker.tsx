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
  };
  ppltn_delta_pct?: number;
}

// 혼잡도 폴링 대상(now_back deps.py CROWD_AREA_MAP)과 동일한 지점만 순환 노출
const TICKER_AREAS = ['성수', '홍대', '강남역', '이태원', '광화문'];
const ROTATE_MS = 5000;

// 지점명 다국어 표기 — API/내부 키는 한글 그대로, 화면 표시만 번역
const AREA_LABEL: Record<string, Record<string, string>> = {
  '성수': { en: 'Seongsu', zh: '圣水', ja: 'ソンス' },
  '홍대': { en: 'Hongdae', zh: '弘大', ja: 'ホンデ' },
  '강남역': { en: 'Gangnam Stn', zh: '江南站', ja: 'カンナム駅' },
  '이태원': { en: 'Itaewon', zh: '梨泰院', ja: 'イテウォン' },
  '광화문': { en: 'Gwanghwamun', zh: '光化门', ja: 'グァンファムン' },
};

function areaLabel(area: string, lang: string): string {
  return AREA_LABEL[area]?.[lang] ?? area;
}

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

const CONGEST_LABEL: Record<string, Record<string, string>> = {
  '여유': { en: 'Not Crowded', zh: '空闲', ja: '余裕' },
  '보통': { en: 'Moderate', zh: '一般', ja: '普通' },
  '약간 붐빔': { en: 'Slightly Busy', zh: '略拥挤', ja: 'やや混雑' },
  '붐빔': { en: 'Crowded', zh: '拥挤', ja: '混雑' },
};

function congestLabel(lvl: string, lang: string): string {
  return CONGEST_LABEL[lvl]?.[lang] ?? lvl;
}

function formatNum(n: number): string {
  return n.toLocaleString('ko-KR');
}

function ppltnUnit(lang: string): string {
  return lang === 'en' ? '' : lang === 'zh' || lang === 'ja' ? '人' : '명';
}

function topAgeGroup(ageGender: CrowdData['age_gender_summary'] | undefined, lang: string): string | null {
  if (!ageGender?.age_rates) return null;
  const entries = Object.entries(ageGender.age_rates)
    .map(([age, rate]) => [age, parseFloat(rate)] as [string, number])
    .filter(([, rate]) => !Number.isNaN(rate));
  if (entries.length === 0) return null;
  const [topAge] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (lang === 'en') return `${topAge}s`;
  if (lang === 'zh') return `${topAge}多岁`;
  if (lang === 'ja') return `${topAge}代`;
  return `${topAge}대`;
}

// "남성다수" 같은 문구 대신 남성/여성/남녀(비슷)만 색으로 구분 표기(남성=파랑, 여성=분홍, 비슷=무채색)
function dominantGender(ageGender: CrowdData['age_gender_summary'] | undefined, lang: string): { label: string; className: string } | null {
  const male = parseFloat(ageGender?.male_rate || '');
  const female = parseFloat(ageGender?.female_rate || '');
  if (Number.isNaN(male) || Number.isNaN(female)) return null;
  const evenLabel = lang === 'en' ? 'Even' : lang === 'zh' ? '均衡' : lang === 'ja' ? '同数' : '남녀';
  const maleLabel = lang === 'en' ? 'Male' : lang === 'zh' ? '男性' : lang === 'ja' ? '男性' : '남성';
  const femaleLabel = lang === 'en' ? 'Female' : lang === 'zh' ? '女性' : lang === 'ja' ? '女性' : '여성';
  if (Math.abs(male - female) < 5) return { label: evenLabel, className: 'text-zinc-400' };
  return male > female
    ? { label: maleLabel, className: 'text-blue-400' }
    : { label: femaleLabel, className: 'text-pink-400' };
}

export default function CrowdTicker({ lang = 'ko', onNavigateToMap }: { lang?: string; onNavigateToMap?: (region: string) => void }) {
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

  const accent = AREA_ACCENT[area] || '#a1a1aa';
  const age = topAgeGroup(data.age_gender_summary, lang);
  const gender = dominantGender(data.age_gender_summary, lang);
  const isFlat = typeof data.ppltn_delta_pct === 'number' && Math.abs(data.ppltn_delta_pct) < 1;
  // 모바일에서 혼잡도가 계속 잘려서 — 온도 칩 제거, 델타도 라벨 없이 숫자만(0%) 표기
  const deltaText = typeof data.ppltn_delta_pct === 'number'
    ? (isFlat ? '0%' : `${data.ppltn_delta_pct > 0 ? '+' : ''}${data.ppltn_delta_pct}%`)
    : null;
  // 증가=빨강, 감소=파랑, 변화 거의 없음(1% 미만)은 무채색
  const deltaColor = isFlat ? 'text-zinc-400' : (data.ppltn_delta_pct ?? 0) > 0 ? 'text-rose-400' : 'text-blue-400';

  return (
    <button
      onClick={() => onNavigateToMap?.(AREA_TO_REGION[area] || area)}
      className="w-full px-6 pt-2.5 overflow-hidden text-left"
    >
      <div className="relative h-9 bg-zinc-950 rounded-2xl overflow-hidden border border-zinc-800/80">
        <AnimatePresence mode="wait">
          <motion.div
            key={area}
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="absolute inset-0 flex items-center gap-1.5 px-4 text-[11px] font-bold whitespace-nowrap overflow-x-auto no-scrollbar"
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: accent, boxShadow: `0 0 5px ${accent}` }}
            />
            <span className="font-black flex-shrink-0" style={{ color: accent }}>{areaLabel(area, lang)}</span>
            <span className="text-zinc-700 flex-shrink-0">•</span>
            <span className="text-zinc-200 font-mono flex-shrink-0">{formatNum(data.ppltn_min)}~{formatNum(data.ppltn_max)}{ppltnUnit(lang)}</span>
            {deltaText && (
              <>
                <span className="text-zinc-700 flex-shrink-0">•</span>
                <span className={`font-medium flex-shrink-0 ${deltaColor}`}>{deltaText}</span>
              </>
            )}
            {age && (
              <>
                <span className="text-zinc-700 flex-shrink-0">•</span>
                <span className="text-zinc-400 font-medium flex-shrink-0">{age}</span>
              </>
            )}
            {gender && (
              <>
                <span className="text-zinc-700 flex-shrink-0">•</span>
                <span className={`font-medium flex-shrink-0 ${gender.className}`}>{gender.label}</span>
              </>
            )}
            <span className="text-zinc-700 flex-shrink-0">•</span>
            <span className={`font-black flex-shrink-0 ${CONGEST_COLOR[data.congest_lvl] || 'text-zinc-400'}`}>
              {congestLabel(data.congest_lvl, lang)}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </button>
  );
}
