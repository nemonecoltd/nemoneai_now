"use client";

import { useState, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Plus, X, Search, ChevronRight, Trash2, MapPin, Calendar, Clock, Video, Globe } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AdUnit from './AdUnit';

export default function ThemeMenu({ lang = 'ko' }: { lang?: string }) {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'create' && user) {
      setIsCreating(true);
      router.replace('/?tab=theme');
    }
  }, [user]);

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [places, setPlaces] = useState<any[]>([]);

  useEffect(() => {
    fetchThemes();
  }, [lang]);

  const fetchThemes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/themes`);
      if (res.ok) setThemes(await res.json());
    } finally {
      setIsLoading(false);
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
      if (res.ok) fetchThemes();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteTheme = async (e: React.MouseEvent, themeId: number, authorId: string) => {
    e.stopPropagation();
    if (!user || (user.id !== authorId && user.email !== 'nemonecoltd@gmail.com')) {
      alert('권한이 없습니다.');
      return;
    }
    if (!confirm('테마를 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api-now/themes/${themeId}?user_id=${user.id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('삭제되었습니다.');
        setSelectedTheme(null);
        fetchThemes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const top5 = themes.slice(0, 5);
  const latest = [...themes].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const addPlaceToForm = () => {
    setPlaces([...places, { title: '', location: '', content: '', image_url: '', video_url: '', date_range: '' }]);
  };

  const handlePlaceChange = (index: number, field: string, value: string) => {
    const newPlaces = [...places];
    newPlaces[index][field] = value;
    setPlaces(newPlaces);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return signInWithGoogle();
    if (!title || !description || places.length === 0) return alert('제목, 설명, 그리고 최소 1개의 플레이스를 등록해주세요.');
    
    setIsLoading(true);
    try {
      const res = await fetch('/api-now/themes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          user_image: user.user_metadata?.avatar_url || null,
          title,
          description,
          places
        })
      });
      if (res.ok) {
        alert('테마가 등록되었습니다.');
        setIsCreating(false);
        setTitle('');
        setDescription('');
        setPlaces([]);
        fetchThemes();
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isCreating) {
    return (
      <div className="h-full flex flex-col bg-zinc-50 p-6 overflow-y-auto pb-32">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-zinc-900 tracking-tight">새 테마 만들기</h2>
          <button onClick={() => setIsCreating(false)} className="p-2 bg-zinc-100 rounded-full"><X size={20} /></button>
        </div>
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">테마 제목</label>
            <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500" placeholder="예: 비오는 날 가기 좋은 성수 카페" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">테마 설명</label>
            <textarea required value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-white border border-zinc-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500 resize-none h-24" placeholder="이 테마에 대한 간단한 설명을 적어주세요." />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pl-2">플레이스 리스트</label>
              <button type="button" onClick={addPlaceToForm} className="text-[10px] bg-emerald-50 text-emerald-600 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"><Plus size={12} /> 추가</button>
            </div>
            {places.map((place, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-zinc-200 space-y-3 relative">
                <button type="button" onClick={() => setPlaces(places.filter((_, i) => i !== idx))} className="absolute top-4 right-4 text-zinc-400 hover:text-rose-500"><X size={16} /></button>
                <div className="space-y-1 pr-8">
                  <label className="text-[10px] font-bold text-zinc-400">플레이스 이름</label>
                  <input required type="text" value={place.title} onChange={e => handlePlaceChange(idx, 'title', e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400">주소</label>
                  <input required type="text" value={place.location} onChange={e => handlePlaceChange(idx, 'location', e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="상세 주소를 입력하세요" />
                  {place.location && (
                    <a href={`https://map.naver.com/v5/search/${encodeURIComponent(place.location)}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-emerald-500 hover:underline inline-block mt-1">네이버 지도로 확인</a>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400">설명 / 팁</label>
                  <textarea required value={place.content} onChange={e => handlePlaceChange(idx, 'content', e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400">운영 일시 (선택)</label>
                  <input type="text" value={place.date_range} onChange={e => handlePlaceChange(idx, 'date_range', e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="예: 2026.04.01 ~ 04.30" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400">이미지 URL (선택)</label>
                  <input type="text" value={place.image_url} onChange={e => handlePlaceChange(idx, 'image_url', e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400">영상 URL (선택)</label>
                  <input type="text" value={place.video_url} onChange={e => handlePlaceChange(idx, 'video_url', e.target.value)} className="w-full bg-zinc-50 border border-zinc-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" placeholder="YouTube 또는 Spotify 링크" />
                </div>
              </div>
            ))}
            {places.length === 0 && <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-zinc-200 text-zinc-400 text-xs font-bold">등록된 플레이스가 없습니다.</div>}
          </div>
          <button disabled={isLoading} type="submit" className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50">
            {isLoading ? '등록 중...' : '테마 만들기'}
          </button>
          <p className="text-[9px] text-center text-zinc-400">광고, 홍보 그리고 주제와 맞지 않는 플레이스 등은 임의로 삭제될 수 있습니다.</p>
        </form>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50 relative">
      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-32 no-scrollbar">
        {/* Top 5 랭킹 */}
        {top5.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-black text-zinc-900 tracking-tight mb-4 flex items-center gap-2"><Heart className="text-rose-500" size={18} /> 인기 테마 TOP 5</h2>
            <div className="space-y-4">
              {top5.map((theme: any, idx: number) => (
                <Fragment key={theme.id}>
                <div onClick={() => setSelectedTheme(theme)} className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm space-y-4 cursor-pointer hover:border-blue-200 transition-all group relative overflow-hidden">
                  <div className="absolute -left-1 -top-1 w-8 h-8 bg-blue-500 text-white text-[10px] font-black rounded-br-2xl flex items-center justify-center shadow-lg z-10">
                    {idx + 1}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-100 flex-shrink-0 bg-zinc-50">
                      <img
                        src={theme.user_image || `https://picsum.photos/seed/u${theme.id}/200`}
                        className="w-full h-full object-cover"
                        alt={theme.user_name || ''}
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/u${theme.id}/200`; }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[10px] font-bold text-zinc-900 truncate">{theme.user_name || '아무개'}</p>
                        <span className="text-[7px] font-black px-1.5 py-0.5 rounded uppercase border bg-blue-50 text-blue-600 border-blue-100">테마</span>
                      </div>
                    </div>
                    <button onClick={(e) => toggleThemeLike(e, theme.id)} className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100 hover:bg-rose-50 transition-all">
                      <Heart size={14} className="text-zinc-300" />
                      <span className="text-[10px] font-black text-zinc-400">{theme.like_count}</span>
                    </button>
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-zinc-900 text-sm tracking-tight group-hover:text-blue-600 transition-colors">{theme.title}</h4>
                    <p className="text-[11px] text-zinc-500 line-clamp-1">{theme.description}</p>
                  </div>
                </div>
                {idx === 2 && (
                  <div className="border-y border-zinc-100 py-2">
                    <AdUnit slotId="8058413094" />
                  </div>
                )}
                </Fragment>
              ))}
            </div>
          </div>
        )}

        {/* 최신 테마 */}
        {latest.length > 0 && (
          <div>
            <h2 className="text-sm font-black text-zinc-400 uppercase tracking-widest mb-4">최신 테마</h2>
            <div className="space-y-4">
              {latest.map((theme: any) => (
                <div key={theme.id} onClick={() => setSelectedTheme(theme)} className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm cursor-pointer hover:border-blue-200 transition-all flex items-center gap-4 group">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-zinc-100 flex-shrink-0 bg-zinc-50">
                    <img
                      src={theme.user_image || `https://picsum.photos/seed/u${theme.id}/200`}
                      className="w-full h-full object-cover"
                      alt={theme.user_name || ''}
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/u${theme.id}/200`; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-zinc-900 text-sm tracking-tight line-clamp-1 group-hover:text-blue-600 transition-colors">{theme.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold text-zinc-400 truncate">{theme.user_name || '아무개'}</span>
                      <span className="text-[9px] font-black text-zinc-300 ml-auto flex items-center gap-1"><Heart size={10} /> {theme.like_count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Floating Create Button */}
      <button onClick={() => { if(!user) return signInWithGoogle(); setIsCreating(true); }} className="fixed bottom-28 left-6 w-12 h-12 bg-blue-500 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-blue-600 transition-all z-40">
        <Plus size={24} />
      </button>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedTheme && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedTheme(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTheme.user_image || `https://picsum.photos/seed/u${selectedTheme.id}/200`}
                    className="w-10 h-10 rounded-full border border-zinc-100 bg-zinc-50 object-cover"
                    alt={selectedTheme.user_name || ''}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/u${selectedTheme.id}/200`; }}
                  />
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedTheme.title}</h3>
                    <p className="text-xs text-zinc-400 font-bold uppercase">{(selectedTheme.user_name || '아무개')}의 테마</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(user?.id === selectedTheme.user_id || user?.email === 'nemonecoltd@gmail.com') && (
                    <button 
                      onClick={(e) => handleDeleteTheme(e, selectedTheme.id, selectedTheme.user_id)} 
                      className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
                      title="테마 삭제"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
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