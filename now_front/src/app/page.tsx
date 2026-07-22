"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Map as MapIcon,
  MapPin,
  Sparkles,
  Search,
  Users,
  Route as RouteIcon,
  MessageCircle,
  TrendingUp,
  MessageSquare,
  Newspaper,
  ChevronLeft
} from 'lucide-react';
import MapView from '@/components/MapView';
import PlaceList, { PlaceSort } from '@/components/PlaceList';
import AskAI from '@/components/AskAI';
import AITour from '@/components/AITour';
import ThemeMenu from '@/components/ThemeMenu';
import MagazineList from '@/components/MagazineList';
import BrandTagline from '@/components/BrandTagline';
import Recommendation from '@/components/Recommendation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PAGE_SIZE = 20;

type Tab = 'rec' | 'map' | 'list' | 'course' | 'magazine' | 'chat';
type CourseSub = 'ai' | 'theme';
type Region = '성수' | '홍대' | '강북' | '강남' | '공연' | '제주' | '축제';
type Lang = 'ko' | 'en' | 'zh';
// 우선순위 고정 목록 — 실제 서브탭 노출 여부는 /places/categories로 지역별 DISTINCT 조회해 결정
// '전시'=성수/홍대/강북/강남(Visit Seoul), '행사'=제주(비짓제주) 전용 — 지역별 DISTINCT라 서로 섞이지 않음
const CATEGORY_ORDER = ['popup', 'class', 'shopping', '전시', '행사'] as const;
type PlaceCategory = typeof CATEGORY_ORDER[number];
const CATEGORY_LABEL: Record<PlaceCategory, { en: string; zh: string; ko: string }> = {
  popup: { en: 'Pop-up', zh: '快闪店', ko: '팝업' },
  class: { en: 'Class', zh: '体验课程', ko: '클래스' },
  shopping: { en: 'Shopping', zh: '购物', ko: '쇼핑' },
  '전시': { en: 'Exhibit', zh: '展览', ko: '전시' },
  '행사': { en: 'Event', zh: '活动', ko: '행사' },
};

// 장소형 지역(지도+AI코스+팝업/클래스/쇼핑/전시·행사 서브탭 전부 지원) / 이벤트형 지역(리스트만) — 지역탭에서 '|'로 구분 표시
const PLACE_REGIONS = ['성수', '홍대', '강북', '강남', '제주'] as const;
const EVENT_REGIONS = ['공연', '축제'] as const;
const REGION_LABEL: Record<Region, { en: string; zh: string }> = {
  '성수': { en: 'SEONGSU', zh: '圣水洞' },
  '홍대': { en: 'HONGDAE', zh: '弘大' },
  '강북': { en: 'GANGBUK', zh: '江北' },
  '강남': { en: 'GANGNAM', zh: '江南' },
  '제주': { en: 'JEJU', zh: '济州' },
  '공연': { en: 'CONCERT', zh: '演出' },
  '축제': { en: 'FESTIVAL', zh: '节庆' },
};
// 제주 대표색 — 이전 '공연>제주' 서브탭 시절 쓰던 블루를 지역 자체 대표색으로 승격
const REGION_ACCENT: Record<Region, string> = {
  '성수': 'text-emerald-600 border-emerald-500',
  '홍대': 'text-orange-600 border-orange-500',
  '강북': 'text-yellow-600 border-yellow-500',
  '강남': 'text-pink-600 border-pink-500',
  '제주': 'text-[#0369a1] border-[#0369a1]',
  '공연': 'text-emerald-600 border-emerald-500',
  '축제': 'text-amber-600 border-amber-500',
};
// 서브탭(팝업/클래스/쇼핑/전시·행사, 공연 장르)의 활성 상태 배경색 — 지역 대표색과 통일
const REGION_PILL_ACTIVE: Record<Region, string> = {
  '성수': 'bg-emerald-500 text-white border-emerald-500',
  '홍대': 'bg-orange-500 text-white border-orange-500',
  '강북': 'bg-yellow-500 text-white border-yellow-500',
  '강남': 'bg-pink-500 text-white border-pink-500',
  '제주': 'bg-[#0369a1] text-white border-[#0369a1]',
  '공연': 'bg-emerald-500 text-white border-emerald-500',
  '축제': 'bg-amber-500 text-white border-amber-500',
};

