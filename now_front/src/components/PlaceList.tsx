"use client";

import { motion } from 'framer-motion';
import { MapPin, Clock, ChevronRight, Heart } from 'lucide-react';
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

export default function PlaceList({ places: initialPlaces, region, lang = 'ko', category = 'popup', sortLatest = false, onToggleSortLatest }: { places: Place[], region: string, lang?: string, category?: 'popup' | 'class', sortLatest?: boolean, onToggleSortLatest?: () => void }) {
  const { user, signInWithGoogle } = useAuth();
  const [userLikes, setUserLikes] = useState<number[]>([]);
  const [places, setPlaces] = useState(initialPlaces);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasMore, setHasMore] = useState(initialPlaces.length >= PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlaces(initialPlaces);
    setHasMore(initialPlaces.length >= PAGE_SIZE);
  }, [initialPlaces]);

  const loadMore = React.useCallback(async () => {
    if (isLoadingMore || !hasMore || searchTerm) return;
    setIsLoadingMore(true);
    try {
      const categoryParam = `&category=${category}`;
      const sortParam = sortLatest ? '&sort=latest' : '';
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
  }, [isLoadingMore, hasMore, searchTerm, region, lang, places.length, category, sortLatest]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '400px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      setPlaces(initialPlaces);
      setHasMore(initialPlaces.length >= PAGE_SIZE);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api-now/search?q=${encodeURIComponent(searchTerm)}&region=${encodeURIComponent(region)}&lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setPlaces(data);
        setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

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

  return (
    <div className="p-6 space-y-6 pb-24">
      <div className="flex flex-col gap-4">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onBlur={() => handleSearch()}
            placeholder={lang === 'en'
              ? (region === '공연' ? 'Search for concerts...' : region === '축제' ? 'Search for festivals...' : 'Search for pop-ups...')
              : lang === 'zh'
                ? (region === '공연' ? '搜索演出...' : region === '축제' ? '搜索节庆...' : '搜索快闪店...')
                : (region === '공연' ? '공연 검색...' : region === '축제' ? '축제 검색...' : '팝업스토어 검색...')}
            className="w-full bg-zinc-100/50 border border-zinc-200 rounded-2xl pl-12 pr-12 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all text-zinc-900"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
            {isSearching ? <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" /> : <MapPin size={18} />}
          </div>
          {onToggleSortLatest && (
            <button
              type="button"
              onClick={onToggleSortLatest}
              title={lang === 'en' ? 'Sort by latest' : lang === 'zh' ? '按最新排序' : '최신순'}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                sortLatest ? "bg-emerald-500 text-white" : "bg-transparent text-zinc-400 hover:text-zinc-600"
              )}
            >
              <Clock size={16} />
            </button>
          )}
        </form>
      </div>

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
        {hasMore && !searchTerm && (
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
