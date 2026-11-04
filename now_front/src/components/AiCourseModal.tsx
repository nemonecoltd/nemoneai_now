"use client";

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Clock, Info, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import AdUnit from './AdUnit';

// Recommendation.tsx(랭킹 탭) 안에서만 열리던 AI코스 생성 모달을 독립 컴포넌트로 분리(2026-09-06).
// 원래는 좌하단 FAB이 랭킹 탭으로 전환한 뒤에야 모달을 띄웠는데, 홈 탭에서 눌러도 랭킹으로
// 화면이 넘어갔다 모달이 뜨는 게 어색하다는 피드백 — 현재 탭이 뭐든 그 위에 바로 오버레이되게 함.
const AI_COURSE_REGIONS = ['성수', '홍대', '강북', '강남', '부산'] as const;   // 제주 삭제(2026-11-04)
type AiCourseRegion = typeof AI_COURSE_REGIONS[number];
type Companion = 'solo' | 'couple' | 'friends';
const COMPANION_LABEL: Record<Companion, string> = { solo: '혼자', couple: '연인', friends: '친구' };

export default function AiCourseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user, session, signInWithGoogle } = useAuth();
  const [courseRegion, setCourseRegion] = useState<AiCourseRegion>('성수');
  const [courseCompanion, setCourseCompanion] = useState<Companion>('solo');
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [courseUsage, setCourseUsage] = useState({ usage_count: 0, limit: 2 });

  const handleClose = () => { if (!isCreatingCourse) onClose(); };

  // 모달이 열릴 때마다 오늘 남은 생성 횟수를 다시 조회 — 로그인 안 한 상태면 조용히 스킵.
  useEffect(() => {
    if (!open || !user) return;
    fetch(`/api-now/users/${user.id}/usage/itinerary`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setCourseUsage(data); })
      .catch(() => {});
  }, [open, user]);

  const createAiCourse = async () => {
    if (!user) return signInWithGoogle();
    setIsCreatingCourse(true);
    try {
      const res = await fetch(`/api-now/courses/draft?scope=timed&region=${encodeURIComponent(courseRegion)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          user_image: user.user_metadata?.avatar_url || null,
          companion: courseCompanion,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        onClose();
        router.push(`/course/${data.id}/edit`);
      } else if (res.status === 403) {
        const err = await res.json();
        alert(err.detail || '오늘 제공된 3시간코스 생성 기회를 모두 사용하셨습니다.');
      } else {
        alert('코스를 만드는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (e) {
      console.error(e);
      alert('코스를 만드는 중 오류가 발생했습니다.');
    } finally {
      setIsCreatingCourse(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center"
          onClick={handleClose}
        >
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl font-black text-zinc-900 tracking-tight">AI 자동코스 생성</h2>
              <button onClick={handleClose} className="p-2 bg-zinc-100 rounded-full"><X size={20} /></button>
            </div>
            <p className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5 mb-6">
              <Info size={12} /> 오늘 남은 3시간코스 생성 횟수: {Math.max(courseUsage.limit - courseUsage.usage_count, 0)}/{courseUsage.limit}
            </p>

            <div className="space-y-3 mb-6">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">지역</label>
              <div className="grid grid-cols-5 gap-1.5">
                {AI_COURSE_REGIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setCourseRegion(r)}
                    className={cn("py-2.5 rounded-xl text-xs font-bold transition-all border", courseRegion === r ? "bg-pace-50 border-pace-200 text-pace-700" : "bg-zinc-50 border-transparent text-zinc-500")}
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
                    onClick={() => setCourseCompanion(c)}
                    className={cn("py-3 rounded-2xl text-xs font-bold transition-all border", courseCompanion === c ? "bg-pace-50 border-pace-200 text-pace-700" : "bg-zinc-50 border-transparent text-zinc-500")}
                  >
                    {COMPANION_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              whileHover={{ scale: 1.02 }}
              onClick={createAiCourse}
              disabled={isCreatingCourse}
              className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-pace-600 transition-all disabled:opacity-50 shadow-xl"
            >
              {isCreatingCourse ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  코스 설계 중...
                </>
              ) : (
                <>
                  <Clock size={18} /> 3시간코스 만들기
                </>
              )}
            </motion.button>

            <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
