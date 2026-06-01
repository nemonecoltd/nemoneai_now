"use client";

import { motion } from 'framer-motion';
import { MapPin, Clock, ChevronRight, Filter, Heart } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Place {
  id: number;
  title: string;
  title_en?: string;
  content: string;
  content_en?: string;
  image_url?: string;
  video_url?: string;
  location?: string;
  date_range?: string;
}

export default function PlaceList({ places: initialPlaces, region, lang = 'ko' }: { places: Place[], region: string, lang?: string }) {
  const { user, signInWithGoogle } = useAuth();
  const [userLikes, setUserLikes] = useState<number[]>([]);
  const [places, setPlaces] = useState(initialPlaces);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setPlaces(initialPlaces);
  }, [initialPlaces]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim()) {
      setPlaces(initialPlaces);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(`/api-now/search?q=${encodeURIComponent(searchTerm)}&region=${encodeURIComponent(region)}&lang=${lang}`);
      if (res.ok) {
        const data = await res.json();
        setPlaces(data);
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
    ? (region === '성수' ? 'Seongsu' : region === '홍대' ? 'Hongdae' : 'Concert')
    : region;

  return (
    <div className="p-6 space-y-6 pb-24">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-display">
            {lang === 'en'
              ? (region === '공연' ? 'Seoul Concerts' : `${displayRegion} Hotplaces`)
              : (region === '공연' ? '서울 공연' : `${region} 핫플레이스`)}
          </h2>
          <button className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
            <Filter size={14} /> {lang === 'en' ? 'Filter' : '필터'}
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onBlur={() => handleSearch()}
            placeholder={lang === 'en'
              ? (region === '공연' ? 'Search for concerts...' : 'Search for pop-ups...')
              : (region === '공연' ? '공연 검색...' : '팝업스토어 검색...')}
            className="w-full bg-zinc-100/50 border border-zinc-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500/50 transition-all text-zinc-900"
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
            {isSearching ? <span className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin inline-block" /> : <MapPin size={18} />}
          </div>
        </form>
      </div>

      <div className="space-y-4">
        {places.map((place) => (
          <motion.div
            key={place.id}
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
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://picsum.photos/seed/seongsu-${place.id}/400/300`;
                }}
              />
              <div className="absolute top-4 left-4 flex gap-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-bold text-white bg-emerald-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  {lang === 'en' ? 'Live' : '운영 중'}
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
                    {(lang === 'en' && place.title_en) ? place.title_en : place.title}
                  </h3>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">{place.location}</p>
                </div>
                <Link href={`/posts/${place.id}`} className="p-2 rounded-full bg-zinc-50 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 transition-all">
                  <ChevronRight size={20} />
                </Link>
              </div>
              <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed">
                {(lang === 'en' && place.content_en) ? place.content_en : place.content}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Clock size={12} className="text-zinc-400" />
                <span className="text-[10px] font-medium text-zinc-400">
                  {place.date_range || (lang === 'en' ? "Open Daily" : "상시 운영")}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
        {places.length === 0 && (
          <div className="text-center py-20 text-zinc-400 italic">
            {lang === 'en' ? 'No data available.' : '데이터가 없습니다.'}
          </div>
        )}
      </div>
    </div>
  );
}
