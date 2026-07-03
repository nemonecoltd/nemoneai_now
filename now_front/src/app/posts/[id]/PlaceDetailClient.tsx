'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, MapPin, Calendar, Clock, Share2, Globe, Video } from 'lucide-react';
import { InArticleAd } from '@/components/AdUnit';
import { motion } from 'framer-motion';

export interface BlogReview {
  title: string;
  url: string;
}

export interface Place {
  id: number;
  title: string;
  title_en?: string;
  content: string;
  content_en?: string;
  location: string;
  image_url: string;
  video_url?: string;
  date_range?: string;
  end_date?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  naver_place_id?: string;
  blog_reviews?: BlogReview[] | string | null;
  link_url?: string | null;
}

interface Props {
  place: Place | null;
  lang: string;
  suggestions: Place[];
}

export default function PlaceDetailClient({ place, lang, suggestions }: Props) {
  const router = useRouter();
  const [navIndex, setNavIndex] = React.useState(0);

  React.useEffect(() => {
    if (place?.id) {
      fetch(`/api-now/places/${place.id}/view`, { method: 'POST', keepalive: true }).catch(() => {});
    }
  }, [place?.id]);

  const goToSuggestion = (direction: 1 | -1) => {
    if (suggestions.length === 0) return;
    const nextIndex = (navIndex + direction + suggestions.length) % suggestions.length;
    setNavIndex(nextIndex);
    const target = suggestions[nextIndex];
    router.push(`/posts/${target.id}${place?.region ? `?region=${encodeURIComponent(place.region)}` : ''}`);
  };

  if (!place) {
    return (
      <div className="min-h-screen bg-zinc-50 max-w-md mx-auto px-6 py-12 flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center text-3xl">🏁</div>
          <div className="space-y-1">
            <p className="text-lg font-bold text-zinc-800">운영이 종료됐습니다</p>
            <p className="text-sm text-zinc-400">해당 팝업·행사는 운영 기간이 지났어요.</p>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">지금 가볼 만한 핫플</p>
            <div className="flex flex-col gap-3">
              {suggestions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/posts/${s.id}${s.region ? `?region=${encodeURIComponent(s.region)}` : ''}`)}
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm text-left hover:shadow-md transition-shadow"
                >
                  <img
                    src={s.image_url}
                    alt={s.title}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/sug-${s.id}/200/200`; }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{s.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{s.location}</p>
                    {(s.date_range || s.end_date) && (
                      <p className="text-xs text-emerald-600 font-bold mt-1">
                        {s.date_range || `~ ${s.end_date}`}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => router.push('/')}
          className="w-full py-3 bg-zinc-900 text-white text-sm font-bold rounded-2xl"
        >
          전체 핫플레이스 보기
        </button>
      </div>
    );
  }

  const displayTitle = (lang === 'en' && place.title_en) ? place.title_en : place.title;
  const displayContent = (lang === 'en' && place.content_en) ? place.content_en : place.content;

  const displayDateRange = (() => {
    if (place.date_range) return place.date_range;
    if (place.end_date) return `~ ${place.end_date}`;
    return null;
  })();

  const toISO = (s: string): string => {
    const clean = s.replace(/\s/g, '').replace(/\.+$/, '');
    const full = clean.match(/^(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})\.?$/);
    if (full) return `${full[1]}-${full[2].padStart(2,'0')}-${full[3].padStart(2,'0')}`;
    const short = clean.match(/^(\d{1,2})[.\-](\d{1,2})\.?$/);
    if (short) return `${new Date().getFullYear()}-${short[1].padStart(2,'0')}-${short[2].padStart(2,'0')}`;
    return new Date().toISOString().split('T')[0];
  };

  const [startDate, endDate] = (() => {
    const src = displayDateRange || '';
    const parts = src.split('~').map(s => s.trim());
    const start = parts[0] ? toISO(parts[0]) : new Date().toISOString().split('T')[0];
    const end = parts[1] ? toISO(parts[1]) : undefined;
    return [start, end];
  })();

  const isPerformanceRegion = place.region === '공연' || place.region === '축제' || place.region === '제주';
  const regionColorClass = {
    '성수': 'bg-emerald-600/80',
    '홍대': 'bg-rose-600/80',
    '공연': 'bg-violet-600/80',
    '제주': 'bg-sky-700/80',
    '축제': 'bg-amber-600/80',
  }[place.region || ''] || 'bg-black/40';
  const hasValidNaverId = place.naver_place_id &&
    !place.naver_place_id.startsWith('raw_') &&
    !place.naver_place_id.startsWith('seoul_') &&
    !isPerformanceRegion;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": displayTitle,
    "description": displayContent.replace(/<[^>]*>/g, '').substring(0, 160),
    "url": `https://now.nemoneai.com/posts/${place.id}`,
    "image": place.image_url || 'https://now.nemoneai.com/og-image.png',
    "location": {
      "@type": "Place",
      "name": place.location || (place.region === '제주' ? '제주아트센터' : '서울'),
      "address": {
        "@type": "PostalAddress",
        "streetAddress": place.location || undefined,
        "addressLocality": place.region === '제주' ? "Jeju" : "Seoul",
        "addressRegion": place.region === '제주' ? "Jeju-do" : undefined,
        "addressCountry": "KR"
      }
    },
    "startDate": startDate,
    ...(endDate ? { "endDate": endDate } : {}),
  };

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {suggestions.length > 0 && (
        <div className="fixed inset-0 max-w-md mx-auto z-30 pointer-events-none">
          <button
            onClick={() => goToSuggestion(-1)}
            aria-label={lang === 'en' ? 'Previous place' : '이전 장소'}
            className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-auto w-11 h-11 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-zinc-100 flex items-center justify-center text-zinc-700 active:scale-95 transition-transform"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => goToSuggestion(1)}
            aria-label={lang === 'en' ? 'Next place' : '다음 장소'}
            className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-auto w-11 h-11 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-zinc-100 flex items-center justify-center text-zinc-700 active:scale-95 transition-transform"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}

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

        <div className="absolute top-8 left-6 right-6 flex justify-between">
          <button
            onClick={() => router.push(`/?region=${encodeURIComponent(place.region || '성수')}`)}
            className={`w-11 h-11 ${regionColorClass} backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 shadow-lg active:scale-95 transition-transform`}
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2">
            <a
              href="https://nemoneai.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="네모네AIM (맛매치)"
              className="w-11 h-11 rounded-full overflow-hidden border border-white/40 shadow-lg active:scale-95 transition-transform"
            >
              <img src="/matmatch-icon.png" alt="네모네AIM" className="w-full h-full object-cover" />
            </a>
            <button className="w-11 h-11 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 shadow-lg active:scale-95 transition-transform">
              <Share2 size={20} />
            </button>
          </div>
        </div>

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
            <p className="text-xs font-bold text-zinc-900">{displayDateRange || (lang === 'en' ? 'Open Daily' : '상시 운영')}</p>
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
          {(() => {
            const LABEL_RE = /^(기간|출연|러닝타임|관람연령|티켓가격|공연시간|기획|장소|주최|문의):\s*(.+)$/;
            const lines = displayContent.replace(/\|/g, '\n').split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const sourceLine = lines.find(l => l.includes('출처'));
            const infoLines = lines.filter(l => LABEL_RE.test(l));
            const textLines = lines.filter(l => !LABEL_RE.test(l) && !l.includes('출처'));

            return (
              <>
                {textLines.length > 0 && (
                  <div className="text-zinc-600 leading-relaxed text-sm font-medium space-y-2">
                    {textLines.map((line, i) =>
                      line.match(/map\.naver\.com/) ? null :
                      line.match(/https?:\/\/\S+/) ? (
                        <p key={i}>
                          <a href={line.match(/https?:\/\/\S+/)![0]} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline font-bold">
                            바로가기: 링크 열기
                          </a>
                        </p>
                      ) : (
                        <p key={i}>{line}</p>
                      )
                    )}
                  </div>
                )}

                {infoLines.length > 0 && (
                  <ul className="bg-white border border-zinc-100 rounded-2xl p-4 space-y-2.5">
                    {infoLines.map((line, i) => {
                      const m = line.match(LABEL_RE)!;
                      return (
                        <li key={i} className="flex gap-2 text-sm leading-snug">
                          <span className="text-emerald-500 font-black flex-shrink-0">•</span>
                          <span>
                            <span className="font-bold text-zinc-800">{m[1]}</span>
                            <span className="text-zinc-500"> {m[2]}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {sourceLine && (
                  <p className="text-[11px] text-zinc-400 text-right">{sourceLine}</p>
                )}
              </>
            );
          })()}

          {Array.isArray(place.blog_reviews) && place.blog_reviews.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">블로그 후기</p>
              <div className="flex flex-col gap-2">
                {(place.blog_reviews as BlogReview[]).map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl p-3 shadow-sm hover:border-emerald-200 transition-all no-underline group">
                    <span className="text-xs font-black text-zinc-300 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="text-xs font-bold text-zinc-700 group-hover:text-emerald-600 flex-grow leading-snug line-clamp-2">{r.title}</span>
                    <span className="text-zinc-300 flex-shrink-0 group-hover:text-emerald-500">›</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {hasValidNaverId && (
            <a
              href={`https://map.naver.com/p/entry/place/${place.naver_place_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <img
                src={place.image_url || `https://picsum.photos/seed/naver-${place.id}/200/200`}
                alt={displayTitle}
                className="w-20 h-20 object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/naver-${place.id}/200/200`; }}
              />
              <div className="flex items-center gap-2 flex-1 pr-4">
                <span className="text-base font-black text-[#03C75A]">N</span>
                <span className="text-sm font-bold text-zinc-800">네이버지도에서 보기</span>
                <span className="ml-auto text-zinc-300 text-lg">›</span>
              </div>
            </a>
          )}

          {isPerformanceRegion && place.link_url && (
            <a
              href={place.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <img
                src={place.image_url || `https://picsum.photos/seed/link-${place.id}/200/200`}
                alt={displayTitle}
                className="w-20 h-20 object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/link-${place.id}/200/200`; }}
              />
              <div className="flex items-center gap-2 flex-1 pr-4">
                <Globe size={16} className="text-emerald-500 flex-shrink-0" />
                <span className="text-sm font-bold text-zinc-800">
                  {place.region === '공연' || place.region === '제주' ? '예매하러 가기' : '공식 페이지 바로가기'}
                </span>
                <span className="ml-auto text-zinc-300 text-lg">›</span>
              </div>
            </a>
          )}
        </div>

        <InArticleAd />

        {suggestions.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
              {lang === 'en' ? 'More to explore' : '이런 곳도 있어요'}
            </p>
            <div className="flex flex-col gap-3">
              {suggestions.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/posts/${s.id}${s.region ? `?region=${encodeURIComponent(s.region)}` : ''}`)}
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm text-left hover:shadow-md transition-shadow"
                >
                  <img
                    src={s.image_url}
                    alt={s.title}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/sug-${s.id}/200/200`; }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{s.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{s.location}</p>
                    {(s.date_range || s.end_date) && (
                      <p className="text-xs text-emerald-600 font-bold mt-1">
                        {s.date_range || `~ ${s.end_date}`}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            {lang === 'en' ? 'Location' : '위치 안내'}
          </h2>
          <div className="flex items-center gap-2 text-sm text-emerald-600 font-bold bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
            <MapPin size={18} />
            {place.location}
          </div>
          {place.latitude && place.longitude && place.latitude !== 0 ? (
            <div className="w-full h-48 bg-zinc-200 rounded-3xl overflow-hidden border-4 border-white shadow-lg">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${place.latitude},${place.longitude}&z=16&output=embed`}
                allowFullScreen
              />
            </div>
          ) : place.location && place.location !== '확인 필요' && place.location !== '전국' ? (
            <div className="w-full h-48 bg-zinc-200 rounded-3xl overflow-hidden border-4 border-white shadow-lg">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(place.location)}&z=16&output=embed`}
                allowFullScreen
              />
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

        {place.video_url && (
          <div className="pt-4">
            <button className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl">
              <Video size={20} /> {lang === 'en' ? 'Watch Video' : '실시간 영상 보기'}
            </button>
          </div>
        )}

        <footer className="mt-6 mb-10 pt-6 border-t border-zinc-100 space-y-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-black text-zinc-700 tracking-[0.2em] uppercase">
              {lang === 'en' ? 'NOW HERE' : '지금여기'}
            </span>
            <span className="text-[9px] font-bold text-zinc-300 tracking-widest uppercase">
              © NEMONE INC. ALL RIGHTS RESERVED.
            </span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2">
            {[
              { name: 'ABOUT', href: 'https://home.nemoneai.com' },
              { name: 'YOUTUBE', href: 'https://www.youtube.com/@MatMatch' },
              { name: '네모네AIM', href: 'https://nemoneai.com' },
              { name: 'FEEDBACK', href: '/feedback' },
            ].map((item) => (
              <a
                key={item.name}
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-[9px] font-black text-zinc-400 hover:text-emerald-600 tracking-[0.25em] uppercase transition-colors"
              >
                {item.name}
              </a>
            ))}
          </nav>
        </footer>
      </div>
    </div>
  );
}
