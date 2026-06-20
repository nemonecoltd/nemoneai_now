"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Trash2, Edit, ExternalLink, MapPin, Image as ImageIcon, X, Plus, Loader2, ShieldCheck, Users, Route, MapPin as MapPinIcon, Palette, ChevronDown, ChevronUp, Pin } from 'lucide-react';

interface Place {
  id: number;
  title: string;
  content: string;
  location: string;
  image_url: string;
  latitude?: number;
  longitude?: number;
  date_range?: string;
  region?: string;
  pinned_at?: string | null;
}

interface Theme {
  id: number;
  title: string;
  description: string;
  places: any[];
  region: string;
  user_id: string;
  user_name: string;
  user_image?: string;
  like_count: number;
  created_at: string;
}

interface AdminStats {
  total_users: number;
  total_courses: number;
  total_places: number;
}

type Region = '성수' | '홍대' | '공연' | '제주' | '축제';
type ViewMode = 'spots' | 'themes';

export default function AdminPage() {
  const { user, signInWithGoogle, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<ViewMode>('spots');
  const [places, setPlaces] = useState<Place[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [region, setRegion] = useState<Region>('성수');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Place> & { region?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [expandedThemeId, setExpandedThemeId] = useState<number | null>(null);
  const [editingThemeId, setEditingThemeId] = useState<number | null>(null);
  const [themeEditForm, setThemeEditForm] = useState<{ title: string; description: string }>({ title: '', description: '' });
  const [addingPlaceThemeId, setAddingPlaceThemeId] = useState<number | null>(null);
  const [placeSearchTerm, setPlaceSearchTerm] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState<any[]>([]);
  const [allPlacesCache, setAllPlacesCache] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      signInWithGoogle();
    } else if (user && user.email !== 'nemonecoltd@gmail.com') {
      alert('관리자 권한이 없습니다.');
      router.push('/');
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user?.email === 'nemonecoltd@gmail.com') {
      fetchAdminStats();
      if (viewMode === 'spots') {
        fetchPlaces();
      } else if (viewMode === 'themes') {
        fetchThemes();
      }
    }
  }, [user, region, viewMode]);

  const fetchAdminStats = async () => {
    const res = await fetch('/api-now/admin/stats');
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  };

  const fetchThemes = async () => {
    const res = await fetch('/api-now/admin/themes');
    if (res.ok) setThemes(await res.json());
  };

  const openAddPlace = async (themeId: number) => {
    setAddingPlaceThemeId(themeId);
    setPlaceSearchTerm('');
    setPlaceSearchResults([]);
    if (allPlacesCache.length === 0) {
      const res = await fetch('/api-now/places');
      if (res.ok) setAllPlacesCache(await res.json());
    }
  };

  const handlePlaceSearch = (term: string) => {
    setPlaceSearchTerm(term);
    if (!term.trim()) { setPlaceSearchResults([]); return; }
    setPlaceSearchResults(
      allPlacesCache.filter(p => p.title?.includes(term) || p.location?.includes(term)).slice(0, 8)
    );
  };

  const addPlaceToTheme = async (theme: Theme, place: any) => {
    const newPlace: any = {
      title: place.title,
      location: place.location || '',
      content: place.content || '',
    };
    if (place.image_url) newPlace.image_url = place.image_url;
    if (place.video_url) newPlace.video_url = place.video_url;
    if (place.date_range) newPlace.date_range = place.date_range;

    const updatedPlaces = [...(Array.isArray(theme.places) ? theme.places : []), newPlace];
    await fetch(`/api-now/admin/themes/${theme.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ places: updatedPlaces }),
    });
    setAddingPlaceThemeId(null);
    setPlaceSearchTerm('');
    setPlaceSearchResults([]);
    fetchThemes();
  };

  const fetchPlaces = async () => {
    const res = await fetch(`/api-now/places?region=${encodeURIComponent(region)}`);
    if (res.ok) {
      const data = await res.json();
      setPlaces(data);
    }
  };

  const handleEdit = (place: Place) => {
    setEditingId(place.id);
    setEditForm({ ...place, pinned: !!place.pinned_at } as any);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        setEditingId(null);
        fetchPlaces();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, region: editForm.region || region }),
      });
      if (res.ok) {
        setIsCreating(false);
        setEditForm({});
        fetchPlaces();
      } else {
        alert('등록에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const res = await fetch(`/api-now/places/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) fetchPlaces();
  };


  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="animate-spin text-emerald-500" /></div>;
  if (user?.email !== 'nemonecoltd@gmail.com') return null;

  return (
    <div className="min-h-screen bg-zinc-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-end mb-8">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <ShieldCheck size={18} />
              <span className="text-[10px] font-black uppercase tracking-widest">Admin Control Panel</span>
            </div>
            <h1 className="text-3xl font-bold text-zinc-900">지금 여기 관리자 <span className="text-emerald-500">.</span></h1>
            
            <div className="flex items-center gap-6 mt-6 border-b border-zinc-200">
              <div className="flex items-center gap-4">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">스팟 데이터</span>
                {(['성수', '홍대', '공연', '제주', '축제'] as Region[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setViewMode('spots');
                      setRegion(r);
                    }}
                    className={`text-sm font-bold transition-all px-2 pb-2 border-b-2 -mb-[1px] ${
                      viewMode === 'spots' && region === r ? "text-emerald-600 border-emerald-500" : "text-zinc-400 border-transparent hover:text-zinc-600"
                    }`}
                  >
                    {r === '성수' ? 'SEONGSU' : r === '홍대' ? 'HONGDAE' : r === '공연' ? 'CONCERT' : r === '제주' ? 'JEJU' : 'FESTIVAL'}
                  </button>
                ))}
              </div>
              
              <div className="w-px h-4 bg-zinc-300 mb-1"></div>

              <div className="flex items-center">
                <button
                  onClick={() => setViewMode('themes')}
                  className={`flex items-center gap-1.5 text-sm font-bold transition-all px-2 pb-2 border-b-2 -mb-[1px] ${
                    viewMode === 'themes' ? "text-emerald-600 border-emerald-500" : "text-zinc-400 border-transparent hover:text-zinc-600"
                  }`}
                >
                  <Palette size={16} /> 테마
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/" className="px-6 py-3 bg-white text-zinc-900 border border-zinc-200 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-all shadow-sm">
              서비스 홈
            </Link>
            {viewMode === 'spots' && (
              <button 
                onClick={() => {
                  setIsCreating(true);
                  setEditingId(null);
                  setEditForm({});
                }}
                className="bg-zinc-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg"
              >
                <Plus size={20} /> 새 장소 등록
              </button>
            )}
          </div>
        </header>

        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Users size={24} />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">총 유저수</div>
                <div className="text-2xl font-black text-zinc-900">{(stats?.total_users ?? 0).toLocaleString()}명</div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                <Route size={24} />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">생성된 코스</div>
                <div className="text-2xl font-black text-zinc-900">{(stats?.total_courses ?? 0).toLocaleString()}개</div>
              </div>
            </div>
            <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center">
                <MapPinIcon size={24} />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">등록된 장소</div>
                <div className="text-2xl font-black text-zinc-900">{(stats?.total_places ?? 0).toLocaleString()}곳</div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'spots' ? (
          <div className="grid gap-6">
            {isCreating && (
              <div className="bg-white border border-emerald-500 rounded-3xl p-6 shadow-md flex gap-6 items-start">
                <div className="w-32 h-32 rounded-2xl bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-100">
                  {editForm.image_url ? (
                    <img src={editForm.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300"><ImageIcon size={32} /></div>
                  )}
                </div>
                <div className="flex-grow space-y-2">
                    <div className="grid gap-4 bg-zinc-50 p-6 rounded-2xl border border-emerald-100">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">장소명</label>
                          <input 
                            type="text" 
                            value={editForm.title || ''} 
                            onChange={e => setEditForm({...editForm, title: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">주소 (Geocoding 대상)</label>
                          <input 
                            type="text" 
                            value={editForm.location || ''} 
                            onChange={e => setEditForm({...editForm, location: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">상세 내용 (RAG 리소스)</label>
                        <textarea 
                          rows={3}
                          value={editForm.content || ''} 
                          onChange={e => setEditForm({...editForm, content: e.target.value})}
                          className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">카테고리 (Region)</label>
                          <select
                            value={editForm.region || region}
                            onChange={e => setEditForm({...editForm, region: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          >
                            {(['성수', '홍대', '공연', '제주', '축제'] as Region[]).map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">이미지 URL</label>
                          <input
                            type="text"
                            value={editForm.image_url || ''}
                            onChange={e => setEditForm({...editForm, image_url: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">운영 일시</label>
                          <input
                            type="text"
                            value={editForm.date_range || ''}
                            onChange={e => setEditForm({...editForm, date_range: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-zinc-400 font-bold text-sm">취소</button>
                        <button
                          onClick={handleCreate}
                          disabled={isLoading}
                          className="bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-600 disabled:opacity-50"
                        >
                          <Plus size={16} /> {isLoading ? '저장 중...' : '신규 장소 등록'}
                        </button>
                      </div>
                    </div>
                </div>
              </div>
            )}
            {places.map((place) => (
              <div key={place.id} className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex gap-6 items-start transition-all hover:border-emerald-200">
                <div className="w-32 h-32 rounded-2xl bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-100">
                  {place.image_url ? (
                    <img src={place.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300"><ImageIcon size={32} /></div>
                  )}
                </div>

                <div className="flex-grow space-y-2">
                  {editingId === place.id ? (
                    <div className="grid gap-4 bg-zinc-50 p-6 rounded-2xl border border-emerald-100">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">장소명</label>
                          <input 
                            type="text" 
                            value={editForm.title || ''} 
                            onChange={e => setEditForm({...editForm, title: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">주소 (Geocoding 대상)</label>
                          <input 
                            type="text" 
                            value={editForm.location || ''} 
                            onChange={e => setEditForm({...editForm, location: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">상세 내용 (RAG 리소스)</label>
                        <textarea 
                          rows={3}
                          value={editForm.content || ''} 
                          onChange={e => setEditForm({...editForm, content: e.target.value})}
                          className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">카테고리 (Region)</label>
                          <select
                            value={editForm.region || region}
                            onChange={e => setEditForm({...editForm, region: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          >
                            {(['성수', '홍대', '공연', '제주', '축제'] as Region[]).map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">이미지 URL</label>
                          <input
                            type="text"
                            value={editForm.image_url || ''}
                            onChange={e => setEditForm({...editForm, image_url: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">운영 일시</label>
                          <input
                            type="text"
                            value={editForm.date_range || ''}
                            onChange={e => setEditForm({...editForm, date_range: e.target.value})}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!(editForm as any).pinned}
                            onChange={e => setEditForm({...editForm, pinned: e.target.checked} as any)}
                            className="w-4 h-4 accent-emerald-500"
                          />
                          <span className="text-xs font-bold text-zinc-600 flex items-center gap-1">
                            <Pin size={12} /> 최상단 고정
                          </span>
                        </label>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingId(null)} className="px-4 py-2 text-zinc-400 font-bold text-sm">취소</button>
                          <button
                            onClick={handleUpdate}
                            disabled={isLoading}
                            className="bg-emerald-500 text-white px-6 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-emerald-600 disabled:opacity-50"
                          >
                            <Save size={16} /> {isLoading ? '저장 중...' : '보정 내용 저장'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-zinc-900">{place.title}</h3>
                        <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">ID: {place.id}</span>
                        {place.pinned_at && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <Pin size={10} /> 고정
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                        <MapPin size={12} /> {place.location || '위치 정보 없음'}
                      </div>
                      <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed font-medium">{place.content}</p>
                      <div className="flex gap-4 pt-4">
                        <button onClick={() => handleEdit(place)} className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-emerald-600 transition-colors bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-100">
                          <Edit size={14} /> 데이터 수정
                        </button>
                        <button onClick={() => handleDelete(place.id)} className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-rose-500 transition-colors px-3 py-1.5">
                          <Trash2 size={14} /> 삭제
                        </button>
                        <a href={`http://localhost:3000/posts/${place.id}`} target="_blank" className="ml-auto flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors">
                          <ExternalLink size={14} /> 실제 화면 보기
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <Palette size={20} className="text-emerald-500" /> 전체 테마 ({themes.length}개)
              </h3>
            </div>
            {themes.length === 0 && (
              <div className="bg-white border border-zinc-200 rounded-3xl p-12 text-center text-zinc-400 font-medium">
                등록된 테마가 없습니다.
              </div>
            )}
            {themes.map((theme) => {
              const places = Array.isArray(theme.places) ? theme.places : [];
              const isExpanded = expandedThemeId === theme.id;
              const isEditing = editingThemeId === theme.id;
              return (
                <div key={theme.id} className="bg-white border border-zinc-200 rounded-3xl shadow-sm overflow-hidden">
                  <div className="p-5 flex items-start gap-4">
                    {theme.user_image ? (
                      <img src={theme.user_image} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 font-bold flex-shrink-0">
                        {theme.user_name?.[0] || 'U'}
                      </div>
                    )}
                    <div className="flex-grow min-w-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={themeEditForm.title}
                            onChange={e => setThemeEditForm(f => ({ ...f, title: e.target.value }))}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-emerald-500"
                          />
                          <textarea
                            rows={2}
                            value={themeEditForm.description}
                            onChange={e => setThemeEditForm(f => ({ ...f, description: e.target.value }))}
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                setIsLoading(true);
                                const res = await fetch(`/api-now/admin/themes/${theme.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(themeEditForm),
                                });
                                if (res.ok) { setEditingThemeId(null); fetchThemes(); }
                                setIsLoading(false);
                              }}
                              disabled={isLoading}
                              className="bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-600 disabled:opacity-50"
                            >
                              <Save size={12} /> 저장
                            </button>
                            <button onClick={() => setEditingThemeId(null)} className="px-4 py-1.5 text-zinc-400 font-bold text-xs">취소</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-zinc-900 text-sm">{theme.title}</h4>
                            <span className="text-[10px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">ID: {theme.id}</span>
                            <span className="text-[10px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">{theme.region}</span>
                            <span className="text-[10px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">❤️ {theme.like_count}</span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">{theme.description}</p>
                          <p className="text-[10px] text-zinc-400 mt-1">작성자: {theme.user_name} · {places.length}개 장소 · {new Date(theme.created_at).toLocaleDateString('ko-KR')}</p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!isEditing && (
                        <button
                          onClick={() => { setEditingThemeId(theme.id); setThemeEditForm({ title: theme.title, description: theme.description }); }}
                          className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="수정"
                        >
                          <Edit size={15} />
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm(`"${theme.title}" 테마를 삭제하시겠습니까?`)) return;
                          await fetch(`/api-now/admin/themes/${theme.id}`, { method: 'DELETE' });
                          fetchThemes();
                        }}
                        className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                      <button
                        onClick={() => setExpandedThemeId(isExpanded ? null : theme.id)}
                        className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 rounded-lg transition-colors"
                        title="장소 목록 보기"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-zinc-100 px-5 py-4 bg-zinc-50">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">포함 장소 ({places.length}개)</p>
                        <button
                          onClick={() => addingPlaceThemeId === theme.id ? setAddingPlaceThemeId(null) : openAddPlace(theme.id)}
                          className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <Plus size={12} /> 장소 추가
                        </button>
                      </div>

                      {addingPlaceThemeId === theme.id && (
                        <div className="mb-3 bg-white rounded-xl border border-zinc-200 p-3 space-y-2">
                          <input
                            type="text"
                            value={placeSearchTerm}
                            onChange={e => handlePlaceSearch(e.target.value)}
                            placeholder="장소명 또는 주소 검색..."
                            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                            autoFocus
                          />
                          {placeSearchResults.length > 0 && (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {placeSearchResults.map((p: any) => (
                                <button
                                  key={p.id}
                                  onClick={() => addPlaceToTheme(theme, p)}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-emerald-50 transition-colors text-left"
                                >
                                  {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" referrerPolicy="no-referrer" />}
                                  <div className="min-w-0">
                                    <p className="text-sm font-bold text-zinc-800 truncate">{p.title}</p>
                                    {p.location && <p className="text-xs text-zinc-400 truncate">{p.location}</p>}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                          {placeSearchTerm && placeSearchResults.length === 0 && (
                            <p className="text-xs text-zinc-400 text-center py-2">검색 결과 없음</p>
                          )}
                        </div>
                      )}

                      {places.length === 0 ? (
                        <p className="text-xs text-zinc-400 text-center py-2">장소 없음</p>
                      ) : (
                        <div className="grid gap-2">
                          {places.map((p: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 bg-white rounded-xl px-4 py-2.5 border border-zinc-100">
                              {p.image_url && <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" referrerPolicy="no-referrer" />}
                              <div className="flex-grow min-w-0">
                                <p className="text-sm font-bold text-zinc-800">{p.title}</p>
                                {p.location && <p className="text-xs text-zinc-400">{p.location}</p>}
                              </div>
                              <button
                                onClick={async () => {
                                  if (!confirm(`"${p.title}" 장소를 이 테마에서 삭제하시겠습니까?`)) return;
                                  const newPlaces = places.filter((_: any, idx: number) => idx !== i);
                                  await fetch(`/api-now/admin/themes/${theme.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ places: newPlaces }),
                                  });
                                  fetchThemes();
                                }}
                                className="p-1.5 text-zinc-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors flex-shrink-0"
                                title="이 장소 삭제"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}