const dict = {
  ko: {
    title: '지금 여기',
    desc: '당신 3시간의 알찬 설계',
    totalRec: '통합 실시간 랭킹',
    regionGuide: '실시간 {region} 가이드',
    navRec: '핫플',
    navMap: '지도',
    navList: '장소',
    navCourse: '코스',
    navMagazine: '매거진',
    courseSubAi: 'AI 코스',
    courseSubTheme: '테마',
    my: '마이',
    footer: '© 네모네 주식회사, 당신 시간의 알찬 소비',
    feedback: '피드백'
  },
  en: {
    title: 'NOW HERE',
    desc: 'A fulfilling plan for your 3 hours',
    totalRec: 'Live Integrated Ranking',
    regionGuide: 'Live {region} Guide',
    navRec: 'Hot',
    navMap: 'Map',
    navList: 'Spot',
    navCourse: 'Course',
    navMagazine: 'Magazine',
    courseSubAi: 'AI Tour',
    courseSubTheme: 'Theme',
    my: 'My',
    footer: '© Nemone Co., Ltd. Make every moment count.',
    feedback: 'Feedback'
  },
  zh: {
    title: 'NOW HERE',
    desc: '为您3小时的充实安排',
    totalRec: '综合实时排行',
    regionGuide: '{region} 实时指南',
    navRec: '热门',
    navMap: '地图',
    navList: '地点',
    navCourse: '路线',
    navMagazine: '杂志',
    courseSubAi: 'AI路线',
    courseSubTheme: '主题',
    my: '我的',
    footer: '© Nemone Co., Ltd. 让每一刻都有意义',
    feedback: '反馈'
  }
};

