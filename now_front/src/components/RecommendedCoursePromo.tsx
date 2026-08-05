"use client";

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, ChevronRight, Save, Share2, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type Pick = { type: 'course' | 'theme'; data: any };

function formatStepTimes(steps: any[]): string[] {
  // 코스 상세/편집 페이지와 동일한 규칙 — 시간은 저장하지 않고 14:00 시작 + duration 누적으로 계산
  let cursor = 14 * 60;
  return steps.map((s) => {
    const h = Math.floor(cursor / 60) % 24;
    const m = cursor % 60;
    cursor += s.duration || 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
}

export default function RecommendedCoursePromo() {
  const router = useRouter();
  const { user, signInWithGoogle } = useAuth();
  const [pick, setPick] = useState<Pick | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    (async () => {
      try {
        const [coursesRes, themesRes] = await Promise.all([
          fetch('/api-now/courses'),
          fetch('/api-now/themes'),
        ]);
        const courses = coursesRes.ok ? await coursesRes.json() : [];
        const themes = themesRes.ok ? await themesRes.json() : [];
        const topCourse = courses.filter((c: any) => c.scope === 'timed')[0];
        const topTheme = themes[0];

        const candidates: Pick[] = [];
        if (topCourse) candidates.push({ type: 'course', data: topCourse });
        if (topTheme) candidates.push({ type: 'theme', data: topTheme });
        if (candidates.length > 0) {
          setPick(candidates[Math.floor(Math.random() * candidates.length)]);
        }
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  if (!pick) return null;

  const items = pick.type === 'course'
    ? (Array.isArray(pick.data.steps) ? pick.data.steps : JSON.parse(pick.data.steps || '[]'))
    : (Array.isArray(pick.data.places) ? pick.data.places : JSON.parse(pick.data.places || '[]'));

  const times = pick.type === 'course' ? formatStepTimes(items) : [];
  const thumbnail = pick.type === 'theme' ? items[0]?.image_url : null;

  const handleSave = async () => {
    if (!user) return signInWithGoogle();
    try {
      const res = pick.type === 'course'
        ? await fetch('/api-now/courses/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              user_image: user.user_metadata?.avatar_url || null,
              title: `[퍼감] ${pick.data.title}`,
              description: pick.data.description,
              steps: items,
              region: pick.data.region || '성수',
            }),
          })
        : await fetch('/api-now/themes/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: user.id,
              user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              user_image: user.user_metadata?.avatar_url || null,
              title: `[퍼감] ${pick.data.title}`,
              description: pick.data.description,
              places: items,
            }),
          });
      alert(res.ok ? '내 마이페이지로 가져왔습니다!' : '저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const handleShare = async () => {
    try {
      let url: string;
      if (pick.type === 'course') {
        url = `${window.location.origin}/course/${pick.data.id}`;
      } else {
        const res = await fetch('/api-now/ranking/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tab: 'theme', region: null, label: pick.data.title, items: items.slice(0, 10), user_id: null }),
        });
        if (!res.ok) throw new Error('공유 링크 생성 실패');
        const { id } = await res.json();
        url = `${window.location.origin}/ranking/share/${id}`;
      }
      await navigator.clipboard.writeText(url);
      alert('공유 링크가 복사되었습니다!');
    } catch (e) {
      console.error(e);
      alert('공유 링크 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowModal(false)}>
      <div className="w-full max-w-md bg-white rounded-t-[40px] p-6 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-[9px] font-black text-pace-600 bg-pace-50 px-1.5 py-0.5 rounded uppercase">
              {pick.type === 'course' ? '3시간코스' : '테마'} 1위
            </span>
            <h3 className="text-lg font-black text-zinc-900 tracking-tight mt-1">{pick.data.title}</h3>
          </div>
          <button onClick={() => setShowModal(false)} className="p-2 bg-zinc-100 text-zinc-400 rounded-full flex-shrink-0"><X size={18} /></button>
        </div>
        {pick.data.description && <p className="text-sm text-zinc-500 mb-4">{pick.data.description}</p>}

        {pick.type === 'course' ? (
          <div className="relative space-y-6 mb-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
            {items.slice(0, 10).map((step: any, idx: number) => (
              <div key={idx} className="relative pl-10">
                <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-4 border-pace-500 z-10" />
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-zinc-400 font-mono uppercase">{times[idx]} • {step.duration}MIN</p>
                  <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-zinc-900 text-sm">{step.place_name}</h4>
                        {step.date_range && (
                          <p className="text-[10px] text-pace-600 font-bold mt-0.5">{step.date_range}</p>
                        )}
                        {step.activity && <p className="text-[11px] text-zinc-500 mt-1">{step.activity}</p>}
                      </div>
                      {step.place_id && (
                        <Link
                          href={`/posts/${step.place_id}`}
                          className="flex-shrink-0 w-7 h-7 bg-white border border-zinc-200 rounded-xl flex items-center justify-center text-zinc-400 hover:bg-pace-50 hover:text-pace-500 hover:border-pace-200 transition-all"
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
        ) : (
          <div className="space-y-3 mb-8">
            {items.slice(0, 10).map((place: any, idx: number) => (
              <Link
                key={idx}
                href={place.place_id ? `/posts/${place.place_id}` : '#'}
                className="flex items-center gap-3 bg-zinc-50 rounded-2xl p-3 hover:bg-pace-50 transition-colors"
              >
                {place.image_url && (
                  <img src={place.image_url} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" alt="" referrerPolicy="no-referrer" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-zinc-900 truncate">{place.title}</p>
                  {place.location && <p className="text-xs text-zinc-400 truncate">{place.location}</p>}
                </div>
                {place.place_id && <ChevronRight size={16} className="text-zinc-300 flex-shrink-0" />}
              </Link>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 pb-2">
          <button onClick={handleSave} className="flex flex-col items-center gap-1 py-3 bg-zinc-100 text-zinc-700 rounded-2xl font-bold text-xs hover:bg-zinc-200 transition-all">
            <Save size={16} /> 저장하기
          </button>
          <button onClick={handleShare} className="flex flex-col items-center gap-1 py-3 bg-zinc-100 text-zinc-700 rounded-2xl font-bold text-xs hover:bg-zinc-200 transition-all">
            <Share2 size={16} /> 공유하기
          </button>
          <button onClick={() => router.push('/course')} className="flex flex-col items-center gap-1 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-xs hover:bg-pace-600 transition-all">
            <Sparkles size={16} /> 코스생성
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
        <Sparkles size={14} className="text-pace-500" /> 추천! 인기코스
      </p>
      <button
        onClick={() => setShowModal(true)}
        className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm text-left hover:shadow-md transition-shadow"
      >
        {thumbnail ? (
          <img src={thumbnail} alt={pick.data.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-pace-50 flex items-center justify-center">
            <Sparkles className="text-pace-400" size={24} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-black text-pace-600 bg-pace-50 px-1.5 py-0.5 rounded uppercase">
              {pick.type === 'course' ? '3시간' : '테마'}
            </span>
            <span className="text-[9px] font-black text-zinc-400">1위</span>
          </div>
          <p className="text-sm font-bold text-zinc-900 truncate">{pick.data.title}</p>
          <p className="text-xs text-zinc-400 mt-0.5">{items.length}곳</p>
        </div>
        <ChevronRight size={18} className="text-zinc-300 flex-shrink-0" />
      </button>

      {showModal && mounted && createPortal(modal, document.body)}
    </div>
  );
}
