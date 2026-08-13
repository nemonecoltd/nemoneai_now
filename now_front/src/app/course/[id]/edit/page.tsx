"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronUp, ChevronDown, X, Plus, Search, Loader2,
  Save, Send, MessageSquarePlus, Clock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import BrandTagline from '@/components/BrandTagline';
import HeaderControls from '@/components/HeaderControls';
import Logo from '@/components/Logo';

interface Step {
  place_id: number;
  place_name: string;
  activity: string;
  duration: number;
  date_range?: string | null;
}

interface Course {
  id: number;
  user_id: string;
  title: string;
  description: string;
  steps: Step[];
  region: string;
  scope: 'timed' | 'free';
  source: string;
  is_public: boolean;
}

function formatStepTimes(steps: Step[]): string[] {
  // timed 코스의 시간 라벨은 저장하지 않고 14:00 시작 + duration 누적으로 매번 계산
  // — 순서를 바꿔도 AI 재호출 없이 시간표가 재배열되는 핵심 장치
  let cursor = 14 * 60;
  return steps.map((s) => {
    const h = Math.floor(cursor / 60) % 24;
    const m = cursor % 60;
    cursor += s.duration || 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
}

export default function CourseEditPage() {
  const params = useParams();
  const courseId = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'ko';
  const tr = (ko: string, en: string, zh: string, ja: string) =>
    lang === 'en' ? en : lang === 'zh' ? zh : lang === 'ja' ? ja : ko;
  const { user, session, isLoading: authLoading } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [reported, setReported] = useState(false);

  const authHeader = () => ({ Authorization: `Bearer ${session?.access_token || ''}` });

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/course'); return; }
    (async () => {
      try {
        const res = await fetch(`/api-now/courses/${courseId}`, { headers: authHeader() });
        if (res.status === 404) { setNotFound(true); return; }
        const data: Course = await res.json();
        if (data.user_id !== user.id) { setForbidden(true); return; }
        setCourse(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setSteps(Array.isArray(data.steps) ? data.steps : JSON.parse((data.steps as any) || '[]'));
      } catch (e) {
        console.error(e);
        setNotFound(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, user, authLoading]);

  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const removeStep = (idx: number) => setSteps((prev) => prev.filter((_, i) => i !== idx));

  const updateStepActivity = (idx: number, activity: string) =>
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, activity } : s)));

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    setReported(false);
    try {
      const res = await fetch(`/api-now/places/search?q=${encodeURIComponent(q)}&region=${encodeURIComponent(course?.region || '성수')}`);
      if (res.ok) setSearchResults(await res.json());
    } finally {
      setSearching(false);
    }
  }, [course]);

  useEffect(() => {
    const t = setTimeout(() => runSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, runSearch]);

  const addStep = (place: any) => {
    setSteps((prev) => [...prev, { place_id: place.id, place_name: place.title, activity: '', duration: 60, date_range: place.date_range || null }]);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const reportMissingPlace = async () => {
    try {
      await fetch('/api-now/place_reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ query: searchQuery, region: course?.region }),
      });
      setReported(true);
    } catch (e) {
      console.error(e);
    }
  };

  const persist = async (): Promise<boolean> => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api-now/courses/${courseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ title, description, steps }),
      });
      return res.ok;
    } catch (e) {
      console.error(e);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    const ok = await persist();
    alert(ok
      ? tr('임시저장되었습니다.', 'Saved as draft.', '已暂存。', '一時保存しました。')
      : tr('저장에 실패했습니다. 잠시 후 다시 시도해주세요.', 'Save failed. Please try again later.', '保存失败，请稍后重试。', '保存に失敗しました。しばらくしてから再試行してください。'));
  };

  const handlePublish = async () => {
    if (steps.length === 0) {
      alert(tr('장소를 1곳 이상 담아야 발행할 수 있습니다.', 'You need at least 1 place to publish.', '至少需要添加1个地点才能发布。', '発行するには最低1つの場所が必要です。'));
      return;
    }
    setIsPublishing(true);
    try {
      const saved = await persist();
      if (!saved) throw new Error('저장 실패');
      const res = await fetch(`/api-now/courses/${courseId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ title: title.trim() || null }),
      });
      if (!res.ok) throw new Error('발행 실패');
      router.push(`/course/${courseId}?published=1`);
    } catch (e) {
      console.error(e);
      alert(tr('발행 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'An error occurred while publishing. Please try again later.', '发布时发生错误，请稍后重试。', '発行中にエラーが発生しました。しばらくしてから再試行してください。'));
    } finally {
      setIsPublishing(false);
      setShowPublishConfirm(false);
    }
  };

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 max-w-md mx-auto px-6 text-center">
        <p className="text-lg font-bold text-zinc-800">{tr('코스를 찾을 수 없습니다', 'Course Not Found', '找不到该课程', 'コースが見つかりません')}</p>
        <button onClick={() => router.push(`/course?lang=${lang}`)} className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">{tr('코스 홈으로', 'Go to Course Home', '返回课程首页', 'コースホームへ')}</button>
      </div>
    );
  }
  if (forbidden) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 max-w-md mx-auto px-6 text-center">
        <p className="text-lg font-bold text-zinc-800">{tr('내가 만든 코스만 편집할 수 있어요', 'You can only edit courses you created', '只能编辑自己创建的课程', '自分が作成したコースのみ編集できます')}</p>
        <button onClick={() => router.push(`/course/${courseId}?lang=${lang}`)} className="px-6 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm">{tr('코스 보러가기', 'View Course', '查看课程', 'コースを見る')}</button>
      </div>
    );
  }
  if (!course) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-zinc-300" size={32} /></div>;
  }

  const times = course.scope === 'timed' ? formatStepTimes(steps) : [];

  return (
    <div className="min-h-screen bg-zinc-50 max-w-md mx-auto relative shadow-2xl border-x border-zinc-200 pb-32">
      <header className="sticky top-0 bg-white/90 backdrop-blur-xl z-40 border-b border-zinc-100 px-6 pt-4 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => router.push(`/course?lang=${lang}`)} className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all">
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <Logo />
          </div>
          <HeaderControls />
        </div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-zinc-500 truncate">{tr('코스 편집', 'Edit Course', '编辑课程', 'コース編集')}</span>
          <span className="text-[10px] font-black text-pace-600 bg-pace-50 px-2 py-1 rounded-md uppercase flex-shrink-0">
            {course.scope === 'timed' ? tr('3시간코스', '3-Hour Course', '3小时课程', '3時間コース') : tr('자유코스', 'Free Course', '自由课程', 'フリーコース')}
          </span>
        </div>
        <BrandTagline lang={lang} />
      </header>

      <main className="px-6 py-6 space-y-6">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={tr('코스 제목을 입력하세요 (비워두면 발행 시 자동 생성)', 'Enter a course title (auto-generated if left blank)', '请输入课程标题（留空则发布时自动生成）', 'コースタイトルを入力してください（空欄の場合、発行時に自動生成されます）')}
          className="w-full text-xl font-bold text-zinc-900 bg-transparent border-b border-zinc-200 focus:border-pace-400 outline-none py-2"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={tr('코스에 대한 소개를 적어주세요', 'Write an introduction for this course', '请写一段课程介绍', 'コースの紹介を書いてください')}
          rows={3}
          className="w-full text-sm text-zinc-600 bg-white border border-zinc-100 rounded-2xl p-4 outline-none focus:border-pace-200 resize-none"
        />

        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={`${step.place_id}-${idx}`} className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm flex gap-3">
              <div className="flex flex-col gap-1 pt-1">
                <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="p-1 text-zinc-300 hover:text-zinc-600 disabled:opacity-20 transition-colors">
                  <ChevronUp size={16} />
                </button>
                <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="p-1 text-zinc-300 hover:text-zinc-600 disabled:opacity-20 transition-colors">
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {course.scope === 'timed' && (
                      <span className="text-[10px] font-black text-zinc-400 font-mono flex-shrink-0">{times[idx]}</span>
                    )}
                    <h4 className="font-bold text-zinc-900 text-sm truncate">{step.place_name}</h4>
                  </div>
                  <button onClick={() => removeStep(idx)} className="p-1 text-zinc-300 hover:text-rose-500 flex-shrink-0 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <input
                  value={step.activity}
                  onChange={(e) => updateStepActivity(idx, e.target.value)}
                  placeholder={tr('이곳에서 무엇을 할까요?', 'What will you do here?', '在这里做什么？', 'ここで何をしますか？')}
                  className="w-full text-xs text-zinc-600 bg-zinc-50 rounded-xl px-3 py-2 outline-none focus:bg-pace-50"
                />
              </div>
            </div>
          ))}

          <button
            onClick={() => setShowSearch(true)}
            className="w-full py-4 border-2 border-dashed border-zinc-200 rounded-2xl text-zinc-400 font-bold text-sm flex items-center justify-center gap-2 hover:border-pace-200 hover:text-pace-600 transition-all"
          >
            <Plus size={18} /> {tr('장소 추가', 'Add Place', '添加地点', '場所を追加')}
          </button>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-zinc-100 p-4 flex gap-2">
        <button
          onClick={handleSaveDraft}
          disabled={isSaving || isPublishing}
          className="flex-1 py-4 bg-zinc-100 text-zinc-700 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-zinc-200 transition-all disabled:opacity-50 text-sm"
        >
          <Save size={18} /> {tr('임시저장', 'Save Draft', '暂存', '一時保存')}
        </button>
        <button
          onClick={() => setShowPublishConfirm(true)}
          disabled={isSaving || isPublishing}
          className="flex-1 py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-pace-600 transition-all disabled:opacity-50 text-sm shadow-xl"
        >
          <Send size={18} /> {tr('발행하기', 'Publish', '发布', '発行する')}
        </button>
      </div>

      {/* 장소 검색 오버레이 */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowSearch(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="w-full max-w-md bg-white rounded-t-[40px] p-6 max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 bg-zinc-100 rounded-2xl px-4 py-3 mb-4">
                <Search size={18} className="text-zinc-400 flex-shrink-0" />
                <input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={tr(`${course.region}에서 장소 검색`, `Search places in ${course.region}`, `搜索${course.region}的地点`, `${course.region}で場所を検索`)}
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                {searching && <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-zinc-300" /></div>}

                {!searching && searchQuery.trim() && searchResults.length === 0 && (
                  <div className="py-10 text-center space-y-3">
                    <p className="text-sm text-zinc-400">{tr('검색 결과가 없어요.', 'No results found.', '没有找到相关结果。', '検索結果がありません。')}</p>
                    {!reported ? (
                      <button onClick={reportMissingPlace} className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-100 text-zinc-600 rounded-xl text-xs font-bold hover:bg-zinc-200 transition-all">
                        <MessageSquarePlus size={14} /> {tr('이 장소 제보하기', 'Report This Place', '提交该地点信息', 'この場所を報告する')}
                      </button>
                    ) : (
                      <p className="text-xs text-pace-600 font-bold">{tr('제보해주셔서 감사합니다!', 'Thanks for the report!', '感谢您的反馈！', 'ご報告ありがとうございます！')}</p>
                    )}
                  </div>
                )}

                {searchResults.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => addStep(place)}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-zinc-50 transition-all text-left"
                  >
                    <img
                      src={place.image_url || `https://picsum.photos/seed/${place.id}/200`}
                      className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-zinc-100"
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-zinc-900 truncate">{place.title}</p>
                      <p className="text-[10px] text-zinc-400 truncate">{place.location}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 발행 확인 */}
      <AnimatePresence>
        {showPublishConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6" onClick={() => !isPublishing && setShowPublishConfirm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-black text-zinc-900">{tr('코스를 발행할까요?', 'Publish this course?', '要发布该课程吗？', 'コースを発行しますか？')}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {tr('발행하면 다른 사람들도 이 코스를 볼 수 있어요.', 'Once published, other people can view this course too.', '发布后，其他人也可以查看该课程。', '発行すると、他のユーザーもこのコースを見られるようになります。')}
                {!title.trim() && ' ' + tr('제목을 비워두셔서 지역·장소 구성으로 제목이 자동 생성돼요.', 'Since you left the title blank, one will be auto-generated from the region and places.', '由于标题为空，将根据地区和地点自动生成标题。', 'タイトルが空欄のため、エリアと場所の構成からタイトルが自動生成されます。')}
              </p>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowPublishConfirm(false)} className="flex-1 py-3 bg-zinc-100 text-zinc-600 rounded-2xl font-bold text-sm">{tr('취소', 'Cancel', '取消', 'キャンセル')}</button>
                <button onClick={handlePublish} disabled={isPublishing} className="flex-1 py-3 bg-zinc-900 text-white rounded-2xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPublishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {tr('발행하기', 'Publish', '发布', '発行する')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
