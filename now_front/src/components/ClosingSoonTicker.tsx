"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock3 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ClosingSoonPlace {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  image_url?: string;
  region?: string;
}

const regionBorder: Record<string, string> = {
  '성수': 'border-emerald-400',
  '홍대': 'border-orange-400',
  '강북': 'border-yellow-400',
  '강남': 'border-pink-400',
  '제주': 'border-[#0369a1]',
};

const regionText: Record<string, string> = {
  '성수': 'text-emerald-300',
  '홍대': 'text-orange-300',
  '강북': 'text-yellow-300',
  '강남': 'text-pink-300',
  '제주': 'text-sky-300',
};

export default function ClosingSoonTicker({ lang = 'ko' }: { lang?: string }) {
  const [places, setPlaces] = useState<ClosingSoonPlace[]>([]);

  useEffect(() => {
    fetch('/api-now/places/closing-soon')
      .then(res => res.json())
      .then(setPlaces)
      .catch(() => {});
  }, []);

  if (places.length === 0) return null;

  const label = lang === 'en' ? 'Closing Soon' : lang === 'zh' ? '即将结束' : '마감임박';
  const loop = [...places, ...places]; // 이어붙여서 끊김 없이 순환

  return (
    <div className="flex items-center bg-zinc-900/60">
      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-rose-600/60 z-10">
        <Clock3 size={12} className="text-white" />
        <span className="text-[11px] font-black text-white whitespace-nowrap">{label}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="flex items-center gap-5 py-2 px-4 w-max animate-marquee hover:[animation-play-state:paused]">
          {loop.map((p, idx) => {
            const title = (lang === 'en' && p.title_en) ? p.title_en : (lang === 'zh' && p.title_zh) ? p.title_zh : p.title;
            return (
              <Link
                key={`${p.id}-${idx}`}
                href={`/posts/${p.id}`}
                className={cn(
                  "flex items-center gap-2 flex-shrink-0 pr-5 border-r whitespace-nowrap",
                  regionBorder[p.region || ''] || 'border-zinc-600'
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url || `https://picsum.photos/seed/${p.id}/60`}
                  alt=""
                  className="w-6 h-6 rounded-full object-cover flex-shrink-0 border border-zinc-700"
                />
                <span className={cn("text-xs font-bold", regionText[p.region || ''] || 'text-zinc-100')}>{title}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
