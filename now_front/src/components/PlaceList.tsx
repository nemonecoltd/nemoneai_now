"use client";

import { motion } from 'framer-motion';
import { Clock, ChevronRight, ChevronDown, Heart, Search, X } from 'lucide-react';
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
  title_ja?: string;
  content: string;
  content_en?: string;
  content_zh?: string;
  content_ja?: string;
  image_url?: string;
  video_url?: string;
  location?: string;
  date_range?: string;
  category?: string | null;
}

export type PlaceSort = 'random' | 'popular' | 'latest' | 'closing';

export default function PlaceList({ places: initialPlaces, region, lang = 'ko', category = 'popup', sort = null, onSortChange }: { places: Place[], region: string, lang?: string, category?: string, sort?: PlaceSort | null, onSortChange?: (sort: PlaceSort) => void }) {
  const { user, signInWithGoogle } = useAuth();
  const [userLikes, setUserLikes] = useState<number[]>([]);
  const [places, setPlaces] = useState(initialPlaces);
  const [hasMore, setHasMore] = useState(initialPlaces.length >= PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const isSearchMode = searchQuery.trim().length > 0;

  useEffect(() => {
    setPlaces(initialPlaces);
    setHasMore(initialPlaces.length >= PAGE_SIZE);
  }, [initialPlaces]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults([]); return; }
    setIsSearching(true);
    const t = setTimeout(() => {
      fetch(`/api-now/places/search?q=${encodeURIComponent(q)}&region=${encodeURIComponent(region)}`)
        .then(res => (res.ok ? res.json() : []))
        .then((data: Place[]) => setSearchResults(data))
        .catch(err => { console.error('Failed to search places', err); setSearchResults([]); })
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, region]);

  const loadMore = React.useCallback(async () => {
    if (isLoadingMore || !hasMore || isSearchMode) return;
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
  }, [isLoadingMore, hasMore, isSearchMode, region, lang, places.length, category, sort]);

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

  const sortOptions: { key: PlaceSort; ko: string; en: string; zh: string }[] = [
    { key: 'random', ko: '랜덤순', en: 'Random', zh: '随机排序' },
    { key: 'popular', ko: '인기순', en: 'Popular', zh: '人气排序' },
    { key: 'latest', ko: '최신순', en: 'Latest', zh: '最新排序' },
    { key: 'closing', ko: '마감임박순', en: 'Closing Soon', zh: '即将结束' },
  ];

  const displayPlaces = isSearchMode ? searchResults : places;

  return (
    <div className="p-6 space-y-6 pb-24">
      {onSortChange && (
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-300 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={lang === 'en' ? 'Search places...' : lang === 'zh' ? '搜索地点...' : '장소 검색'}
              className="w-full pl-9 pr-8 py-2.5 rounded-xl text-sm border border-zinc-200 bg-white outline-none focus:border-pace-400 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-zinc-300 hover:text-zinc-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="relative flex-shrink-0">
            <select
              value={sort ?? 'random'}
              onChange={(e) => onSortChange(e.target.value as PlaceSort)}
              disabled={isSearchMode}
              className={cn(
                "appearance-none py-2.5 pl-3 pr-8 rounded-xl text-xs font-bold border bg-white outline-none transition-all cursor-pointer",
                isSearchMode ? "opacity-40 cursor-not-allowed border-zinc-200 text-zinc-300" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
              )}
            >
              {sortOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {lang === 'en' ? opt.en : lang === 'zh' ? opt.zh : opt.ko}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          </div>
        </div>
      )}

      <div className="space-y-4">
        {isSearchMode && isSearching && (
          <div className="flex justify-center py-10">
            <span className="w-5 h-5 border-2 border-pace-500 border-t-transparent rounded-full animate-spin inline-block" />
          </div>
        )}
        {displayPlaces.map((place, idx) => (
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
                <span className="px-3 py-1 rounded-full text-[10px] font-bold text-white bg-pace-500 flex items-center gap-1.5">
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
              <Link href={`/posts/${place.id}?region=${encodeURIComponent(region)}&lang=${lang}`} className="flex items-start justify-between gap-3 -m-1 p-1 rounded-xl hover:bg-zinc-50 transition-colors">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-zinc-900">
                    {(lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : (lang === 'ja' && place.title_ja) ? place.title_ja : place.title}
                  </h3>
                  <p className="text-[10px] font-bold text-pace-600 uppercase tracking-widest mt-1">{place.location}</p>
                </div>
                <span className="flex-shrink-0 p-2 rounded-full bg-zinc-50 text-zinc-400">
                  <ChevronRight size={20} />
                </span>
              </Link>
              <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">
                {(lang === 'en' && place.content_en) ? place.content_en : (lang === 'zh' && place.content_zh) ? place.content_zh : (lang === 'ja' && place.content_ja) ? place.content_ja : place.content}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Clock size={12} className="text-zinc-400" />
                <span className="text-[10px] font-medium text-zinc-400">
                  {place.date_range || (lang === 'en' ? "Open Daily" : lang === 'zh' ? "全年营业" : "상시 운영")}
                </span>
              </div>
            </div>
          </motion.div>
          {(idx === 0 || (idx > 0 && idx % 7 === 0)) && <AdUnit slotId="1670386458" layoutKey="-6t+ed+2i-1n-4w" />}
          </React.Fragment>
        ))}
        {!isSearching && displayPlaces.length === 0 && (
          <div className="text-center py-20 text-zinc-400 italic">
            {isSearchMode
              ? (lang === 'en' ? 'No matching places.' : lang === 'zh' ? '没有匹配的地点。' : '검색 결과가 없습니다.')
              : (lang === 'en' ? 'No data available.' : lang === 'zh' ? '暂无数据。' : '데이터가 없습니다.')}
          </div>
        )}
        {hasMore && !isSearchMode && (
          <div ref={sentinelRef} className="flex justify-center py-6">
            {isLoadingMore && (
              <span className="w-5 h-5 border-2 border-pace-500 border-t-transparent rounded-full animate-spin inline-block" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
