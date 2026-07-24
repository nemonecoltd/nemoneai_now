"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Heart, ChevronRight, User, Sparkles, X, Share2, Copy, Save, MapPin, Calendar, Video, Flame } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AdUnit from './AdUnit';
import ClosingSoonTicker from './ClosingSoonTicker';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'course' | 'theme' | 'place' | 'concert' | 'festival';
const PLACE_RANKING_REGIONS = ['종합', '성수', '홍대', '강북', '강남', '제주'] as const;
type PlaceRankingRegion = typeof PLACE_RANKING_REGIONS[number];

export default function Recommendation({ places: initialPlaces = [], lang = 'ko' }: { places?: any[], lang?: string }) {
  const { user, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('place');
  const [courses, setCourses] = useState([]);
  const [themes, setThemes] = useState([]);
  const [places, setPlaces] = useState(initialPlaces);
  const [placeRegion, setPlaceRegion] = useState<PlaceRankingRegion>('종합');
  const [concerts, setConcerts] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (placeRegion === '종합') setPlaces(initialPlaces);
  }, [initialPlaces, placeRegion]);

  useEffect(() => {
    if (activeTab === 'course') {
      fetchCourses();
    } else if (activeTab === 'theme') {
      fetchThemes();
    } else if (activeTab === 'concert') {
      fetchConcerts();
    } else if (activeTab === 'festival') {
      fetchFestivals();
    } else if (activeTab === 'place' && placeRegion !== '종합') {
      fetchPlacesByRegion(placeRegion);
    }
  }, [activeTab, lang, placeRegion]);

  const fetchPlacesByRegion = async (region: PlaceRankingRegion) => {
    if (region === '종합') {
      setPlaces(initialPlaces);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places/popular?region=${encodeURIComponent(region)}&t=${Date.now()}`);
      if (res.ok) setPlaces(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConcerts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places/popular/performance?t=${Date.now()}`);
      if (res.ok) setConcerts(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFestivals = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places/popular/festival?t=${Date.now()}`);
      if (res.ok) setFestivals(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/courses?lang=${lang}`);
      if (res.ok) setCourses(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchThemes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/themes`);
      if (res.ok) setThemes(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    if (activeTab === 'course') fetchCourses();
    if (activeTab === 'theme') fetchThemes();
  };

  const toggleCourseLike = async (e: React.MouseEvent, courseId: number) => {
    e.stopPropagation();
    if (!user) return signInWithGoogle();

    try {
      const res = await fetch('/api-now/courses/like/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, course_id: courseId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleThemeLike = async (e: React.MouseEvent, themeId: number) => {
    e.stopPropagation();
    if (!user) return signInWithGoogle();

    try {
      const res = await fetch('/api-now/themes/like/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, theme_id: themeId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleForkCourse = async (course: any) => {
    if (!user) return signInWithGoogle();
    
    try {
      const res = await fetch('/api-now/courses/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          user_image: user.user_metadata?.avatar_url || null,
          title: `[퍼감] ${course.title}`,
          description: course.description,
          steps: Array.isArray(course.steps) ? course.steps : JSON.parse(course.steps),
          region: course.region || '성수'
        }),
      });
      if (res.ok) {
        alert("내 마이페이지로 코스를 가져왔습니다!");
        setSelectedCourse(null);
      } else {
        alert("코스를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
        console.error("Fork course failed", res.status, await res.text());
      }
    } catch (e) {
      alert("코스를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
      console.error(e);
    }
  };

  const handleForkTheme = async (theme: any) => {
    if (!user) return signInWithGoogle();
    
    try {
      const res = await fetch('/api-now/themes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          user_image: user.user_metadata?.avatar_url || null,
          title: `[퍼감] ${theme.title}`,
          description: theme.description,
          places: Array.isArray(theme.places) ? theme.places : JSON.parse(theme.places)
        })
      });
      if (res.ok) {
        alert("내 마이페이지로 테마를 가져왔습니다!");
        setSelectedTheme(null);
      } else {
        alert("테마를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
        console.error("Fork theme failed", res.status, await res.text());
      }
    } catch (e) {
      alert("테마를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <ClosingSoonTicker lang={lang} />
      <div className="px-6 py-4">
        <div className="flex bg-zinc-200/50 p-1 rounded-2xl overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('course')} className={cn("flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap px-1", activeTab === 'course' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Courses' : lang === 'zh' ? '路线' : '코스'}
          </button>
          <button onClick={() => setActiveTab('theme')} className={cn("flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap px-1", activeTab === 'theme' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Themes' : lang === 'zh' ? '主题' : '테마'}
          </button>
          <button onClick={() => setActiveTab('place')} className={cn("flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap px-1", activeTab === 'place' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Places' : lang === 'zh' ? '地点' : '플레이스'}
          </button>
          <button onClick={() => setActiveTab('concert')} className={cn("flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap px-1", activeTab === 'concert' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Concerts' : lang === 'zh' ? '演出' : '공연'}
          </button>
          <button onClick={() => setActiveTab('festival')} className={cn("flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap px-1", activeTab === 'festival' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Festivals' : lang === 'zh' ? '节庆' : '축제'}
          </button>
        </div>
        {activeTab === 'place' && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto no-scrollbar">
            {PLACE_RANKING_REGIONS.map((r) => (
              <button
                key={r}
                onClick={() => setPlaceRegion(r)}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border",
                  placeRegion === r ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
                )}
              >
                {r === '종합'
                  ? (lang === 'en' ? 'All' : lang === 'zh' ? '综合' : '종합')
                  : r === '홍대'
                    ? (lang === 'en' ? 'Hongdae' : lang === 'zh' ? '弘大' : '홍대')
                    : r === '강북'
                      ? (lang === 'en' ? 'Gangbuk' : lang === 'zh' ? '江北' : '강북')
                      : r === '강남'
                        ? (lang === 'en' ? 'Gangnam' : lang === 'zh' ? '江南' : '강남')
                        : r === '제주'
                          ? (lang === 'en' ? 'Jeju' : lang === 'zh' ? '济州' : '제주')
                          : (lang === 'en' ? 'Seongsu' : lang === 'zh' ? '圣水洞' : '성수')}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 no-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'course' ? (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
              {courses.slice(0, 25).map((course: any, idx: number) => (
                <div key={course.id}>
                  <div onClick={() => setSelectedCourse(course)} className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm space-y-4 cursor-pointer hover:border-emerald-200 transition-all group relative overflow-hidden mb-4">
                    <div className="absolute -left-1 -top-1 w-8 h-8 bg-zinc-900 text-white text-[10px] font-black rounded-br-2xl flex items-center justify-center shadow-lg z-10">
                      {idx + 1}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-100 flex-shrink-0 bg-zinc-50">
                        <img
                          src={course.user_image || `https://ui-avatars.com/api/?name=${course.user_name || 'U'}&background=random`}
                          className="w-full h-full object-cover"
                          alt={course.user_name || ''}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-zinc-900 truncate">{course.user_name}</p>
                          <span className={cn(
                            "text-[7px] font-black px-1.5 py-0.5 rounded uppercase border",
                            course.region === '홍대' ? "bg-orange-50 text-orange-600 border-orange-100"
                            : course.region === '강북' ? "bg-yellow-50 text-yellow-700 border-yellow-100"
                            : course.region === '강남' ? "bg-pink-50 text-pink-600 border-pink-100"
                            : course.region === '공연' ? "bg-purple-50 text-purple-600 border-purple-100"
                            : course.region === '제주' ? "bg-sky-50 text-[#0369a1] border-sky-200"
                            : course.region === '축제' ? "bg-amber-50 text-amber-600 border-amber-100"
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                          )}>
                            {lang === 'en'
                              ? (course.region === '홍대' ? 'Hongdae' : course.region === '강북' ? 'Gangbuk' : course.region === '강남' ? 'Gangnam' : course.region === '공연' ? 'Concert' : course.region === '제주' ? 'Jeju' : course.region === '축제' ? 'Festival' : 'Seongsu')
                              : lang === 'zh'
                                ? (course.region === '홍대' ? '弘大' : course.region === '강북' ? '江北' : course.region === '강남' ? '江南' : course.region === '공연' ? '演出' : course.region === '제주' ? '济州' : course.region === '축제' ? '节庆' : '圣水洞')
                                : (course.region || '성수')}
                          </span>
                        </div>
                        <p className="text-[8px] text-zinc-400 font-medium">Verified Local Guide</p>
                      </div>
                      <button onClick={(e) => toggleCourseLike(e, course.id)} className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100 hover:bg-rose-50 transition-all group/like">
                        <Heart size={14} className="text-zinc-300 group-hover/like:text-rose-500 transition-colors" />
                        <span className="text-[10px] font-black text-zinc-400 group-hover/like:text-rose-600">{course.like_count}</span>
                      </button>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="font-bold text-zinc-900 text-sm tracking-tight group-hover:text-emerald-600 transition-colors">
                        {(lang === 'en' && course.title_en) ? course.title_en : course.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">
                        {(lang === 'en' && course.description_en) ? course.description_en : course.description}
                      </p>
                    </div>
                  </div>

                  {idx === 1 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
              ))}
            </motion.div>
          ) : activeTab === 'theme' ? (
            <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
              {themes.slice(0, 25).map((theme: any, idx: number) => (
                <div key={theme.id}>
                  <div onClick={() => setSelectedTheme(theme)} className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm space-y-4 cursor-pointer hover:border-blue-200 transition-all group relative overflow-hidden mb-4">
                    <div className="absolute -left-1 -top-1 w-8 h-8 bg-zinc-900 text-white text-[10px] font-black rounded-br-2xl flex items-center justify-center shadow-lg z-10">
                      {idx + 1}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-100 flex-shrink-0">
                        <img src={theme.user_image || `https://picsum.photos/seed/u${theme.id}/200`} className="w-full h-full object-cover" alt={theme.title} onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/u${theme.id}/200`; }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-zinc-900 truncate">{theme.user_name || (lang === 'en' ? 'Anony' : lang === 'zh' ? '匿名' : '아무개')}</p>
                          <span className="text-[7px] font-black px-1.5 py-0.5 rounded uppercase border bg-blue-50 text-blue-600 border-blue-100">
                            {lang === 'en' ? 'Theme' : lang === 'zh' ? '主题' : '테마'}
                          </span>
                        </div>
                      </div>
                      <button onClick={(e) => toggleThemeLike(e, theme.id)} className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100 hover:bg-rose-50 transition-all group/like">
                        <Heart size={14} className="text-zinc-300 group-hover/like:text-rose-500 transition-colors" />
                        <span className="text-[10px] font-black text-zinc-400 group-hover/like:text-rose-600">{theme.like_count}</span>
                      </button>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="font-bold text-zinc-900 text-sm tracking-tight group-hover:text-blue-600 transition-colors">
                        {theme.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">
                        {theme.description}
                      </p>
                    </div>
                  </div>

                  {idx === 1 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
              ))}
            </motion.div>
          ) : activeTab === 'place' ? (
            <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
              {places.slice(0, 25).map((place: any, idx: number) => (
                <div key={place.id}>
                  <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative group mb-4">
                    <div className="absolute -left-2 -top-2 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                      {idx + 1}
                    </div>
                    <div className="relative flex-shrink-0">
                      <img src={place.image_url || `https://picsum.photos/seed/${place.id}/200`} className="w-16 h-16 rounded-2xl object-cover border border-zinc-50" alt={place.title || ''} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/200`; }} />
                      <div className="absolute -bottom-1 -right-1 shadow-lg">
                        <span className={cn(
                          "text-[8px] font-black px-1.5 py-0.5 rounded-md border",
                          place.region === '홍대' ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                          : place.region === '강북' ? "bg-yellow-500 text-white border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                          : place.region === '강남' ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                          : place.region === '공연' ? "bg-purple-500 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                          : place.region === '제주' ? "bg-[#0369a1] text-white border-[#0369a1] shadow-[0_0_10px_rgba(3,105,161,0.5)]"
                          : place.region === '축제' ? "bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                          : "bg-emerald-50 text-emerald-600 border-emerald-400"
                        )}>
                          {lang === 'en'
                            ? (place.region === '홍대' ? 'HONGDAE' : place.region === '강북' ? 'GANGBUK' : place.region === '강남' ? 'GANGNAM' : place.region === '공연' ? 'CONCERT' : place.region === '제주' ? 'JEJU' : place.region === '축제' ? 'FESTIVAL' : 'SEONGSU')
                            : lang === 'zh'
                              ? (place.region === '홍대' ? '弘大' : place.region === '강북' ? '江北' : place.region === '강남' ? '江南' : place.region === '공연' ? '演出' : place.region === '제주' ? '济州' : place.region === '축제' ? '节庆' : '圣水洞')
                              : (place.region || '성수')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-zinc-900 text-sm truncate tracking-tight">
                          {(lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : place.title}
                        </h4>
                        {place.category === 'class' && (
                          <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">
                            {lang === 'en' ? 'Class' : lang === 'zh' ? '体验课' : '클래스'}
                          </span>
                        )}
                        {place.is_new && (
                          <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400 animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                          <Flame size={10} fill="currentColor" /> {place.score ?? place.like_count}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-medium truncate">
                          {place.region === '공연'
                            ? (lang === 'en' ? 'Seoul Concert' : lang === 'zh' ? '首尔演出' : '서울 공연')
                            : place.region === '축제'
                              ? (lang === 'en' ? 'Local Festival' : lang === 'zh' ? '全国节庆' : '전국 축제')
                              : (place.category === 'class' || place.category === 'shopping')
                                ? (lang === 'en' ? 'Always Open' : lang === 'zh' ? '常年营业' : '상시 운영')
                                : place.date_range || (lang === 'en'
                                    ? `Near ${place.region === '홍대' ? 'Hongdae' : place.region === '강북' ? 'Gangbuk' : place.region === '강남' ? 'Gangnam' : place.region === '제주' ? 'Jeju' : 'Seongsu'}`
                                    : lang === 'zh'
                                      ? `${place.region === '홍대' ? '弘大' : place.region === '강북' ? '江北' : place.region === '강남' ? '江南' : place.region === '제주' ? '济州' : '圣水洞'}附近`
                                      : `${place.region} 근처`)}
                        </span>
                      </div>
                    </div>
                    <Link href={`/posts/${place.id}?region=${encodeURIComponent(place.region || '성수')}&lang=${lang}`} className="p-2 bg-zinc-50 rounded-xl text-zinc-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
                      <ChevronRight size={18} />
                    </Link>
                  </div>

                  {idx === 1 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
              ))}
            </motion.div>
          ) : activeTab === 'concert' ? (
            <motion.div key="ct" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
              {concerts.length === 0 && !isLoading && (
                <p className="text-center text-xs text-zinc-400 py-10">
                  {lang === 'en' ? 'No concert ranking data yet.' : lang === 'zh' ? '暂无演出排行数据。' : '아직 공연 랭킹 데이터가 없습니다.'}
                </p>
              )}
              {concerts.slice(0, 25).map((place: any, idx: number) => (
                <div key={place.id}>
                  <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative group mb-4">
                    <div className="absolute -left-2 -top-2 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                      {idx + 1}
                    </div>
                    <div className="relative flex-shrink-0">
                      <img src={place.image_url || `https://picsum.photos/seed/${place.id}/200`} className="w-16 h-16 rounded-2xl object-cover border border-zinc-50" alt={place.title || ''} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/200`; }} />
                      <div className="absolute -bottom-1 -right-1 shadow-lg">
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md border bg-purple-500 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                          {lang === 'en'
                            ? (place.category === '연극' ? 'THEATER' : place.category === '뮤지컬' ? 'MUSICAL' : place.category === '음악' ? 'MUSIC' : 'CONCERT')
                            : lang === 'zh'
                              ? (place.category === '연극' ? '话剧' : place.category === '뮤지컬' ? '音乐剧' : place.category === '음악' ? '音乐' : '综合')
                              : (place.category || '종합')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-zinc-900 text-sm truncate tracking-tight">
                          {(lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : place.title}
                        </h4>
                        {place.is_new && (
                          <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400 animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                          <Flame size={10} fill="currentColor" /> {place.score ?? place.like_count}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-medium truncate">
                          {place.date_range || (lang === 'en' ? 'Seoul Concert' : lang === 'zh' ? '首尔演出' : '서울 공연')}
                        </span>
                      </div>
                    </div>
                    <Link href={`/posts/${place.id}?region=공연&lang=${lang}`} className="p-2 bg-zinc-50 rounded-xl text-zinc-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
                      <ChevronRight size={18} />
                    </Link>
                  </div>

                  {idx === 1 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="ft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-2">
              {festivals.length === 0 && !isLoading && (
                <p className="text-center text-xs text-zinc-400 py-10">
                  {lang === 'en' ? 'No festival ranking data yet.' : lang === 'zh' ? '暂无节庆排行数据。' : '아직 축제 랭킹 데이터가 없습니다.'}
                </p>
              )}
              {festivals.slice(0, 25).map((place: any, idx: number) => (
                <div key={place.id}>
                  <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative group mb-4">
                    <div className="absolute -left-2 -top-2 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                      {idx + 1}
                    </div>
                    <div className="relative flex-shrink-0">
                      <img src={place.image_url || `https://picsum.photos/seed/${place.id}/200`} className="w-16 h-16 rounded-2xl object-cover border border-zinc-50" alt={place.title || ''} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/200`; }} />
                      <div className="absolute -bottom-1 -right-1 shadow-lg">
                        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md border bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                          {lang === 'en' ? 'FESTIVAL' : lang === 'zh' ? '节庆' : '축제'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-zinc-900 text-sm truncate tracking-tight">
                          {(lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : place.title}
                        </h4>
                        {place.is_new && (
                          <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400 animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                          <Flame size={10} fill="currentColor" /> {place.score ?? place.like_count}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-medium truncate">
                          {place.date_range || (lang === 'en' ? 'Seoul Festival' : lang === 'zh' ? '首尔节庆' : '전국 축제')}
                        </span>
                      </div>
                    </div>
                    <Link href={`/posts/${place.id}?region=축제&lang=${lang}`} className="p-2 bg-zinc-50 rounded-xl text-zinc-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
                      <ChevronRight size={18} />
                    </Link>
                  </div>

                  {idx === 1 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Course Detail Modal */}
      <AnimatePresence>
        {selectedCourse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedCourse(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <img src={selectedCourse.user_image} className="w-10 h-10 rounded-full border border-zinc-100" alt={selectedCourse.user_name || ''} />
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedCourse.title}</h3>
                    <p className="text-xs text-zinc-400 font-bold">
                      {selectedCourse.user_name}의 추천 코스
                      {selectedCourse.created_at && (
                        <span className="ml-2 font-normal text-zinc-300">
                          {new Date(selectedCourse.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedCourse(null)} className="p-2 bg-zinc-100 rounded-full"><X size={20} /></button>
              </div>

              <div className="relative space-y-8 mb-10 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
                {(Array.isArray(selectedCourse.steps) ? selectedCourse.steps : JSON.parse(selectedCourse.steps)).map((step: any, idx: number) => (
                  <div key={idx} className="relative pl-10">
                    <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-4 border-emerald-500 z-10" />
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-400 font-mono uppercase">{step.time} • {step.duration}MIN</p>
                      <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-zinc-900 text-sm">{step.place_name}</h4>
                            {step.date_range && (
                              <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{step.date_range}</p>
                            )}
                            <p className="text-[11px] text-zinc-500 mt-1">{step.activity}</p>
                          </div>
                          {step.place_id && (
                            <Link
                              href={`/posts/${step.place_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-shrink-0 w-7 h-7 bg-white border border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 hover:bg-emerald-50 hover:text-emerald-500 hover:border-emerald-200 transition-all"
                            >
                              <ChevronRight size={14} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => handleForkCourse(selectedCourse)}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-emerald-600 transition-all"
              >
                <Save size={20} /> 이 코스 내 마이페이지로 퍼가기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Theme Detail Modal */}
      <AnimatePresence>
        {selectedTheme && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedTheme(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTheme.user_image || `https://picsum.photos/seed/u${selectedTheme.id}/200`}
                    className="w-10 h-10 rounded-full border border-zinc-100 object-cover"
                    alt={selectedTheme.user_name || ''}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/u${selectedTheme.id}/200`; }}
                  />
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedTheme.title}</h3>
                    <p className="text-xs text-zinc-400 font-bold uppercase">{(selectedTheme.user_name || (lang === 'en' ? 'Anony' : lang === 'zh' ? '匿名' : '아무개'))}의 테마</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTheme(null)} className="p-2 bg-zinc-100 rounded-full"><X size={20} /></button>
              </div>

              <div className="space-y-4 mb-10">
                {(Array.isArray(selectedTheme.places) ? selectedTheme.places : JSON.parse(selectedTheme.places)).map((place: any, idx: number) => (
                  <div key={idx} onClick={() => setSelectedPlace(place)} className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex gap-4 relative group cursor-pointer hover:border-emerald-200 transition-colors">
                    <img
                      src={place.image_url || `https://picsum.photos/seed/theme-${selectedTheme.id}-${idx}/400/300`}
                      className="w-16 h-16 rounded-2xl object-cover border border-zinc-200 bg-white"
                      alt={place.title || ''}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://picsum.photos/seed/theme-error-${idx}/400/300`;
                      }}
                    />
                    <div className="flex-1 min-w-0 pr-6">
                      <h4 className="font-bold text-zinc-900 text-sm truncate group-hover:text-emerald-600 transition-colors">{place.title}</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{place.location}</p>
                      <p className="text-[11px] text-zinc-600 mt-2 line-clamp-2">{place.content}</p>
                    </div>
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                  </div>
                ))}
              </div>

              <button 
                onClick={() => handleForkTheme(selectedTheme)}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-emerald-600 transition-all"
              >
                <Save size={20} /> 이 테마 내 마이페이지로 퍼가기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Place Detail Nested Modal */}
      <AnimatePresence>
        {selectedPlace && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedPlace(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight pr-8">{selectedPlace.title}</h3>
                <button onClick={() => setSelectedPlace(null)} className="p-2 bg-zinc-100 text-zinc-400 hover:text-zinc-600 rounded-full transition-colors flex-shrink-0"><X size={20} /></button>
              </div>
              
              <div className="space-y-6 flex-grow">
                <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden bg-zinc-100 border border-zinc-200">
                  <img
                    src={selectedPlace.image_url || `https://picsum.photos/seed/theme-${selectedPlace.title}/800/600`}
                    className="w-full h-full object-cover"
                    alt={selectedPlace.title || ''}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/theme-error-place/800/600`;
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2 text-sm text-emerald-600 font-bold bg-emerald-50 p-3 rounded-xl">
                    <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{selectedPlace.location || '위치 정보 없음'}</span>
                  </div>
                  {selectedPlace.date_range && (
                    <div className="flex items-center gap-2 text-sm text-zinc-600 font-bold bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                      <Calendar size={16} className="text-zinc-400 flex-shrink-0" />
                      <span>{selectedPlace.date_range}</span>
                    </div>
                  )}
                  {selectedPlace.video_url && (
                    <div className="flex items-center gap-2 text-sm text-zinc-600 font-bold bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                      <Video size={16} className="text-zinc-400 flex-shrink-0" />
                      <a href={selectedPlace.video_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 hover:underline truncate">
                        {selectedPlace.video_url}
                      </a>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">상세 설명 및 팁</h4>
                  <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{selectedPlace.content}</p>
                </div>

                {selectedPlace.location && (
                  <div className="w-full aspect-video rounded-3xl overflow-hidden border border-zinc-200 bg-zinc-100 relative">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedPlace.location)}&z=16&output=embed`}
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
