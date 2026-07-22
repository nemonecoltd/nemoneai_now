'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, MapPin, Calendar, Clock, Share2, Globe, Video, Heart,
  Users, TrendingUp, Map as MapIcon, Library, Route as RouteIcon, MessageCircle, Megaphone, Flame, Sparkles,
} from 'lucide-react';
import { InArticleAd } from '@/components/AdUnit';
import BrandTagline from '@/components/BrandTagline';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PLACE_REGIONS = ['성수', '홍대', '강북', '강남', '제주'] as const;
const EVENT_REGIONS = ['공연', '축제'] as const;
const REGION_LABEL: Record<string, { en: string; zh: string }> = {
  '성수': { en: 'SEONGSU', zh: '圣水洞' },
  '홍대': { en: 'HONGDAE', zh: '弘大' },
  '강북': { en: 'GANGBUK', zh: '江北' },
  '강남': { en: 'GANGNAM', zh: '江南' },
  '제주': { en: 'JEJU', zh: '济州' },
  '공연': { en: 'CONCERT', zh: '演出' },
  '축제': { en: 'FESTIVAL', zh: '节庆' },
};
const REGION_ACCENT: Record<string, string> = {
  '성수': 'text-emerald-600 border-emerald-500',
  '홍대': 'text-orange-600 border-orange-500',
  '강북': 'text-yellow-600 border-yellow-500',
  '강남': 'text-pink-600 border-pink-500',
  '제주': 'text-[#0369a1] border-[#0369a1]',
  '공연': 'text-emerald-600 border-emerald-500',
  '축제': 'text-amber-600 border-amber-500',
};
const CATEGORY_ORDER = ['popup', 'class', 'shopping', '전시', '행사'] as const;
const CATEGORY_LABEL: Record<string, { en: string; zh: string; ko: string }> = {
  popup: { en: 'Pop-up', zh: '快闪店', ko: '팝업' },
  class: { en: 'Class', zh: '体验课程', ko: '클래스' },
  shopping: { en: 'Shopping', zh: '购物', ko: '쇼핑' },
  '전시': { en: 'Exhibit', zh: '展览', ko: '전시' },
  '행사': { en: 'Event', zh: '活动', ko: '행사' },
};

export interface BlogReview {
  title: string;
  url: string;
}

export interface Place {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  content: string;
  content_en?: string;
  content_zh?: string;
  location: string;
  image_url: string;
  video_url?: string;
  date_range?: string;
  end_date?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  category?: string | null;
  naver_place_id?: string;
  blog_reviews?: BlogReview[] | string | null;
  link_url?: string | null;
  link_title?: string | null;
  created_at?: string | null;
  hot_rank?: number | null;
  hot_rank_updated_at?: string | null;
}

interface Props {
  place: Place | null;
  lang: string;
  suggestions: Place[];
}

const T = {
  ko: {
    prevPlace: '이전 장소', nextPlace: '다음 장소', spotlight: '핫플레이스 상세',
    hotVerified: '핫플인증', closingSoon: '마감임박', new: 'NEW', updatedAt: '기준',
    duration: '운영 기간', openDaily: '상시 운영', status: '상태', active: '운영 중', ended: '운영 종료',
    details: '상세 정보', moreToExplore: '이런 곳도 있어요', location: '위치 안내',
    locationSyncing: '정확한 위치 정보 준비 중', watchVideo: '실시간 영상 보기', nowHere: '지금여기',
    linkCopied: '링크가 복사되었습니다!',
    navRec: '핫플', navMap: '지도', navList: '장소', navTheme: '테마', navTour: 'AI 코스', my: '마이',
    tagline: '당신 3시간의 알찬 설계',
  },
  en: {
    prevPlace: 'Previous place', nextPlace: 'Next place', spotlight: 'Hotplace Spotlight',
    hotVerified: 'Hot Pick', closingSoon: 'Closing Soon', new: 'NEW', updatedAt: 'as of',
    duration: 'Duration', openDaily: 'Open Daily', status: 'Status', active: 'Active', ended: 'Ended',
    details: 'Details', moreToExplore: 'More to explore', location: 'Location',
    locationSyncing: 'Location Data Syncing', watchVideo: 'Watch Video', nowHere: 'NOW HERE',
    linkCopied: 'Link copied!',
    navRec: 'Hot', navMap: 'Map', navList: 'Spot', navTheme: 'Theme', navTour: 'AI Tour', my: 'My',
    tagline: 'A fulfilling plan for your 3 hours',
  },
  zh: {
    prevPlace: '上一个地点', nextPlace: '下一个地点', spotlight: '热门地点详情',
    hotVerified: '认证热门', closingSoon: '即将结束', new: 'NEW', updatedAt: '更新于',
    duration: '运营期间', openDaily: '全年营业', status: '状态', active: '营业中', ended: '已结束',
    details: '详细信息', moreToExplore: '更多推荐', location: '位置信息',
    locationSyncing: '位置信息准备中', watchVideo: '观看实时视频', nowHere: 'NOW HERE',
    linkCopied: '链接已复制！',
    navRec: '热门', navMap: '地图', navList: '地点', navTheme: '主题', navTour: 'AI路线', my: '我的',
    tagline: '为您3小时的充实安排',
  },
} as const;

