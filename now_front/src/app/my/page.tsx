"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, MapPin, Route, Heart, ChevronRight, LogOut, Loader2, 
  Sparkles, Trash2, ChevronLeft, Map as MapIcon, List as ListIcon, X, Ticket, TrendingUp,
  MessageSquare, Settings, Library, Edit3, Plus, Save, Calendar, Video
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'theme' | 'course' | 'place';

export default function MyPage() {
  const { user, signOut, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('theme');
  const [likedPlaces, setLikedPlaces] = useState([]);
  const [savedCourses, setSavedCourses] = useState([]);
  const [userThemes, setUserThemes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null); // 재추가

  // Edit Mode State
  const [editingTheme, setEditingTheme] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPlaces, setEditPlaces] = useState<any[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchUserData();
    }
  }, [user]);

  const fetchUserData = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [likesRes, coursesRes, themesRes] = await Promise.all([
        fetch(`/api-now/users/${user.id}/likes`),
        fetch(`/api-now/users/${user.id}/courses`),
        fetch(`/api-now/users/${user.id}/themes`)
      ]);
      if (likesRes.ok) setLikedPlaces(await likesRes.json());
      if (coursesRes.ok) setSavedCourses(await coursesRes.json());
      if (themesRes.ok) setUserThemes(await themesRes.json());
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTheme = async (themeId: number) => {
    if (!confirm('테마를 정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api-now/themes/${themeId}?user_id=${user?.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('삭제되었습니다.');
        fetchUserData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const startEditTheme = (theme: any) => {
    setEditingTheme(theme);
    setEditTitle(theme.title);
    setEditDesc(theme.description);
    const parsedPlaces = typeof theme.places === 'string' ? JSON.parse(theme.places) : theme.places;
    setEditPlaces(parsedPlaces);
  };
  
  const handleUpdateTheme = async () => {
    if (!editTitle || !editDesc || editPlaces.length === 0) return alert('모든 필드를 입력해주세요.');
    try {
      const res = await fetch(`/api-now/themes/${editingTheme.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          title: editTitle,
          description: editDesc,
          places: editPlaces
        })
      });

      if (res.ok) {
        alert('테마가 수정되었습니다.');
        setEditingTheme(null);
        fetchUserData();
      } else {
        const err = await res.json();
        alert(`수정 실패: ${err.detail}`);
      }
    } catch (e) {
      console.error(e);
      alert('서버 통신 중 오류가 발생했습니다.');
    }
  };


  if (authLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;
  
  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center p-8 text-center space-y-6 max-w-md mx-auto bg-white shadow-2xl">
      <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center text-emerald-500 mb-4">
        <User size={40} />
      </div>
      <h2 className="text-2xl font-bold font-display">로그인이 필요합니다</h2>
      <p className="text-zinc-500 text-sm">마이페이지를 확인하시려면 로그인해 주세요.</p>
      <button onClick={() => { const u = process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3002'; window.location.href = `${u}/login?next=${encodeURIComponent(window.location.origin)}`; }} className="w-full max-w-xs py-4 bg-zinc-900 text-white rounded-2xl font-bold shadow-xl">로그인하기</button>
      <button onClick={() => router.push('/')} className="text-zinc-400 text-sm font-bold">홈으로 돌아가기</button>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl pb-32 border-x border-zinc-200">
      <header className="fixed top-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-md z-50 border-b border-zinc-100 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="p-2 hover:bg-zinc-100 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold font-display tracking-tight text-zinc-900">MY PAGE</h1>
        <div className="ml-auto flex items-center gap-2">
          {user.email === 'nemonecoltd@gmail.com' && (
            <Link href="/admin" className="px-3 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-all">
              ADMIN
            </Link>
          )}
          <button onClick={() => signOut()} className="p-2 bg-zinc-50 rounded-xl text-zinc-400 hover:text-rose-500 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="bg-white px-8 pt-24 pb-10 rounded-b-[40px] shadow-sm">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-emerald-50 shadow-lg flex-shrink-0 bg-zinc-100">
            <img 
              src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=random`} 
              alt={user.user_metadata?.full_name || ""} 
              className="w-full h-full object-cover" 
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-black tracking-tight truncate">{user.user_metadata?.full_name || user.email?.split('@')[0]}</h2>
            <p className="text-zinc-400 text-xs font-medium truncate">{user.email}</p>
          </div>
          <Link href="/my/edit" className="p-3 bg-zinc-100 text-zinc-500 rounded-2xl hover:bg-emerald-50 hover:text-emerald-500 transition-all shadow-sm">
            <Settings size={20} />
          </Link>
        </div>

        <div className="flex bg-zinc-100 p-1.5 rounded-2xl">
          <button onClick={() => setActiveTab('theme')} className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'theme' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            <Library size={16} /> 테마
          </button>
          <button onClick={() => setActiveTab('course')} className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'course' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            <Route size={16} /> 코스
          </button>
          <button onClick={() => setActiveTab('place')} className={cn("flex-1 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2", activeTab === 'place' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            <Heart size={16} /> 찜
          </button>
        </div>
      </div>

      <main className="p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'theme' && (
            <motion.div key="theme" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {userThemes.length > 0 ? userThemes.map((theme: any) => {
                const places = typeof theme.places === 'string' ? JSON.parse(theme.places) : theme.places;
                const firstImage = places[0]?.image_url || `https://picsum.photos/seed/theme-${theme.id}/400/300`;
                
                return (
                  <div key={theme.id} onClick={() => setSelectedTheme(theme)} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-4 relative group cursor-pointer hover:border-blue-200 transition-all">
                    <div className="flex gap-4">
                      <img
                        src={firstImage}
                        className="w-16 h-16 rounded-2xl object-cover border border-zinc-50 bg-zinc-50"
                        alt={theme.title}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://picsum.photos/seed/theme-error-${theme.id}/400/300`;
                        }}
                      />
                      <div className="flex-1 min-w-0 pr-16">
                        <h4 className="font-bold text-zinc-900 tracking-tight truncate">{theme.title}</h4>
                        <p className="text-xs text-zinc-500 line-clamp-2 mt-1">{theme.description}</p>
                      </div>
                      <div className="flex gap-1 absolute top-6 right-6" onClick={e => e.stopPropagation()}>
                        {!theme.title.startsWith('[퍼감]') && (
                          <button onClick={() => startEditTheme(theme)} className="p-2 text-zinc-400 hover:text-emerald-500 bg-zinc-50 rounded-lg transition-colors"><Edit3 size={16} /></button>
                        )}
                        <button onClick={() => handleDeleteTheme(theme.id)} className="p-2 text-zinc-400 hover:text-rose-500 bg-zinc-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-50">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md uppercase">THEME</span>
                      <span className="text-[10px] font-bold text-zinc-400 ml-auto">{new Date(theme.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              }) : (
                <div className="py-20 text-center space-y-4">
                  <Library size={48} className="mx-auto text-zinc-200" />
                  <p className="text-zinc-400 text-sm font-medium">아직 나만의 테마가 없습니다.</p>
                  <Link href="/?tab=theme&action=create" className="inline-block px-8 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">테마 만들러 가기</Link>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'course' && (
            <motion.div key="course" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {savedCourses.length > 0 ? savedCourses.map((course: any) => (
                <div key={course.id} onClick={() => setSelectedCourse(course)} className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-3 relative cursor-pointer hover:border-emerald-200 transition-colors">
                  <h4 className="font-bold text-zinc-900 tracking-tight">{course.title}</h4>
                  <p className="text-xs text-zinc-500 line-clamp-1">{course.description}</p>
                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-50">
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md uppercase">AI COURSE</span>
                    <span className="text-[10px] font-bold text-zinc-400 ml-auto">{new Date(course.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )) : (
                <div className="py-20 text-center space-y-4">
                  <Route size={48} className="mx-auto text-zinc-200" />
                  <p className="text-zinc-400 text-sm font-medium">아직 저장된 코스가 없습니다.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'place' && (
            <motion.div key="place" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {likedPlaces.length > 0 ? likedPlaces.map((place: any) => (
                <Link href={`/posts/${place.id}`} key={place.id} className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative no-underline group">
                  <img
                    src={place.image_url || `https://picsum.photos/seed/place-${place.id}/400/300`}
                    className="w-16 h-16 rounded-2xl object-cover border border-zinc-100 bg-white"
                    alt={place.title}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/place-error-${place.id}/400/300`;
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-zinc-900 text-sm truncate group-hover:text-emerald-600 transition-colors">{place.title}</h4>
                    <p className="text-[10px] text-zinc-400 truncate mt-1">{place.location}</p>
                  </div>
                  <ChevronRight size={20} className="text-zinc-300 group-hover:text-emerald-500 transition-colors" />
                </Link>
              )) : (
                <div className="py-20 text-center space-y-4">
                  <Heart size={48} className="mx-auto text-zinc-200" />
                  <p className="text-zinc-400 text-sm font-medium">찜한 장소가 없습니다.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Theme Edit Modal */}
      <AnimatePresence>
        {editingTheme && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end justify-center">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black text-zinc-900 tracking-tight">테마 수정하기</h3>
                <button onClick={() => setEditingTheme(null)} className="p-2 bg-zinc-100 rounded-full"><X size={20} /></button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">제목</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">설명</label>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-2xl px-4 py-3 text-sm h-24 resize-none focus:outline-none focus:border-emerald-500" />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">장소 리스트 ({editPlaces.length})</label>
                    <button onClick={() => setEditPlaces([...editPlaces, { title: '', location: '', content: '', image_url: '', video_url: '', date_range: '' }])} className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus size={12} /> 추가</button>
                  </div>
                  {editPlaces.map((p, idx) => (
                    <div key={idx} className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 space-y-3 relative">
                      <button onClick={() => setEditPlaces(editPlaces.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-zinc-300 hover:text-rose-500"><X size={16} /></button>
                      <input placeholder="장소명" value={p.title} onChange={e => { const n = [...editPlaces]; n[idx] = { ...n[idx], title: e.target.value }; setEditPlaces(n); }} className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold" />
                      <input placeholder="주소" value={p.location} onChange={e => { const n = [...editPlaces]; n[idx] = { ...n[idx], location: e.target.value }; setEditPlaces(n); }} className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs" />
                      <textarea placeholder="설명" value={p.content} onChange={e => { const n = [...editPlaces]; n[idx] = { ...n[idx], content: e.target.value }; setEditPlaces(n); }} className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs h-16 resize-none" />
                      <input placeholder="운영 일시" value={p.date_range || ''} onChange={e => { const n = [...editPlaces]; n[idx] = { ...n[idx], date_range: e.target.value }; setEditPlaces(n); }} className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs" />
                      <input placeholder="이미지 URL" value={p.image_url || ''} onChange={e => { const n = [...editPlaces]; n[idx] = { ...n[idx], image_url: e.target.value }; setEditPlaces(n); }} className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs" />
                      <input placeholder="영상 URL" value={p.video_url || ''} onChange={e => { const n = [...editPlaces]; n[idx] = { ...n[idx], video_url: e.target.value }; setEditPlaces(n); }} className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs" />
                    </div>
                  ))}
                </div>

                <button onClick={handleUpdateTheme} className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-emerald-600 transition-all">
                  <Save size={20} /> 수정 내용 저장
                </button>
              </div>
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
                  <img src={selectedTheme.user_image || "https://ui-avatars.com/api/?name=U&background=random"} className="w-10 h-10 rounded-full border border-zinc-100 object-cover bg-zinc-50" alt="" />
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedTheme.title}</h3>
                    <p className="text-xs text-zinc-400 font-bold uppercase">{selectedTheme.user_name}의 테마</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedTheme(null)} className="p-2 bg-zinc-100 text-zinc-400 hover:text-zinc-600 rounded-full transition-colors"><X size={20} /></button>
                </div>
              </div>

              <p className="text-sm text-zinc-600 mb-6 bg-zinc-50 p-4 rounded-xl">{selectedTheme.description}</p>

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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Course Detail Modal */}
      <AnimatePresence>
        {selectedCourse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedCourse(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <img src={user?.user_metadata?.avatar_url || "https://picsum.photos/200"} className="w-10 h-10 rounded-full border border-zinc-100 object-cover" alt="" />
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedCourse.title}</h3>
                    <p className="text-xs text-zinc-400 font-bold uppercase">{user?.user_metadata?.full_name || 'User'}의 코스</p>
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
                      frameBorder="0"
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
