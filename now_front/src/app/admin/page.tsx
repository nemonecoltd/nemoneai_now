"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Trash2, Edit, ExternalLink, MapPin, Image as ImageIcon, X, Plus, Loader2, ShieldCheck, Users, Route, MapPin as MapPinIcon, Palette, ChevronDown, ChevronUp, Pin, Upload, HardDrive, Download } from 'lucide-react';

const compressPlaceImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIMENSION = 1000;
        let { width, height } = img;
        if (width > height && width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        } else if (height >= width && height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/webp', 0.8);
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

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
  naver_place_id?: string;
  created_at?: string;
  updated_at?: string | null;
  link_url?: string | null;
  link_title?: string | null;
  blog_reviews?: { title: string; url: string; thumbnail?: string }[] | null;
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
  storage_used_bytes?: number;
  storage_limit_bytes?: number;
  storage_percent?: number;
}

type Region = '성수' | '홍대' | '용산' | '강남' | '공연' | '제주' | '축제';
type ViewMode = 'spots' | 'themes' | 'ranking';

export default function AdminPage() {
  const { user, signInWithGoogle, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [viewMode, setViewMode] = useState<ViewMode>('ranking');
  const [places, setPlaces] = useState<Place[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [region, setRegion] = useState<Region>('성수');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Place> & { region?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [enriched, setEnriched] = useState<{placeId: number; reviews: {title: string; url: string}[]} | null>(null);
  const [placeSearch, setPlaceSearch] = useState('');
  const placeSamplePool = useMemo(() => {
    const shuffled = [...places].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 10);
  }, [places]);
  const placesLastUpdated = useMemo(() => {
    let latest: string | null = null;
    for (const p of places) {
      const d = p.updated_at || p.created_at;
      if (d && (!latest || d > latest)) latest = d;
    }
    return latest;
  }, [places]);
  const [weeklyRanking, setWeeklyRanking] = useState<{id: number; title: string; image_url: string; region: string; naver_place_id: string; view_count: number; updated_at?: string | null; date_range?: string | null}[]>([]);
  const [bannerText, setBannerText] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [savingBanner, setSavingBanner] = useState(false);
  const [downloadingRanking, setDownloadingRanking] = useState(false);
  const [enrichingRankId, setEnrichingRankId] = useState<number | null>(null);
  const [expandedThemeId, setExpandedThemeId] = useState<number | null>(null);
  const [editingThemeId, setEditingThemeId] = useState<number | null>(null);
  const [themeEditForm, setThemeEditForm] = useState<{ title: string; description: string }>({ title: '', description: '' });
  const [addingPlaceThemeId, setAddingPlaceThemeId] = useState<number | null>(null);
  const [newPlaceForm, setNewPlaceForm] = useState<{ title: string; location: string; content: string; image_url: string; video_url: string; date_range: string }>({
    title: '', location: '', content: '', image_url: '', video_url: '', date_range: '',
  });
  const [editingPlace, setEditingPlace] = useState<{ themeId: number; index: number } | null>(null);
  const [editPlaceForm, setEditPlaceForm] = useState<{ title: string; location: string; content: string; image_url: string; video_url: string; date_range: string }>({
    title: '', location: '', content: '', image_url: '', video_url: '', date_range: '',
  });
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handlePlaceImageUpload = async (file: File, onUploaded: (url: string) => void) => {
    setIsUploadingImage(true);
    try {
      const compressedBlob = await compressPlaceImage(file);
      const formData = new FormData();
      formData.append('file', compressedBlob, 'upload.webp');
      const res = await fetch('/api-now/places/upload-image', { method: 'POST', body: formData });
      if (!res.ok) {
        alert('이미지 업로드에 실패했습니다.');
        return;
      }
      const { url } = await res.json();
      onUploaded(url);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // localhost뿐 아니라 Tailscale(사설망, 100.64.0.0/10)/루프백으로 접속한 경우도
  // 로컬 신뢰 접속으로 보고 로그인 검사를 건너뜀 — 어차피 외부에 노출 안 되는 사설 접속
  const [isLocalDev, setIsLocalDev] = useState(false);
  useEffect(() => {
    const host = window.location.hostname;
    setIsLocalDev(host === 'localhost' || host === '127.0.0.1' || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host));
  }, []);

  useEffect(() => {
    if (isLocalDev) return;
    if (!authLoading && !user) {
      signInWithGoogle();
    } else if (user && user.email !== 'nemonecoltd@gmail.com') {
      alert('관리자 권한이 없습니다.');
      router.push('/');
    }
  }, [authLoading, user, router, isLocalDev]);

  useEffect(() => {
    if (isLocalDev || user?.email === 'nemonecoltd@gmail.com') {
      fetchAdminStats();
      fetchWeeklyRanking();
      fetchBanner();
      if (viewMode === 'spots') {
        fetchPlaces();
      } else if (viewMode === 'themes') {
        fetchThemes();
      }
    }
  }, [user, region, viewMode, isLocalDev]);

  const fetchBanner = async () => {
    const res = await fetch('/api-now/banner');
    if (res.ok) {
      const data = await res.json();
      setBannerText(data.text || '');
      setBannerUrl(data.url || '');
    }
  };

  const handleSaveBanner = async () => {
    setSavingBanner(true);
    try {
      const res = await fetch('/api-now/admin/banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: bannerText, url: bannerUrl }),
      });
      if (res.ok) {
        alert(bannerText.trim() ? '배너가 갱신되었습니다.' : '배너가 비워져 더 이상 노출되지 않습니다.');
      } else {
        alert('배너 저장 실패');
      }
    } catch (e) {
      alert('배너 저장 실패');
      console.error(e);
    } finally {
      setSavingBanner(false);
    }
  };

  const fetchAdminStats = async () => {
    const res = await fetch('/api-now/admin/stats');
    if (res.ok) {
      const data = await res.json();
      setStats(data);
    }
  };

  const fetchWeeklyRanking = async () => {
    const res = await fetch('/api-now/admin/ranking/weekly');
    if (res.ok) setWeeklyRanking(await res.json());
  };

  const handleDownloadRanking = async () => {
    setDownloadingRanking(true);
    try {
      const res = await fetch('/api-now/admin/ranking/weekly7d');
      if (!res.ok) { alert('7일 랭킹 조회 실패'); return; }
      const data: typeof weeklyRanking = await res.json();

      const escapeCsv = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
      const rows = [
        ['순위', '제목', 'URL', '썸네일URL', '운영기간'],
        ...data.map((item, idx) => {
          const img = item.image_url
            ? (item.image_url.startsWith('http') ? item.image_url : `https://now.nemoneai.com${item.image_url}`)
            : '';
          return [String(idx + 1), item.title, `https://now.nemoneai.com/posts/${item.id}`, img, item.date_range || '상시 운영'];
        }),
      ];
      const csv = '﻿' + rows.map(r => r.map(escapeCsv).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `now_ranking_weekly7d_top${data.length}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingRanking(false);
    }
  };

  const handleEnrichRanking = async (placeId: number) => {
    setEnrichingRankId(placeId);
    try {
      const res = await fetch(`/api-now/places/${placeId}/enrich`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        alert(`✅ ${data.blog_reviews?.length ?? 0}개 블로그 후기 업데이트 완료`);
      } else {
        alert('실패');
      }
    } catch {
      alert('네트워크 오류');
    } finally {
      setEnrichingRankId(null);
    }
  };

  const fetchThemes = async () => {
    const res = await fetch('/api-now/admin/themes');
    if (res.ok) setThemes(await res.json());
  };

  const openAddPlace = (themeId: number) => {
    setAddingPlaceThemeId(themeId);
    setNewPlaceForm({ title: '', location: '', content: '', image_url: '', video_url: '', date_range: '' });
  };

  const savePlaceEdit = async (theme: Theme) => {
    if (!editPlaceForm.title.trim() || !editPlaceForm.location.trim() || !editPlaceForm.content.trim()) {
      alert('이름, 주소, 설명은 필수입니다.');
      return;
    }
    const updated = [...theme.places];
    const updatedPlace: any = {
      title: editPlaceForm.title.trim(),
      location: editPlaceForm.location.trim(),
      content: editPlaceForm.content.trim(),
    };
    if (editPlaceForm.image_url.trim()) updatedPlace.image_url = editPlaceForm.image_url.trim();
    if (editPlaceForm.video_url.trim()) updatedPlace.video_url = editPlaceForm.video_url.trim();
    if (editPlaceForm.date_range.trim()) updatedPlace.date_range = editPlaceForm.date_range.trim();
    updated[editingPlace!.index] = updatedPlace;

    setIsLoading(true);
    await fetch(`/api-now/admin/themes/${theme.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ places: updated }),
    });
    setIsLoading(false);
    setEditingPlace(null);
    fetchThemes();
  };

  const addPlaceToTheme = async (theme: Theme) => {
    if (!newPlaceForm.title.trim() || !newPlaceForm.location.trim() || !newPlaceForm.content.trim()) {
      alert('이름, 주소, 설명은 필수입니다.');
      return;
    }
    const newPlace: any = {
      title: newPlaceForm.title.trim(),
      location: newPlaceForm.location.trim(),
      content: newPlaceForm.content.trim(),
    };
    if (newPlaceForm.image_url.trim()) newPlace.image_url = newPlaceForm.image_url.trim();
    if (newPlaceForm.video_url.trim()) newPlace.video_url = newPlaceForm.video_url.trim();
    if (newPlaceForm.date_range.trim()) newPlace.date_range = newPlaceForm.date_range.trim();

    const updatedPlaces = [...(Array.isArray(theme.places) ? theme.places : []), newPlace];
    setIsLoading(true);
    await fetch(`/api-now/admin/themes/${theme.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ places: updatedPlaces }),
    });
    setIsLoading(false);
    setAddingPlaceThemeId(null);
    fetchThemes();
  };

  const fetchPlaces = async () => {
    const res = await fetch(`/api-now/admin/places?region=${encodeURIComponent(region)}`);
    if (res.ok) {
      const data = await res.json();
      setPlaces(data);
    }
  };

  const handleEdit = (place: Place) => {
    setEditingId(place.id);
    setEditForm({ ...place, pinned: !!place.pinned_at } as any);
    if (place.blog_reviews && place.blog_reviews.length > 0) {
      setEnriched({ placeId: place.id, reviews: place.blog_reviews });
    } else {
      setEnriched(null);
    }
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

  const handleEnrich = async () => {
    if (!editingId) return;
    setIsEnriching(true);
    setEnriched(null);
    try {
      const res = await fetch(`/api-now/places/${editingId}/enrich`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setEditForm(prev => ({ ...prev, content: data.content }));
        if ((data.blog_reviews || []).length > 0) {
          setEnriched({ placeId: editingId, reviews: data.blog_reviews });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`실패: ${err.detail || res.statusText}`);
      }
    } catch (e) {
      alert('네트워크 오류');
    } finally {
      setIsEnriching(false);
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


  if (!isLocalDev && authLoading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50"><Loader2 className="animate-spin text-emerald-500" /></div>;
  if (!isLocalDev && user?.email !== 'nemonecoltd@gmail.com') return null;

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
                <button
                  onClick={() => setViewMode('ranking')}
                  className={`text-sm font-bold transition-all px-2 pb-2 border-b-2 -mb-[1px] ${
                    viewMode === 'ranking' ? "text-amber-500 border-amber-400" : "text-zinc-400 border-transparent hover:text-zinc-600"
                  }`}
                >
                  📊 TOP 25
                </button>
                <div className="w-px h-4 bg-zinc-300 mb-1"></div>
                {(['성수', '홍대', '용산', '강남', '공연', '제주', '축제'] as Region[]).map((r) => (
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
                    {r === '성수' ? 'SEONGSU' : r === '홍대' ? 'HONGDAE' : r === '용산' ? 'YONGSAN' : r === '강남' ? 'GANGNAM' : r === '공연' ? 'CONCERT' : r === '제주' ? 'JEJU' : 'FESTIVAL'}
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
          <div className="grid grid-cols-4 gap-4 mb-8">
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
            <div className="bg-white p-5 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                <HardDrive size={24} />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest">스토리지 사용량</div>
                <div className="text-2xl font-black text-zinc-900">
                  {(stats?.storage_percent ?? 0).toFixed(1)}%
                  <span className="text-xs font-bold text-zinc-400 ml-1">
                    ({((stats?.storage_used_bytes ?? 0) / 1024 / 1024).toFixed(1)}MB)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === 'ranking' && (
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base font-black text-zinc-900">📣 플레이스 페이지 상단 공지 배너</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">전체 페이지 공통 · 수동 운영</span>
            </div>
            <p className="text-[11px] text-zinc-400 mb-3">텍스트를 비우고 갱신하면 배너가 사라집니다.</p>
            <div className="flex flex-col sm:flex-row gap-2 mb-6">
              <input
                type="text"
                value={bannerText}
                onChange={(e) => setBannerText(e.target.value)}
                placeholder="공지/기사 제목 (예: 성수 팝업 완전정복 가이드 — 맛매치에서 보기)"
                className="flex-[2] px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-400"
              />
              <input
                type="text"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://nemoneai.com/posts/155"
                className="flex-[1.5] px-3 py-2 text-sm border border-zinc-200 rounded-xl focus:outline-none focus:border-emerald-400"
              />
              <button
                onClick={handleSaveBanner}
                disabled={savingBanner}
                className="px-4 py-2 text-sm font-bold bg-zinc-900 text-white rounded-xl hover:bg-zinc-700 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {savingBanner ? '저장 중...' : '갱신'}
              </button>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-base font-black text-zinc-900">📊 조회수 TOP {weeklyRanking.length}</span>
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest ml-1">최근 48시간</span>
              <button
                onClick={handleDownloadRanking}
                disabled={downloadingRanking}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors ml-auto"
              >
                <Download size={12} /> {downloadingRanking ? '조회 중...' : 'CSV 다운로드 (7일 기준)'}
              </button>
            </div>
            {weeklyRanking.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">아직 조회 데이터가 없습니다. 유저 방문이 쌓이면 표시됩니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {weeklyRanking.map((item, idx) => (
                  <div key={item.id} className="flex flex-wrap items-center gap-2 sm:gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                    <span className="text-lg font-black text-zinc-300 w-6 text-center">{idx + 1}</span>
                    {item.image_url ? (
                      <img
                        src={item.image_url.startsWith('http') ? item.image_url : `https://now.nemoneai.com${item.image_url}`}
                        alt=""
                        className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-zinc-200 flex-shrink-0" />
                    )}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-zinc-800 truncate">{item.title}</p>
                        {item.updated_at && (
                          <span className="flex-shrink-0 text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">
                            갱신됨
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-400">{item.region} · ID {item.id} · {item.view_count}회 · {item.date_range || '상시 운영'}</p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto pl-8 sm:pl-0">
                      <button
                        onClick={async () => {
                          setRegion(item.region as Region);
                          setViewMode('spots');
                          // 해당 리전 로드 후 편집 폼 열기
                          const res = await fetch(`/api-now/admin/places?region=${encodeURIComponent(item.region)}`);
                          if (res.ok) {
                            const data = await res.json();
                            setPlaces(data);
                            const found = data.find((p: Place) => p.id === item.id);
                            if (found) {
                              setEditingId(found.id);
                              setEditForm({ ...found });
                              setEnriched(found.blog_reviews && found.blog_reviews.length > 0 ? { placeId: found.id, reviews: found.blog_reviews } : null);
                            }
                          }
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-zinc-100 text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-200 flex-shrink-0 transition-colors"
                      >
                        <Edit size={11} /> 편집
                      </button>
                      <button
                        onClick={() => handleEnrichRanking(item.id)}
                        disabled={enrichingRankId === item.id}
                        className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl hover:bg-emerald-100 disabled:opacity-50 flex-shrink-0 transition-colors"
                      >
                        {enrichingRankId === item.id ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} />}
                        {enrichingRankId === item.id ? '수집 중...' : '블로그 갱신'}
                      </button>
                      <a href={`/posts/${item.id}`} target="_blank" className="text-zinc-300 hover:text-zinc-600 transition-colors flex-shrink-0 ml-auto sm:ml-0">
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode !== 'ranking' && (viewMode === 'spots' ? (
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
                            {(['성수', '홍대', '용산', '강남', '공연', '제주', '축제'] as Region[]).map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">이미지 URL</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editForm.image_url || ''}
                              onChange={e => setEditForm({...editForm, image_url: e.target.value})}
                              className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                            />
                            <label className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-zinc-100 border border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-200 transition-colors">
                              {isUploadingImage ? <Loader2 size={16} className="animate-spin text-zinc-500" /> : <Upload size={16} className="text-zinc-500" />}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isUploadingImage}
                                onChange={e => e.target.files?.[0] && handlePlaceImageUpload(e.target.files[0], (url) => setEditForm({...editForm, image_url: url}))}
                              />
                            </label>
                          </div>
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
            <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400 font-bold">
              <span>
                총 {places.length}개
                {placesLastUpdated && ` · 최종 업데이트 ${new Date(placesLastUpdated).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
              </span>
              {!placeSearch.trim() && places.length > 10 && <span>랜덤 10개만 표시 중 · 검색으로 찾아보세요</span>}
            </div>
            <div className="flex items-center gap-3 bg-white border border-zinc-200 rounded-2xl px-4 py-2.5 shadow-sm">
              <svg className="text-zinc-400 flex-shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="장소명 또는 네이버 플레이스 ID 검색..."
                value={placeSearch}
                onChange={e => setPlaceSearch(e.target.value)}
                className="flex-grow text-sm text-zinc-800 placeholder-zinc-400 bg-transparent outline-none"
              />
              {placeSearch && (
                <button onClick={() => setPlaceSearch('')} className="text-zinc-400 hover:text-zinc-600 flex-shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>
            {(placeSearch.trim() ? places : placeSamplePool).filter(p => {
              if (!placeSearch.trim()) return true;
              const q = placeSearch.trim().toLowerCase().replace(/^#/, '');
              if (/^\d+$/.test(q)) return String(p.id) === q;
              return (
                p.title.toLowerCase().includes(q) ||
                (p.content || '').toLowerCase().includes(q) ||
                (p.naver_place_id || '').toLowerCase().includes(q)
              );
            }).map((place) => (
              <React.Fragment key={place.id}>
              <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm flex gap-6 items-start transition-all hover:border-emerald-200">
                <div className="w-32 h-32 rounded-2xl bg-zinc-100 flex-shrink-0 overflow-hidden border border-zinc-100">
                  {place.image_url ? (
                    <img src={place.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-300"><ImageIcon size={32} /></div>
                  )}
                </div>

                <div className="flex-grow space-y-2">
                  {editingId === place.id ? (
                    <>
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
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">상세 내용 (RAG 리소스)</label>
                          <button
                            onClick={handleEnrich}
                            disabled={isEnriching}
                            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isEnriching ? <Loader2 size={11} className="animate-spin" /> : <MapPin size={11} />}
                            {isEnriching ? 'pcmap 불러오는 중...' : 'pcmap 소개 자동생성'}
                          </button>
                        </div>
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
                            {(['성수', '홍대', '용산', '강남', '공연', '제주', '축제'] as Region[]).map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">이미지 URL</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editForm.image_url || ''}
                              onChange={e => setEditForm({...editForm, image_url: e.target.value})}
                              className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                            />
                            <label className="flex-shrink-0 flex items-center justify-center w-10 h-10 bg-zinc-100 border border-zinc-200 rounded-xl cursor-pointer hover:bg-zinc-200 transition-colors">
                              {isUploadingImage ? <Loader2 size={16} className="animate-spin text-zinc-500" /> : <Upload size={16} className="text-zinc-500" />}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={isUploadingImage}
                                onChange={e => e.target.files?.[0] && handlePlaceImageUpload(e.target.files[0], (url) => setEditForm({...editForm, image_url: url}))}
                              />
                            </label>
                          </div>
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
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">네이버 플레이스 ID</label>
                        <input
                          type="text"
                          placeholder="네이버 지도 URL의 숫자 ID (예: 2025646860)"
                          value={editForm.naver_place_id || ''}
                          onChange={e => setEditForm({...editForm, naver_place_id: e.target.value})}
                          className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">바로가기 제목</label>
                          <input
                            type="text"
                            placeholder="예약하기 / 인스타 / 공식페이지"
                            value={(editForm as any).link_title || ''}
                            onChange={e => setEditForm({...editForm, link_title: e.target.value} as any)}
                            className="w-full bg-white border border-zinc-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">바로가기 URL</label>
                          <input
                            type="text"
                            placeholder="https://..."
                            value={(editForm as any).link_url || ''}
                            onChange={e => setEditForm({...editForm, link_url: e.target.value} as any)}
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
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-bold text-zinc-900">{place.title}</h3>
                        <span className="text-[10px] font-medium text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md">ID: {place.id}</span>
                        {place.pinned_at && (
                          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                            <Pin size={10} /> 고정
                          </span>
                        )}
                        {place.updated_at && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            갱신됨 {new Date(place.updated_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                          </span>
                        )}
                        {place.created_at && (
                          <span className="text-[10px] font-medium text-zinc-400">
                            생성일 {new Date(place.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
                        <MapPin size={12} /> {place.location || '위치 정보 없음'}
                      </div>
                      <p className="text-sm text-zinc-500 line-clamp-2 leading-relaxed font-medium">{place.content}</p>
                      <div className="flex flex-wrap gap-3 sm:gap-4 pt-4">
                        <button onClick={() => handleEdit(place)} className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 hover:text-emerald-600 transition-colors bg-zinc-50 px-3 py-1.5 rounded-lg border border-zinc-100">
                          <Edit size={14} /> 데이터 수정
                        </button>
                        <button onClick={() => handleDelete(place.id)} className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-rose-500 transition-colors px-3 py-1.5">
                          <Trash2 size={14} /> 삭제
                        </button>
                        <a href={`https://now.nemoneai.com/posts/${place.id}`} target="_blank" className="ml-auto flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors">
                          <ExternalLink size={14} /> 실제 화면 보기
                        </a>
                      </div>
                    </>
                  )}
                </div>
              </div>
              {enriched?.placeId === place.id && (
                <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">pcmap 블로그 후기 ({enriched.reviews.length})</p>
                  <div className="flex flex-col gap-1.5">
                    {enriched.reviews.map((r, i) => (
                      <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2.5 p-2 bg-white border border-emerald-100 rounded-xl hover:border-emerald-400 transition-colors no-underline group">
                        <span className="text-[11px] font-bold text-zinc-400 w-4 flex-shrink-0">{i + 1}</span>
                        <span className="text-xs text-zinc-700 group-hover:text-emerald-700 flex-grow leading-snug">{r.title}</span>
                        <ExternalLink size={11} className="flex-shrink-0 text-emerald-300 group-hover:text-emerald-600 ml-auto" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              </React.Fragment>
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
                        <div className="mb-3 bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">새 장소 직접 입력</p>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">이름 *</label>
                              <input type="text" value={newPlaceForm.title} onChange={e => setNewPlaceForm(f => ({...f, title: e.target.value}))}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" autoFocus />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">주소 *</label>
                              <input type="text" value={newPlaceForm.location} onChange={e => setNewPlaceForm(f => ({...f, location: e.target.value}))}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">설명 *</label>
                            <textarea rows={2} value={newPlaceForm.content} onChange={e => setNewPlaceForm(f => ({...f, content: e.target.value}))}
                              className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 resize-none" />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">이미지 URL</label>
                              <div className="flex gap-2">
                                <input type="text" value={newPlaceForm.image_url} onChange={e => setNewPlaceForm(f => ({...f, image_url: e.target.value}))}
                                  className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                                <label className="flex-shrink-0 flex items-center justify-center w-9 h-9 bg-zinc-100 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-200 transition-colors">
                                  {isUploadingImage ? <Loader2 size={14} className="animate-spin text-zinc-500" /> : <Upload size={14} className="text-zinc-500" />}
                                  <input type="file" accept="image/*" className="hidden" disabled={isUploadingImage}
                                    onChange={e => e.target.files?.[0] && handlePlaceImageUpload(e.target.files[0], (url) => setNewPlaceForm(f => ({...f, image_url: url})))} />
                                </label>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">동영상 URL</label>
                              <input type="text" value={newPlaceForm.video_url} onChange={e => setNewPlaceForm(f => ({...f, video_url: e.target.value}))}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">운영 일시</label>
                              <input type="text" value={newPlaceForm.date_range} onChange={e => setNewPlaceForm(f => ({...f, date_range: e.target.value}))}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setAddingPlaceThemeId(null)} className="px-4 py-1.5 text-zinc-400 font-bold text-xs">취소</button>
                            <button onClick={() => addPlaceToTheme(theme)} disabled={isLoading}
                              className="bg-emerald-500 text-white px-5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-600 disabled:opacity-50">
                              <Plus size={12} /> {isLoading ? '저장 중...' : '장소 추가'}
                            </button>
                          </div>
                        </div>
                      )}

                      {places.length === 0 ? (
                        <p className="text-xs text-zinc-400 text-center py-2">장소 없음</p>
                      ) : (
                        <div className="grid gap-2">
                          {places.map((p: any, i: number) => (
                            <div key={i} className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
                              {editingPlace?.themeId === theme.id && editingPlace?.index === i ? (
                                <div className="p-3 space-y-2 border-emerald-200 border rounded-xl">
                                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">장소 수정</p>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">이름 *</label>
                                      <input type="text" value={editPlaceForm.title} onChange={e => setEditPlaceForm(f => ({...f, title: e.target.value}))}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500" autoFocus />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">주소 *</label>
                                      <input type="text" value={editPlaceForm.location} onChange={e => setEditPlaceForm(f => ({...f, location: e.target.value}))}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500" />
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">설명 *</label>
                                    <textarea rows={2} value={editPlaceForm.content} onChange={e => setEditPlaceForm(f => ({...f, content: e.target.value}))}
                                      className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500 resize-none" />
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">이미지 URL</label>
                                      <div className="flex gap-2">
                                        <input type="text" value={editPlaceForm.image_url} onChange={e => setEditPlaceForm(f => ({...f, image_url: e.target.value}))}
                                          className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500" />
                                        <label className="flex-shrink-0 flex items-center justify-center w-9 h-9 bg-zinc-100 border border-zinc-200 rounded-lg cursor-pointer hover:bg-zinc-200 transition-colors">
                                          {isUploadingImage ? <Loader2 size={14} className="animate-spin text-zinc-500" /> : <Upload size={14} className="text-zinc-500" />}
                                          <input type="file" accept="image/*" className="hidden" disabled={isUploadingImage}
                                            onChange={e => e.target.files?.[0] && handlePlaceImageUpload(e.target.files[0], (url) => setEditPlaceForm(f => ({...f, image_url: url})))} />
                                        </label>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">동영상 URL</label>
                                      <input type="text" value={editPlaceForm.video_url} onChange={e => setEditPlaceForm(f => ({...f, video_url: e.target.value}))}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500" />
                                    </div>
                                    <div className="space-y-1">
                                      <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">운영 일시</label>
                                      <input type="text" value={editPlaceForm.date_range} onChange={e => setEditPlaceForm(f => ({...f, date_range: e.target.value}))}
                                        className="w-full bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500" />
                                    </div>
                                  </div>
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditingPlace(null)} className="px-4 py-1.5 text-zinc-400 font-bold text-xs">취소</button>
                                    <button onClick={() => savePlaceEdit(theme)} disabled={isLoading}
                                      className="bg-emerald-500 text-white px-5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-600 disabled:opacity-50">
                                      <Save size={12} /> {isLoading ? '저장 중...' : '수정 저장'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3 px-4 py-2.5">
                                  {p.image_url && <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" referrerPolicy="no-referrer" />}
                                  <div className="flex-grow min-w-0">
                                    <p className="text-sm font-bold text-zinc-800">{p.title}</p>
                                    {p.location && <p className="text-xs text-zinc-400">{p.location}</p>}
                                  </div>
                                  <button
                                    onClick={() => {
                                      setEditingPlace({ themeId: theme.id, index: i });
                                      setEditPlaceForm({
                                        title: p.title || '',
                                        location: p.location || '',
                                        content: p.content || '',
                                        image_url: p.image_url || '',
                                        video_url: p.video_url || '',
                                        date_range: p.date_range || '',
                                      });
                                    }}
                                    className="p-1.5 text-zinc-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors flex-shrink-0"
                                    title="수정"
                                  >
                                    <Edit size={14} />
                                  </button>
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
                                    title="삭제"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              )}
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
        ))}
      </div>
    </div>
  );
}