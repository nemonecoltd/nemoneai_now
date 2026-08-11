"use client";

// 서울시 실시간 도시데이터 혼잡도 4단계 공식 표기 순서 — 게이지 진행률(1~4단계) 계산에 사용
export const CONGEST_LEVELS = ['여유', '보통', '약간 붐빔', '붐빔'];

export const CONGEST_RING_COLOR: Record<string, string> = {
  '여유': '#10b981',
  '보통': '#f59e0b',
  '약간 붐빔': '#f97316',
  '붐빔': '#f43f5e',
};

const CONGEST_LABEL: Record<string, Record<string, string>> = {
  '여유': { en: 'Not Crowded', zh: '空闲', ja: '余裕' },
  '보통': { en: 'Moderate', zh: '一般', ja: '普通' },
  '약간 붐빔': { en: 'Slightly Busy', zh: '略拥挤', ja: 'やや混雑' },
  '붐빔': { en: 'Crowded', zh: '拥挤', ja: '混雑' },
};

export function congestLabel(lvl: string, lang: string): string {
  return CONGEST_LABEL[lvl]?.[lang] ?? lvl;
}

// 혼잡도를 원형 게이지(도넛)로 표기 — 텍스트 배지 대신 서울시 도시데이터 사이트 참고 스타일.
// showLabel=false: 색+진행률만(미니 링, 옆에 별도 텍스트를 붙이는 용도).
// showLabel=true: 중앙에 항상 퍼센트 숫자를 표기 — size>=56이면 그 아래 "여유" 등 텍스트 라벨도 함께,
// 작은 링(예: 지도 상단 헤더)은 공간이 없어 숫자 한 줄만(2026-08-11, 텍스트 대신 숫자로 바꿔달라는 요청).
export default function CongestionRing({ level, size, lang, showLabel = true }: { level: string; size: number; lang: string; showLabel?: boolean }) {
  const idx = CONGEST_LEVELS.indexOf(level);
  const pct = idx >= 0 ? (idx + 1) / CONGEST_LEVELS.length : 0.25;
  const color = CONGEST_RING_COLOR[level] || '#a1a1aa';
  const stroke = Math.max(3, Math.round(size * 0.11));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const showSubLabel = showLabel && size >= 56;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f3" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-black leading-none" style={{ color, fontSize: showSubLabel ? size * 0.26 : size * 0.32 }}>
            {Math.round(pct * 100)}%
          </span>
          {showSubLabel && (
            <span className="font-bold leading-none mt-1" style={{ color, fontSize: size * 0.12, opacity: 0.85 }}>
              {congestLabel(level, lang)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
