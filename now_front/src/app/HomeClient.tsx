"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Home as HomeIcon,
  Map as MapIcon,
  MapPin,
  Sparkles,
  Search,
  Users,
  Route as RouteIcon,
  MessageCircle,
  TrendingUp,
  MessageSquare,
  Newspaper,
  ChevronLeft
} from 'lucide-react';
import MapView from '@/components/MapView';
import PlaceList, { PlaceSort } from '@/components/PlaceList';
import AskAI from '@/components/AskAI';
import ThemeMenu from '@/components/ThemeMenu';
import MagazineList from '@/components/MagazineList';
import Logo from '@/components/Logo';
import Recommendation, { Tab as RecTab, PlaceRankingRegion } from '@/components/Recommendation';
import CrowdTicker from '@/components/CrowdTicker';
import AiCourseModal from '@/components/AiCourseModal';
import SideCardLayout, { WIDE_FRAME, WIDE_FRAME_BORDER, useElementHeight } from '@/components/sidecards/SideCardLayout';
import HomeSections from '@/components/home/HomeSections';
import { HomeRegion } from '@/components/home/homeUtils';
import PullToRefresh from '@/components/PullToRefresh';
import { cn } from '@/lib/utils';


const PAGE_SIZE = 20;

type Tab = 'home' | 'rec' | 'map' | 'list' | 'course' | 'magazine' | 'chat';
type CourseSub = 'ai' | 'theme';
type Region = '성수' | '홍대' | '강북' | '강남' | '부산' | '공연' | '제주' | '축제';
type Lang = 'ko' | 'en' | 'zh' | 'ja';
// 우선순위 고정 목록 — 실제 서브탭 노출 여부는 /places/categories로 지역별 DISTINCT 조회해 결정
// '전시'=성수/홍대/강북/강남(Visit Seoul), '행사'=제주(비짓제주) 전용 — 지역별 DISTINCT라 서로 섞이지 않음
// '엔터'는 여기(지역 안 콘텐츠 유형)가 아니라 category_tag(핫플>카테고리, 지역 무관 장르
// 분류)로 들어가야 맞다 — 한 번 여기 넣었다가 장소>강북 하위에 별도 탭이 생기는 오류가
// 있었음(2026-09-11 발견, category_tags.py 쪽으로 이동)
const CATEGORY_ORDER = ['popup', 'class', 'shopping', '전시', '행사'] as const;
type PlaceCategory = typeof CATEGORY_ORDER[number];
const CATEGORY_LABEL: Record<PlaceCategory, { en: string; zh: string; ja: string; ko: string }> = {
  popup: { en: 'Pop-up', zh: '快闪店', ja: 'ポップアップ', ko: '팝업' },
  class: { en: 'Class', zh: '体验课程', ja: '体験', ko: '클래스' },
  shopping: { en: 'Shopping', zh: '购物', ja: 'ショッピング', ko: '쇼핑' },
  '전시': { en: 'Exhibit', zh: '展览', ja: '展示', ko: '전시' },
  '행사': { en: 'Event', zh: '活动', ja: 'イベント', ko: '행사' },
};

// 장소형 지역(지도+AI코스+팝업/클래스/쇼핑/전시·행사 서브탭 전부 지원) / 이벤트형 지역(리스트만) — 지역탭에서 '|'로 구분 표시
// 부산은 팝업만 수행 — 다른 장소형 지역과 동일하게 취급하되 실제 서브탭은 데이터(팝업만) 기준으로 자동 결정됨
const PLACE_REGIONS = ['성수', '홍대', '강북', '강남', '부산', '제주'] as const;
const EVENT_REGIONS = ['공연', '축제'] as const;
const REGION_LABEL: Record<Region, { en: string; zh: string; ja: string }> = {
  '성수': { en: 'SEONGSU', zh: '圣水洞', ja: 'ソンス' },
  '홍대': { en: 'HONGDAE', zh: '弘大', ja: 'ホンデ' },
  '강북': { en: 'GANGBUK', zh: '江北', ja: 'カンブク' },
  '강남': { en: 'GANGNAM', zh: '江南', ja: 'カンナム' },
  '부산': { en: 'BUSAN', zh: '釜山', ja: '釜山' },
  '제주': { en: 'JEJU', zh: '济州', ja: '済州' },
  '공연': { en: 'CONCERT', zh: '演出', ja: '公演' },
  '축제': { en: 'FESTIVAL', zh: '节庆', ja: '祭り' },
};
// 제주 대표색 — 이전 '공연>제주' 서브탭 시절 쓰던 블루를 지역 자체 대표색으로 승격
// 부산 대표색 — 하늘색(sky), 제주의 진한 블루(#0369a1)와 구분
const REGION_ACCENT: Record<Region, string> = {
  '성수': 'text-emerald-600 border-emerald-500',
  '홍대': 'text-orange-600 border-orange-500',
  '강북': 'text-yellow-600 border-yellow-500',
  '강남': 'text-pink-600 border-pink-500',
  '부산': 'text-sky-500 border-sky-500',
  '제주': 'text-[#0369a1] border-[#0369a1]',
  '공연': 'text-emerald-600 border-emerald-500',
  '축제': 'text-amber-600 border-amber-500',
};
// 서브탭(팝업/클래스/쇼핑/전시·행사, 공연 장르)의 활성 상태 배경색 — 지역 대표색과 통일
const REGION_PILL_ACTIVE: Record<Region, string> = {
  '성수': 'bg-emerald-500 text-white border-emerald-500',
  '홍대': 'bg-orange-500 text-white border-orange-500',
  '강북': 'bg-yellow-500 text-white border-yellow-500',
  '강남': 'bg-pink-500 text-white border-pink-500',
  '부산': 'bg-sky-500 text-white border-sky-500',
  '제주': 'bg-[#0369a1] text-white border-[#0369a1]',
  '공연': 'bg-emerald-500 text-white border-emerald-500',
  '축제': 'bg-amber-500 text-white border-amber-500',
};

