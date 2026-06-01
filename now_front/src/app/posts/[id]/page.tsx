"use client";

import { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, MapPin, Calendar, Clock, Share2, Globe, Video } from 'lucide-react';
import { motion } from 'framer-motion';

interface Place {
  id: number;
  title: string;
  title_en?: string;
  content: string;
  content_en?: string;
  location: string;
  image_url: string;
  video_url?: string;
  date_range?: string;
  latitude?: number;
  longitude?: number;
}

function PostDetail() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'ko';
  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);

  useEffect(() => {
    const fetchPlace = async () => {
      const res = await fetch(`/api-now/places?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const found = data.find((p: Place) => p.id === Number(id));
        setPlace(found);
      }
    };
    fetchPlace();
  }, [id]);

  if (!place) return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;

  const displayTitle = (lang === 'en' && place.title_en) ? place.title_en : place.title;
  const displayContent = (lang === 'en' && place.content_en) ? place.content_en : place.content;

  // SEO: JSON-LD Structured Data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": displayTitle,
    "description": displayContent,
    "image": place.image_url,
    "location": {
      "@type": "Place",
      "name": place.location,
      "address": {
        "@type": "PostalAddress",
        "streetAddress": place.location,
        "addressLocality": "Seoul",
        "addressCountry": "KR"
      }
    },
    "startDate": new Date().toISOString().split('T')[0], // 실제 시작일 데이터가 있다면 교체 권장
  };

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl">
      {/* JSON-LD for Google SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* Hero Image */}
      <div className="relative h-[45vh] overflow-hidden bg-zinc-200">
        <img
          src={place.image_url || `https://picsum.photos/seed/seongsu-${place.id}/800/1200`}
          className="w-full h-full object-cover"
          alt={displayTitle}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/seongsu-detail-${place.id}/800/1200`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
        
        {/* Top Buttons */}
        <div className="absolute top-8 left-6 right-6 flex justify-between">
          <button onClick={() => router.back()} className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30">
            <ChevronLeft size={24} />
          </button>
          <button className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/30">
            <Share2 size={20} />
          </button>
        </div>

        {/* Title Overlay */}
        <div className="absolute bottom-10 left-8 right-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2 block">
              {lang === 'en' ? 'Hotplace Spotlight' : '핫플레이스 상세'}
            </span>
            <h1 className="text-3xl font-black text-white tracking-tighter leading-tight">{displayTitle}</h1>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-10 space-y-10 -mt-6 bg-zinc-50 rounded-t-[40px] relative z-10 shadow-2xl">
        <div className="flex gap-4">
          <div className="flex-1 bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-3">
              <Calendar size={20} />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              {lang === 'en' ? 'Duration' : '운영 기간'}
            </p>
            <p className="text-xs font-bold text-zinc-900">{place.date_range || (lang === 'en' ? 'Open Daily' : '상시 운영')}</p>
          </div>
          <div className="flex-1 bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 mb-3">
              <Clock size={20} />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              {lang === 'en' ? 'Status' : '상태'}
            </p>
            <p className="text-xs font-bold text-zinc-900">{lang === 'en' ? 'Active' : '운영 중'}</p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            {lang === 'en' ? 'Details' : '상세 정보'}
          </h2>
          <p className="text-zinc-600 leading-relaxed text-sm font-medium">
            {displayContent}
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            {lang === 'en' ? 'Location' : '위치 안내'}
          </h2>
          <div className="flex items-center gap-2 text-sm text-emerald-600 font-bold bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
            <MapPin size={18} />
            {place.location}
          </div>
          {/* Map Preview (Generic Iframe without API Key limitation) */}
          {place.latitude && place.longitude && place.latitude !== 0 ? (
            <div className="w-full h-48 bg-zinc-200 rounded-3xl overflow-hidden border-4 border-white shadow-lg">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${place.latitude},${place.longitude}&z=16&output=embed`}
                allowFullScreen
              ></iframe>
            </div>
          ) : place.location && place.location !== '확인 필요' ? (
            <div className="w-full h-48 bg-zinc-200 rounded-3xl overflow-hidden border-4 border-white shadow-lg">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(place.location)}&z=16&output=embed`}
                allowFullScreen
              ></iframe>
            </div>
          ) : (
            <div className="w-full h-48 bg-zinc-100 rounded-3xl flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200">
              <MapPin size={24} className="mb-2 opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                {lang === 'en' ? 'Location Data Syncing' : '정확한 위치 정보 준비 중'}
              </p>
            </div>
          )}
        </div>

        {/* Video Link if exists */}
        {place.video_url && (
          <div className="pt-4 pb-10">
            <button className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl">
              <Video size={20} /> {lang === 'en' ? 'Watch Video' : '실시간 영상 보기'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PostDetailPage() {
  return (
    <Suspense>
      <PostDetail />
    </Suspense>
  );
}
