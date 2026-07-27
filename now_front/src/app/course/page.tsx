"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, Compass, Info, Loader2, Plus, Sparkles, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BrandTagline from '@/components/BrandTagline';
import BottomNav from '@/components/BottomNav';

const PLACE_REGIONS = ['성수', '홍대', '강북', '강남', '제주'] as const;
type Region = typeof PLACE_REGIONS[number];
type Companion = 'solo' | 'couple' | 'friends';

const COMPANION_LABEL: Record<Companion, string> = { solo: '혼자', couple: '연인', friends: '친구' };

export default function CourseHubPage() {
  const router = useRouter();
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

  const createDraft = async (params: { scope: 'timed' | 'free'; region?: string; source?: string; companion?: string }) => {
    if (!user) return signInWithGoogle();
    setIsCreating(true);
    try {
      const qs = new URLSearchParams({ scope: params.scope });
      if (params.region) qs.set('region', params.region);
      if (params.source) qs.set('source', params.source);
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
        <div className="flex items-center gap-3 mb-2">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-600">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-lg font-black font-display tracking-tight text-zinc-900 whitespace-nowrap">
            <Link href="/" className="no-underline text-inherit">지금여기<span className="text-emerald-500">.</span></Link>
          </h1>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-bold text-zinc-500">코스</span>
        </div>
        <BrandTagline />
      </header>

      <main className="px-6 py-6 space-y-8 pb-28">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowTimedModal(true)}
            disabled={isCreating}
            className="flex flex-col items-center justify-center gap-2 py-6 bg-zinc-900 text-white rounded-3xl font-bold shadow-xl hover:bg-emerald-600 transition-all disabled:opacity-50"
          >
            <Sparkles size={24} />
            <span className="text-sm">3시간코스 만들기</span>
          </button>
          <button
            onClick={() => createDraft({ scope: 'free' })}
            disabled={isCreating}
            className="flex flex-col items-center justify-center gap-2 py-6 bg-white border border-zinc-200 text-zinc-700 rounded-3xl font-bold hover:border-emerald-200 hover:text-emerald-600 transition-all disabled:opacity-50"
          >
            {isCreating ? <Loader2 size={24} className="animate-spin" /> : <Compass size={24} />}
            <span className="text-sm">자유롭게 만들기</span>
          </button>
        </div>

        {user && (
          <p className="text-center text-[11px] font-bold text-zinc-400 flex items-center justify-center gap-1.5">
            <Info size={12} /> 오늘 남은 3시간코스 생성 횟수: {Math.max(usage.limit - usage.usage_count, 0)}/{usage.limit}
          </p>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">내 코스</h2>
          </div>

          {!user && !authLoading ? (
            <button onClick={() => signInWithGoogle()} className="w-full py-10 bg-white border border-dashed border-zinc-200 rounded-3xl text-center text-zinc-400 text-sm font-medium hover:border-emerald-200 hover:text-emerald-600 transition-all">
              로그인하고 내 코스를 확인해보세요
            </button>
          ) : isLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-zinc-300" /></div>
          ) : myCourses.length > 0 ? (
            <div className="space-y-3">
              {myCourses.map((c: any) => (
                <button
                  key={c.id}
                  onClick={() => router.push(`/course/${c.id}/edit`)}
                  className="w-full flex items-center gap-3 bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm text-left hover:border-emerald-200 transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-zinc-900 text-sm truncate">{c.title || '제목 없는 코스'}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">
                        {c.scope === 'timed' ? '3시간코스' : '자유코스'}
                      </span>
                      {c.is_public && <span className="text-[9px] font-black text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded uppercase">공개</span>}
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-zinc-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-zinc-400 text-sm font-medium bg-white border border-zinc-100 rounded-3xl">
              아직 만든 코스가 없어요. 위 버튼으로 첫 코스를 만들어보세요!
            </div>
          )}
        </div>
      </main>

      <AnimatePresence>
        {showTimedModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => !isCreating && setShowTimedModal(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-black text-zinc-900 tracking-tight mb-6">3시간코스 만들기</h2>

              <div className="space-y-3 mb-6">
                <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">지역</label>
                <div className="grid grid-cols-5 gap-1.5">
                  {PLACE_REGIONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRegion(r)}
                      className={`py-2.5 rounded-xl text-xs font-bold transition-all border ${region === r ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-transparent text-zinc-500'}`}
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
                      className={`py-3 rounded-2xl text-xs font-bold transition-all border ${companion === c ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-zinc-50 border-transparent text-zinc-500'}`}
                    >
                      {COMPANION_LABEL[c]}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => createDraft({ scope: 'timed', region, companion })}
                disabled={isCreating}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-xl"
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav region={region} />
    </div>
  );
}
