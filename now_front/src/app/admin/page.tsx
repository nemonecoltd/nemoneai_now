"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Trash2, Edit, ExternalLink, MapPin, Image as ImageIcon, X, Plus, Loader2, ShieldCheck, Users, BarChart3, Map, MapPinned, Route, MapPin as MapPinIcon } from 'lucide-react';

interface Place {
  id: number;
  title: string;
  content: string;
  location: string;
  image_url: string;
  latitude?: number;
  longitude?: number;
  date_range?: string;
}

interface User {
  email: string;
  name: string;
  image_url: string;
  gender?: string;
  age?: string;
  nationality?: string;
  created_at: string;
}

interface AdminStats {
  total_users: number;
  total_courses: number;
  total_places: number;
}

type Region = '성수' | '홍대' | '공연' | '제주' | '축제';
type ViewMode = 'spots' | 'users';

export default function AdminPage() {
  const { user, signInWithGoogle, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<ViewMode>('spots');
  const [places, setPlaces] = useState<Place[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [region, setRegion] = useState<Region>('성수');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Place>>({});
  const [isLoading, setIsLoading] = useState(false);

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
      } else if (viewMode === 'users') {
        fetchUsers();
      }
    }
  }, [user, region, viewMode, userPage]);

  const fetchAdminStats = async () => {
    const res = await fetch('/api-now/admin/stats');
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  };

  const fetchUsers = async () => {
    const res = await fetch(`/api-now/admin/users?page=${userPage}&limit=25`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
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
    setEditForm(place);
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
        body: JSON.stringify({ ...editForm, region }),
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

  const handleDeleteUser = async (email: string) => {
    if (!confirm('해당 사용자를 정말 삭제하시겠습니까? 관련 데이터는 유지되거나 고아가 될 수 있습니다.')) return;
    try {
      const res = await fetch(`/api-now/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        alert('사용자가 삭제되었습니다.');
        fetchUsers();
      } else {
        alert('사용자 삭제에 실패했습니다.');
      }
    } catch (e) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
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
                  onClick={() => setViewMode('users')}
                  className={`flex items-center gap-1.5 text-sm font-bold transition-all px-2 pb-2 border-b-2 -mb-[1px] ${
                    viewMode === 'users' ? "text-emerald-600 border-emerald-500" : "text-zinc-400 border-transparent hover:text-zinc-600"
                  }`}
                >
                  <Users size={16} /> 사용자
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
                      <div className="grid grid-cols-2 gap-4">
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
                      <div className="grid grid-cols-2 gap-4">
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
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-bold text-zinc-900">{place.title}</h3>
                        <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">ID: {place.id}</span>
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
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <Users size={20} className="text-emerald-500" /> 회원가입 유저 리스트
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] text-zinc-400 uppercase tracking-widest bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 rounded-l-xl font-bold">유저명</th>
                    <th className="px-4 py-3 font-bold">이메일</th>
                    <th className="px-4 py-3 font-bold">성별</th>
                    <th className="px-4 py-3 font-bold">연령대</th>
                    <th className="px-4 py-3 font-bold">국적</th>
                    <th className="px-4 py-3 rounded-r-xl font-bold text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {users.map((user) => (
                    <tr key={user.email} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-4 font-bold text-zinc-900 flex items-center gap-3">
                        {user.image_url ? (
                          <img src={user.image_url} alt="" className="w-8 h-8 rounded-full bg-zinc-100 object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 font-bold">
                            {user.name?.[0] || 'U'}
                          </div>
                        )}
                        {user.name || '이름 없음'}
                      </td>
                      <td className="px-4 py-4 text-zinc-500">{user.email}</td>
                      <td className="px-4 py-4 text-zinc-500">{user.gender === 'male' ? '남성' : user.gender === 'female' ? '여성' : user.gender === 'other' ? '기타' : '-'}</td>
                      <td className="px-4 py-4 text-zinc-500">{user.age === '10s' ? '10대' : user.age === '20s' ? '20대' : user.age === '30s' ? '30대' : user.age === '40s' ? '40대 이상' : '-'}</td>
                      <td className="px-4 py-4 text-zinc-500">{user.nationality || '-'}</td>
                      <td className="px-4 py-4 text-center">
                        <button 
                          onClick={() => handleDeleteUser(user.email)} 
                          className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-block"
                          title="사용자 삭제"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-zinc-400 font-medium">유저 데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-center items-center gap-4 mt-8">
              <button 
                onClick={() => setUserPage(p => Math.max(1, p - 1))}
                disabled={userPage === 1}
                className="px-4 py-2 text-sm font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-zinc-100 transition-colors"
              >
                이전 페이지
              </button>
              <span className="text-sm font-bold text-zinc-900">
                {userPage} 페이지
              </span>
              <button 
                onClick={() => setUserPage(p => p + 1)}
                disabled={users.length < 25}
                className="px-4 py-2 text-sm font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 disabled:opacity-50 disabled:hover:bg-zinc-100 transition-colors"
              >
                다음 페이지
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}