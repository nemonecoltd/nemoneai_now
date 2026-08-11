'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

// 순위변동 배지 — 상승(▲N, 초록) / 하락(▼N, 회색) / 변동없음(무표시).
// "신규 진입"은 이미 있는 NEW 배지(is_new)가 따로 표시하므로 여기선 다루지 않는다.
// 텍스트 화살표 대신 아이콘 + 스프링 팝 애니메이션(2026-08-11, 순위 UI가 밋밋하다는 피드백).
export default function RankBadge({ rankDelta }: { rankDelta: number | 'new' | null | undefined }) {
  if (typeof rankDelta !== 'number' || rankDelta === 0) return null;

  const isUp = rankDelta > 0;
  return (
    <motion.span
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 14 }}
      className={
        isUp
          ? 'flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600'
          : 'flex items-center gap-0.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-400'
      }
    >
      {isUp ? <TrendingUp size={9} strokeWidth={3} /> : <TrendingDown size={9} strokeWidth={3} />}
      {Math.abs(rankDelta)}
    </motion.span>
  );
}