const dict = {
  ko: {
    desc: '당신의 다음 3시간을 설계합니다',
    totalRec: '통합 실시간 랭킹',
    regionGuide: '실시간 {region} 가이드',
    navHome: '홈',
    navRec: '랭킹',
    navMap: '지도',
    navList: '장소',
    navCourse: '코스',
    navMagazine: '핫플',
    courseSubAi: '3시간코스',
    courseSubTheme: '자유코스',
    my: '마이',
    footer: '© 네모네 주식회사, 당신 시간의 알찬 소비',
    feedback: '피드백'
  },
  en: {
    desc: 'A fulfilling plan for your 3 hours',
    totalRec: 'Live Integrated Ranking',
    regionGuide: 'Live {region} Guide',
    navHome: 'Home',
    navRec: 'Ranking',
    navMap: 'Map',
    navList: 'Spot',
    navCourse: 'Course',
    navMagazine: 'Hot',
    courseSubAi: '3-Hour Course',
    courseSubTheme: 'Free Course',
    my: 'My',
    footer: '© Nemone Co., Ltd. Make every moment count.',
    feedback: 'Feedback'
  },
  zh: {
    desc: '为您3小时的充实安排',
    totalRec: '综合实时排行',
    regionGuide: '{region} 实时指南',
    navHome: '首页',
    navRec: '排行',
    navMap: '地图',
    navList: '地点',
    navCourse: '路线',
    navMagazine: '热门',
    courseSubAi: '3小时路线',
    courseSubTheme: '自由路线',
    my: '我的',
    footer: '© Nemone Co., Ltd. 让每一刻都有意义',
    feedback: '反馈'
  },
  ja: {
    desc: 'あなたの3時間を充実させる',
    totalRec: 'リアルタイム統合ランキング',
    regionGuide: 'リアルタイム{region}ガイド',
    navHome: 'ホーム',
    navRec: 'ランキング',
    navMap: '地図',
    navList: 'スポット',
    navCourse: 'コース',
    navMagazine: '人気',
    courseSubAi: '3時間コース',
    courseSubTheme: 'フリーコース',
    my: 'マイ',
    footer: '© Nemone Co., Ltd. 充実した時間の使い方を。',
    feedback: 'フィードバック'
  }
};

