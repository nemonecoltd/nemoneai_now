"use client";

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Minus, Users, X } from 'lucide-react';
import CongestionRing from './CongestionRing';
import AdUnit from './AdUnit';

// 지역 → 서울시 도시데이터 지점 후보. now_back deps.py CROWD_AREA_MAP과 키를 맞출 것.
// 강북은 넓은 지역이라 이태원 외 지점(광화문 등)으로 향후 확장 예정 — 여기 배열에 추가하면
// 아래 드롭다운이 선택지를 자동으로 늘려 보여줌.
const REGION_CROWD_POINTS: Record<string, string[]> = {
  '성수': ['성수'],
  '홍대': ['홍대'],
  '강남': ['강남역'],
  '강북': ['이태원', '광화문'],
};

// 지점명 다국어 표기 — API/내부 키(value)는 한글 그대로, 드롭다운 표시 텍스트만 번역
const POINT_LABEL: Record<string, Record<string, string>> = {
  '성수': { en: 'Seongsu', zh: '圣水', ja: 'ソンス' },
  '홍대': { en: 'Hongdae', zh: '弘大', ja: 'ホンデ' },
  '강남역': { en: 'Gangnam Stn', zh: '江南站', ja: 'カンナム駅' },
  '이태원': { en: 'Itaewon', zh: '梨泰院', ja: 'イテウォン' },
  '광화문': { en: 'Gwanghwamun', zh: '光化门', ja: 'グァンファムン' },
};

function pointLabel(point: string, lang: string): string {
  return POINT_LABEL[point]?.[lang] ?? point;
}

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

function formatNum(n: number): string {
  return n.toLocaleString('ko-KR');
}

function ppltnUnit(lang: string): string {
  return lang === 'en' ? '' : lang === 'zh' || lang === 'ja' ? '人' : '명';
}

function detailsLabel(lang: string): string {
  return lang === 'en' ? 'Details' : lang === 'zh' ? '详情' : lang === 'ja' ? '詳細' : '자세히';
}

function flatDeltaLabel(lang: string): string {
  return lang === 'en' ? 'About the same' : lang === 'zh' ? '变化不大' : lang === 'ja' ? 'ほぼ同じ' : '직전대비 비슷';
}

// 연령대 분포에서 가장 비중 높은 세대 — 방문자구성 칩용
function topAgeGroup(ageGender?: CrowdData['age_gender_summary']): string | null {
  if (!ageGender?.age_rates) return null;
  const entries = Object.entries(ageGender.age_rates)
    .map(([age, rate]) => [age, parseFloat(rate)] as [string, number])
    .filter(([, rate]) => !Number.isNaN(rate));
  if (entries.length === 0) return null;
  const [topAge] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return topAge;
}

function ageDominantLabel(age: string, lang: string): string {
  if (lang === 'en') return `Mostly ${age}s`;
  if (lang === 'zh') return `${age}多岁为主`;
  if (lang === 'ja') return `${age}代中心`;
  return `${age}대 강세`;
}

// 남/여 둘 다 보여주면 줄이 밀려서 — 우세한 쪽 하나만, 정확히 동률이면 '남여동일'
function dominantGenderChip(ageGender: CrowdData['age_gender_summary'] | undefined, lang: string): { label: string; className: string } | null {
  const male = parseFloat(ageGender?.male_rate || '');
  const female = parseFloat(ageGender?.female_rate || '');
  if (Number.isNaN(male) || Number.isNaN(female)) return null;
  const evenLabel = lang === 'en' ? 'Even split' : lang === 'zh' ? '男女均衡' : lang === 'ja' ? '男女同数' : '남여동일';
  const maleLabel = lang === 'en' ? 'Male' : lang === 'zh' ? '男性' : lang === 'ja' ? '男性' : '남성';
  const femaleLabel = lang === 'en' ? 'Female' : lang === 'zh' ? '女性' : lang === 'ja' ? '女性' : '여성';
  if (male === female) return { label: evenLabel, className: 'bg-zinc-50 text-zinc-500' };
  return male > female
    ? { label: `${maleLabel} ${ageGender!.male_rate}%`, className: 'bg-blue-50 text-blue-500' }
    : { label: `${femaleLabel} ${ageGender!.female_rate}%`, className: 'bg-pink-50 text-pink-500' };
}

