"use client";

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Minus, Users, X } from 'lucide-react';

interface CrowdData {
  area: string;
  congest_lvl: string;
  ppltn_min: number;
  ppltn_max: number;
  fcst_text?: string;
  age_gender_summary?: {
    male_rate?: string;
    female_rate?: string;
    age_rates?: Record<string, string>;
  };
  weather_summary?: {
    temp?: string;
    sky?: string;
    pcp_msg?: string;
    air_idx?: string;
  };
  updated_at: string;
  ppltn_delta_pct?: number;
  prev_congest_lvl?: string;
}

// 서울시 실시간 도시데이터 혼잡도 4단계 공식 표기 — 배지 색상 매핑
const CONGEST_STYLE: Record<string, string> = {
  '여유': 'bg-emerald-50 text-emerald-600 border-emerald-200',
  '보통': 'bg-amber-50 text-amber-600 border-amber-200',
  '약간 붐빔': 'bg-orange-50 text-orange-600 border-orange-200',
  '붐빔': 'bg-rose-50 text-rose-600 border-rose-200',
};

function formatNum(n: number): string {
  return n.toLocaleString('ko-KR');
}

// 연령대 분포에서 가장 비중 높은 세대 + 성비 우세 쪽을 한 줄 요약으로 — 방문자구성 4줄 서브텍스트용
function summarizeVisitors(ageGender?: CrowdData['age_gender_summary']): string | null {
  if (!ageGender?.age_rates) return null;
  const entries = Object.entries(ageGender.age_rates)
    .map(([age, rate]) => [age, parseFloat(rate)] as [string, number])
    .filter(([, rate]) => !Number.isNaN(rate));
  if (entries.length === 0) return null;
  const [topAge] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const male = parseFloat(ageGender.male_rate || '0');
  const female = parseFloat(ageGender.female_rate || '0');
  const genderLabel = Math.abs(male - female) < 5 ? '남녀 비슷' : male > female ? '남성 다수' : '여성 다수';
  return `${topAge}대 · ${genderLabel} 방문`;
}

function summarizeWeather(weather?: CrowdData['weather_summary']): string | null {
  if (!weather?.temp) return null;
  const parts = [`${Math.round(parseFloat(weather.temp))}°C`];
  if (weather.sky) parts.push(weather.sky);
  return parts.join(' · ');
}

export default function CrowdCard({ region, lang = 'ko' }: { region: string; lang?: string }) {
  const [data, setData] = useState<CrowdData | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // API 실패해도 이전 카드 값을 그대로 유지 — 화면이 깨지거나 빈 카드로 바뀌지 않도록 setData(null) 하지 않음
    fetch(`/api-now/crowd?area=${encodeURIComponent(region)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && json) setData(json); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [region]);

  if (!data) return null;

  const visitorSummary = summarizeVisitors(data.age_gender_summary);
  const weatherSummary = summarizeWeather(data.weather_summary);
  const subtext = [visitorSummary, weatherSummary].filter(Boolean).join(' · ');

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className="sticky top-0 z-40 w-full text-left bg-white/95 backdrop-blur-xl border-b border-zinc-100 px-5 py-3 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${CONGEST_STYLE[data.congest_lvl] || 'bg-zinc-50 text-zinc-500 border-zinc-200'}`}>
              {data.congest_lvl}
            </span>
            <span className="text-[10px] text-zinc-400 font-bold">
              {lang === 'en' ? 'Live Crowd' : lang === 'zh' ? '实时人流' : '실시간 인구'}
            </span>
          </div>
          <ChevronRight size={14} className="text-zinc-300" />
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-sm font-black text-zinc-900">
            {formatNum(data.ppltn_min)}~{formatNum(data.ppltn_max)}{lang === 'en' ? '' : '명'}
          </span>
          {typeof data.ppltn_delta_pct === 'number' && Math.abs(data.ppltn_delta_pct) >= 1 && (
            <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${data.ppltn_delta_pct > 0 ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
              {data.ppltn_delta_pct > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
              {Math.abs(data.ppltn_delta_pct)}%
            </span>
          )}
          {typeof data.ppltn_delta_pct === 'number' && Math.abs(data.ppltn_delta_pct) < 1 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-50 text-zinc-400">
              <Minus size={9} />
            </span>
          )}
        </div>

        {data.fcst_text && (
          <p className="text-[10px] text-zinc-400 font-medium mt-1">{data.fcst_text}</p>
        )}

        {subtext && (
          <p className="text-[10px] text-zinc-400 mt-1">{subtext}</p>
        )}
      </button>

      {showDetail && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/20" onClick={() => setShowDetail(false)} />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-[95] bg-white rounded-t-3xl shadow-2xl p-6 pb-10">
            <button
              onClick={() => setShowDetail(false)}
              className="absolute top-4 right-4 w-8 h-8 bg-zinc-50 rounded-full flex items-center justify-center"
            >
              <X size={16} className="text-zinc-600" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Users size={16} className="text-zinc-400" />
              <h3 className="text-base font-black text-zinc-900">{data.area} 실시간 인구</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              {new Date(data.updated_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 기준
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-zinc-50 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-400 font-bold mb-1">남성</p>
                <p className="text-lg font-black text-zinc-900">{data.age_gender_summary?.male_rate ?? '-'}%</p>
              </div>
              <div className="bg-zinc-50 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-400 font-bold mb-1">여성</p>
                <p className="text-lg font-black text-zinc-900">{data.age_gender_summary?.female_rate ?? '-'}%</p>
              </div>
            </div>

            {data.age_gender_summary?.age_rates && (
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">연령대 분포</p>
                {Object.entries(data.age_gender_summary.age_rates).map(([age, rate]) => (
                  <div key={age} className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-bold w-8 flex-shrink-0">{age}대</span>
                    <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-pace-500 rounded-full" style={{ width: `${Math.min(parseFloat(rate) * 3, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold w-10 text-right flex-shrink-0">{rate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