function Home({ initialAllPlaces, regionTopPlaces }: { initialAllPlaces: any[]; regionTopPlaces: { region: string; place: any }[] }) {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);
  // 이 페이지의 하단 네비는 fixed가 아니라 sticky(문서 flow 안)라 실측이 가능해 상수 대신 측정한다.
  const [headerRef, headerH] = useElementHeight<HTMLElement>(96);
  const [bottomNavRef, bottomNavH] = useElementHeight<HTMLElement>(88);
  const [activeTab, setActiveTabState] = useState<Tab>('home');
  const [region, setRegionState] = useState<Region>('성수');
  const [placeCategory, setPlaceCategory] = useState<PlaceCategory>('popup');
  const [availableCategories, setAvailableCategories] = useState<PlaceCategory[]>([...CATEGORY_ORDER]);
  const [concertGenre, setConcertGenre] = useState<'연극' | '뮤지컬' | '음악' | '종합'>('연극');
  const [placeSort, setPlaceSort] = useState<PlaceSort | null>(null);
  const [courseSub, setCourseSub] = useState<CourseSub>('theme');
  const [magazineSub, setMagazineSub] = useState<'article' | 'mood' | 'category'>('article');
  const [magazineMood, setMagazineMood] = useState<string | undefined>(undefined);
  const [magazineCategory, setMagazineCategory] = useState<string | undefined>(undefined);
  const [showAiCourseModal, setShowAiCourseModal] = useState(false);
  // 랭킹 탭의 탭/지역 선택 상태 — 지도/장소처럼 헤더에 붙여 스크롤해도 고정되게 하려고
  // Recommendation.tsx 내부 useState였던 걸 여기로 옮겼다(2026-09-07, controlled 컴포넌트화).
  const [recSubTab, setRecSubTab] = useState<RecTab>('place');
  const [recPlaceRegion, setRecPlaceRegion] = useState<PlaceRankingRegion>('종합');
  // 랭킹 탭 당겨서 새로고침(2026-09-10) — '종합'은 allPlaces가 그대로 내려가 fetchAllPlaces()만
  // 다시 부르면 되지만, 성수/홍대/쇼핑/전시 등은 Recommendation.tsx 내부의 독립적인 fetch라
  // activeTab/placeRegion이 그대로면 effect가 재실행되지 않음 — 키를 하나 올려 강제로 재실행시킴.
  const [rankingRefreshKey, setRankingRefreshKey] = useState(0);
  const recPlacePillsRef = useRef<HTMLDivElement>(null);
  // 스와이프/탭으로 지역이 바뀔 때 활성 pill이 가로 스크롤 영역 밖에 있으면 안 보여서
  // "뭐가 바뀌었는지" 체감이 안 됨 — 항상 활성 pill이 보이게 자동 스크롤(원래 Recommendation.tsx에 있던 로직).
  useEffect(() => {
    const el = recPlacePillsRef.current?.querySelector<HTMLElement>(`[data-region="${recPlaceRegion}"]`);
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [recPlaceRegion]);
  // main은 overflow-y-auto가 아니라 자연 문서 스크롤을 쓴다(아래 main 클래스 참고) — 그래서
  // 스크롤 대상도 window여야 한다(2026-09-07, overflow-y-auto 제거하며 함께 수정).
  const scrollToTop = () => { window.scrollTo({ top: 0 }); };
  const setRegion = (r: Region) => { setRegionState(r); setPlaceCategory('popup'); scrollToTop(); };
  const setActiveTab = (tab: Tab) => { setActiveTabState(tab); scrollToTop(); };
  // 홈 '지금 뜨는 곳' 전체보기 — <Link href="/?tab=rec&...">로 만들었다가 안 눌리는(클릭은
  // 되는데 화면이 안 바뀌는) 버그가 있었다(2026-09-10). pathname이 그대로 '/'라 Next.js가 페이지를
  // 다시 마운트하지 않고, URL 파싱용 useEffect는 최초 마운트 때 한 번만 도는 구조라 쿼리만
  // 바뀌어선 activeTab/recPlaceRegion이 갱신되지 않았음 — 상태를 직접 바꾸는 콜백으로 교체.
  const goToRanking = (region: HomeRegion) => {
    setRecSubTab('place');
    setRecPlaceRegion(region === '전체' ? '종합' : (region as PlaceRankingRegion));
    setActiveTab('rec');
  };
  const goToCrowdMap = (region: string) => {
    setRegion(region as Region);
    setActiveTab('map');
  };
  // PC 사이드카드 'NEW POP-UP' 전체보기 — 위 goToRanking과 같은 이유로 Link 대신 콜백(2026-09-10).
  const goToPopupList = () => {
    setActiveTab('list');
    setPlaceCategory('popup');
  };
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };
  const [lang, setLang] = useState<Lang>('ko');
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get('region') as Region;
    const t = params.get('tab');
    const l = params.get('lang') as Lang;
    const c = params.get('category');
    if (r) setRegionState(r);
    // 구버전 링크 호환: '테마'는 그대로 '코스' 밑 서브탭 유지, 'AI코스(tour)'는 신규 /course 페이지로 리다이렉트
    if (t === 'theme') { setActiveTab('course'); setCourseSub('theme'); }
    else if (t === 'tour') { router.push(`/course${l ? `?lang=${l}` : ''}`); return; }
    else if (t) setActiveTab(t as Tab);
    // 홈 '지금 뜨는 곳' 전체보기(?tab=rec&region=성수 등) — 랭킹 탭 자체의 지역 필터는 위 region과
    // 별개 상태(recPlaceRegion)라 여기서 같이 맞춰줘야 선택했던 지역 그대로 열림(2026-09-10).
    if (t === 'rec' && r && (['종합', '성수', '홍대', '강북', '강남', '부산', '제주'] as const).includes(r as any)) {
      setRecPlaceRegion(r as PlaceRankingRegion);
    }
    if (l === 'en' || l === 'zh' || l === 'ja' || l === 'ko') setLang(l);
    if (c === 'popup' || c === 'class' || c === 'shopping' || c === '전시' || c === '행사') setPlaceCategory(c);
    if (c === '연극' || c === '뮤지컬' || c === '음악' || c === '종합') setConcertGenre(c);
    // 상세페이지 무드 칩 → 매거진 탭의 '무드' 서브탭을 해당 무드로 열어줌(2026-09-02)
    const m = params.get('mood');
    const s = params.get('sub');
    // 상세페이지 카테고리 칩 → 매거진 탭의 '카테고리' 서브탭을 해당 카테고리로 열어줌(2026-09-04)
    const ct = params.get('category_tag');
    if (m) { setActiveTab('magazine'); setMagazineSub('mood'); setMagazineMood(m); }
    else if (ct) { setActiveTab('magazine'); setMagazineSub('category'); setMagazineCategory(ct); }
    // 태그 없이 "무드/카테고리 탭"만 여는 범용 링크 — 첫 번째 태그가 기본 선택됨(2026-09-02, 09-04)
    else if (t === 'magazine' && s === 'mood') { setMagazineSub('mood'); }
    else if (t === 'magazine' && s === 'category') { setMagazineSub('category'); }
  }, []);
  const [places, setPlaces] = useState([]); // 지역별 데이터 (리스트 첫 페이지)
  const [mapPlaces, setMapPlaces] = useState([]); // 지도용 전체 데이터 (PLACE_REGIONS만)
  // 통합 데이터 (랭킹용) — 서버에서 미리 fetch한 종합 랭킹으로 초기화해 첫 렌더부터 크롤러에게
  // 실제 카드/링크가 보이게 함(page.tsx가 서버 컴포넌트로 fetch해서 넘겨줌, 2026-08-10)
  const [allPlaces, setAllPlaces] = useState(initialAllPlaces);

  const t = dict[lang];
  const isPlaceRegion = (PLACE_REGIONS as readonly string[]).includes(region);

  useEffect(() => {
    fetchPlaces();
    fetchAllPlaces();
    if (isPlaceRegion) {
      fetchMapPlaces();
    } else {
      setMapPlaces([]);
    }
  }, [region, lang, placeCategory, concertGenre, placeSort]);

  useEffect(() => {
    if (isPlaceRegion) {
      fetchAvailableCategories();
    }
  }, [region]);

  useEffect(() => {
    // 지역 전환으로 서브탭 목록이 바뀌었는데 현재 선택된 category가 그 지역엔 없으면 첫 번째 탭으로 스냅
    if (isPlaceRegion && !availableCategories.includes(placeCategory)) {
      setPlaceCategory(availableCategories[0] ?? 'popup');
    }
  }, [availableCategories]);

  useEffect(() => {
    // '공연'/'축제' 지역엔 지도가 없으므로 리스트로 강제 이동
    if ((region === '공연' || region === '축제') && activeTab === 'map') {
      setActiveTab('list');
    }
  }, [region, activeTab]);

  const categoryParam = `&category=${region === '공연' ? concertGenre : placeCategory}`;
  const sortParam = placeSort ? `&sort=${placeSort}` : '';

  const fetchPlaces = async () => {
    try {
      const res = await fetch(`/api-now/places?region=${encodeURIComponent(region)}&lang=${lang}&limit=${PAGE_SIZE}&offset=0${categoryParam}${sortParam}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setPlaces(data);
      }
    } catch (e) {
      console.error("Failed to fetch places:", e);
    }
  };

  const fetchMapPlaces = async () => {
    try {
      const res = await fetch(`/api-now/places?region=${encodeURIComponent(region)}&lang=${lang}${categoryParam}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setMapPlaces(data);
      }
    } catch (e) {
      console.error("Failed to fetch map places:", e);
    }
  };

  const fetchAvailableCategories = async () => {
    try {
      const res = await fetch(`/api-now/places/categories?region=${encodeURIComponent(region)}&t=${Date.now()}`);
      if (res.ok) {
        const data: string[] = await res.json();
        setAvailableCategories(CATEGORY_ORDER.filter((c) => data.includes(c)));
      }
    } catch (e) {
      console.error("Failed to fetch categories:", e);
    }
  };

  const fetchAllPlaces = async () => {
    try {
      const res = await fetch(`/api-now/places/popular?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        setAllPlaces(data);
      }
    } catch (e) {
      console.error("Failed to fetch all places:", e);
    }
  };

  const refreshHome = () => fetchAllPlaces();
  const refreshRanking = async () => {
    await fetchAllPlaces(); // '종합' 케이스 — Recommendation의 places prop이 갱신되며 자동 반영
    setRankingRefreshKey((k) => k + 1); // 성수/홍대/쇼핑/전시 등 나머지 서브탭 강제 재fetch
  };

  // PC(xl+)에서 랭킹/지도/장소/코스/핫플 탭 본문 양옆에 실시간 요약 카드(팝업/혼잡도/랭킹/핫플)를
  // 붙인다(2026-09-07, 코스 탭도 나머지 탭과 통일해서 카드가 있어야 한다는 피드백으로 포함).
  // 홈은 이미 자체 넓은 레이아웃이 있어 대상 아님, 채팅은 메뉴가 아니라 대상 아님.
  const showSideCards = activeTab === 'rec' || activeTab === 'map' || activeTab === 'list' || activeTab === 'course' || activeTab === 'magazine';

  const content = (
    // h-[100dvh]+overflow-hidden(고정 뷰포트+내부 스크롤 앱셸) 대신 모든 탭에서 문서 자체가
    // 스크롤되게 바꿨다(2026-09-06) — 루트 div의 실제 렌더 높이가 100dvh를 안 지키고 콘텐츠
    // 높이만큼 늘어나는 경우가 있었는데(PC·모바일 공통, 사용자 리포트: "하단 메뉴가 브라우저
    // 하단에 안 맞춰져 있음. 안 보임"), overflow-hidden이 걸려있으면 header의 sticky top-0/
    // 하단 nav의 sticky bottom-0가 문서 스크롤을 못 잡고 같이 밀려버렸다. 처음엔 홈 탭만
    // 고쳤다가 나머지 탭(랭킹/지도/장소/코스/핫플)도 같은 문제가 있어 전체로 확장.
    // 홈 탭만 PC에서 max-w 제한을 풀어 넓게 쓰고, 나머지는 항상 max-w-md 모바일 프레임 유지.
    // 홈↔다른 탭 전환 시 폭이 뚝 끊기듯 바뀌는 게 어색하다는 피드백(2026-09-06) — max-w 변화에
    // transition을 걸어 부드럽게 넘어가게 함.
    // 카드가 있는 탭(showSideCards)은 xl에서 상/하단바까지 포함해 홈과 완전히 같은 폭
    // (WIDE_FRAME)으로 넓어진다(2026-09-07) — 그 폭 안에서만 카드가 보이므로 xl 미만에서는
    // 지금까지와 동일하게 max-w-md 모바일 프레임 그대로.
    <div className={cn(
      "flex flex-col min-h-[100dvh] bg-zinc-50 mx-auto relative transition-[max-width] duration-300 ease-in-out",
      activeTab === 'home'
        ? cn("md:max-w-4xl", WIDE_FRAME)
        : showSideCards
          ? cn(WIDE_FRAME, WIDE_FRAME_BORDER)
          : "max-w-md mx-auto shadow-2xl border-x border-zinc-200"
    )}>
      {/* 시각적으로는 로고+태그라인으로 충분하지만, 페이지 전체에 h1이 하나도 없어(SEO 점검 중
          2026-08-25 발견) 크롤러에 페이지 주제를 알려줄 시맨틱 h1이 없었음. 디자인은 그대로 두고
          root layout의 title과 동일한 문구로 숨김 h1만 추가(브랜드 앞머리 순서는 2026-09-20
          title 변경에 맞춰 동기화) */}
      <h1 className="sr-only">NEMONE PACE | 서울·부산·제주 팝업스토어 실시간 랭킹 | 지금 뜨는 핫플레이스</h1>
      {/* Header */}
      <header ref={headerRef} className="px-6 pt-4 pb-1 bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {activeTab !== 'home' && (
              <button
                onClick={handleBack}
                className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
            )}
            <Logo />
          </div>
          <div className="flex items-center gap-3">
            {/* Language Toggle */}
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 mr-1 shadow-inner">
              {(['ko', 'en', 'zh', 'ja'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-black rounded-md transition-all whitespace-nowrap",
                    lang === l ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400"
                  )}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            {user ? (
              <Link href={`/my?lang=${lang}`} className="flex items-center gap-2 bg-zinc-100 pl-1 pr-3 py-1 rounded-full border border-zinc-200 hover:bg-white transition-all">
                <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-white shadow-sm bg-zinc-200">
                  <img
                    src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=random`}
                    className="w-full h-full object-cover"
                    alt="profile"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <span className="text-[10px] font-black tracking-tight text-zinc-900 uppercase">{t.my}</span>
              </Link>
            ) : (
              <button onClick={() => signInWithGoogle()} className="p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                <Users size={20} />
              </button>
            )}
          </div>
        </div>

        {/* 홈 탭에서만 브랜드 슬로건 자리에 실시간 혼잡도 티커를 노출(2026-09-06 사용자 요청).
            다른 탭은 원래 BrandTagline을 대신 보여줬는데, 페이지 하단 Global Footer에 같은
            슬로건이 이미 있어 상단은 중복이라는 피드백으로 제거(2026-09-10) — 이제 홈 탭이
            아니면 이 자리엔 아무것도 없다. PC 넓은 화면에서 티커가 그대로 풀폭으로 늘어나면
            휑해 보여서 md 이상에서는 max-w-3xl로 폭을 제한하고 가운데 정렬한다. */}
        {activeTab === 'home' && (
          <div className="-mx-6 md:mx-auto md:max-w-3xl">
            <CrowdTicker lang={lang} onNavigateToMap={goToCrowdMap} />
          </div>
        )}

        {/* Region Tabs: '추천'/'매거진'/'코스>테마' 탭에서는 숨김 (통합 운영) */}
        <AnimatePresence>
          {activeTab !== 'home' && !(activeTab === 'course' && courseSub === 'theme') && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              {activeTab === 'rec' ? (
                <>
                  {/* 랭킹 탭 서브메뉴 — 지도/장소와 같은 텍스트+밑줄 스타일로 헤더에 고정
                      (2026-09-07, 기존 Recommendation.tsx 내부에 있던 걸 이동) */}
                  {/* 탭 순서: 팝업/쇼핑/전시/공연/축제(카테고리·지역 필터) 먼저, 3시간/테마
                      (추천 알고리즘 모드라 성격이 달라 뒤로)는 맨 뒤로(2026-09-07 요청). */}
                  <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-nowrap">
                    <button onClick={() => setRecSubTab('place')} className={cn("text-sm font-bold transition-all px-1 pb-1 border-b-2 shrink-0 whitespace-nowrap", recSubTab === 'place' ? "text-pace-600 border-pace-600" : "text-zinc-300 border-transparent hover:text-zinc-500")}>
                      {lang === 'en' ? 'Pop-ups' : lang === 'zh' ? '快闪店' : lang === 'ja' ? 'ポップアップ' : '팝업'}
                    </button>
                    <button onClick={() => setRecSubTab('shopping')} className={cn("text-sm font-bold transition-all px-1 pb-1 border-b-2 shrink-0 whitespace-nowrap", recSubTab === 'shopping' ? "text-pace-600 border-pace-600" : "text-zinc-300 border-transparent hover:text-zinc-500")}>
                      {lang === 'en' ? 'Shopping' : lang === 'zh' ? '购物' : lang === 'ja' ? 'ショッピング' : '쇼핑'}
                    </button>
                    <button onClick={() => setRecSubTab('exhibition')} className={cn("text-sm font-bold transition-all px-1 pb-1 border-b-2 shrink-0 whitespace-nowrap", recSubTab === 'exhibition' ? "text-pace-600 border-pace-600" : "text-zinc-300 border-transparent hover:text-zinc-500")}>
                      {lang === 'en' ? 'Exhibits' : lang === 'zh' ? '展览' : lang === 'ja' ? '展示' : '전시'}
                    </button>
                    <button onClick={() => setRecSubTab('concert')} className={cn("text-sm font-bold transition-all px-1 pb-1 border-b-2 shrink-0 whitespace-nowrap", recSubTab === 'concert' ? "text-pace-600 border-pace-600" : "text-zinc-300 border-transparent hover:text-zinc-500")}>
                      {lang === 'en' ? 'Concerts' : lang === 'zh' ? '演出' : lang === 'ja' ? '公演' : '공연'}
                    </button>
                    <button onClick={() => setRecSubTab('festival')} className={cn("text-sm font-bold transition-all px-1 pb-1 border-b-2 shrink-0 whitespace-nowrap", recSubTab === 'festival' ? "text-pace-600 border-pace-600" : "text-zinc-300 border-transparent hover:text-zinc-500")}>
                      {lang === 'en' ? 'Festivals' : lang === 'zh' ? '节庆' : lang === 'ja' ? '祭り' : '축제'}
                    </button>
                    <button onClick={() => setRecSubTab('course')} className={cn("text-sm font-bold transition-all px-1 pb-1 border-b-2 shrink-0 whitespace-nowrap", recSubTab === 'course' ? "text-pace-600 border-pace-600" : "text-zinc-300 border-transparent hover:text-zinc-500")}>
                      {lang === 'en' ? '3-Hour' : lang === 'zh' ? '3小时' : lang === 'ja' ? '3時間' : '3시간'}
                    </button>
                    <button onClick={() => setRecSubTab('theme')} className={cn("text-sm font-bold transition-all px-1 pb-1 border-b-2 shrink-0 whitespace-nowrap", recSubTab === 'theme' ? "text-pace-600 border-pace-600" : "text-zinc-300 border-transparent hover:text-zinc-500")}>
                      {lang === 'en' ? 'Themes' : lang === 'zh' ? '主题' : lang === 'ja' ? 'テーマ' : '테마'}
                    </button>
                  </div>
                  {recSubTab === 'place' && (
                    <div ref={recPlacePillsRef} className="flex gap-1.5 mt-1.5 overflow-x-auto no-scrollbar">
                      {(['종합', '성수', '홍대', '강북', '강남', '부산', '제주'] as const).map((r) => (
                        <button
                          key={r}
                          data-region={r}
                          onClick={() => setRecPlaceRegion(r)}
                          className={cn(
                            "flex-shrink-0 px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border",
                            recPlaceRegion === r ? "bg-zinc-900 text-white border-zinc-900" : "bg-white text-zinc-400 border-zinc-200"
                          )}
                        >
                          {r === '종합'
                            ? (lang === 'en' ? 'All' : lang === 'zh' ? '全部' : lang === 'ja' ? '全体' : '전체')
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
                </>
              ) : activeTab === 'magazine' ? (
                /* 핫플 탭 서브메뉴 — 마찬가지로 헤더에 고정(2026-09-07, MagazineList.tsx에서 이동) */
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar flex-nowrap">
                  {([
                    ['article', lang === 'en' ? 'Magazine' : lang === 'zh' ? '杂志' : lang === 'ja' ? 'マガジン' : '매거진'],
                    ['mood', lang === 'en' ? 'Mood' : lang === 'zh' ? '氛围' : lang === 'ja' ? 'ムード' : '무드'],
                    ['category', lang === 'en' ? 'Category' : lang === 'zh' ? '分类' : lang === 'ja' ? 'カテゴリ' : '카테고리'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setMagazineSub(key)}
                      className={cn("text-sm font-bold transition-all px-1 pb-1 border-b-2 shrink-0 whitespace-nowrap", magazineSub === key ? "text-pace-600 border-pace-600" : "text-zinc-300 border-transparent hover:text-zinc-500")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <>
                  {/* 메인 지역 탭 — 장소형(성수/홍대/강북/강남/부산/제주) | 이벤트형(공연/축제), '|'로 시각적 구분 */}
                  {/* 부산 추가로 항목이 늘어 gap을 좁혀 2줄 방지(그래도 넘치면 가로 스크롤) */}
                  <div className="flex items-center gap-2 mb-1 overflow-x-auto no-scrollbar flex-nowrap">
                    {PLACE_REGIONS.map((r) => (
                      <button
                        key={r}
                        onClick={() => setRegion(r)}
                        className={cn(
                          "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1 shrink-0 whitespace-nowrap",
                          region === r ? REGION_ACCENT[r] : "text-zinc-300 border-transparent hover:text-zinc-500"
                        )}
                      >
                        {lang === 'en' ? REGION_LABEL[r].en : lang === 'zh' ? REGION_LABEL[r].zh : lang === 'ja' ? REGION_LABEL[r].ja : r}
                      </button>
                    ))}
                    {(activeTab !== 'map' && activeTab !== 'chat') && (
                      <>
                        <span className="text-zinc-200 font-bold select-none shrink-0">|</span>
                        {EVENT_REGIONS.map((r) => (
                          <button
                            key={r}
                            onClick={() => setRegion(r)}
                            className={cn(
                              "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1 shrink-0 whitespace-nowrap",
                              region === r ? REGION_ACCENT[r] : "text-zinc-300 border-transparent hover:text-zinc-500"
                            )}
                          >
                            {lang === 'en' ? REGION_LABEL[r].en : lang === 'zh' ? REGION_LABEL[r].zh : lang === 'ja' ? REGION_LABEL[r].ja : r}
                          </button>
                        ))}
                      </>
                    )}
                  </div>

                  {/* 공연 서브탭: 연극 | 뮤지컬 | 음악 | 종합 */}
                  <AnimatePresence>
                    {region === '공연' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex items-center gap-2 mb-1 pl-1 mt-2 overflow-x-auto no-scrollbar"
                      >
                        <span className="text-[10px] text-zinc-300 font-bold flex-shrink-0">›</span>
                        {(['연극', '뮤지컬', '음악', '종합'] as const).map((c) => {
                          const isActive = concertGenre === c;
                          return (
                            <button
                              key={c}
                              onClick={() => setConcertGenre(c)}
                              className={cn(
                                "text-xs font-bold transition-all px-2 py-0.5 rounded-full border flex-shrink-0 whitespace-nowrap",
                                isActive
                                  ? REGION_PILL_ACTIVE['공연']
                                  : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                              )}
                            >
                              {lang === 'en'
                                ? (c === '연극' ? 'Play' : c === '뮤지컬' ? 'Musical' : c === '음악' ? 'Music' : 'Others')
                                : lang === 'zh'
                                  ? (c === '연극' ? '话剧' : c === '뮤지컬' ? '音乐剧' : c === '음악' ? '音乐' : '综合')
                                  : lang === 'ja'
                                    ? (c === '연극' ? '演劇' : c === '뮤지컬' ? 'ミュージカル' : c === '음악' ? '音楽' : 'その他')
                                    : c}
                            </button>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 성수/홍대/강북/강남/제주 서브탭: 해당 지역에 실제 데이터가 있는 category만 동적 렌더링 (fetchAvailableCategories) */}
                  <AnimatePresence>
                    {isPlaceRegion && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex items-center gap-2 mb-1 pl-1 mt-2"
                      >
                        <span className="text-[10px] text-zinc-300 font-bold">›</span>
                        {availableCategories.map((c) => (
                          <button
                            key={c}
                            onClick={() => setPlaceCategory(c)}
                            className={cn(
                              "text-xs font-bold transition-all px-2 py-0.5 rounded-full border",
                              placeCategory === c
                                ? REGION_PILL_ACTIVE[region]
                                : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                            )}
                          >
                            {lang === 'en' ? CATEGORY_LABEL[c].en : lang === 'zh' ? CATEGORY_LABEL[c].zh : lang === 'ja' ? CATEGORY_LABEL[c].ja : CATEGORY_LABEL[c].ko}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content */}
      {/* overflow-y-auto를 뺐다 — main이 overflow!=visible이면 그 안에 있는 사이드카드
          (position:sticky)의 sticky 기준 컨테이너가 문서가 아니라 main이 되는데, main 자체는
          실제로는 내부 스크롤이 없고(항상 scrollHeight===clientHeight, 문서 스크롤에 얹혀만
          있음) scrollTop이 절대 안 바뀌어서 sticky가 전혀 동작하지 않고 카드가 그냥 같이
          흘러가버렸다(2026-09-07, 사이드카드를 main 안으로 옮기며 새로 드러난 문제 — main은
          애초에 2026-09-06 dvh 버그 수정 이후 자체 스크롤이 아니라 문서 스크롤에 의존하므로
          overflow-y-auto가 원래도 불필요했다). */}
      <main ref={mainRef} className="flex-1">
        <AnimatePresence mode="wait">
          {/* h-full을 안 쓴다 — HomeSections 콘텐츠가 한 화면보다 훨씬 길어서 h-full로 박스 높이를
              뷰포트에 고정하면 넘치는 콘텐츠는 시각적으로만 삐져나오고, 실제 박스 높이는 짧게 계산돼
              바로 아래 형제 요소인 footer가 콘텐츠 중간에 겹쳐서 렌더링된다(2026-09-06 확인). */}
          {activeTab === 'home' && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PullToRefresh enabled onRefresh={refreshHome}>
                <HomeSections lang={lang} allPlaces={allPlaces} regionTopPlaces={regionTopPlaces} onSeeAllRanking={goToRanking} />
              </PullToRefresh>
            </motion.div>
          )}

          {activeTab === 'rec' && (
            <motion.div key="rec" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <SideCardLayout
                headerH={headerH}
                bottomH={bottomNavH}
                lang={lang}
                onSeeAllPopup={goToPopupList}
                onSeeAllCongestion={goToCrowdMap}
                onSeeAllRanking={goToRanking}
              >
                <PullToRefresh enabled onRefresh={refreshRanking}>
                  <Recommendation
                    places={allPlaces}
                    lang={lang}
                    onNavigateToMap={goToCrowdMap}
                    activeTab={recSubTab}
                    setActiveTab={setRecSubTab}
                    placeRegion={recPlaceRegion}
                    setPlaceRegion={setRecPlaceRegion}
                    refreshKey={rankingRefreshKey}
                  />
                </PullToRefresh>
              </SideCardLayout>
            </motion.div>
          )}

          {activeTab === 'map' && isPlaceRegion && (
            <motion.div key="map" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <SideCardLayout
                headerH={headerH}
                bottomH={bottomNavH}
                lang={lang}
                onSeeAllPopup={goToPopupList}
                onSeeAllCongestion={goToCrowdMap}
                onSeeAllRanking={goToRanking}
              >
                <MapView places={mapPlaces} region={region} lang={lang} />
              </SideCardLayout>
            </motion.div>
          )}

          {activeTab === 'list' && (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SideCardLayout
                headerH={headerH}
                bottomH={bottomNavH}
                lang={lang}
                onSeeAllPopup={goToPopupList}
                onSeeAllCongestion={goToCrowdMap}
                onSeeAllRanking={goToRanking}
              >
                <PlaceList places={places} region={region} lang={lang} category={region === '공연' ? concertGenre : placeCategory} sort={placeSort} onSortChange={setPlaceSort} />
              </SideCardLayout>
            </motion.div>
          )}

          {activeTab === 'course' && (
            <motion.div key="course" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <SideCardLayout
                headerH={headerH}
                bottomH={bottomNavH}
                lang={lang}
                onSeeAllPopup={goToPopupList}
                onSeeAllCongestion={goToCrowdMap}
                onSeeAllRanking={goToRanking}
              >
                <div className="flex gap-2 px-6 pt-4 pb-1">
                  {isPlaceRegion && (
                    <button
                      onClick={() => router.push(`/course?lang=${lang}`)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all bg-zinc-100 text-zinc-400"
                    >
                      {t.courseSubAi}
                    </button>
                  )}
                  <button
                    onClick={() => setCourseSub('theme')}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all",
                      courseSub === 'theme' ? "bg-zinc-900 text-white shadow-sm" : "bg-zinc-100 text-zinc-400"
                    )}
                  >
                    {t.courseSubTheme}
                  </button>
                </div>
                {courseSub === 'theme' && <ThemeMenu lang={lang} />}
              </SideCardLayout>
            </motion.div>
          )}

          {activeTab === 'magazine' && (
            <motion.div key="magazine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SideCardLayout
                headerH={headerH}
                bottomH={bottomNavH}
                lang={lang}
                onSeeAllPopup={goToPopupList}
                onSeeAllCongestion={goToCrowdMap}
                onSeeAllRanking={goToRanking}
              >
                <MagazineList lang={lang} sub={magazineSub} initialMood={magazineMood} initialCategory={magazineCategory} />
              </SideCardLayout>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <AskAI region={region} lang={lang} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Footer */}
        <footer className="mt-10 mb-20 px-6 pt-6 border-t border-zinc-100 space-y-4">
          <div className="flex flex-col items-center text-center gap-1">
            <span className="text-[11px] font-black text-zinc-700 tracking-[0.2em] uppercase">
              NEMONE PACE
            </span>
            <span className="text-[10px] font-bold text-zinc-500 tracking-wide">
              {t.desc}
            </span>
            <span className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase mt-1">
              © NEMONE INC. ALL RIGHTS RESERVED.
            </span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {[
              { name: 'ABOUT', href: 'https://home.nemoneai.com' },
              { name: 'BLOG', href: 'https://blog.naver.com/nemoneaim' },
              { name: '네모네AIM', href: 'https://nemoneai.com' },
              { name: 'FEEDBACK', href: `/feedback?lang=${lang}` },
            ].map((item) => (
              <Link
                key={item.name}
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-[9px] font-black text-zinc-500 hover:text-pace-600 tracking-[0.25em] uppercase transition-colors"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </footer>
      </main>

      {/* Floating AI 가이드/코스생성 버튼(둥둥이) — 핫플 상단에 있던 버튼 2개를 전체 화면 공통 FAB로 이동
          (그 자리엔 유동인구 티커가 들어감). 가이드=우하단, 코스생성=좌하단, 모든 탭에서 노출.
          코스생성은 예전엔 '랭킹' 탭으로 전환한 뒤에야 Recommendation.tsx 안의 인라인 모달이 열려서
          홈 탭에서 누르면 화면이 랭킹으로 바뀌었다 모달이 뜨는 게 어색했다(2026-09-06 피드백) —
          모달을 AiCourseModal로 분리해 탭 전환 없이 지금 탭 위에 바로 오버레이되게 함. */}
      <button
        onClick={() => setShowAiCourseModal(true)}
        className="fixed bottom-28 left-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all z-[60] active:scale-90 bg-white text-zinc-900 border border-zinc-200 hover:border-pace-300 hover:text-pace-600"
        aria-label="AI코스생성"
      >
        <Sparkles size={22} />
      </button>
      <AiCourseModal open={showAiCourseModal} onClose={() => setShowAiCourseModal(false)} />

      <button
        onClick={() => setActiveTab('chat')}
        className={cn(
          "fixed bottom-28 right-6 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all z-[60] active:scale-90",
          activeTab === 'chat' ? "bg-pace-500 text-white scale-105" : "bg-zinc-900 text-white hover:bg-pace-600"
        )}
        aria-label="AI가이드"
      >
        <MessageCircle size={24} className={cn(activeTab === 'chat' && "animate-pulse")} />
        {activeTab !== 'chat' && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-pace-500 rounded-full border-2 border-zinc-50 animate-bounce" />
        )}
      </button>

      {/* Bottom Navigation — sticky bottom-0 방어 처리(2026-09-06): 정상 상황(모바일 앱셸이
          h-[100dvh]+overflow-hidden로 정확히 뷰포트에 맞음)에선 이미 자연스러운 맨 아래라 아무
          변화 없지만, PC/일부 환경에서 루트 div의 실제 렌더 높이가 100dvh를 안 지키고 콘텐츠
          높이만큼 늘어나는 경우(사용자 리포트: "하단 메뉴가 브라우저 하단에 안 맞춰져 있음. 안
          보임", PC·모바일 공통) 문서 자체가 스크롤되면서 네비가 화면 밖으로 밀려나 버리는 문제를
          막아준다 — body가 스크롤되더라도 sticky가 뷰포트 하단에 다시 붙잡아 둠. */}
      <nav ref={bottomNavRef} className="sticky bottom-0 bg-white/90 backdrop-blur-xl border-t border-zinc-100 px-4 pt-2 pb-4 flex justify-between items-center z-50">
        <NavButton
          active={activeTab === 'home'}
          onClick={() => setActiveTab('home')}
          icon={<HomeIcon size={22} />}
          label={t.navHome}
        />
        <NavButton
          active={activeTab === 'rec'}
          onClick={() => setActiveTab('rec')}
          icon={<TrendingUp size={22} />}
          label={t.navRec}
        />
        <NavButton
          active={activeTab === 'map'}
          onClick={() => {
            if (region === '공연' || region === '축제') setRegion('성수');
            setActiveTab('map');
          }}
          icon={<MapIcon size={22} />}
          label={t.navMap}
          disabled={(region === '공연' || region === '축제') && activeTab === 'list'}
        />
        <NavButton 
          active={activeTab === 'list'} 
          onClick={() => setActiveTab('list')} 
          icon={<MapPin size={22} />}
          label={t.navList}
        />
        <NavButton
          active={activeTab === 'course'}
          onClick={() => router.push(`/course?lang=${lang}`)}
          icon={<RouteIcon size={22} />}
          label={t.navCourse}
        />
        <NavButton
          active={activeTab === 'magazine'}
          onClick={() => setActiveTab('magazine')}
          icon={<Newspaper size={22} />}
          label={t.navMagazine}
        />
      </nav>
    </div>
  );

  return content;
}

export default function HomeClient({ initialAllPlaces, regionTopPlaces = [] }: { initialAllPlaces: any[]; regionTopPlaces?: { region: string; place: any }[] }) {
  return <Home initialAllPlaces={initialAllPlaces} regionTopPlaces={regionTopPlaces} />;
}

function NavButton({ active, onClick, icon, label, disabled }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, disabled?: boolean }) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.85 }}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        disabled ? "text-zinc-300 cursor-not-allowed" : (active ? "text-pace-600" : "text-zinc-400")
      )}
    >
      <div className={cn("relative p-1 rounded-xl", disabled && "opacity-50")}>
        {/* 활성 탭 배경 — layoutId로 같은 요소가 탭 사이를 부드럽게 이동하는 것처럼 애니메이션 */}
        {active && !disabled && (
          <motion.div
            layoutId="nav-active-pill"
            className="absolute inset-0 bg-pace-50 rounded-xl"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <span className="relative">{icon}</span>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </motion.button>
  );
}
