"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { SHOW_AI_GUIDE_BUTTON } from '@/lib/featureFlags';
import { Home as HomeIcon, TrendingUp, Map as MapIcon, MapPin, Route as RouteIcon, Newspaper, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';


// 메인 SPA(page.tsx)의 하단 탭 6종과 동일하게 유지 — 라벨/구성이 어긋나면 안 됨
// ('홈' 탭 추가는 2026-09-06 홈 개편 — 랭킹과 분리되면서 여기도 같이 갱신해야 함)
const LABELS = {
  ko: { navHome: '홈', navRec: '랭킹', navMap: '지도', navList: '장소', navCourse: '코스', navMagazine: '핫플' },
  en: { navHome: 'Home', navRec: 'Ranking', navMap: 'Map', navList: 'Spot', navCourse: 'Course', navMagazine: 'Hot' },
  zh: { navHome: '首页', navRec: '排行', navMap: '地图', navList: '地点', navCourse: '路线', navMagazine: '热门' },
  ja: { navHome: 'ホーム', navRec: 'ランキング', navMap: '地図', navList: 'スポット', navCourse: 'コース', navMagazine: '人気' },
} as const;

interface BottomNavProps {
  region?: string;
  lang?: string;
  isPerformanceRegion?: boolean;
  /** PC 사이드카드가 붙어 프레임이 넓어지는 페이지에서만 true — 하단바도 같은 폭으로 넓어진다. */
  wide?: boolean;
}

export default function BottomNav({ region = '성수', lang = 'ko', isPerformanceRegion = false, wide = false }: BottomNavProps) {
  const router = useRouter();
  const t = LABELS[lang as keyof typeof LABELS] || LABELS.ko;
  const encodedRegion = encodeURIComponent(region);

  // 카드가 있는 페이지에서는 상/하단바가 홈과 같은 폭(xl:max-w-6xl)으로 넓어져야 한다는
  // 피드백(2026-09-07). 다만 이걸 무조건 적용해뒀더니 카드가 없는 페이지(랭킹/코스 상세/공유 등)
  // 에서도 PC에서 하단바만 1152px로 늘어나 본문(448px)과 어긋나 있었다 — wide를 넘긴
  // 페이지에서만 넓어지도록 수정(2026-09-08).
  return (
    <div className={cn("fixed inset-x-0 bottom-0 mx-auto z-50 pointer-events-none", wide ? "max-w-md xl:max-w-6xl" : "max-w-md")}>
      {SHOW_AI_GUIDE_BUTTON && <button
        onClick={() => router.push(`/?region=${encodedRegion}&tab=chat&lang=${lang}`)}
        className="pointer-events-auto absolute bottom-28 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-zinc-900 text-white hover:bg-pace-600 active:scale-90 transition-all"
      >
        <MessageCircle size={28} />
      </button>}

      <nav className="pointer-events-auto bg-white/90 backdrop-blur-xl border-t border-zinc-100 px-4 pt-2 pb-4 flex justify-between items-center">
        <NavButton
          onClick={() => router.push(`/?tab=home&lang=${lang}`)}
          icon={<HomeIcon size={22} />}
          label={t.navHome}
        />
        <NavButton
          onClick={() => router.push(`/?region=${encodedRegion}&tab=rec&lang=${lang}`)}
          icon={<TrendingUp size={22} />}
          label={t.navRec}
        />
        <NavButton
          onClick={() => router.push(`/?region=${encodedRegion}&tab=map&lang=${lang}`)}
          icon={<MapIcon size={22} />}
          label={t.navMap}
          disabled={isPerformanceRegion}
        />
        <NavButton
          onClick={() => router.push(`/?region=${encodedRegion}&tab=list&lang=${lang}`)}
          icon={<MapPin size={22} />}
          label={t.navList}
        />
        <NavButton
          onClick={() => router.push(`/course?lang=${lang}`)}
          icon={<RouteIcon size={22} />}
          label={t.navCourse}
        />
        <NavButton
          onClick={() => router.push(`/?region=${encodedRegion}&tab=magazine&lang=${lang}`)}
          icon={<Newspaper size={22} />}
          label={t.navMagazine}
        />
      </nav>
    </div>
  );
}

function NavButton({ onClick, icon, label, disabled }: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.85 }}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        disabled ? "text-zinc-300 cursor-not-allowed" : "text-zinc-400 hover:text-pace-600"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </motion.button>
  );
}
