"use client";

import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Map as MapIcon,
  List as ListIcon,
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

type Tab = 'rec' | 'map' | 'list' | 'theme' | 'tour' | 'chat';
type Region = '성수' | '홍대' | '공연' | '제주' | '축제';
type Lang = 'ko' | 'en';

const dict = {
  ko: {
    title: '지금 여기',
    desc: '당신의 3시간을 완벽하게 설계하는 로컬 가이드',
    totalRec: '통합 실시간 랭킹',
    regionGuide: '실시간 {region} 가이드',
    navRec: '랭킹',
    navMap: '지도',
    navList: '리스트',
    navTheme: '테마',
    navTour: 'AI 코스',
    my: '마이',
    footer: '© 네모네 주식회사, 당신 시간의 알찬 소비',
    feedback: '피드백'
  },
  en: {
    title: 'NOW HERE',
    desc: 'AI-powered local guide for your perfect Seoul experience',
    totalRec: 'Live Integrated Ranking',
    regionGuide: 'Live {region} Guide',
    navRec: 'Ranking',
    navMap: 'Map',
    navList: 'List',
    navTheme: 'Theme',
    navTour: 'AI Tour',
    my: 'My',
    footer: '© Nemone Co., Ltd. Make every moment count.',
    feedback: 'Feedback'
  }
};

function Home() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRegion = (searchParams.get('region') as Region) || '성수';
  const [activeTab, setActiveTab] = useState<Tab>('list');
  const [region, setRegion] = useState<Region>(initialRegion);
  const [lang, setLang] = useState<Lang>('ko');
  const [places, setPlaces] = useState([]); // 지역별 데이터
  const [allPlaces, setAllPlaces] = useState([]); // 통합 데이터 (랭킹용)

  const t = dict[lang];

  useEffect(() => {
    fetchPlaces();
    fetchAllPlaces(); 
  }, [region, lang]);

  useEffect(() => {
    // '공연'/'제주'/'축제' 탭에서는 지도나 AI코스가 없으므로 리스트로 강제 이동
    if ((region === '공연' || region === '제주' || region === '축제') && (activeTab === 'map' || activeTab === 'tour')) {
      setActiveTab('list');
    }
  }, [region, activeTab]);

  const fetchPlaces = async () => {
    try {
      const res = await fetch(`/api-now/places?region=${encodeURIComponent(region)}&lang=${lang}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setPlaces(data);
      }
    } catch (e) {
      console.error("Failed to fetch places:", e);
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
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.close()}
                className="w-7 h-7 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
              <h1 className="text-2xl font-black font-display tracking-tight text-zinc-900 leading-none">
                {t.title} <span className="text-emerald-500">.</span>
              </h1>
              <a 
                href="https://nemoneai.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-2 py-0.5 bg-[#0c0c0c] border border-[#D4AF37] text-[#D4AF37] text-[8px] font-black italic rounded-md hover:bg-[#D4AF37] hover:text-[#0c0c0c] transition-all shadow-sm tracking-tighter"
              >
                NEMONEAI
              </a>
            </div>
            <p className="text-[9px] text-zinc-400 font-bold mt-1 uppercase tracking-tighter italic">{t.desc}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 mr-1 shadow-inner">
              {(['ko', 'en'] as Lang[]).map((l) => (
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
                {(['성수', '홍대', '공연', '축제'] as const)
                  .filter(r => (r !== '공연' && r !== '축제') || (activeTab !== 'map' && activeTab !== 'tour'))
                  .map((r) => {
                    const isConcertActive = r === '공연' && (region === '공연' || region === '제주');
                    const isFestivalActive = r === '축제' && region === '축제';
                    return (
                      <button
                        key={r}
                        onClick={() => setRegion(r === '공연' && region === '제주' ? '제주' : r)}
                        className={cn(
                          "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1",
                          isFestivalActive
                            ? "text-amber-600 border-amber-500"
                            : isConcertActive || region === r
                              ? "text-emerald-600 border-emerald-500"
                              : "text-zinc-300 border-transparent hover:text-zinc-500"
                        )}
                      >
                        {lang === 'en'
                          ? (r === '성수' ? 'SEONGSU' : r === '홍대' ? 'HONGDAE' : r === '공연' ? 'CONCERT' : 'FESTIVAL')
                          : r}
                      </button>
                    );
                  })}
              </div>

              {/* 공연 서브탭: 서울 | 제주 */}
              <AnimatePresence>
                {(region === '공연' || region === '제주') && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex items-center gap-2 mb-1 pl-1 mt-2"
                  >
                    <span className="text-[10px] text-zinc-300 font-bold">›</span>
                    <button
                      onClick={() => setRegion('공연')}
                      className={cn(
                        "text-xs font-bold transition-all px-2 py-0.5 rounded-full border",
                        region === '공연'
                          ? "bg-emerald-500 text-white border-emerald-500"
                          : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                      )}
                    >
                      {lang === 'en' ? 'Seoul' : '서울'}
                    </button>
                    <button
                      onClick={() => setRegion('제주')}
                      className={cn(
                        "text-xs font-bold transition-all px-2 py-0.5 rounded-full border",
                        region === '제주'
                          ? "bg-[#0369a1] text-white border-[#0369a1]"
                          : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                      )}
                    >
                      {lang === 'en' ? 'Jeju' : '제주'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'rec' && (
            <motion.div key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <Recommendation places={allPlaces} lang={lang} />
            </motion.div>
          )}

          {activeTab === 'map' && region !== '공연' && region !== '제주' && region !== '축제' && (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <MapView places={places} region={region} lang={lang} />
            </motion.div>
          )}

          {activeTab === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PlaceList places={places} region={region} lang={lang} />
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
        <footer className="mt-10 mb-20 px-6 flex items-center justify-between border-t border-zinc-100 pt-6">
          <span className="text-[10px] font-bold text-zinc-400 tracking-tight">{t.footer}</span>
          <Link href="/feedback" className="flex items-center gap-1.5 text-[11px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full hover:bg-emerald-100 transition-colors shadow-sm">
            {t.feedback} <MessageSquare size={14} className="fill-emerald-100" />
          </Link>
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
          icon={<ListIcon size={22} />} 
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
  return (
    <Suspense>
      <Home />
    </Suspense>
  );
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
