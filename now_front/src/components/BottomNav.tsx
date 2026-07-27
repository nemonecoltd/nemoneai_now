"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Map as MapIcon, MapPin, Library, Route as RouteIcon, MessageCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LABELS = {
  ko: { navRec: '핫플', navMap: '지도', navList: '장소', navTheme: '테마', navTour: '코스' },
  en: { navRec: 'Hot', navMap: 'Map', navList: 'Spot', navTheme: 'Theme', navTour: 'Course' },
  zh: { navRec: '热门', navMap: '地图', navList: '地点', navTheme: '主题', navTour: '路线' },
} as const;

interface BottomNavProps {
  region?: string;
  lang?: string;
  isPerformanceRegion?: boolean;
}

export default function BottomNav({ region = '성수', lang = 'ko', isPerformanceRegion = false }: BottomNavProps) {
  const router = useRouter();
  const t = LABELS[lang as keyof typeof LABELS] || LABELS.ko;
  const encodedRegion = encodeURIComponent(region);

  return (
    <div className="fixed inset-x-0 bottom-0 max-w-md mx-auto z-50 pointer-events-none">
      <button
        onClick={() => router.push(`/?region=${encodedRegion}&tab=chat&lang=${lang}`)}
        className="pointer-events-auto absolute bottom-28 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-zinc-900 text-white hover:bg-emerald-600 active:scale-90 transition-all"
      >
        <MessageCircle size={28} />
      </button>

      <nav className="pointer-events-auto bg-white/90 backdrop-blur-xl border-t border-zinc-100 px-6 pt-2 pb-4 flex justify-between items-center">
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
          onClick={() => router.push(`/?region=${encodedRegion}&tab=theme&lang=${lang}`)}
          icon={<Library size={22} />}
          label={t.navTheme}
        />
        <NavButton
          onClick={() => router.push(`/?region=${encodedRegion}&tab=tour&lang=${lang}`)}
          icon={<RouteIcon size={22} />}
          label={t.navTour}
          disabled={isPerformanceRegion}
        />
      </nav>
    </div>
  );
}

function NavButton({ onClick, icon, label, disabled }: { onClick: () => void; icon: React.ReactNode; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        disabled ? "text-zinc-300 cursor-not-allowed" : "text-zinc-400 hover:text-emerald-600"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}
