"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Route, Heart, ChevronRight, User, Sparkles, X, Share2, Copy, Save, MapPin, Calendar, Video, Flame, Bot, Clock, Info } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import AdUnit from './AdUnit';
import ClosingSoonTicker from './ClosingSoonTicker';
import AskAI from './AskAI';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'course' | 'theme' | 'place' | 'concert' | 'festival' | 'shopping' | 'exhibition';
const PLACE_RANKING_REGIONS = ['종합', '성수', '홍대', '강북', '강남', '부산', '제주'] as const;
// 지역 전환 슬라이드 애니메이션 — custom(스와이프 방향)에 따라 진입/퇴장 방향이 반대가 됨
const regionSlideVariants = {
  enter: (dir: 1 | -1) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: 1 | -1) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};
type PlaceRankingRegion = typeof PLACE_RANKING_REGIONS[number];
const AI_COURSE_REGIONS = ['성수', '홍대', '강북', '강남', '제주'] as const;
type AiCourseRegion = typeof AI_COURSE_REGIONS[number];
type Companion = 'solo' | 'couple' | 'friends';
const COMPANION_LABEL: Record<Companion, string> = { solo: '혼자', couple: '연인', friends: '친구' };

export default function Recommendation({ places: initialPlaces = [], lang = 'ko' }: { places?: any[], lang?: string }) {
  const { user, session, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('place');
  const [courses, setCourses] = useState([]);
  const [topCourseImages, setTopCourseImages] = useState<string[]>([]); // 1위 코스 콜라주용 — steps에 썸네일이 없어 방문지 장소 이미지를 개별 조회
  const [themes, setThemes] = useState([]);
  const [places, setPlaces] = useState(initialPlaces);
  const [placeRegion, setPlaceRegion] = useState<PlaceRankingRegion>('종합');
  const [placeSwipeDir, setPlaceSwipeDir] = useState<1 | -1>(1); // 지역 전환 슬라이드 방향(1=다음/왼쪽으로, -1=이전/오른쪽으로)
  const placePillsRef = useRef<HTMLDivElement>(null);
  const [concerts, setConcerts] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [shopping, setShopping] = useState([]);
  const [exhibitions, setExhibitions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedTheme, setSelectedTheme] = useState<any>(null);
  const [selectedPlace, setSelectedPlace] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showAskAI, setShowAskAI] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseRegion, setCourseRegion] = useState<AiCourseRegion>('성수');
  const [courseCompanion, setCourseCompanion] = useState<Companion>('solo');
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [courseUsage, setCourseUsage] = useState({ usage_count: 0, limit: 2 });

  useEffect(() => {
    if (placeRegion === '종합') setPlaces(initialPlaces);
  }, [initialPlaces, placeRegion]);

  // 스와이프/탭으로 지역이 바뀔 때 활성 pill이 가로 스크롤 영역 밖에 있으면 안 보여서
  // "스와이프가 뭘 바꿨는지" 체감이 안 됨 — 항상 활성 pill이 보이게 자동 스크롤.
  useEffect(() => {
    const el = placePillsRef.current?.querySelector<HTMLElement>(`[data-region="${placeRegion}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [placeRegion]);

  // 1위 코스의 방문지(최대 4곳) 이미지를 개별 조회해 콜라주 썸네일 구성 — steps 데이터엔
  // place_id/place_name만 있고 이미지가 없어서, 코스가 참조하는 실제 장소 이미지를 가져와야 함
  useEffect(() => {
    const top = courses[0] as any;
    const stepIds: number[] = Array.isArray(top?.steps) ? top.steps.slice(0, 4).map((s: any) => s.place_id).filter(Boolean) : [];
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

  useEffect(() => {
    if (activeTab === 'course') {
      fetchCourses();
    } else if (activeTab === 'theme') {
      fetchThemes();
    } else if (activeTab === 'concert') {
      fetchConcerts();
    } else if (activeTab === 'festival') {
      fetchFestivals();
    } else if (activeTab === 'shopping') {
      fetchShopping();
    } else if (activeTab === 'exhibition') {
      fetchExhibitions();
    } else if (activeTab === 'place' && placeRegion !== '종합') {
      fetchPlacesByRegion(placeRegion);
    }
  }, [activeTab, lang, placeRegion]);

  const fetchPlacesByRegion = async (region: PlaceRankingRegion) => {
    if (region === '종합') {
      setPlaces(initialPlaces);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places/popular?region=${encodeURIComponent(region)}&t=${Date.now()}`);
      if (res.ok) setPlaces(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  // pill 탭 클릭과 스와이프 둘 다 이걸 거쳐서 지역을 바꿈 — 인덱스 비교로 슬라이드 방향을
  // 정해서, 탭으로 눌러도 스와이프한 것처럼 콘텐츠가 방향에 맞게 슬라이드 전환되게 함.
  const changeRegion = (next: PlaceRankingRegion) => {
    const curIdx = PLACE_RANKING_REGIONS.indexOf(placeRegion);
    const nextIdx = PLACE_RANKING_REGIONS.indexOf(next);
    setPlaceSwipeDir(nextIdx >= curIdx ? 1 : -1);
    setPlaceRegion(next);
  };

  // 지역 탭(종합/성수/홍대/…) 스와이프 전환 — 왼쪽으로 스와이프하면 다음 지역, 오른쪽이면 이전 지역.
  // 배열 끝에서는 그냥 멈춤(순환 안 함) — 순환시키면 "종합" 옆에 "제주"가 붙어 방향 감각이 헷갈림.
  const handlePlaceSwipe = (offsetX: number, velocityX: number) => {
    const SWIPE_DISTANCE = 60;
    const SWIPE_VELOCITY = 400;
    const idx = PLACE_RANKING_REGIONS.indexOf(placeRegion);
    if (offsetX < -SWIPE_DISTANCE || velocityX < -SWIPE_VELOCITY) {
      if (idx < PLACE_RANKING_REGIONS.length - 1) changeRegion(PLACE_RANKING_REGIONS[idx + 1]);
    } else if (offsetX > SWIPE_DISTANCE || velocityX > SWIPE_VELOCITY) {
      if (idx > 0) changeRegion(PLACE_RANKING_REGIONS[idx - 1]);
    }
  };

  const fetchConcerts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places/popular/performance?t=${Date.now()}`);
      if (res.ok) setConcerts(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFestivals = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places/popular/festival?t=${Date.now()}`);
      if (res.ok) setFestivals(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShopping = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places/popular/shopping?t=${Date.now()}`);
      if (res.ok) setShopping(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchExhibitions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/places/popular/exhibition?t=${Date.now()}`);
      if (res.ok) setExhibitions(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCourses = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/courses?lang=${lang}`);
      if (res.ok) setCourses(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchThemes = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api-now/themes`);
      if (res.ok) setThemes(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchData = async () => {
    if (activeTab === 'course') fetchCourses();
    if (activeTab === 'theme') fetchThemes();
  };

  const toggleCourseLike = async (e: React.MouseEvent, courseId: number) => {
    e.stopPropagation();
    if (!user) return signInWithGoogle();

    try {
      const res = await fetch('/api-now/courses/like/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, course_id: courseId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleThemeLike = async (e: React.MouseEvent, themeId: number) => {
    e.stopPropagation();
    if (!user) return signInWithGoogle();

    try {
      const res = await fetch('/api-now/themes/like/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, theme_id: themeId }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openCourseModal = async () => {
    setShowCourseModal(true);
    if (!user) return;
    try {
      const res = await fetch(`/api-now/users/${user.id}/usage/itinerary`);
      if (res.ok) setCourseUsage(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

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
        setShowCourseModal(false);
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
          region: course.region || '성수'
        }),
      });
      if (res.ok) {
        alert("내 마이페이지로 코스를 가져왔습니다!");
        setSelectedCourse(null);
      } else {
        alert("코스를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
        console.error("Fork course failed", res.status, await res.text());
      }
    } catch (e) {
      alert("코스를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
      console.error(e);
    }
  };

  const handleForkTheme = async (theme: any) => {
    if (!user) return signInWithGoogle();
    
    try {
      const res = await fetch('/api-now/themes/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          user_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          user_image: user.user_metadata?.avatar_url || null,
          title: `[퍼감] ${theme.title}`,
          description: theme.description,
          places: Array.isArray(theme.places) ? theme.places : JSON.parse(theme.places)
        })
      });
      if (res.ok) {
        alert("내 마이페이지로 테마를 가져왔습니다!");
        setSelectedTheme(null);
      } else {
        alert("테마를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
        console.error("Fork theme failed", res.status, await res.text());
      }
    } catch (e) {
      alert("테마를 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.");
      console.error(e);
    }
  };

  // 랭킹 공유/마이페이지 저장 — 클릭 시점의 top10 스냅샷을 그대로 고정해서 보관(라이브 랭킹과 무관하게 유지)
  const isShareableTab = activeTab === 'place' || activeTab === 'concert' || activeTab === 'festival' || activeTab === 'shopping' || activeTab === 'exhibition';
  const currentRankingLabel = activeTab === 'place'
    ? `${placeRegion === '종합' ? '종합' : placeRegion} 팝업 랭킹`
    : activeTab === 'concert' ? '공연 랭킹'
    : activeTab === 'festival' ? '축제 랭킹'
    : activeTab === 'shopping' ? '쇼핑 랭킹'
    : '전시 랭킹';

  const getCurrentRankingList = () =>
    activeTab === 'place' ? places
    : activeTab === 'concert' ? concerts
    : activeTab === 'festival' ? festivals
    : activeTab === 'shopping' ? shopping
    : exhibitions;

  const createRankingShare = async (opts: { tab: string; region?: string | null; label: string; items: any[]; userId?: string }) => {
    const res = await fetch('/api-now/ranking/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tab: opts.tab,
        region: opts.region ?? null,
        label: opts.label,
        items: opts.items,
        user_id: opts.userId || null,
      }),
    });
    if (!res.ok) throw new Error('공유 링크 생성 실패');
    return res.json();
  };

  const handleShareRanking = async () => {
    try {
      const items = getCurrentRankingList().slice(0, 10).map((p: any) => ({
        id: p.id, title: p.title, title_en: p.title_en, title_zh: p.title_zh,
        image_url: p.image_url, region: p.region, category: p.category, date_range: p.date_range, score: p.score,
      }));
      const { id } = await createRankingShare({ tab: activeTab, region: activeTab === 'place' ? placeRegion : null, label: currentRankingLabel, items });
      const url = `${window.location.origin}/ranking/share/${id}`;
      await navigator.clipboard.writeText(url);
      alert('공유 링크가 복사되었습니다!');
    } catch (e) {
      alert('공유 링크 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
      console.error(e);
    }
  };

  const handleSaveRanking = async () => {
    if (!user) return signInWithGoogle();
    try {
      const items = getCurrentRankingList().slice(0, 10).map((p: any) => ({
        id: p.id, title: p.title, title_en: p.title_en, title_zh: p.title_zh,
        image_url: p.image_url, region: p.region, category: p.category, date_range: p.date_range, score: p.score,
      }));
      await createRankingShare({ tab: activeTab, region: activeTab === 'place' ? placeRegion : null, label: currentRankingLabel, items, userId: user.id });
      alert('마이페이지에 저장했습니다!');
    } catch (e) {
      alert('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
      console.error(e);
    }
  };

  // 테마 상세(선택한 테마 하나에 딸린 장소 10개)를 공유/저장 — 테마 랭킹 목록 자체는 공유 대상 아님
  const handleShareTheme = async (theme: any) => {
    try {
      const themePlaces = typeof theme.places === 'string' ? JSON.parse(theme.places) : theme.places;
      const items = themePlaces.slice(0, 10).map((p: any) => ({ id: p.id, title: p.title, image_url: p.image_url, region: p.region, date_range: p.date_range }));
      const { id } = await createRankingShare({ tab: 'theme', label: theme.title, items });
      const url = `${window.location.origin}/ranking/share/${id}`;
      await navigator.clipboard.writeText(url);
      alert('공유 링크가 복사되었습니다!');
    } catch (e) {
      alert('공유 링크 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50">
      <ClosingSoonTicker lang={lang} />
      <div className="px-6 pt-2.5 flex gap-2">
        <button
          onClick={openCourseModal}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-zinc-900 text-white rounded-2xl text-xs font-bold hover:bg-pace-600 transition-all shadow-sm"
        >
          <Sparkles size={14} />
          {lang === 'en' ? 'AI Course' : lang === 'zh' ? 'AI路线' : lang === 'ja' ? 'AIコース' : 'AI코스생성'}
        </button>
        <button
          onClick={() => setShowAskAI(true)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white text-zinc-900 border border-zinc-200 rounded-2xl text-xs font-bold hover:border-pace-300 hover:text-pace-600 transition-all shadow-sm"
        >
          <Bot size={14} />
          {lang === 'en' ? 'AI Guide' : lang === 'zh' ? 'AI导游' : lang === 'ja' ? 'AIガイド' : 'AI가이드'}
        </button>
      </div>
      <div className="px-6 py-2.5">
        <div className="flex gap-1 bg-zinc-200/50 p-1 rounded-2xl overflow-x-auto no-scrollbar">
          <button onClick={() => setActiveTab('course')} className={cn("flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap", activeTab === 'course' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? '3-Hour' : lang === 'zh' ? '3小时' : lang === 'ja' ? '3時間' : '3시간'}
          </button>
          <button onClick={() => setActiveTab('theme')} className={cn("flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap", activeTab === 'theme' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Themes' : lang === 'zh' ? '主题' : lang === 'ja' ? 'テーマ' : '테마'}
          </button>
          <button onClick={() => setActiveTab('place')} className={cn("flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap", activeTab === 'place' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Pop-ups' : lang === 'zh' ? '快闪店' : lang === 'ja' ? 'ポップアップ' : '팝업'}
          </button>
          <button onClick={() => setActiveTab('shopping')} className={cn("flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap", activeTab === 'shopping' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Shopping' : lang === 'zh' ? '购物' : lang === 'ja' ? 'ショッピング' : '쇼핑'}
          </button>
          <button onClick={() => setActiveTab('exhibition')} className={cn("flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap", activeTab === 'exhibition' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Exhibits' : lang === 'zh' ? '展览' : lang === 'ja' ? '展示' : '전시'}
          </button>
          <button onClick={() => setActiveTab('concert')} className={cn("flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap", activeTab === 'concert' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Concerts' : lang === 'zh' ? '演出' : lang === 'ja' ? '公演' : '공연'}
          </button>
          <button onClick={() => setActiveTab('festival')} className={cn("flex-shrink-0 px-3 py-2 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap", activeTab === 'festival' ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400")}>
            {lang === 'en' ? 'Festivals' : lang === 'zh' ? '节庆' : lang === 'ja' ? '祭り' : '축제'}
          </button>
        </div>
        {activeTab === 'place' && (
          <div ref={placePillsRef} className="flex gap-1.5 mt-1.5 overflow-x-auto no-scrollbar">
            {PLACE_RANKING_REGIONS.map((r) => (
              <button
                key={r}
                data-region={r}
                onClick={() => changeRegion(r)}
                className={cn(
                  "flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border",
                  placeRegion === r ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
                )}
              >
                {r === '종합'
                  ? (lang === 'en' ? 'All' : lang === 'zh' ? '综合' : lang === 'ja' ? '総合' : '종합')
                  : r === '홍대'
                    ? (lang === 'en' ? 'Hongdae' : lang === 'zh' ? '弘大' : lang === 'ja' ? 'ホンデ' : '홍대')
                    : r === '강북'
                      ? (lang === 'en' ? 'Gangbuk' : lang === 'zh' ? '江北' : lang === 'ja' ? 'カンブク' : '강북')
                      : r === '강남'
                        ? (lang === 'en' ? 'Gangnam' : lang === 'zh' ? '江南' : lang === 'ja' ? 'カンナム' : '강남')
                        : r === '부산'
                          ? (lang === 'en' ? 'Busan' : lang === 'zh' ? '釜山' : lang === 'ja' ? '釜山' : '부산')
                          : r === '제주'
                            ? (lang === 'en' ? 'Jeju' : lang === 'zh' ? '济州' : lang === 'ja' ? '済州' : '제주')
                            : (lang === 'en' ? 'Seongsu' : lang === 'zh' ? '圣水洞' : lang === 'ja' ? 'ソンス' : '성수')}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 no-scrollbar">
        <AnimatePresence mode="wait">
          {activeTab === 'course' ? (
            <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-1">
              {courses.slice(0, 25).map((course: any, idx: number) => (
                <div key={course.id}>
                  <div onClick={() => setSelectedCourse(course)} className="bg-white rounded-3xl border border-zinc-100 shadow-sm cursor-pointer hover:border-pace-200 transition-all group relative overflow-hidden mb-4">
                    {idx === 0 && (
                      <div className="relative h-[104px] grid grid-cols-2 gap-0.5 bg-zinc-100">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div key={i} className="relative overflow-hidden bg-zinc-200">
                            {topCourseImages[i] && (
                              <img src={topCourseImages[i]} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                            )}
                          </div>
                        ))}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
                          <Flame size={11} className="text-rose-400" fill="currentColor" /> 1{lang === 'en' ? 'st' : lang === 'zh' ? '位' : '위'}
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
                        <img
                          src={course.user_image || `https://ui-avatars.com/api/?name=${course.user_name || 'U'}&background=random`}
                          className="w-full h-full object-cover"
                          alt={course.user_name || ''}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-zinc-900 truncate">{course.user_name}</p>
                          <span className={cn(
                            "text-[7px] font-black px-1.5 py-0.5 rounded uppercase border",
                            course.region === '홍대' ? "bg-orange-50 text-orange-600 border-orange-100"
                            : course.region === '강북' ? "bg-yellow-50 text-yellow-700 border-yellow-100"
                            : course.region === '강남' ? "bg-pink-50 text-pink-600 border-pink-100"
                            : course.region === '공연' ? "bg-purple-50 text-purple-600 border-purple-100"
                            : course.region === '제주' ? "bg-sky-50 text-[#0369a1] border-sky-200"
                            : course.region === '축제' ? "bg-amber-50 text-amber-600 border-amber-100"
                            : "bg-pace-50 text-pace-600 border-pace-100"
                          )}>
                            {lang === 'en'
                              ? (course.region === '홍대' ? 'Hongdae' : course.region === '강북' ? 'Gangbuk' : course.region === '강남' ? 'Gangnam' : course.region === '공연' ? 'Concert' : course.region === '제주' ? 'Jeju' : course.region === '축제' ? 'Festival' : 'Seongsu')
                              : lang === 'zh'
                                ? (course.region === '홍대' ? '弘大' : course.region === '강북' ? '江北' : course.region === '강남' ? '江南' : course.region === '공연' ? '演出' : course.region === '제주' ? '济州' : course.region === '축제' ? '节庆' : '圣水洞')
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

                  {idx === 0 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                  {idx === 14 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
              ))}
            </motion.div>
          ) : activeTab === 'theme' ? (
            <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-1">
              {themes.slice(0, 25).map((theme: any, idx: number) => (
                <div key={theme.id}>
                  <div onClick={() => setSelectedTheme(theme)} className="bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm space-y-4 cursor-pointer hover:border-blue-200 transition-all group relative overflow-hidden mb-4">
                    <div className="absolute -left-1 -top-1 w-8 h-8 bg-zinc-900 text-white text-[10px] font-black rounded-br-2xl flex items-center justify-center shadow-lg z-10">
                      {idx + 1}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-zinc-100 flex-shrink-0">
                        <img src={theme.user_image || `https://picsum.photos/seed/u${theme.id}/200`} className="w-full h-full object-cover" alt={theme.title} onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/u${theme.id}/200`; }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-bold text-zinc-900 truncate">{theme.user_name || (lang === 'en' ? 'Anony' : lang === 'zh' ? '匿名' : '아무개')}</p>
                          <span className="text-[7px] font-black px-1.5 py-0.5 rounded uppercase border bg-blue-50 text-blue-600 border-blue-100">
                            {lang === 'en' ? 'Theme' : lang === 'zh' ? '主题' : '테마'}
                          </span>
                        </div>
                      </div>
                      <button onClick={(e) => toggleThemeLike(e, theme.id)} className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100 hover:bg-rose-50 transition-all group/like">
                        <Heart size={14} className="text-zinc-300 group-hover/like:text-rose-500 transition-colors" />
                        <span className="text-[10px] font-black text-zinc-400 group-hover/like:text-rose-600">{theme.like_count}</span>
                      </button>
                    </div>
                    
                    <div className="space-y-1">
                      <h4 className="font-bold text-zinc-900 text-sm tracking-tight group-hover:text-blue-600 transition-colors">
                        {theme.title}
                      </h4>
                      <p className="text-[11px] text-zinc-500 line-clamp-1">
                        {theme.description}
                      </p>
                    </div>
                  </div>

                  {idx === 1 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                  {idx === 14 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
              ))}
            </motion.div>
          ) : activeTab === 'place' ? (
            <motion.div
              key="p"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="pt-1 touch-pan-y overflow-x-hidden"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.5}
              onDragEnd={(_e, info) => handlePlaceSwipe(info.offset.x, info.velocity.x)}
            >
            {/* 지역 전환 시 스와이프 방향대로 콘텐츠가 슬라이드 전환 — 순간 교체되면 스와이프가
                뭘 바꿨는지 체감이 안 되던 문제 보완. 바깥 motion.div(key="p")는 드래그 감지만 담당,
                실제 카드 리스트는 placeRegion이 바뀔 때마다 이 안쪽에서 새로 마운트/언마운트됨. */}
            <AnimatePresence mode="wait" custom={placeSwipeDir} initial={false}>
              <motion.div
                key={placeRegion}
                custom={placeSwipeDir}
                variants={regionSlideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: 'easeOut' }}
                className="space-y-6"
              >
              {places.slice(0, 25).map((place: any, idx: number) => {
                const regionBadgeClass = cn(
                  "text-[8px] font-black px-1.5 py-0.5 rounded-md border",
                  place.region === '홍대' ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                  : place.region === '강북' ? "bg-yellow-500 text-white border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                  : place.region === '강남' ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                  : place.region === '공연' ? "bg-purple-500 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                  : place.region === '부산' ? "bg-sky-400 text-white border-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                  : place.region === '제주' ? "bg-[#0369a1] text-white border-[#0369a1] shadow-[0_0_10px_rgba(3,105,161,0.5)]"
                  : place.region === '축제' ? "bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                  : "bg-emerald-50 text-emerald-600 border-emerald-400"
                );
                const regionLabel = lang === 'en'
                  ? (place.region === '홍대' ? 'HONGDAE' : place.region === '강북' ? 'GANGBUK' : place.region === '강남' ? 'GANGNAM' : place.region === '공연' ? 'CONCERT' : place.region === '부산' ? 'BUSAN' : place.region === '제주' ? 'JEJU' : place.region === '축제' ? 'FESTIVAL' : 'SEONGSU')
                  : lang === 'zh'
                    ? (place.region === '홍대' ? '弘大' : place.region === '강북' ? '江北' : place.region === '강남' ? '江南' : place.region === '공연' ? '演出' : place.region === '부산' ? '釜山' : place.region === '제주' ? '济州' : place.region === '축제' ? '节庆' : '圣水洞')
                    : (place.region || '성수');
                const placeTitle = (lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : place.title;
                const secondaryText = place.region === '공연'
                  ? (lang === 'en' ? 'Seoul Concert' : lang === 'zh' ? '首尔演出' : '서울 공연')
                  : place.region === '축제'
                    ? (lang === 'en' ? 'Local Festival' : lang === 'zh' ? '全国节庆' : '전국 축제')
                    : (place.category === 'class' || place.category === 'shopping')
                      ? (lang === 'en' ? 'Always Open' : lang === 'zh' ? '常年营业' : '상시 운영')
                      : place.date_range || (lang === 'en'
                          ? `Near ${place.region === '홍대' ? 'Hongdae' : place.region === '강북' ? 'Gangbuk' : place.region === '강남' ? 'Gangnam' : place.region === '부산' ? 'Busan' : place.region === '제주' ? 'Jeju' : 'Seongsu'}`
                          : lang === 'zh'
                            ? `${place.region === '홍대' ? '弘大' : place.region === '강북' ? '江北' : place.region === '강남' ? '江南' : place.region === '부산' ? '釜山' : place.region === '제주' ? '济州' : '圣水洞'}附近`
                            : `${place.region} 근처`);
                const href = `/posts/${place.id}?region=${encodeURIComponent(place.region || '성수')}&lang=${lang}`;

                return (
                <div key={place.id}>
                  {idx === 0 ? (
                    // 1위 강조 카드 — 장소 메뉴 카드 스타일(큰 이미지)을 그대로 재사용해 통일감 유지
                    <Link href={href} className="block bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden group relative mb-4">
                      <div className="relative h-[104px] overflow-hidden bg-zinc-100">
                        <img
                          src={place.image_url || `https://picsum.photos/seed/${place.id}/400/300`}
                          alt={placeTitle || ''}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          referrerPolicy="no-referrer"
                          onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/400/300`; }}
                        />
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
                          <Flame size={11} className="text-rose-400" fill="currentColor" /> 1{lang === 'en' ? 'st' : lang === 'zh' ? '位' : '위'}
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <span className={regionBadgeClass}>{regionLabel}</span>
                        </div>
                        {place.is_new && (
                          <span className="absolute bottom-2.5 right-2.5 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase bg-rose-500 text-white border border-rose-400 animate-pulse">
                            NEW
                          </span>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-lg font-bold text-zinc-900 tracking-tight">{placeTitle}</h3>
                          {place.category === 'class' && (
                            <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">
                              {lang === 'en' ? 'Class' : lang === 'zh' ? '体验课' : '클래스'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={11} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative group mb-4">
                      <div className="absolute -left-2 -top-2 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                        {idx + 1}
                      </div>
                      <div className="relative flex-shrink-0">
                        <img src={place.image_url || `https://picsum.photos/seed/${place.id}/200`} className="w-16 h-16 rounded-2xl object-cover border border-zinc-50" alt={placeTitle || ''} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/200`; }} />
                        <div className="absolute -bottom-1 -right-1 shadow-lg">
                          <span className={regionBadgeClass}>{regionLabel}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-zinc-900 text-sm truncate tracking-tight">{placeTitle}</h4>
                          {place.category === 'class' && (
                            <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-indigo-50 text-indigo-600 border-indigo-100">
                              {lang === 'en' ? 'Class' : lang === 'zh' ? '体验课' : '클래스'}
                            </span>
                          )}
                          {place.is_new && (
                            <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400 animate-pulse">
                              NEW
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={10} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                      <Link href={href} className="p-2 bg-zinc-50 rounded-xl text-zinc-300 group-hover:bg-pace-50 group-hover:text-pace-500 transition-all">
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  )}

                  {idx === 0 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                  {idx === 14 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
                );
              })}
              </motion.div>
            </AnimatePresence>
            </motion.div>
          ) : activeTab === 'concert' ? (
            <motion.div key="ct" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-1">
              {concerts.length === 0 && !isLoading && (
                <p className="text-center text-xs text-zinc-400 py-10">
                  {lang === 'en' ? 'No concert ranking data yet.' : lang === 'zh' ? '暂无演出排行数据。' : '아직 공연 랭킹 데이터가 없습니다.'}
                </p>
              )}
              {concerts.slice(0, 25).map((place: any, idx: number) => {
                const badgeLabel = lang === 'en'
                  ? (place.category === '연극' ? 'THEATER' : place.category === '뮤지컬' ? 'MUSICAL' : place.category === '음악' ? 'MUSIC' : 'CONCERT')
                  : lang === 'zh'
                    ? (place.category === '연극' ? '话剧' : place.category === '뮤지컬' ? '音乐剧' : place.category === '음악' ? '音乐' : '综合')
                    : (place.category || '종합');
                const badgeClass = "text-[8px] font-black px-1.5 py-0.5 rounded-md border bg-purple-500 text-white border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]";
                const title = (lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : place.title;
                const secondaryText = place.date_range || (lang === 'en' ? 'Seoul Concert' : lang === 'zh' ? '首尔演出' : '서울 공연');
                const href = `/posts/${place.id}?region=공연&lang=${lang}`;
                return (
                <div key={place.id}>
                  {idx === 0 ? (
                    <Link href={href} className="block bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden group relative mb-4">
                      <div className="relative h-[104px] overflow-hidden bg-zinc-100">
                        <img src={place.image_url || `https://picsum.photos/seed/${place.id}/400/300`} alt={title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/400/300`; }} />
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
                          <Flame size={11} className="text-rose-400" fill="currentColor" /> 1{lang === 'en' ? 'st' : lang === 'zh' ? '位' : '위'}
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <span className={badgeClass}>{badgeLabel}</span>
                        </div>
                        {place.is_new && (
                          <span className="absolute bottom-2.5 right-2.5 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase bg-rose-500 text-white border border-rose-400 animate-pulse">NEW</span>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="text-base font-bold text-zinc-900 tracking-tight">{title}</h3>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={11} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative group mb-4">
                      <div className="absolute -left-2 -top-2 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                        {idx + 1}
                      </div>
                      <div className="relative flex-shrink-0">
                        <img src={place.image_url || `https://picsum.photos/seed/${place.id}/200`} className="w-16 h-16 rounded-2xl object-cover border border-zinc-50" alt={title || ''} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/200`; }} />
                        <div className="absolute -bottom-1 -right-1 shadow-lg">
                          <span className={badgeClass}>{badgeLabel}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-zinc-900 text-sm truncate tracking-tight">{title}</h4>
                          {place.is_new && (
                            <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400 animate-pulse">NEW</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={10} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                      <Link href={href} className="p-2 bg-zinc-50 rounded-xl text-zinc-300 group-hover:bg-pace-50 group-hover:text-pace-500 transition-all">
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  )}

                  {idx === 0 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                  {idx === 14 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
                );
              })}
            </motion.div>
          ) : activeTab === 'festival' ? (
            <motion.div key="ft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-1">
              {festivals.length === 0 && !isLoading && (
                <p className="text-center text-xs text-zinc-400 py-10">
                  {lang === 'en' ? 'No festival ranking data yet.' : lang === 'zh' ? '暂无节庆排行数据。' : '아직 축제 랭킹 데이터가 없습니다.'}
                </p>
              )}
              {festivals.slice(0, 25).map((place: any, idx: number) => {
                const badgeLabel = lang === 'en' ? 'FESTIVAL' : lang === 'zh' ? '节庆' : '축제';
                const badgeClass = "text-[8px] font-black px-1.5 py-0.5 rounded-md border bg-amber-500 text-white border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]";
                const title = (lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : place.title;
                const secondaryText = place.date_range || (lang === 'en' ? 'Seoul Festival' : lang === 'zh' ? '首尔节庆' : '전국 축제');
                const href = `/posts/${place.id}?region=축제&lang=${lang}`;
                return (
                <div key={place.id}>
                  {idx === 0 ? (
                    <Link href={href} className="block bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden group relative mb-4">
                      <div className="relative h-[104px] overflow-hidden bg-zinc-100">
                        <img src={place.image_url || `https://picsum.photos/seed/${place.id}/400/300`} alt={title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/400/300`; }} />
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
                          <Flame size={11} className="text-rose-400" fill="currentColor" /> 1{lang === 'en' ? 'st' : lang === 'zh' ? '位' : '위'}
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <span className={badgeClass}>{badgeLabel}</span>
                        </div>
                        {place.is_new && (
                          <span className="absolute bottom-2.5 right-2.5 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase bg-rose-500 text-white border border-rose-400 animate-pulse">NEW</span>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="text-base font-bold text-zinc-900 tracking-tight">{title}</h3>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={11} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative group mb-4">
                      <div className="absolute -left-2 -top-2 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                        {idx + 1}
                      </div>
                      <div className="relative flex-shrink-0">
                        <img src={place.image_url || `https://picsum.photos/seed/${place.id}/200`} className="w-16 h-16 rounded-2xl object-cover border border-zinc-50" alt={title || ''} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/200`; }} />
                        <div className="absolute -bottom-1 -right-1 shadow-lg">
                          <span className={badgeClass}>{badgeLabel}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-zinc-900 text-sm truncate tracking-tight">{title}</h4>
                          {place.is_new && (
                            <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400 animate-pulse">NEW</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={10} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                      <Link href={href} className="p-2 bg-zinc-50 rounded-xl text-zinc-300 group-hover:bg-pace-50 group-hover:text-pace-500 transition-all">
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  )}

                  {idx === 0 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                  {idx === 14 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
                );
              })}
            </motion.div>
          ) : activeTab === 'shopping' ? (
            <motion.div key="sh" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-1">
              {shopping.length === 0 && !isLoading && (
                <p className="text-center text-xs text-zinc-400 py-10">
                  {lang === 'en' ? 'No shopping ranking data yet.' : lang === 'zh' ? '暂无购物排行数据。' : '아직 쇼핑 랭킹 데이터가 없습니다.'}
                </p>
              )}
              {shopping.slice(0, 25).map((place: any, idx: number) => {
                const badgeClass = cn(
                  "text-[8px] font-black px-1.5 py-0.5 rounded-md border",
                  place.region === '홍대' ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                  : place.region === '강북' ? "bg-yellow-500 text-white border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                  : place.region === '강남' ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                  : place.region === '부산' ? "bg-sky-400 text-white border-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                  : place.region === '제주' ? "bg-[#0369a1] text-white border-[#0369a1] shadow-[0_0_10px_rgba(3,105,161,0.5)]"
                  : "bg-emerald-50 text-emerald-600 border-emerald-400"
                );
                const badgeLabel = lang === 'en'
                  ? (place.region === '홍대' ? 'HONGDAE' : place.region === '강북' ? 'GANGBUK' : place.region === '강남' ? 'GANGNAM' : place.region === '부산' ? 'BUSAN' : place.region === '제주' ? 'JEJU' : 'SEONGSU')
                  : lang === 'zh'
                    ? (place.region === '홍대' ? '弘大' : place.region === '강북' ? '江北' : place.region === '강남' ? '江南' : place.region === '부산' ? '釜山' : place.region === '제주' ? '济州' : '圣水洞')
                    : (place.region || '성수');
                const title = (lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : place.title;
                const secondaryText = lang === 'en'
                  ? `Near ${place.region === '홍대' ? 'Hongdae' : place.region === '강북' ? 'Gangbuk' : place.region === '강남' ? 'Gangnam' : place.region === '부산' ? 'Busan' : place.region === '제주' ? 'Jeju' : 'Seongsu'}`
                  : lang === 'zh'
                    ? `${place.region === '홍대' ? '弘大' : place.region === '강북' ? '江北' : place.region === '강남' ? '江南' : place.region === '부산' ? '釜山' : place.region === '제주' ? '济州' : '圣水洞'}附近`
                    : `${place.region || '성수'} 근처`;
                const href = `/posts/${place.id}?region=${encodeURIComponent(place.region || '성수')}&lang=${lang}`;
                return (
                <div key={place.id}>
                  {idx === 0 ? (
                    <Link href={href} className="block bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden group relative mb-4">
                      <div className="relative h-[104px] overflow-hidden bg-zinc-100">
                        <img src={place.image_url || `https://picsum.photos/seed/${place.id}/400/300`} alt={title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/400/300`; }} />
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
                          <Flame size={11} className="text-rose-400" fill="currentColor" /> 1{lang === 'en' ? 'st' : lang === 'zh' ? '位' : '위'}
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <span className={badgeClass}>{badgeLabel}</span>
                        </div>
                        {place.is_new && (
                          <span className="absolute bottom-2.5 right-2.5 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase bg-rose-500 text-white border border-rose-400 animate-pulse">NEW</span>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="text-base font-bold text-zinc-900 tracking-tight">{title}</h3>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={11} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative group mb-4">
                      <div className="absolute -left-2 -top-2 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                        {idx + 1}
                      </div>
                      <div className="relative flex-shrink-0">
                        <img src={place.image_url || `https://picsum.photos/seed/${place.id}/200`} className="w-16 h-16 rounded-2xl object-cover border border-zinc-50" alt={title || ''} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/200`; }} />
                        <div className="absolute -bottom-1 -right-1 shadow-lg">
                          <span className={badgeClass}>{badgeLabel}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-zinc-900 text-sm truncate tracking-tight">{title}</h4>
                          {place.is_new && (
                            <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400 animate-pulse">NEW</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={10} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                      <Link href={href} className="p-2 bg-zinc-50 rounded-xl text-zinc-300 group-hover:bg-pace-50 group-hover:text-pace-500 transition-all">
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  )}

                  {idx === 0 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                  {idx === 14 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div key="ex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-1">
              {exhibitions.length === 0 && !isLoading && (
                <p className="text-center text-xs text-zinc-400 py-10">
                  {lang === 'en' ? 'No exhibition ranking data yet.' : lang === 'zh' ? '暂无展览排行数据。' : '아직 전시 랭킹 데이터가 없습니다.'}
                </p>
              )}
              {exhibitions.slice(0, 25).map((place: any, idx: number) => {
                const badgeClass = cn(
                  "text-[8px] font-black px-1.5 py-0.5 rounded-md border",
                  place.region === '홍대' ? "bg-orange-500 text-white border-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                  : place.region === '강북' ? "bg-yellow-500 text-white border-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                  : place.region === '강남' ? "bg-pink-500 text-white border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                  : place.region === '부산' ? "bg-sky-400 text-white border-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.5)]"
                  : place.region === '제주' ? "bg-[#0369a1] text-white border-[#0369a1] shadow-[0_0_10px_rgba(3,105,161,0.5)]"
                  : "bg-emerald-50 text-emerald-600 border-emerald-400"
                );
                const badgeLabel = lang === 'en'
                  ? (place.region === '홍대' ? 'HONGDAE' : place.region === '강북' ? 'GANGBUK' : place.region === '강남' ? 'GANGNAM' : place.region === '부산' ? 'BUSAN' : place.region === '제주' ? 'JEJU' : 'SEONGSU')
                  : lang === 'zh'
                    ? (place.region === '홍대' ? '弘大' : place.region === '강북' ? '江北' : place.region === '강남' ? '江南' : place.region === '부산' ? '釜山' : place.region === '제주' ? '济州' : '圣水洞')
                    : (place.region || '성수');
                const title = (lang === 'en' && place.title_en) ? place.title_en : (lang === 'zh' && place.title_zh) ? place.title_zh : place.title;
                const secondaryText = place.date_range || (lang === 'en'
                  ? `Near ${place.region === '홍대' ? 'Hongdae' : place.region === '강북' ? 'Gangbuk' : place.region === '강남' ? 'Gangnam' : place.region === '부산' ? 'Busan' : place.region === '제주' ? 'Jeju' : 'Seongsu'}`
                  : lang === 'zh'
                    ? `${place.region === '홍대' ? '弘大' : place.region === '강북' ? '江北' : place.region === '강남' ? '江南' : place.region === '부산' ? '釜山' : place.region === '제주' ? '济州' : '圣水洞'}附近`
                    : `${place.region || '성수'} 근처`);
                const href = `/posts/${place.id}?region=${encodeURIComponent(place.region || '성수')}&lang=${lang}`;
                return (
                <div key={place.id}>
                  {idx === 0 ? (
                    <Link href={href} className="block bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden group relative mb-4">
                      <div className="relative h-[104px] overflow-hidden bg-zinc-100">
                        <img src={place.image_url || `https://picsum.photos/seed/${place.id}/400/300`} alt={title || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/400/300`; }} />
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
                          <Flame size={11} className="text-rose-400" fill="currentColor" /> 1{lang === 'en' ? 'st' : lang === 'zh' ? '位' : '위'}
                        </div>
                        <div className="absolute top-2.5 right-2.5">
                          <span className={badgeClass}>{badgeLabel}</span>
                        </div>
                        {place.is_new && (
                          <span className="absolute bottom-2.5 right-2.5 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase bg-rose-500 text-white border border-rose-400 animate-pulse">NEW</span>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="text-base font-bold text-zinc-900 tracking-tight">{title}</h3>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={11} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <div className="bg-white p-4 rounded-3xl border border-zinc-100 shadow-sm flex gap-4 items-center relative group mb-4">
                      <div className="absolute -left-2 -top-2 w-6 h-6 bg-zinc-900 text-white text-[10px] font-black rounded-lg flex items-center justify-center shadow-lg z-10">
                        {idx + 1}
                      </div>
                      <div className="relative flex-shrink-0">
                        <img src={place.image_url || `https://picsum.photos/seed/${place.id}/200`} className="w-16 h-16 rounded-2xl object-cover border border-zinc-50" alt={title || ''} referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/rank-${place.id}/200`; }} />
                        <div className="absolute -bottom-1 -right-1 shadow-lg">
                          <span className={badgeClass}>{badgeLabel}</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-zinc-900 text-sm truncate tracking-tight">{title}</h4>
                          {place.is_new && (
                            <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded uppercase border bg-rose-500 text-white border-rose-400 animate-pulse">NEW</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-[9px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                            <Flame size={10} fill="currentColor" /> {place.score ?? place.like_count}
                          </span>
                          <span className="text-[9px] text-zinc-400 font-medium truncate">{secondaryText}</span>
                        </div>
                      </div>
                      <Link href={href} className="p-2 bg-zinc-50 rounded-xl text-zinc-300 group-hover:bg-pace-50 group-hover:text-pace-500 transition-all">
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  )}

                  {idx === 0 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                  {idx === 14 && (
                    <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
                  )}
                </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
        {isShareableTab && (
          <div className="flex gap-2 pt-2 pb-4">
            <button onClick={handleShareRanking} className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-zinc-900 text-white rounded-2xl text-xs font-bold hover:bg-zinc-800 transition-colors">
              <Share2 size={14} />
              {lang === 'en' ? 'Share' : lang === 'zh' ? '分享' : '공유하기'}
            </button>
            <button onClick={handleSaveRanking} className="flex-1 flex items-center justify-center gap-1.5 py-3 bg-zinc-900 text-white rounded-2xl text-xs font-bold hover:bg-zinc-800 transition-colors">
              <Save size={14} />
              {lang === 'en' ? 'Save' : lang === 'zh' ? '保存' : '마이페이지에 저장'}
            </button>
          </div>
        )}
      </div>

      {/* Course Detail Modal */}
      <AnimatePresence>
        {selectedCourse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedCourse(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
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

              <button 
                onClick={() => handleForkCourse(selectedCourse)}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-pace-600 transition-all"
              >
                <Save size={20} /> 이 코스 내 마이페이지로 퍼가기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Theme Detail Modal */}
      <AnimatePresence>
        {selectedTheme && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedTheme(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <img
                    src={selectedTheme.user_image || `https://picsum.photos/seed/u${selectedTheme.id}/200`}
                    className="w-10 h-10 rounded-full border border-zinc-100 object-cover"
                    alt={selectedTheme.user_name || ''}
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/u${selectedTheme.id}/200`; }}
                  />
                  <div>
                    <h3 className="text-xl font-black text-zinc-900 tracking-tight">{selectedTheme.title}</h3>
                    <p className="text-xs text-zinc-400 font-bold uppercase">{(selectedTheme.user_name || (lang === 'en' ? 'Anony' : lang === 'zh' ? '匿名' : '아무개'))}의 테마</p>
                  </div>
                </div>
                <button onClick={() => setSelectedTheme(null)} className="p-2 bg-zinc-100 rounded-full"><X size={20} /></button>
              </div>

              <div className="space-y-4 mb-10">
                {(Array.isArray(selectedTheme.places) ? selectedTheme.places : JSON.parse(selectedTheme.places)).map((place: any, idx: number) => (
                  <div key={idx} onClick={() => setSelectedPlace(place)} className="bg-zinc-50 p-4 rounded-2xl border border-zinc-100 flex gap-4 relative group cursor-pointer hover:border-pace-200 transition-colors">
                    <img
                      src={place.image_url || `https://picsum.photos/seed/theme-${selectedTheme.id}-${idx}/400/300`}
                      className="w-16 h-16 rounded-2xl object-cover border border-zinc-200 bg-white"
                      alt={place.title || ''}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://picsum.photos/seed/theme-error-${idx}/400/300`;
                      }}
                    />
                    <div className="flex-1 min-w-0 pr-6">
                      <h4 className="font-bold text-zinc-900 text-sm truncate group-hover:text-pace-600 transition-colors">{place.title}</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5 truncate">{place.location}</p>
                      <p className="text-[11px] text-zinc-600 mt-2 line-clamp-2">{place.content}</p>
                    </div>
                    <ChevronRight size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-300 group-hover:text-pace-500 transition-colors" />
                  </div>
                ))}
              </div>

              <button onClick={() => handleShareTheme(selectedTheme)} className="w-full mb-3 flex items-center justify-center gap-1.5 py-3 bg-zinc-900 text-white rounded-2xl text-xs font-bold hover:bg-zinc-800 transition-colors">
                <Share2 size={14} /> 공유하기
              </button>

              <button
                onClick={() => handleForkTheme(selectedTheme)}
                className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-pace-600 transition-all"
              >
                <Save size={20} /> 이 테마 내 마이페이지로 퍼가기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Place Detail Nested Modal */}
      <AnimatePresence>
        {selectedPlace && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setSelectedPlace(null)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 max-h-[90vh] overflow-y-auto no-scrollbar shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-zinc-900 tracking-tight pr-8">{selectedPlace.title}</h3>
                <button onClick={() => setSelectedPlace(null)} className="p-2 bg-zinc-100 text-zinc-400 hover:text-zinc-600 rounded-full transition-colors flex-shrink-0"><X size={20} /></button>
              </div>
              
              <div className="space-y-6 flex-grow">
                <div className="w-full aspect-[4/3] rounded-3xl overflow-hidden bg-zinc-100 border border-zinc-200">
                  <img
                    src={selectedPlace.image_url || `https://picsum.photos/seed/theme-${selectedPlace.title}/800/600`}
                    className="w-full h-full object-cover"
                    alt={selectedPlace.title || ''}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://picsum.photos/seed/theme-error-place/800/600`;
                    }}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-start gap-2 text-sm text-pace-600 font-bold bg-pace-50 p-3 rounded-xl">
                    <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{selectedPlace.location || '위치 정보 없음'}</span>
                  </div>
                  {selectedPlace.date_range && (
                    <div className="flex items-center gap-2 text-sm text-zinc-600 font-bold bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                      <Calendar size={16} className="text-zinc-400 flex-shrink-0" />
                      <span>{selectedPlace.date_range}</span>
                    </div>
                  )}
                  {selectedPlace.video_url && (
                    <div className="flex items-center gap-2 text-sm text-zinc-600 font-bold bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                      <Video size={16} className="text-zinc-400 flex-shrink-0" />
                      <a href={selectedPlace.video_url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 hover:underline truncate">
                        {selectedPlace.video_url}
                      </a>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest mb-3">상세 설명 및 팁</h4>
                  <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">{selectedPlace.content}</p>
                </div>

                {selectedPlace.location && (
                  <div className="w-full aspect-video rounded-3xl overflow-hidden border border-zinc-200 bg-zinc-100 relative">
                    <iframe
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedPlace.location)}&z=16&output=embed`}
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Course Creation Modal */}
      <AnimatePresence>
        {showCourseModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => !isCreatingCourse && setShowCourseModal(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="w-full max-w-md bg-white rounded-t-[40px] p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-black text-zinc-900 tracking-tight">AI 자동코스 생성</h2>
                <button onClick={() => setShowCourseModal(false)} className="p-2 bg-zinc-100 rounded-full"><X size={20} /></button>
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

              <button
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
              </button>

              <AdUnit slotId="5769413560" layoutKey="-hp+7-l-2n+6x" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Guide Modal */}
      <AnimatePresence>
        {showAskAI && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowAskAI(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="w-full max-w-md bg-zinc-50 rounded-t-[40px] h-[88vh] shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end p-4 pb-0 flex-shrink-0">
                <button onClick={() => setShowAskAI(false)} className="p-2 bg-white rounded-full shadow-sm border border-zinc-100"><X size={20} /></button>
              </div>
              <AskAI region={placeRegion === '종합' ? '성수' : placeRegion} lang={lang} fullHeight />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