export default function PlaceDetailClient({ place, lang: initialLang, suggestions }: Props) {
  const router = useRouter();
  const { user, signInWithGoogle } = useAuth();
  const [navIndex, setNavIndex] = React.useState(0);
  const [liked, setLiked] = React.useState(false);
  const [lang, setLang] = React.useState(initialLang);
  const t = T[(lang as keyof typeof T)] || T.ko;
  const [banner, setBanner] = React.useState<{ text: string; url: string } | null>(null);
  const [availableCategories, setAvailableCategories] = React.useState<string[]>([...CATEGORY_ORDER]);

  React.useEffect(() => {
    fetch('/api-now/banner')
      .then(res => res.json())
      .then((data: { text: string; url: string }) => {
        if (data?.text?.trim()) setBanner(data);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!place?.region || !(PLACE_REGIONS as readonly string[]).includes(place.region)) return;
    fetch(`/api-now/places/categories?region=${encodeURIComponent(place.region)}`)
      .then(res => res.json())
      .then((data: string[]) => setAvailableCategories(CATEGORY_ORDER.filter((c) => data.includes(c))))
      .catch(() => {});
  }, [place?.region]);

  React.useEffect(() => {
    if (user?.id && place?.id) {
      fetch(`/api-now/users/${user.id}/likes`)
        .then(res => res.json())
        .then((data: { id: number }[]) => setLiked(data.some(p => p.id === place.id)))
        .catch(() => {});
    }
  }, [user, place?.id]);

  const toggleLike = async () => {
    if (!place) return;
    if (!user) return signInWithGoogle();
    try {
      const res = await fetch('/api-now/likes/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, place_id: place.id }),
      });
      if (res.ok) {
        const { liked: nowLiked } = await res.json();
        setLiked(nowLiked);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    if (!place) return;
    const url = `https://now.nemoneai.com/posts/${place.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: place.title, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert(t.linkCopied);
      } catch {}
    }
  };

  React.useEffect(() => {
    if (place?.id) {
      fetch(`/api-now/places/${place.id}/view`, { method: 'POST', keepalive: true }).catch(() => {});
    }
  }, [place?.id]);

  const handleBack = () => {
    // 외부 앱(카톡·네이버지도 등)에서 바로 들어온 경우 히스토리가 없어 back()이 안 먹힐 수 있어 홈으로 폴백
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const goToSuggestion = (direction: 1 | -1) => {
    if (suggestions.length === 0) return;
    const nextIndex = (navIndex + direction + suggestions.length) % suggestions.length;
    setNavIndex(nextIndex);
    const target = suggestions[nextIndex];
    router.push(`/posts/${target.id}?${new URLSearchParams({ ...(place?.region ? { region: place.region } : {}), lang }).toString()}`);
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
                  onClick={() => router.push(`/posts/${s.id}?${new URLSearchParams({ ...(s.region ? { region: s.region } : {}), lang }).toString()}`)}
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
                    {s.category !== 'class' && (s.date_range || s.end_date) && (
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
          onClick={() => router.push(`/?lang=${lang}`)}
          className="w-full py-3 bg-zinc-900 text-white text-sm font-bold rounded-2xl"
        >
          전체 핫플레이스 보기
        </button>
      </div>
    );
  }

  const displayTitle = (lang === 'en' && place.title_en) ? place.title_en
    : (lang === 'zh' && place.title_zh) ? place.title_zh
    : place.title;
  const displayContent = (lang === 'en' && place.content_en) ? place.content_en
    : (lang === 'zh' && place.content_zh) ? place.content_zh
    : place.content;

  const displayDateRange = (() => {
    if (place.category === 'class') return null; // 원데이클래스/체험 — 상시 운영, 임시 만료일(end_date)을 기간처럼 보여주지 않음
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

  // 원데이클래스/체험은 상시 운영으로 취급해 종료 표기 대상에서 제외
  const isEnded = place.category !== 'class' && !!endDate && endDate < new Date().toISOString().split('T')[0];

  // 마감임박(D-3 이내) — 종료된 곳/상시 클래스는 대상에서 제외
  const daysUntilClose = (place.category !== 'class' && !!endDate && !isEnded)
    ? Math.ceil((new Date(endDate + 'T00:00:00Z').getTime() - new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z').getTime()) / 86400000)
    : null;
  const isClosingSoon = daysUntilClose !== null && daysUntilClose >= 0 && daysUntilClose <= 3;

  // 신규 등록(7일 이내)
  const isNew = !!place.created_at && (Date.now() - new Date(place.created_at).getTime()) <= 7 * 24 * 60 * 60 * 1000;

  // 제주는 2026-07-21부터 팝업/클래스(성수·홍대 등과 동일한 실제 네이버 지도 소스)/쇼핑·행사(비짓제주)를
  // 함께 갖는 장소형 지역이 됨 — 공연/축제(KOPIS·문체부 등 외부 이벤트 소스만 있는 지역)와는 구분해야 함
  const isPerformanceRegion = place.region === '공연' || place.region === '축제';
  const hasValidNaverId = place.naver_place_id &&
    !place.naver_place_id.startsWith('raw_') &&
    !place.naver_place_id.startsWith('seoul_') &&
    !place.naver_place_id.startsWith('kopis_') &&
    !place.naver_place_id.startsWith('visitseoul_') &&
    !place.naver_place_id.startsWith('visitjeju_') &&
    !place.naver_place_id.startsWith('jeju_');

  const pageUrl = `https://now.nemoneai.com/posts/${place.id}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": displayTitle,
    "description": displayContent.replace(/<[^>]*>/g, '').substring(0, 160),
    "url": pageUrl,
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
    "endDate": endDate || startDate,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "performer": {
      "@type": "Organization",
      "name": displayTitle
    },
    "organizer": {
      "@type": "Organization",
      "name": displayTitle,
      "url": place.link_url || pageUrl
    },
    "offers": {
      "@type": "Offer",
      "url": place.link_url || pageUrl,
      "price": "0",
      "priceCurrency": "KRW",
      "availability": "https://schema.org/InStock",
      "validFrom": startDate
    },
  };

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* GNB */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-100 px-5 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBack}
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <span className="text-lg font-black tracking-tight text-zinc-900 whitespace-nowrap flex-shrink-0">
              {t.nowHere} <span className="text-emerald-500">.</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 shadow-inner">
              {(['ko', 'en', 'zh'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "px-2 py-0.5 text-[9px] font-black rounded-md transition-all",
                    lang === l ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400"
                  )}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {user ? (
              <a href={`/my?lang=${lang}`} className="flex items-center bg-zinc-100 p-0.5 rounded-full border border-zinc-200 hover:bg-white transition-all">
                <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-white shadow-sm bg-zinc-200">
                  <img
                    src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=random`}
                    className="w-full h-full object-cover"
                    alt="profile"
                  />
                </div>
              </a>
            ) : (
              <button onClick={() => signInWithGoogle()} className="p-1.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                <Users size={16} />
              </button>
            )}
          </div>
        </div>

        <BrandTagline lang={lang} />

        {/* 지역 탭 — 장소형(성수/홍대/강북/강남/제주) | 이벤트형(공연/축제) */}
        <div className="flex items-center gap-4 mb-1">
          {PLACE_REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => router.push(`/?region=${encodeURIComponent(r)}&tab=list&lang=${lang}`)}
              className={cn(
                "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1 whitespace-nowrap",
                place.region === r ? REGION_ACCENT[r] : "text-zinc-300 border-transparent"
              )}
            >
              {lang === 'en' ? REGION_LABEL[r].en : lang === 'zh' ? REGION_LABEL[r].zh : r}
            </button>
          ))}
          <span className="text-zinc-200 font-bold select-none">|</span>
          {EVENT_REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => router.push(`/?region=${encodeURIComponent(r)}&tab=list&lang=${lang}`)}
              className={cn(
                "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1 whitespace-nowrap",
                place.region === r ? REGION_ACCENT[r] : "text-zinc-300 border-transparent"
              )}
            >
              {lang === 'en' ? REGION_LABEL[r].en : lang === 'zh' ? REGION_LABEL[r].zh : r}
            </button>
          ))}
        </div>

        {/* 공연 서브탭: 연극 | 뮤지컬 | 음악 | 종합 */}
        {place.region === '공연' && (
          <div className="flex items-center gap-2 mb-1 pl-1 mt-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-zinc-300 font-bold flex-shrink-0">›</span>
            {(['연극', '뮤지컬', '음악', '종합'] as const).map((c) => {
              const isActive = place.category === c;
              return (
                <button
                  key={c}
                  onClick={() => router.push(`/?region=${encodeURIComponent('공연')}&category=${encodeURIComponent(c)}&tab=list&lang=${lang}`)}
                  className={cn(
                    "text-xs font-bold transition-all px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap",
                    isActive
                      ? "bg-emerald-500 text-white border-emerald-500"
                      : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                  )}
                >
                  {lang === 'en'
                    ? (c === '연극' ? 'Play' : c === '뮤지컬' ? 'Musical' : c === '음악' ? 'Music' : 'Others')
                    : lang === 'zh'
                      ? (c === '연극' ? '话剧' : c === '뮤지컬' ? '音乐剧' : c === '음악' ? '音乐' : '综合')
                      : c}
                </button>
              );
            })}
          </div>
        )}

        {/* 성수/홍대/강북/강남/제주 서브탭: 해당 지역에 실제 데이터가 있는 category만 동적 렌더링 */}
        {(PLACE_REGIONS as readonly string[]).includes(place.region || '') && (
          <div className="flex items-center gap-2 mb-1 pl-1 mt-2">
            <span className="text-[10px] text-zinc-300 font-bold">›</span>
            {availableCategories.map((c) => (
              <button
                key={c}
                onClick={() => router.push(`/?region=${encodeURIComponent(place.region!)}&category=${encodeURIComponent(c)}&tab=list&lang=${lang}`)}
                className={cn(
                  "text-xs font-bold transition-all px-2 py-0.5 rounded-full border",
                  (place.category === 'class' ? 'class' : place.category === 'shopping' ? 'shopping' : place.category === '전시' ? '전시' : place.category === '행사' ? '행사' : 'popup') === c
                    ? "bg-emerald-500 text-white border-emerald-500"
                    : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                )}
              >
                {lang === 'en' ? CATEGORY_LABEL[c].en : lang === 'zh' ? CATEGORY_LABEL[c].zh : CATEGORY_LABEL[c].ko}
              </button>
            ))}
          </div>
        )}
      </header>

      {suggestions.length > 0 && (
        <div className="fixed inset-0 max-w-md mx-auto z-30 pointer-events-none">
          <button
            onClick={() => goToSuggestion(-1)}
            aria-label={t.prevPlace}
            className="absolute left-2 top-[62%] -translate-y-1/2 pointer-events-auto w-11 h-11 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-zinc-100 flex items-center justify-center text-zinc-700 active:scale-95 transition-transform"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => goToSuggestion(1)}
            aria-label={t.nextPlace}
            className="absolute right-2 top-[62%] -translate-y-1/2 pointer-events-auto w-11 h-11 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-zinc-100 flex items-center justify-center text-zinc-700 active:scale-95 transition-transform"
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

        {banner && (
          <a
            href={banner.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 left-4 right-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-lg"
          >
            <Megaphone size={12} className="text-emerald-400 flex-shrink-0" />
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest flex-shrink-0">Notice</span>
            <span className="text-[11px] font-medium text-white truncate">{banner.text}</span>
          </a>
        )}

        <div className="absolute bottom-10 left-8 right-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-2">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                {t.spotlight}
              </span>
              {place.hot_rank && (
                <span className="flex items-center gap-1 text-[9px] font-black text-rose-300 bg-rose-500/20 border border-rose-400/30 rounded-full px-2 py-0.5">
                  <Flame size={9} fill="currentColor" />
                  {t.hotVerified} TOP {place.hot_rank}
                  {place.hot_rank_updated_at && (
                    <span className="text-rose-300/70 font-medium">
                      · {new Date(place.hot_rank_updated_at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })} {t.updatedAt}
                    </span>
                  )}
                </span>
              )}
              {isClosingSoon && (
                <span className="flex items-center gap-1 text-[9px] font-black text-amber-300 bg-amber-500/20 border border-amber-400/30 rounded-full px-2 py-0.5">
                  <Clock size={9} />
                  {t.closingSoon} D-{daysUntilClose}
                </span>
              )}
              {isNew && (
                <span className="flex items-center gap-1 text-[9px] font-black text-sky-300 bg-sky-500/20 border border-sky-400/30 rounded-full px-2 py-0.5">
                  <Sparkles size={9} />
                  {t.new}
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-3">
              <h1 className="flex-1 text-3xl font-black text-white tracking-tighter leading-tight">{displayTitle}</h1>
              <div className="flex items-center gap-1.5 flex-shrink-0 mb-1">
                <a
                  href="https://nemoneai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="네모네AIM (맛매치)"
                  className="w-9 h-9 rounded-full overflow-hidden border border-white/40 shadow-lg active:scale-95 transition-transform"
                >
                  <img src="/matmatch-icon.png" alt="네모네AIM" className="w-full h-full object-cover" />
                </a>
                <button
                  onClick={toggleLike}
                  aria-label={lang === 'en' ? 'Save' : lang === 'zh' ? '收藏' : '찜하기'}
                  className="w-9 h-9 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 shadow-lg active:scale-95 transition-transform"
                >
                  <Heart size={16} className={liked ? 'fill-rose-500 text-rose-500' : ''} />
                </button>
                <button
                  onClick={handleShare}
                  aria-label={lang === 'en' ? 'Share' : lang === 'zh' ? '分享' : '공유하기'}
                  className="w-9 h-9 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 shadow-lg active:scale-95 transition-transform"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-10 pb-28 space-y-10 -mt-6 bg-zinc-50 rounded-t-[40px] relative z-10 shadow-2xl">
        <div className="flex gap-4">
          <div className="flex-1 bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 mb-3">
              <Calendar size={20} />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              {t.duration}
            </p>
            <p className="text-xs font-bold text-zinc-900">{displayDateRange || t.openDaily}</p>
          </div>
          <div className={cn(
            "flex-1 p-5 rounded-3xl border shadow-sm",
            isEnded ? "bg-zinc-900 border-zinc-900" : "bg-white border-zinc-100"
          )}>
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
              isEnded ? "bg-white/10 text-white" : "bg-blue-50 text-blue-600"
            )}>
              <Clock size={20} />
            </div>
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-widest mb-1",
              isEnded ? "text-white/50" : "text-zinc-400"
            )}>
              {t.status}
            </p>
            <p className={cn("text-xs font-bold", isEnded ? "text-white" : "text-zinc-900")}>
              {isEnded ? t.ended : t.active}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            {t.details}
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
                      ) : line.length > 60 ? (
                        // 축제 등 외부 API에서 온 긴 설명은 줄바꿈 없이 한 문단으로 뭉쳐 있어 가독성이 떨어져
                        // 문장 단위(마침표/느낌표/물음표 뒤 공백)로 나눠 각각 별도 문단으로 표시
                        line.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0).map((sentence, j) => (
                          <p key={`${i}-${j}`}>{sentence.trim()}</p>
                        ))
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

          {place.link_url && (
            <a
              href={place.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3 no-underline hover:bg-emerald-100/70 transition-colors"
            >
              <Globe size={15} className="text-emerald-600 flex-shrink-0" />
              <span className="text-sm font-bold text-emerald-800 truncate">
                {place.link_title || (isPerformanceRegion ? '예매하기' : '공식 페이지')}
              </span>
              <span className="text-sm font-bold text-emerald-600 flex-shrink-0">: 바로가기</span>
              <ChevronRight size={14} className="ml-auto text-emerald-400 flex-shrink-0" />
            </a>
          )}

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

        </div>

        <InArticleAd />

        {suggestions.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
              {t.moreToExplore}
            </p>
            <div className="flex flex-col gap-3">
              {suggestions.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/posts/${s.id}?${new URLSearchParams({ ...(s.region ? { region: s.region } : {}), lang }).toString()}`)}
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
                    {s.category !== 'class' && (s.date_range || s.end_date) && (
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
            {t.location}
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
                {t.locationSyncing}
              </p>
            </div>
          )}
        </div>

        {place.video_url && (
          <div className="pt-4">
            <button className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-emerald-600 transition-all shadow-xl">
              <Video size={20} /> {t.watchVideo}
            </button>
          </div>
        )}

        <footer className="mt-6 mb-10 pt-6 border-t border-zinc-100 space-y-4">
          <div className="flex flex-col items-center text-center gap-1">
            <span className="text-[11px] font-black text-zinc-700 tracking-[0.2em] uppercase">
              {t.nowHere}
            </span>
            <span className="text-[10px] font-bold text-zinc-500 tracking-wide">
              {t.tagline}
            </span>
            <span className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase mt-1">
              © NEMONE INC. ALL RIGHTS RESERVED.
            </span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
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
                className="text-[9px] font-black text-zinc-500 hover:text-emerald-600 tracking-[0.25em] uppercase transition-colors"
              >
                {item.name}
              </a>
            ))}
          </nav>
        </footer>
      </div>

      {/* Floating AI Chat Button */}
      <div className="fixed inset-x-0 bottom-0 max-w-md mx-auto z-50 pointer-events-none">
        <button
          onClick={() => router.push(`/?region=${encodeURIComponent(place.region || '성수')}&tab=chat&lang=${lang}`)}
          className="pointer-events-auto absolute bottom-28 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center bg-zinc-900 text-white hover:bg-emerald-600 active:scale-90 transition-all"
        >
          <MessageCircle size={28} />
        </button>

        {/* Bottom Navigation */}
        <nav className="pointer-events-auto bg-white/90 backdrop-blur-xl border-t border-zinc-100 px-6 pt-3 pb-6 flex justify-between items-center">
          <NavButton
            onClick={() => router.push(`/?region=${encodeURIComponent(place.region || '성수')}&tab=rec&lang=${lang}`)}
            icon={<TrendingUp size={22} />}
            label={t.navRec}
          />
          <NavButton
            onClick={() => router.push(`/?region=${encodeURIComponent(place.region || '성수')}&tab=map&lang=${lang}`)}
            icon={<MapIcon size={22} />}
            label={t.navMap}
            disabled={isPerformanceRegion}
          />
          <NavButton
            onClick={() => router.push(`/?region=${encodeURIComponent(place.region || '성수')}&tab=list&lang=${lang}`)}
            icon={<MapPin size={22} />}
            label={t.navList}
          />
          <NavButton
            onClick={() => router.push(`/?region=${encodeURIComponent(place.region || '성수')}&tab=theme&lang=${lang}`)}
            icon={<Library size={22} />}
            label={t.navTheme}
          />
          <NavButton
            onClick={() => router.push(`/?region=${encodeURIComponent(place.region || '성수')}&tab=tour&lang=${lang}`)}
            icon={<RouteIcon size={22} />}
            label={t.navTour}
            disabled={isPerformanceRegion}
          />
        </nav>
      </div>
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
