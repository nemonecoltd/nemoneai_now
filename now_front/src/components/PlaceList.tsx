"use client";

import { motion } from 'framer-motion';
import { Clock, ChevronRight, Heart } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import React, { useState, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AdUnit from './AdUnit';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PAGE_SIZE = 20;

interface Place {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  content: string;
  content_en?: string;
  content_zh?: string;
  image_url?: string;
  video_url?: string;
  location?: string;
  date_range?: string;
  category?: string | null;
}

export type PlaceSort = 'popular' | 'latest' | 'closing';

export default function PlaceList({ places: initialPlaces, region, lang = 'ko', category = 'popup', sort = null, onSortChange }: { places: Place[], region: string, lang?: string, category?: string, sort?: PlaceSort | null, onSortChange?: (sort: PlaceSort) => void }) {
  const { user, signInWithGoogle } = useAuth();
  const [userLikes, setUserLikes] = useState<number[]>([]);
  const [places, setPlaces] = useState(initialPlaces);
  const [hasMore, setHasMore] = useState(initialPlaces.length >= PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlaces(initialPlaces);
    setHasMore(initialPlaces.length >= PAGE_SIZE);
  }, [initialPlaces]);

  const loadMore = React.useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const categoryParam = `&category=${category}`;
      const sortParam = sort ? `&sort=${sort}` : '';
      const res = await fetch(`/api-now/places?region=${encodeURIComponent(region)}&lang=${lang}&limit=${PAGE_SIZE}&offset=${places.length}${categoryParam}${sortParam}`);
      if (res.ok) {
        const data: Place[] = await res.json();
        setPlaces(prev => [...prev, ...data]);
        setHasMore(data.length >= PAGE_SIZE);
      }
    } catch (e) {
      console.error("Failed to load more places", e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, region, lang, places.length, category, sort]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    if (user?.id) {
      fetch(`/api-now/users/${user.id}/likes`)
        .then(res => res.json())
        .then(data => setUserLikes(data.map((p: any) => p.id)))
        .catch(err => console.error("Failed to fetch likes", err));
    }
  }, [user]);

  const toggleLike = async (e: React.MouseEvent, placeId: number) => {
    e.preventDefault();
    if (!user) return signInWithGoogle();

    try {
      const res = await fetch('/api-now/likes/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, place_id: placeId }),
      });
      if (res.ok) {
        const { liked } = await res.json();
        setUserLikes(prev => liked ? [...prev, placeId] : prev.filter(id => id !== placeId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const displayRegion = lang === 'en'
    ? (region === '성수' ? 'Seongsu' : region === '홍대' ? 'Hongdae' : region === '공연' ? 'Concert' : region === '축제' ? 'Festival' : 'Jeju Culture')
    : lang === 'zh'
      ? (region === '성수' ? '圣水洞' : region === '홍대' ? '弘大' : region === '공연' ? '演出' : region === '축제' ? '节庆' : '济州文化')
      : (region === '제주' ? '제주 문화' : region);

  const sortOptions: { key: PlaceSort; ko: string; en: string; zh: string }[] = [
    { key: 'popular', ko: '인기순', en: 'Popular', zh: '人气排序' },
    { key: 'latest', ko: '최신순', en: 'Latest', zh: '最新排序' },
    { key: 'closing', ko: '마감임박순', en: 'Closing Soon', zh: '即将结束' },
  ];

  return (
    <div className="p-6 space-y-6 pb-24">
      {onSortChange && (
        <div className="flex items-center gap-2">
          {sortOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onSortChange(opt.key)}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border",
                sort === opt.key
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-white text-zinc-400 border-zinc-200 hover:border-zinc-300"
              )}
            >
              {lang === 'en' ? opt.en : lang === 'zh' ? opt.zh : opt.ko}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {places.map((place, idx) => (
          <React.Fragment key={place.id}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-zinc-100 overflow-hidden shadow-sm hover:shadow-md transition-all group relative"
          >
            <div className="relative h-48 overflow-hidden bg-zinc-100">
              <img
                src={place.image_url || `https://picsum.photos/seed/${place.id}/400/300`}
                alt={place.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  const retryCount = Number(img.dataset.retryCount || '0');
                  if (retryCount < 2 && place.image_url) {
                    img.dataset.retryCount = String(retryCount + 1);
                    setTimeout(() => { img.src = place.image_url!; }, 600 * (retryCount + 1));
                  } else {
                    img.src = `https://picsum.photos/seed/seongsu-${place.id}/400/300`;
                  }
                }}
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold text-white bg-emerald-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {lang === 'en' ? 'Live' : lang === 'zh' ? '营业中' : '운영 중'}
                </span>
              </div>
              
              {/* Like Button */}
              <button 
                onClick={(e) => toggleLike(e, place.id)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white transition-all hover:bg-white/40 z-20"
              >
                <Heart size={20} className={cn(userLikes.includes(place.id) && "fill-rose-500 text-rose-500")} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">
                    {(lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : place.title}
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">{place.location}</p>
                </div>
                <Link href={`/posts/${place.id}?region=${encodeURIComponent(region)}&lang=${lang}`} className="p-2 rounded-full bg-zinc-50 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all">
                  <ChevronRight size={20} />
                </Link>
              </div>
              <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">
                {(lang === 'en' && place.content_en) ? place.content_en : (lang === 'zh' && place.content_zh) ? place.content_zh : place.content}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Clock size={12} className="text-zinc-400" />
                <span className="text-[10px] font-medium text-zinc-400">
                  {place.date_range || (lang === 'en' ? "Open Daily" : lang === 'zh' ? "全年营业" : "상시 운영")}
                </span>
              </div>
            </div>
          </motion.div>
          {idx === 0 && <AdUnit slotId="1670386458" layoutKey="-6t+ed+2i-1n-4w" />}
          </React.Fragment>
        ))}
        {places.length === 0 && (
          <div className="text-center py-20 text-zinc-400 italic">
            {lang === 'en' ? 'No data available.' : lang === 'zh' ? '暂无数据。' : '데이터가 없습니다.'}
          </div>
        )}
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {isLoadingMore && (
              <span className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
