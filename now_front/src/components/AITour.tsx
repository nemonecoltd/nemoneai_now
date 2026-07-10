"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Users, Ticket, MapPin, Clock, RefreshCcw, Save, Check, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Companion = 'Solo' | 'Couple' | 'Friends';

interface TourStep {
  time: string;
  place_id?: number;
  place_name: string;
  date_range?: string | null;
  activity: string;
  duration: number;
}

interface Tour {
  title: string;
  description: string;
  steps: TourStep[];
}

const dict = {
  ko: {
    title: 'AI 맞춤형 도보 코스',
    subtitle: '{region}의 최신 데이터를 분석하여\n가장 효율적인 3시간 코스를 짜드려요.',
    companionLabel: '누구와 함께인가요?',
    solo: '혼자',
    couple: '연인',
    friends: '친구',
    generate: '3시간 코스 만들기',
    generating: '코스 설계 중...',
    aiRecommended: 'AI 추천 코스',
    duration: '분 체류',
    book: '예약하기',
    direction: '길찾기',
    remake: '다시 만들기',
    save: '코스 저장하기',
    saved: '저장됨',
    saveAlert: '코스가 마이페이지에 저장되었습니다!',
    remaining: '오늘 남은 생성 횟수'
  },
  en: {
    title: 'AI Customized Walking Tour',
    subtitle: 'Analyze the latest data to design\nthe most efficient 3-hour course in {region}.',
    companionLabel: 'Who are you with?',
    solo: 'Solo',
    couple: 'Couple',
    friends: 'Friends',
    generate: 'Create 3-hour Course',
    generating: 'Designing...',
    aiRecommended: 'AI Recommended Course',
    duration: 'min stay',
    book: 'Book Now',
    direction: 'Directions',
    remake: 'Recreate',
    save: 'Save Course',
    saved: 'Saved',
    saveAlert: 'Course has been saved to your My Page!',
    remaining: 'Remaining today'
  }
};

export default function AITour({ region = '성수', lang = 'ko' }: { region?: string, lang?: string }) {
  const { user, signInWithGoogle } = useAuth();
  const [selectedCompanion, setSelectedCompanion] = useState<Companion>('Solo');
  const [tour, setTour] = useState<Tour | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [usage, setUsage] = useState({ usage_count: 0, limit: 2 });

  const t = dict[lang as keyof typeof dict] || dict.ko;
  const displayRegion = lang === 'en' ? (region === '성수' ? 'Seongsu' : region === '용산' ? 'Yongsan' : 'Hongdae') : region;

  useEffect(() => {
    if (user?.id) {
      fetchUsage();
    }
  }, [user]);

  const fetchUsage = async () => {
    try {
      const res = await fetch(`/api-now/users/${user?.id}/usage/itinerary`);
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch (e) {
      console.error('Failed to fetch usage:', e);
    }
  };

  const generateTour = async () => {
    if (!user) return signInWithGoogle();
    setIsGenerating(true);
    setIsSaved(false);
    try {
      const res = await fetch(`/api-now/itinerary?region=${encodeURIComponent(region)}&lang=${lang}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          companion: selectedCompanion,
          user_id: user?.id 
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setTour(data);
        fetchUsage(); // 성공 시 횟수 업데이트
      } else if (res.status === 403) {
        const errorData = await res.json();
        alert(errorData.detail || (lang === 'en' ? 'You have reached your daily limit for generating AI tours (2 times). Please try again tomorrow!' : '오늘 제공된 AI 코스 생성 기회(2회)를 모두 사용하셨습니다. 내일 다시 이용해주세요!'));
        fetchUsage(); // 혹시 모르니 동기화
      } else {
        alert(lang === 'en' ? 'An error occurred while generating the tour. Please try again later.' : '코스를 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveCourse = async () => {
    if (!tour || !user?.id || isSaved) return;
    
    try {
      const res = await fetch('/api-now/courses/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          user_image: user.user_metadata?.avatar_url || null,
          title: tour.title,
          description: tour.description,
          steps: tour.steps,
          region: region // 선택된 지역 정보 추가
        }),
      });
      if (res.ok) {
        setIsSaved(true);
        alert(t.saveAlert);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 space-y-8 pb-24 h-full overflow-y-auto no-scrollbar">
      {!tour ? (
        <div className="space-y-8 py-10">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Sparkles className="text-emerald-500" size={40} />
            </div>
            <h2 className="text-2xl font-bold font-display text-zinc-900">{t.title}</h2>
            <p className="text-zinc-500 text-sm leading-relaxed px-10 whitespace-pre-line">
              {t.subtitle.replace('{region}', displayRegion)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-zinc-100 shadow-sm space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.companionLabel}</label>
              <div className="grid grid-cols-3 gap-2">
                {(['Solo', 'Couple', 'Friends'] as Companion[]).map(comp => (
                  <button
                    key={comp}
                    onClick={() => setSelectedCompanion(comp)}
                    className={cn(
                      "py-3 rounded-2xl text-xs font-bold transition-all border",
                      selectedCompanion === comp
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-zinc-50 border-transparent text-zinc-500"
                    )}
                  >
                    {comp === 'Solo' ? t.solo : comp === 'Couple' ? t.couple : t.friends}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={generateTour}
                disabled={isGenerating}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-all disabled:opacity-50 shadow-xl"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t.generating}
                  </div>
                ) : (
                  <>
                    <Sparkles size={18} />
                    {t.generate}
                  </>
                )}
              </button>
              
              {user && (
                <div className="flex items-center justify-center gap-1.5 text-zinc-400 text-[10px] font-bold tracking-tight">
                  <Info size={12} />
                  <span>{t.remaining}: {usage.limit - usage.usage_count}/{usage.limit}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
              <Sparkles size={16} /> {t.aiRecommended}
            </div>
            <h2 className="text-2xl font-bold font-display leading-tight text-zinc-900 tracking-tight">{tour.title}</h2>
            <p className="text-zinc-500 text-sm">{tour.description}</p>
          </div>

          <div className="relative space-y-10 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
            {tour.steps.map((step, idx) => (
              <div key={idx} className="relative pl-10">
                <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-4 border-emerald-500 z-10" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-400 font-mono tracking-tighter">{step.time}</span>
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md uppercase">{step.duration}{t.duration}</span>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-zinc-100 shadow-sm space-y-3">
                    <h4 className="font-bold text-zinc-900 tracking-tight">{step.place_name}</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed font-medium">{step.activity}</p>
                    <div className="flex gap-2 pt-1">
                      {step.place_id ? (
                        <a
                          href={`/posts/${step.place_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 bg-zinc-900 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1"
                        >
                          <Ticket size={12} /> {t.book}
                        </a>
                      ) : (
                        <button disabled className="flex-1 py-2 bg-zinc-100 text-zinc-300 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-not-allowed">
                          <Ticket size={12} /> {t.book}
                        </button>
                      )}
                      <a
                        href={`https://map.naver.com/p/search/${encodeURIComponent(step.place_name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 bg-zinc-100 text-zinc-600 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1"
                      >
                        <MapPin size={12} /> {t.direction}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <button 
              onClick={() => setTour(null)}
              className="py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all text-sm"
            >
              <RefreshCcw size={18} /> {t.remake}
            </button>
            <button 
              onClick={handleSaveCourse}
              disabled={isSaved}
              className={cn(
                "py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all text-sm shadow-lg",
                isSaved ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-emerald-500 text-white hover:bg-emerald-600"
              )}
            >
              {isSaved ? (
                <>
                  <Check size={18} /> {t.saved}
                </>
              ) : (
                <>
                  <Save size={18} /> {t.save}
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