export default function CrowdCard({ region, lang = 'ko' }: { region: string; lang?: string }) {
  const points = REGION_CROWD_POINTS[region];
  const [selectedPoint, setSelectedPoint] = useState(points?.[0]);
  const [data, setData] = useState<CrowdData | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // 지역이 바뀌면 그 지역의 첫 지점으로 리셋 — 다른 지역 선택값이 그대로 남지 않도록
  useEffect(() => {
    setSelectedPoint(REGION_CROWD_POINTS[region]?.[0]);
  }, [region]);

  useEffect(() => {
    if (!selectedPoint) return;
    let cancelled = false;
    // API 실패해도 이전 카드 값을 그대로 유지 — 화면이 깨지거나 빈 카드로 바뀌지 않도록 setData(null) 하지 않음
    fetch(`/api-now/crowd?area=${encodeURIComponent(selectedPoint)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (!cancelled && json) setData(json); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [selectedPoint]);

  if (!points || !data) return null;

  const topAge = topAgeGroup(data.age_gender_summary);
  const genderChip = dominantGenderChip(data.age_gender_summary, lang);
  const tempChip = data.weather_summary?.temp ? `${Math.round(parseFloat(data.weather_summary.temp))}°C` : null;
  const skyChip = data.weather_summary?.sky || null;
  const maleLabel = lang === 'en' ? 'Male' : lang === 'zh' ? '男性' : lang === 'ja' ? '男性' : '남성';
  const femaleLabel = lang === 'en' ? 'Female' : lang === 'zh' ? '女性' : lang === 'ja' ? '女性' : '여성';

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className="sticky top-0 z-40 w-full text-left bg-white/95 backdrop-blur-xl border-b border-zinc-100 px-5 py-3 shadow-sm"
      >
        {/* 1줄: 지점선택·연령·온도·날씨 ... 자세히 (얇은 상단 헤더) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 지점 선택 — 강북처럼 지역 안에 지점이 여러 개로 늘어나도 여기서 바로 전환 */}
            <span
              className="relative flex items-center gap-0.5 text-[10px] text-zinc-500 font-bold"
              onClick={(e) => e.stopPropagation()}
            >
              <select
                value={selectedPoint}
                onChange={(e) => setSelectedPoint(e.target.value)}
                className="appearance-none bg-transparent pr-3 focus:outline-none"
              >
                {points.map((p) => (
                  <option key={p} value={p}>{pointLabel(p, lang)}</option>
                ))}
              </select>
              <ChevronDown size={10} className="pointer-events-none absolute right-0 text-zinc-400" />
            </span>
            {topAge && <span className="text-[10px] font-bold text-indigo-500">{ageDominantLabel(topAge, lang)}</span>}
            {tempChip && <span className="text-[10px] font-bold text-orange-500">{tempChip}</span>}
            {skyChip && <span className="text-[10px] font-bold text-sky-500">{skyChip}</span>}
          </div>
          <span className="text-[10px] text-zinc-400 font-bold">
            {detailsLabel(lang)}
          </span>
        </div>

        {/* 2줄: 혼잡도+인구수+델타+남녀를 한 줄에 — 가장 중요한 정보라 크게, 줄을 나누지 않음 */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <CongestionRing level={data.congest_lvl} size={30} lang={lang} />
          <span className="text-base font-black text-zinc-900 flex-shrink-0">
            {formatNum(data.ppltn_min)}~{formatNum(data.ppltn_max)}{ppltnUnit(lang)}
          </span>
          {typeof data.ppltn_delta_pct === 'number' && Math.abs(data.ppltn_delta_pct) >= 1 && (
            <span className={`flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${data.ppltn_delta_pct > 0 ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
              {data.ppltn_delta_pct > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
              {Math.abs(data.ppltn_delta_pct)}%
            </span>
          )}
          {typeof data.ppltn_delta_pct === 'number' && Math.abs(data.ppltn_delta_pct) < 1 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-zinc-50 text-zinc-400 flex-shrink-0">
              <Minus size={9} /> {flatDeltaLabel(lang)}
            </span>
          )}
          {genderChip && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${genderChip.className}`}>
              {genderChip.label}
            </span>
          )}
        </div>
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
              <h3 className="text-base font-black text-zinc-900">
                {pointLabel(data.area, lang)} {lang === 'en' ? 'Live Population' : lang === 'zh' ? '实时人流' : lang === 'ja' ? 'リアルタイム人口' : '실시간 인구'}
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mb-5">
              {new Date(data.updated_at).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })}{' '}
              {lang === 'en' ? 'as of' : lang === 'zh' ? '更新于' : lang === 'ja' ? '時点' : '기준'}
            </p>

            <div className="flex items-center gap-4 mb-6">
              <CongestionRing level={data.congest_lvl} size={84} lang={lang} />
              <div>
                <p className="text-xl font-black text-zinc-900">
                  {formatNum(data.ppltn_min)}~{formatNum(data.ppltn_max)}{ppltnUnit(lang)}
                </p>
                {typeof data.ppltn_delta_pct === 'number' && Math.abs(data.ppltn_delta_pct) >= 1 && (
                  <span className={`inline-flex items-center gap-0.5 mt-1 text-xs font-bold px-1.5 py-0.5 rounded-full ${data.ppltn_delta_pct > 0 ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                    {data.ppltn_delta_pct > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                    {Math.abs(data.ppltn_delta_pct)}%
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-zinc-50 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-400 font-bold mb-1">{maleLabel}</p>
                <p className="text-lg font-black text-zinc-900">{data.age_gender_summary?.male_rate ?? '-'}%</p>
              </div>
              <div className="bg-zinc-50 rounded-2xl p-4">
                <p className="text-[10px] text-zinc-400 font-bold mb-1">{femaleLabel}</p>
                <p className="text-lg font-black text-zinc-900">{data.age_gender_summary?.female_rate ?? '-'}%</p>
              </div>
            </div>

            {data.age_gender_summary?.age_rates && (
              <div className="space-y-2">
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">
                  {lang === 'en' ? 'Age Distribution' : lang === 'zh' ? '年龄分布' : lang === 'ja' ? '年齢分布' : '연령대 분포'}
                </p>
                {Object.entries(data.age_gender_summary.age_rates).map(([age, rate]) => (
                  <div key={age} className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 font-bold w-8 flex-shrink-0">
                      {age}{lang === 'en' ? 's' : lang === 'zh' ? '多岁' : lang === 'ja' ? '代' : '대'}
                    </span>
                    <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-pace-500 rounded-full" style={{ width: `${Math.min(parseFloat(rate) * 3, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-400 font-bold w-10 text-right flex-shrink-0">{rate}%</span>
                  </div>
                ))}
              </div>
            )}

            <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
          </div>
        </>
      )}
    </>
  );
}
