"use client";

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Flame, Save, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import AdUnit from './AdUnit';

// Recommendation.tsx의 '랭킹 > 3시간' 탭 렌더링(리스트+상세 모달+좋아요+퍼가기)을 그대로
// 옮겨온 독립 컴포넌트(2026-09-09) — 코스 허브 페이지(/course)에 "3시간코스랭킹" 섹션으로
// 그대로 심어달라는 요청. Recommendation.tsx 쪽은 이미 프로덕션에서 동작 중이라 건드리지
// 않고, 여기서 완전히 자기 완결형으로 새로 구성했다(courses/topCourseImages/selectedCourse
// 상태와 fetch·좋아요·퍼가기 핸들러 전부 이 컴포넌트 안에 있음).
export default function CourseRankingSection({ lang = 'ko' }: { lang?: string }) {
  const { user, signInWithGoogle } = useAuth();
  const [courses, setCourses] = useState<any[]>([]);
  const [topCourseImages, setTopCourseImages] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);

  const fetchCourses = async () => {
    try {
      const res = await fetch(`/api-now/courses?lang=${lang}`);
      if (res.ok) setCourses(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [lang]);

  // 1위 코스의 방문지(최대 3곳) 이미지를 개별 조회해 콜라주 썸네일 구성 — steps 데이터엔
  // place_id/place_name만 있고 이미지가 없어서, 코스가 참조하는 실제 장소 이미지를 가져와야 함
  useEffect(() => {
    const top = courses[0] as any;
    const stepIds: number[] = Array.isArray(top?.steps) ? top.steps.slice(0, 3).map((s: any) => s.place_id).filter(Boolean) : [];
    if (stepIds.length === 0) {
      setTopCourseImages([]);
      return;
    }
    let cancelled = false;
    Promise.all(stepIds.map((id) => fetch(`/api-now/places/${id}`).then(r => r.ok ? r.json() : null).catch(() => null)))
      .then((results) => {
        if (cancelled) return;
        setTopCourseImages(results.filter(Boolean).map((p: any) => p.image_url).filter(Boolean));
      });
    return () => { cancelled = true; };
  }, [courses]);

  const toggleCourseLike = async (e: React.MouseEvent, courseId: number) => {
    e.stopPropagation();
    if (!user) return signInWithGoogle();
    try {
      const res = await fetch('/api-now/courses/like/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, course_id: courseId }),
      });
      if (res.ok) fetchCourses();
    } catch (e) {
      console.error(e);
    }
  };

  const handleForkCourse = async (course: any) => {
    if (!user) return signInWithGoogle();
    try {
      const res = await fetch('/api-now/courses/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          user_image: user.user_metadata?.avatar_url || null,
          title: `[퍼감] ${course.title}`,
          description: course.description,
          steps: Array.isArray(course.steps) ? course.steps : JSON.parse(course.steps),
          region: course.region || '성수',
        }),
      });
      if (res.ok) {
        alert('내 마이페이지로 코스를 가져왔습니다!');
        setSelectedCourse(null);
      } else {
        alert('코스를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.');
        console.error('Fork course failed', res.status, await res.text());
      }
    } catch (e) {
      alert('코스를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.');
      console.error(e);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {courses.slice(0, 25).map((course: any, idx: number) => (
          <div key={course.id}>
            <div onClick={() => setSelectedCourse(course)} className="bg-white rounded-3xl border border-zinc-100 shadow-sm cursor-pointer hover:border-pace-200 transition-all group relative overflow-hidden mb-4">
              {idx === 0 && (
                <div className="relative h-[104px] grid grid-cols-3 gap-0.5 bg-zinc-100">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="relative overflow-hidden bg-zinc-200">
                      {topCourseImages[i] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={topCourseImages[i]} className="w-full h-full object-cover" alt={course.title} referrerPolicy="no-referrer" />
                      )}
                    </div>
                  ))}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
                    <Flame size={11} className="text-rose-400" fill="currentColor" /> 1{lang === 'en' ? 'st' : lang === 'zh' ? '位' : lang === 'ja' ? '位' : '위'}
                  </div>
                </div>
              )}
              <div className="p-5 space-y-4 relative">
                {idx !== 0 && (
                  <div className="absolute -left-1 -top-1 w-8 h-8 bg-zinc-900 text-white text-[10px] font-black rounded-br-2xl flex items-center justify-center shadow-lg z-10">
                    {idx + 1}
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-100 flex-shrink-0 bg-zinc-50">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={course.user_image || `https://ui-avatars.com/api/?name=${course.user_name || 'U'}&background=random`}
                      className="w-full h-full object-cover"
                      alt={course.user_name || ''}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] font-bold text-zinc-900 truncate">{course.user_name}</p>
                      <span className={
                        "text-[7px] font-black px-1.5 py-0.5 rounded uppercase border " +
                        (course.region === '홍대' ? "bg-orange-50 text-orange-600 border-orange-100"
                        : course.region === '강북' ? "bg-yellow-50 text-yellow-700 border-yellow-100"
                        : course.region === '강남' ? "bg-pink-50 text-pink-600 border-pink-100"
                        : course.region === '공연' ? "bg-purple-50 text-purple-600 border-purple-100"
                        : course.region === '제주' ? "bg-sky-50 text-[#0369a1] border-sky-200"
                        : course.region === '축제' ? "bg-amber-50 text-amber-600 border-amber-100"
                        : "bg-pace-50 text-pace-600 border-pace-100")
                      }>
                        {lang === 'en'
                          ? (course.region === '홍대' ? 'Hongdae' : course.region === '강북' ? 'Gangbuk' : course.region === '강남' ? 'Gangnam' : course.region === '공연' ? 'Concert' : course.region === '제주' ? 'Jeju' : course.region === '축제' ? 'Festival' : 'Seongsu')
                          : lang === 'zh'
                            ? (course.region === '홍대' ? '弘大' : course.region === '강북' ? '江北' : course.region === '강남' ? '江南' : course.region === '공연' ? '演出' : course.region === '제주' ? '济州' : course.region === '축제' ? '节庆' : '圣水洞')
                            : lang === 'ja'
                              ? (course.region === '홍대' ? 'ホンデ' : course.region === '강북' ? 'カンブク' : course.region === '강남' ? 'カンナム' : course.region === '공연' ? 'コンサート' : course.region === '제주' ? '済州' : course.region === '축제' ? 'フェスティバル' : 'ソンス')
                              : (course.region || '성수')}
                      </span>
                    </div>
                    <p className="text-[8px] text-zinc-400 font-medium">Verified Local Guide</p>
                  </div>
                  <button onClick={(e) => toggleCourseLike(e, course.id)} className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100 hover:bg-rose-50 transition-all group/like">
                    <Heart size={14} className="text-zinc-300 group-hover/like:text-rose-500 transition-colors" />
                    <span className="text-[10px] font-black text-zinc-400 group-hover/like:text-rose-600">{course.like_count}</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-zinc-900 text-sm tracking-tight group-hover:text-pace-600 transition-colors">
                    {(lang === 'en' && course.title_en) ? course.title_en : course.title}
                  </h4>
                  <p className="text-[11px] text-zinc-500 line-clamp-1">
                    {(lang === 'en' && course.description_en) ? course.description_en : course.description}
                  </p>
                </div>
              </div>
            </div>

            {idx === 1 && <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />}
            {idx === 14 && <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />}
          </div>
        ))}
      </motion.div>

      <AnimatePresence>
        {selectedCourse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedCourse(null)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedCourse.user_image} className="w-10 h-10 rounded-full border border-zinc-100" alt={selectedCourse.user_name || ''} />
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedCourse.title}</h3>
                    <p className="text-xs text-zinc-400 font-bold">
                      {selectedCourse.user_name}의 추천 코스
                      {selectedCourse.created_at && (
                        <span className="ml-2 font-normal text-zinc-300">
                          {new Date(selectedCourse.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedCourse(null)} className="p-2 bg-zinc-100 rounded-full"><X size={20} /></button>
              </div>

              <div className="relative space-y-8 mb-10 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-100">
                {(Array.isArray(selectedCourse.steps) ? selectedCourse.steps : JSON.parse(selectedCourse.steps)).map((step: any, idx: number) => (
                  <div key={idx} className="relative pl-10">
                    <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-4 border-pace-500 z-10" />
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-zinc-400 font-mono uppercase">{step.time} • {step.duration}MIN</p>
                      <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-zinc-900 text-sm">{step.place_name}</h4>
                            {step.date_range && (
                              <p className="text-[10px] text-pace-600 font-bold mt-0.5">{step.date_range}</p>
                            )}
                            <p className="text-[11px] text-zinc-500 mt-1">{step.activity}</p>
                          </div>
                          {step.place_id && (
                            <Link
                              href={`/posts/${step.place_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
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

              <motion.button
                whileTap={{ scale: 0.96 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => handleForkCourse(selectedCourse)}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-pace-600 transition-all"
              >
                <Save size={20} /> 이 코스 내 마이페이지로 퍼가기
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