function Home() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTabState] = useState<Tab>('rec');
  const [region, setRegionState] = useState<Region>('성수');
  const [placeCategory, setPlaceCategory] = useState<PlaceCategory>('popup');
  const [availableCategories, setAvailableCategories] = useState<PlaceCategory[]>([...CATEGORY_ORDER]);
  const [concertGenre, setConcertGenre] = useState<'연극' | '뮤지컬' | '음악' | '종합'>('연극');
  const [placeSort, setPlaceSort] = useState<PlaceSort | null>(null);
  const [courseSub, setCourseSub] = useState<CourseSub>('ai');
  const scrollToTop = () => { mainRef.current?.scrollTo({ top: 0 }); };
  const setRegion = (r: Region) => { setRegionState(r); setPlaceCategory('popup'); scrollToTop(); };
  const setActiveTab = (tab: Tab) => { setActiveTabState(tab); scrollToTop(); };
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const [lang, setLang] = useState<Lang>('ko');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('region') as Region;
    const t = params.get('tab');
    const l = params.get('lang') as Lang;
    const c = params.get('category');
    if (r) setRegionState(r);
    // 구버전 링크 호환: '테마'/'AI코스' 탭이 '코스' 밑 서브탭으로 합쳐짐
    if (t === 'theme') { setActiveTab('course'); setCourseSub('theme'); }
    else if (t === 'tour') { setActiveTab('course'); setCourseSub('ai'); }
    else if (t) setActiveTab(t as Tab);
    if (l === 'en' || l === 'zh' || l === 'ko') setLang(l);
    if (c === 'popup' || c === 'class' || c === 'shopping' || c === '전시' || c === '행사') setPlaceCategory(c);
    if (c === '연극' || c === '뮤지컬' || c === '음악' || c === '종합') setConcertGenre(c);
  }, []);
  const [places, setPlaces] = useState([]); // 지역별 데이터 (리스트 첫 페이지)
  const [mapPlaces, setMapPlaces] = useState([]); // 지도용 전체 데이터 (PLACE_REGIONS만)
  const [allPlaces, setAllPlaces] = useState([]); // 통합 데이터 (랭킹용)

  const t = dict[lang];
  const isPlaceRegion = (PLACE_REGIONS as readonly string[]).includes(region);

  useEffect(() => {
    fetchPlaces();
    fetchAllPlaces();
    if (isPlaceRegion) {
      fetchMapPlaces();
    } else {
      setMapPlaces([]);
    }
  }, [region, lang, placeCategory, concertGenre, placeSort]);

  useEffect(() => {
    if (isPlaceRegion) {
      fetchAvailableCategories();
    }
  }, [region]);

  useEffect(() => {
    // 지역 전환으로 서브탭 목록이 바뀌었는데 현재 선택된 category가 그 지역엔 없으면 첫 번째 탭으로 스냅
    if (isPlaceRegion && !availableCategories.includes(placeCategory)) {
      setPlaceCategory(availableCategories[0] ?? 'popup');
    }
  }, [availableCategories]);

  useEffect(() => {
    // '공연'/'축제' 지역엔 지도가 없으므로 리스트로 강제 이동
    if ((region === '공연' || region === '축제') && activeTab === 'map') {
      setActiveTab('list');
    }
    // 같은 지역들엔 AI코스도 없으므로 '코스' 탭 안에서 '테마' 서브탭으로 대체
    if ((region === '공연' || region === '축제') && activeTab === 'course' && courseSub === 'ai') {
      setCourseSub('theme');
    }
  }, [region, activeTab, courseSub]);

  const categoryParam = `&category=${region === '공연' ? concertGenre : placeCategory}`;
  const sortParam = placeSort ? `&sort=${placeSort}` : '';

  const fetchPlaces = async () => {
    try {
      const res = await fetch(`/api-now/places?region=${encodeURIComponent(region)}&lang=${lang}&limit=${PAGE_SIZE}&offset=0${categoryParam}${sortParam}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setPlaces(data);
      }
    } catch (e) {
      console.error("Failed to fetch places:", e);
    }
  };

  const fetchMapPlaces = async () => {
    try {
      const res = await fetch(`/api-now/places?region=${encodeURIComponent(region)}&lang=${lang}${categoryParam}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setMapPlaces(data);
      }
    } catch (e) {
      console.error("Failed to fetch map places:", e);
    }
  };

  const fetchAvailableCategories = async () => {
    try {
      const res = await fetch(`/api-now/places/categories?region=${encodeURIComponent(region)}&t=${Date.now()}`);
      if (res.ok) {
        const data: string[] = await res.json();
        setAvailableCategories(CATEGORY_ORDER.filter((c) => data.includes(c)));
      }
    } catch (e) {
      console.error("Failed to fetch categories:", e);
    }
  };

  const fetchAllPlaces = async () => {
    try {
      const res = await fetch(`/api-now/places/popular?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setAllPlaces(data);
      }
    } catch (e) {
      console.error("Failed to fetch all places:", e);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-zinc-50 max-w-md mx-auto relative overflow-hidden shadow-2xl border-x border-zinc-200">
      {/* Header */}
      <header className="px-6 pt-4 pb-1 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBack}
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <h1 className="text-lg font-black font-display tracking-tight text-zinc-900 whitespace-nowrap flex-shrink-0">
              {t.title} <span className="text-emerald-500">.</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 mr-1 shadow-inner">
              {(['ko', 'en', 'zh'] as Lang[]).map((l) => (
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
              <Link href="/my" className="flex items-center gap-2 bg-zinc-100 pl-1 pr-3 py-1 rounded-full border border-zinc-200 hover:bg-white transition-all">
                <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-white shadow-sm bg-zinc-200">
                  <img 
                    src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=random`} 
                    className="w-full h-full object-cover" 
                    alt="profile" 
                  />
                </div>
                <span className="text-[10px] font-black tracking-tight text-zinc-900 uppercase">{t.my}</span>
              </Link>
            ) : (
              <button onClick={() => signInWithGoogle()} className="p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                <Users size={20} />
              </button>
            )}
          </div>
        </div>

        <BrandTagline lang={lang} />

        {/* Region Tabs: '추천'/'매거진'/'코스>테마' 탭에서는 숨김 (통합 운영) */}
        <AnimatePresence>
          {activeTab !== 'rec' && activeTab !== 'magazine' && !(activeTab === 'course' && courseSub === 'theme') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* 메인 지역 탭 — 장소형(성수/홍대/강북/강남/제주) | 이벤트형(공연/축제), '|'로 시각적 구분 */}
              <div className="flex items-center gap-3 mb-1 overflow-x-auto no-scrollbar flex-nowrap">
                {PLACE_REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRegion(r)}
                    className={cn(
                      "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1 shrink-0 whitespace-nowrap",
                      region === r ? REGION_ACCENT[r] : "text-zinc-300 border-transparent hover:text-zinc-500"
                    )}
                  >
                    {lang === 'en' ? REGION_LABEL[r].en : lang === 'zh' ? REGION_LABEL[r].zh : r}
                  </button>
                ))}
                {(activeTab !== 'map' && activeTab !== 'chat' && !(activeTab === 'course' && courseSub === 'ai')) && (
                  <>
                    <span className="text-zinc-200 font-bold select-none shrink-0">|</span>
                    {EVENT_REGIONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRegion(r)}
                        className={cn(
                          "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1 shrink-0 whitespace-nowrap",
                          region === r ? REGION_ACCENT[r] : "text-zinc-300 border-transparent hover:text-zinc-500"
                        )}
                      >
                        {lang === 'en' ? REGION_LABEL[r].en : lang === 'zh' ? REGION_LABEL[r].zh : r}
                      </button>
                    ))}
                  </>
                )}
              </div>

              {/* 공연 서브탭: 연극 | 뮤지컬 | 음악 | 종합 */}
              <AnimatePresence>
                {region === '공연' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex items-center gap-2 mb-1 pl-1 mt-2 overflow-x-auto no-scrollbar"
                  >
                    <span className="text-[10px] text-zinc-300 font-bold flex-shrink-0">›</span>
                    {(['연극', '뮤지컬', '음악', '종합'] as const).map((c) => {
                      const isActive = concertGenre === c;
                      return (
                        <button
                          key={c}
                          onClick={() => setConcertGenre(c)}
                          className={cn(
                            "text-xs font-bold transition-all px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap",
                            isActive
                              ? REGION_PILL_ACTIVE['공연']
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
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 성수/홍대/강북/강남/제주 서브탭: 해당 지역에 실제 데이터가 있는 category만 동적 렌더링 (fetchAvailableCategories) */}
              <AnimatePresence>
                {isPlaceRegion && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex items-center gap-2 mb-1 pl-1 mt-2"
                  >
                    <span className="text-[10px] text-zinc-300 font-bold">›</span>
                    {availableCategories.map((c) => (
                      <button
                        key={c}
                        onClick={() => setPlaceCategory(c)}
                        className={cn(
                          "text-xs font-bold transition-all px-2 py-0.5 rounded-full border",
                          placeCategory === c
                            ? REGION_PILL_ACTIVE[region]
                            : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                        )}
                      >
                        {lang === 'en' ? CATEGORY_LABEL[c].en : lang === 'zh' ? CATEGORY_LABEL[c].zh : CATEGORY_LABEL[c].ko}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'rec' && (
            <motion.div key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <Recommendation places={allPlaces} lang={lang} />
            </motion.div>
          )}

          {activeTab === 'map' && isPlaceRegion && (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <MapView places={mapPlaces} region={region} lang={lang} />
            </motion.div>
          )}

          {activeTab === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PlaceList places={places} region={region} lang={lang} category={region === '공연' ? concertGenre : placeCategory} sort={placeSort} onSortChange={setPlaceSort} />
            </motion.div>
          )}

          {activeTab === 'course' && (
            <motion.div key="course" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <div className="flex gap-2 px-6 pt-4 pb-1">
                {isPlaceRegion && (
                  <button
                    onClick={() => setCourseSub('ai')}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
                      courseSub === 'ai' ? "bg-zinc-900 text-white shadow-sm" : "bg-zinc-100 text-zinc-400"
                    )}
                  >
                    {t.courseSubAi}
                  </button>
                )}
                <button
                  onClick={() => setCourseSub('theme')}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
                    courseSub === 'theme' ? "bg-zinc-900 text-white shadow-sm" : "bg-zinc-100 text-zinc-400"
                  )}
                >
                  {t.courseSubTheme}
                </button>
              </div>
              {courseSub === 'ai' && isPlaceRegion && (
                <AITour region={region} lang={lang} />
              )}
              {courseSub === 'theme' && <ThemeMenu lang={lang} />}
            </motion.div>
          )}

          {activeTab === 'magazine' && (
            <motion.div key="magazine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MagazineList lang={lang} />
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <AskAI region={region} lang={lang} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Footer */}
        <footer className="mt-10 mb-20 px-6 pt-6 border-t border-zinc-100 space-y-4">
          <div className="flex flex-col items-center text-center gap-1">
            <span className="text-[11px] font-black text-zinc-700 tracking-[0.2em] uppercase">
              {lang === 'en' || lang === 'zh' ? 'NOW HERE' : '지금여기'}
            </span>
            <span className="text-[10px] font-bold text-zinc-500 tracking-wide">
              {t.desc}
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
              <Link
                key={item.name}
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-[9px] font-black text-zinc-500 hover:text-emerald-600 tracking-[0.25em] uppercase transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </footer>
      </main>

      {/* Floating AI Chat Button (둥둥이) */}
      <button 
        onClick={() => setActiveTab('chat')}
        className={cn(
          "fixed bottom-28 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all z-[60] active:scale-90",
          activeTab === 'chat' ? "bg-emerald-500 text-white scale-110" : "bg-zinc-900 text-white hover:bg-emerald-600"
        )}
      >
        <MessageCircle size={28} className={cn(activeTab === 'chat' && "animate-pulse")} />
        {activeTab !== 'chat' && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-50 animate-bounce" />
        )}
      </button>

      {/* Bottom Navigation */}
      <nav className="bg-white/90 backdrop-blur-xl border-t border-zinc-100 px-6 pt-2 pb-4 flex justify-between items-center z-50">
        <NavButton 
          active={activeTab === 'rec'} 
          onClick={() => setActiveTab('rec')} 
          icon={<TrendingUp size={22} />} 
          label={t.navRec} 
        />
        <NavButton
          active={activeTab === 'map'}
          onClick={() => {
            if (region === '공연' || region === '축제') setRegion('성수');
            setActiveTab('map');
          }}
          icon={<MapIcon size={22} />}
          label={t.navMap}
          disabled={(region === '공연' || region === '축제') && activeTab === 'list'}
        />
        <NavButton 
          active={activeTab === 'list'} 
          onClick={() => setActiveTab('list')} 
          icon={<MapPin size={22} />}
          label={t.navList}
        />
        <NavButton
          active={activeTab === 'course'}
          onClick={() => {
            if (region === '공연' || region === '축제') setRegion('성수');
            setActiveTab('course');
          }}
          icon={<RouteIcon size={22} />}
          label={t.navCourse}
        />
        <NavButton
          active={activeTab === 'magazine'}
          onClick={() => setActiveTab('magazine')}
          icon={<Newspaper size={22} />}
          label={t.navMagazine}
        />
      </nav>
    </div>
  );
}

export default function HomePage() {
  return <Home />;
}

function NavButton({ active, onClick, icon, label, disabled }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, disabled?: boolean }) {
  return (
    <button 
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-1 transition-all",
        disabled ? "text-zinc-300 cursor-not-allowed" : (active ? "text-emerald-600" : "text-zinc-400")
      )}
    >
      <div className={cn(
        "p-1 rounded-xl transition-all",
        active && !disabled && "bg-emerald-50",
        disabled && "opacity-50"
      )}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
}
