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
  Library,
  ChevronLeft
} from 'lucide-react';
import MapView from '@/components/MapView';
import PlaceList from '@/components/PlaceList';
import AskAI from '@/components/AskAI';
import AITour from '@/components/AITour';
import ThemeMenu from '@/components/ThemeMenu';
import Recommendation from '@/components/Recommendation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PAGE_SIZE = 20;

type Tab = 'rec' | 'map' | 'list' | 'theme' | 'tour' | 'chat';
type Region = '성수' | '홍대' | '용산' | '강남' | '공연' | '제주' | '축제';
type Lang = 'ko' | 'en' | 'zh';

const dict = {
  ko: {
    title: '지금 여기',
    desc: '당신 3시간의 알찬 설계',
    totalRec: '통합 실시간 랭킹',
    regionGuide: '실시간 {region} 가이드',
    navRec: '랭킹',
    navMap: '지도',
    navList: '장소',
    navTheme: '테마',
    navTour: 'AI 코스',
    my: '마이',
    footer: '© 네모네 주식회사, 당신 시간의 알찬 소비',
    feedback: '피드백'
  },
  en: {
    title: 'NOW HERE',
    desc: 'A fulfilling plan for your 3 hours',
    totalRec: 'Live Integrated Ranking',
    regionGuide: 'Live {region} Guide',
    navRec: 'Ranking',
    navMap: 'Map',
    navList: 'Spot',
    navTheme: 'Theme',
    navTour: 'AI Tour',
    my: 'My',
    footer: '© Nemone Co., Ltd. Make every moment count.',
    feedback: 'Feedback'
  },
  zh: {
    title: 'NOW HERE',
    desc: '为您3小时的充实安排',
    totalRec: '综合实时排行',
    regionGuide: '{region} 实时指南',
    navRec: '排行',
    navMap: '地图',
    navList: '地点',
    navTheme: '主题',
    navTour: 'AI路线',
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
  const [placeCategory, setPlaceCategory] = useState<'popup' | 'class'>('popup');
  const [concertGenre, setConcertGenre] = useState<'연극' | '뮤지컬' | '음악' | '종합'>('연극');
  const [sortLatest, setSortLatest] = useState(false);
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
    const t = params.get('tab') as Tab;
    const l = params.get('lang') as Lang;
    const c = params.get('category');
    if (r) setRegionState(r);
    if (t) setActiveTab(t);
    if (l === 'en' || l === 'zh' || l === 'ko') setLang(l);
    if (c === 'popup' || c === 'class') setPlaceCategory(c);
    if (c === '연극' || c === '뮤지컬' || c === '음악' || c === '종합') setConcertGenre(c);
  }, []);
  const [places, setPlaces] = useState([]); // 지역별 데이터 (리스트 첫 페이지)
  const [mapPlaces, setMapPlaces] = useState([]); // 지도용 전체 데이터 (성수/홍대만)
  const [allPlaces, setAllPlaces] = useState([]); // 통합 데이터 (랭킹용)

  const t = dict[lang];

  useEffect(() => {
    fetchPlaces();
    fetchAllPlaces();
    if (region === '성수' || region === '홍대' || region === '용산' || region === '강남') {
      fetchMapPlaces();
    } else {
      setMapPlaces([]);
    }
  }, [region, lang, placeCategory, concertGenre, sortLatest]);

  useEffect(() => {
    // '공연'/'제주'/'축제' 탭에서는 지도나 AI코스가 없으므로 리스트로 강제 이동
    if ((region === '공연' || region === '제주' || region === '축제') && (activeTab === 'map' || activeTab === 'tour')) {
      setActiveTab('list');
    }
  }, [region, activeTab]);

  const categoryParam = `&category=${region === '공연' ? concertGenre : placeCategory}`;
  const sortParam = sortLatest ? '&sort=latest' : '';

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
            <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-tighter italic truncate">{t.desc}</p>
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
        
        {/* Region Tabs: '추천' 및 '테마' 탭에서는 숨김 (통합 운영) */}
        <AnimatePresence>
          {activeTab !== 'rec' && activeTab !== 'theme' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {/* 메인 지역 탭 */}
              <div className="flex items-center gap-4 mb-1">
                {(['성수', '홍대', '용산', '강남', '공연', '축제'] as const)
                  .filter(r => (r !== '공연' && r !== '축제') || (activeTab !== 'map' && activeTab !== 'tour' && activeTab !== 'chat'))
                  .map((r) => {
                    const isConcertActive = r === '공연' && (region === '공연' || region === '제주');
                    const isFestivalActive = r === '축제' && region === '축제';
                    const isYongsanActive = r === '용산' && region === '용산';
                    const isGangnamActive = r === '강남' && region === '강남';
                    return (
                      <button
                        key={r}
                        onClick={() => setRegion(r === '공연' && region === '제주' ? '제주' : r)}
                        className={cn(
                          "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1",
                          isFestivalActive
                            ? "text-amber-600 border-amber-500"
                            : isYongsanActive
                              ? "text-yellow-600 border-yellow-500"
                              : isGangnamActive
                                ? "text-pink-600 border-pink-500"
                                : isConcertActive || region === r
                                  ? "text-emerald-600 border-emerald-500"
                                  : "text-zinc-300 border-transparent hover:text-zinc-500"
                        )}
                      >
                        {lang === 'en'
                          ? (r === '성수' ? 'SEONGSU' : r === '홍대' ? 'HONGDAE' : r === '용산' ? 'YONGSAN' : r === '강남' ? 'GANGNAM' : r === '공연' ? 'CONCERT' : 'FESTIVAL')
                          : lang === 'zh'
                            ? (r === '성수' ? '圣水洞' : r === '홍대' ? '弘大' : r === '용산' ? '龙山' : r === '강남' ? '江南' : r === '공연' ? '演出' : '节庆')
                            : r}
                      </button>
                    );
                  })}
              </div>

              {/* 공연 서브탭: 연극 | 뮤지컬 | 음악 | 종합 | 제주 (제주만 기존 블루 유지, 나머지는 예전 '서울' 색상) */}
              <AnimatePresence>
                {(region === '공연' || region === '제주') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex items-center gap-2 mb-1 pl-1 mt-2 overflow-x-auto no-scrollbar"
                  >
                    <span className="text-[10px] text-zinc-300 font-bold flex-shrink-0">›</span>
                    {(['연극', '뮤지컬', '음악', '종합', '제주'] as const).map((c) => {
                      const isJeju = c === '제주';
                      const isActive = isJeju ? region === '제주' : (region === '공연' && concertGenre === c);
                      return (
                        <button
                          key={c}
                          onClick={() => {
                            if (isJeju) { setRegion('제주'); }
                            else { setRegion('공연'); setConcertGenre(c); }
                          }}
                          className={cn(
                            "text-xs font-bold transition-all px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap",
                            isActive
                              ? (isJeju ? "bg-[#0369a1] text-white border-[#0369a1]" : "bg-emerald-500 text-white border-emerald-500")
                              : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                          )}
                        >
                          {lang === 'en'
                            ? (c === '연극' ? 'Play' : c === '뮤지컬' ? 'Musical' : c === '음악' ? 'Music' : c === '종합' ? 'Others' : 'Jeju')
                            : lang === 'zh'
                              ? (c === '연극' ? '话剧' : c === '뮤지컬' ? '音乐剧' : c === '음악' ? '音乐' : c === '종합' ? '综合' : '济州')
                              : c}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 성수/홍대/용산 서브탭: 팝업 | 클래스 */}
              <AnimatePresence>
                {(region === '성수' || region === '홍대' || region === '용산' || region === '강남') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex items-center gap-2 mb-1 pl-1 mt-2"
                  >
                    <span className="text-[10px] text-zinc-300 font-bold">›</span>
                    {(['popup', 'class'] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setPlaceCategory(c)}
                        className={cn(
                          "text-xs font-bold transition-all px-2 py-0.5 rounded-full border",
                          placeCategory === c
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                        )}
                      >
                        {lang === 'en'
                          ? (c === 'popup' ? 'Pop-up' : 'Class')
                          : lang === 'zh'
                            ? (c === 'popup' ? '快闪店' : '体验课程')
                            : (c === 'popup' ? '팝업' : '클래스')}
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

          {activeTab === 'map' && region !== '공연' && region !== '제주' && region !== '축제' && (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <MapView places={mapPlaces} region={region} lang={lang} />
            </motion.div>
          )}

          {activeTab === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PlaceList places={places} region={region} lang={lang} category={region === '공연' ? concertGenre : placeCategory} sortLatest={sortLatest} onToggleSortLatest={() => setSortLatest(v => !v)} />
            </motion.div>
          )}

          {activeTab === 'theme' && (
            <motion.div key="theme" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <ThemeMenu lang={lang} />
            </motion.div>
          )}

          {activeTab === 'tour' && region !== '공연' && region !== '제주' && region !== '축제' && (
            <motion.div key="tour" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <AITour region={region} lang={lang} />
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
      <nav className="bg-white/90 backdrop-blur-xl border-t border-zinc-100 px-6 pt-3 pb-6 flex justify-between items-center z-50">
        <NavButton 
          active={activeTab === 'rec'} 
          onClick={() => setActiveTab('rec')} 
          icon={<TrendingUp size={22} />} 
          label={t.navRec} 
        />
        <NavButton
          active={activeTab === 'map'}
          onClick={() => {
            if (region === '공연' || region === '제주') setRegion('성수');
            setActiveTab('map');
          }}
          icon={<MapIcon size={22} />}
          label={t.navMap}
          disabled={(region === '공연' || region === '제주' || region === '축제') && activeTab === 'list'}
        />
        <NavButton 
          active={activeTab === 'list'} 
          onClick={() => setActiveTab('list')} 
          icon={<MapPin size={22} />}
          label={t.navList}
        />
        <NavButton 
          active={activeTab === 'theme'} 
          onClick={() => setActiveTab('theme')} 
          icon={<Library size={22} />} 
          label={t.navTheme} 
        />
        <NavButton
          active={activeTab === 'tour'}
          onClick={() => {
            if (region === '공연' || region === '제주') setRegion('성수');
            setActiveTab('tour');
          }}
          icon={<RouteIcon size={22} />}
          label={t.navTour}
          disabled={(region === '공연' || region === '제주' || region === '축제') && activeTab === 'list'}
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
