"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, Info, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BrandTagline from '@/components/BrandTagline';
import BottomNav from '@/components/BottomNav';
import HeaderControls from '@/components/HeaderControls';
import Logo from '@/components/Logo';
import StoreBanner from '@/components/StoreBanner';
import SiteFooter from '@/components/SiteFooter';
import AdUnit from '@/components/AdUnit';

const BRAND_TITLE: Record<string, string> = { ko: '지금 여기', en: 'NOW HERE', zh: 'NOW HERE', ja: 'NOW HERE' };

const PLACE_REGIONS = ['성수', '홍대', '강북', '강남', '제주'] as const;
type Region = typeof PLACE_REGIONS[number];
type Companion = 'solo' | 'couple' | 'friends';

const COMPANION_LABEL: Record<Companion, string> = { solo: '혼자', couple: '연인', friends: '친구' };

export default function CourseHubPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <CourseHubContent />
    </Suspense>
  );
}

function CourseHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'ko';
  const { user, session, signInWithGoogle, isLoading: authLoading } = useAuth();
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [usage, setUsage] = useState({ usage_count: 0, limit: 2 });

  const [showTimedModal, setShowTimedModal] = useState(false);
  const [region, setRegion] = useState<Region>('성수');
  const [companion, setCompanion] = useState<Companion>('solo');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user?.id) { setIsLoading(false); return; }
    (async () => {
      setIsLoading(true);
      try {
        const [coursesRes, usageRes] = await Promise.all([
          fetch(`/api-now/users/${user.id}/courses`),
          fetch(`/api-now/users/${user.id}/usage/itinerary`),
        ]);
        if (coursesRes.ok) setMyCourses(await coursesRes.json());
        if (usageRes.ok) setUsage(await usageRes.json());
      } finally {
        setIsLoading(false);
      }
    })();
  }, [user]);

  const createDraft = async (params: { scope: 'timed'; region?: string; companion?: string }) => {
    if (!user) return signInWithGoogle();
    setIsCreating(true);
    try {
      const qs = new URLSearchParams({ scope: params.scope });
      if (params.region) qs.set('region', params.region);
      const res = await fetch(`/api-now/courses/draft?${qs.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          user_image: user.user_metadata?.avatar_url || null,
          companion: params.companion,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/course/${data.id}/edit`);
      } else if (res.status === 403) {
        const err = await res.json();
        alert(err.detail || '오늘 제공된 3시간코스 생성 기회(2회)를 모두 사용하셨습니다.');
      } else {
        alert('코스를 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (e) {
      console.error(e);
      alert('코스를 만드는 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
      setShowTimedModal(false);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl border-x border-zinc-200">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-40 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={handleBack} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <Logo />
          </div>
          <HeaderControls />
        </div>
        <BrandTagline lang={lang} />
      </header>

      <main className="px-6 py-6 space-y-6 pb-28">
        <div className="flex gap-2">
          <button className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all bg-zinc-900 text-white shadow-sm">
            3시간코스
          </button>
          <button
            onClick={() => router.push(`/?tab=theme&lang=${lang}`)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all bg-zinc-100 text-zinc-400"
          >
            자유코스
          </button>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => setShowTimedModal(true)}
            className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-pace-600 transition-all shadow-lg"
          >
            <Sparkles size={18} /> AI 자동코스 생성
          </button>
          <p className="text-center text-xs text-zinc-400 font-medium">생성된 AI 자동코스를 저장하고 재편집해보세요</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">내가 저장한 코스 재편집</h2>

          {!user && !authLoading ? (
            <button onClick={() => signInWithGoogle()} className="w-full py-10 bg-white border border-dashed border-zinc-200 rounded-3xl text-center text-zinc-400 text-sm font-medium hover:border-pace-200 hover:text-pace-600 transition-all">
              로그인하고 내 코스를 확인해보세요
            </button>
          ) : isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-zinc-300" /></div>
          ) : myCourses.filter((c: any) => c.scope === 'timed').length > 0 ? (
            <div className="space-y-3">
              {myCourses.filter((c: any) => c.scope === 'timed').map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/course/${c.id}/edit`)}
                  className="w-full flex items-center gap-3 bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm text-left hover:border-pace-200 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-900 text-sm truncate">{c.title || '제목 없는 코스'}</h3>
                    {c.is_public && (
                      <span className="inline-block mt-1 text-[9px] font-black text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase">공개</span>
                    )}
                  </div>
                  <span className="flex-shrink-0 flex items-center gap-0.5 text-xs font-bold text-pace-600">
                    편집 <ChevronRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center bg-white border border-zinc-100 rounded-3xl space-y-4 px-6">
              <p className="text-zinc-400 text-sm font-medium leading-relaxed">
                저장된 코스가 없습니다. 인기 코스를 저장하거나 AI로 생성된 코스를 저장한 후 편집할 수 있습니다.
              </p>
              <Link href="/ranking/course" className="inline-block px-5 py-2.5 bg-zinc-100 text-zinc-700 rounded-xl font-bold text-xs hover:bg-zinc-200 transition-all">
                코스 랭킹 바로가기
              </Link>
            </div>
          )}
        </div>

        <StoreBanner />
        <SiteFooter lang={lang} />
      </main>

      <AnimatePresence>
        {showTimedModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => !isCreating && setShowTimedModal(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-black text-zinc-900 tracking-tight mb-2">AI생성</h2>
              <p className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5 mb-6">
                <Info size={12} /> 오늘 남은 3시간코스 생성 횟수: {Math.max(usage.limit - usage.usage_count, 0)}/{usage.limit}
              </p>

              <div className="space-y-3 mb-6">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">지역</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {PLACE_REGIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRegion(r)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${region === r ? 'bg-pace-50 border-pace-200 text-pace-700' : 'bg-zinc-50 border-transparent text-zinc-500'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 mb-8">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">누구와 함께인가요?</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(COMPANION_LABEL) as Companion[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCompanion(c)}
                      className={`py-3 rounded-2xl text-xs font-bold transition-all border ${companion === c ? 'bg-pace-50 border-pace-200 text-pace-700' : 'bg-zinc-50 border-transparent text-zinc-500'}`}
                    >
                      {COMPANION_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => createDraft({ scope: 'timed', region, companion })}
                disabled={isCreating}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-pace-600 transition-all disabled:opacity-50 shadow-xl"
              >
                {isCreating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    코스 설계 중...
                  </>
                ) : (
                  <>
                    <Clock size={18} /> 3시간코스 만들기
                  </>
                )}
              </button>

              <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav region={region} lang={lang} />
    </div>
  );
}
