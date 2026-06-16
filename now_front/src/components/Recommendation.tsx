"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Heart, ChevronRight, User, Sparkles, X, Share2, Copy, Save, MapPin, Calendar, Video } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AdUnit from './AdUnit';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'course' | 'theme' | 'place';

export default function Recommendation({ places: initialPlaces = [], lang = 'ko' }: { places?: any[], lang?: string }) {
  const { user, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('course');
  const [courses, setCourses] = useState([]);
  const [themes, setThemes] = useState([]);
  const [places, setPlaces] = useState(initialPlaces);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setPlaces(initialPlaces);
  }, [initialPlaces]);

  useEffect(() => {
    if (activeTab === 'course') {
      fetchCourses();
    } else if (activeTab === 'theme') {
      fetchThemes();
    }
  }, [activeTab, lang]);

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
      }
    } catch (e) {
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
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <div className="px-6 py-4">
        <div className="flex bg-zinc-200/50 p-1 rounded-2xl">
          <button onClick={() => setActiveTab('course')} className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all", activeTab === 'course' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Courses' : '코스 랭킹'}
          </button>
          <button onClick={() => setActiveTab('theme')} className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all", activeTab === 'theme' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Themes' : '테마 랭킹'}
          </button>
          <button onClick={() => setActiveTab('place')} className={cn("flex-1 py-2.5 rounded-xl text-xs font-bold transition-all", activeTab === 'place' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Places' : '플레이스 랭킹'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 no-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'course' ? (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
                          alt="" 
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-zinc-900 truncate">{course.user_name}</p>
                          <span className={cn(
                            "text-[7px] font-black px-1.5 py-0.5 rounded uppercase border",
                            course.region === '홍대' ? "bg-orange-50 text-orange-600 border-orange-100"
                            : course.region === '공연' ? "bg-purple-50 text-purple-600 border-purple-100"
                            : course.region === '제주' ? "bg-cyan-50 text-cyan-600 border-cyan-100"
                            : course.region === '축제' ? "bg-amber-50 text-amber-600 border-amber-100"
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                          )}>
                            {lang === 'en'
                              ? (course.region === '홍대' ? 'Hongdae' : course.region === '공연' ? 'Concert' : course.region === '제주' ? 'Jeju' : course.region === '축제' ? 'Festival' : 'Seongsu')
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

                  {idx === 2 && (
                    <AdUnit slotId="8058413094" />
                  )}
                </div>
              ))}
            </motion.div>
          ) : activeTab === 'theme' ? (
            <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
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
                          <p className="text-[10px] font-bold text-zinc-900 truncate">{theme.user_name}</p>
                          <span className="text-[7px] font-black px-1.5 py-0.5 rounded uppercase border bg-blue-50 text-blue-600 border-blue-100">
                            {lang === 'en' ? 'Theme' : '테마'}
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

                  {idx === 2 && (
                    <AdUnit slotId="8058413094" />
                  )}
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              {places.slice(0, 25).map((place: any, idx: number) => (
                <div key={place.id}>
                  <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative group mb-4">
                    <div className="absolute -left-2 -top-2 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                      {idx + 1}
                    </div>
                    <div className="relative flex-shrink-0">
                      <img src={place.image_url || `https://picsum.photos/seed/${place.id}/200`} className="w-16 h-16 rounded-2xl object-cover border border-zinc-50" alt="" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/200`; }} />
                      <div className="absolute -bottom-1 -right-1 shadow-lg">
                        <span className={cn(
                          "text-[8px] font-black px-1.5 py-0.5 rounded-md border",
                          place.region === '홍대' ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                          : place.region === '공연' ? "bg-purple-500 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                          : place.region === '제주' ? "bg-cyan-500 text-white border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                          : place.region === '축제' ? "bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                          : "bg-emerald-50 text-emerald-600 border-emerald-400"
                        )}>
                          {lang === 'en'
                            ? (place.region === '홍대' ? 'HONGDAE' : place.region === '공연' ? 'CONCERT' : place.region === '제주' ? 'JEJU' : place.region === '축제' ? 'FESTIVAL' : 'SEONGSU')
                            : (place.region || '성수')}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-zinc-900 text-sm truncate tracking-tight">
                        {(lang === 'en' && place.title_en) ? place.title_en : place.title}
                      </h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                          <Heart size={10} fill="currentColor" /> {place.like_count}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-medium truncate">
                          {lang === 'en'
                            ? (place.region === '공연' ? 'Seoul Concert' : place.region === '제주' ? 'Jeju Culture' : place.region === '축제' ? 'Local Festival' : `Near ${place.region === '홍대' ? 'Hongdae' : 'Seongsu'}`)
                            : (place.region === '공연' ? '서울 공연' : place.region === '제주' ? '제주 공연·전시' : place.region === '축제' ? '전국 축제' : `${place.location?.split(' ')[2] || place.region} 근처`)}
                        </span>
                      </div>
                    </div>
                    <Link href={`/posts/${place.id}?region=${encodeURIComponent(place.region || '성수')}`} className="p-2 bg-zinc-50 rounded-xl text-zinc-300 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all">
                      <ChevronRight size={18} />
                    </Link>
                  </div>

                  {idx === 2 && (
                    <AdUnit slotId="8058413094" />
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
                  <img src={selectedCourse.user_image} className="w-10 h-10 rounded-full border border-zinc-100" alt="" />
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedCourse.title}</h3>
                    <p className="text-xs text-zinc-400 font-bold uppercase">{selectedCourse.user_name}의 추천 코스</p>
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
                        <h4 className="font-bold text-zinc-900 text-sm">{step.place_name}</h4>
                        <p className="text-[11px] text-zinc-500 mt-1">{step.activity}</p>
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
                  <img src={selectedTheme.user_image} className="w-10 h-10 rounded-full border border-zinc-100" alt="" />
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedTheme.title}</h3>
                    <p className="text-xs text-zinc-400 font-bold uppercase">{selectedTheme.user_name}의 테마</p>
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
                      alt="" 
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
                    alt="" 
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
