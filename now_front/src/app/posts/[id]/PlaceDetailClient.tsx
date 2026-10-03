'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft, ChevronRight, MapPin, Calendar, Clock, Share2, Globe, Video, Heart,
  Users, Megaphone, Flame, Sparkles, TrendingUp,
} from 'lucide-react';
import { InArticleAd } from '@/components/AdUnit';
import BottomNav from '@/components/BottomNav';
import Logo from '@/components/Logo';
import PwaInstallBanner from '@/components/PwaInstallBanner';
import SideCardLayout, { WIDE_FRAME, WIDE_FRAME_BORDER, useElementHeight } from '@/components/sidecards/SideCardLayout';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';


const PLACE_REGIONS = ['성수', '홍대', '강북', '강남', '부산', '제주'] as const;
const EVENT_REGIONS = ['공연', '축제'] as const;
const REGION_LABEL: Record<string, { en: string; zh: string; ja: string }> = {
  '성수': { en: 'SEONGSU', zh: '圣水洞', ja: 'ソンス' },
  '홍대': { en: 'HONGDAE', zh: '弘大', ja: 'ホンデ' },
  '강북': { en: 'GANGBUK', zh: '江北', ja: 'カンブク' },
  '강남': { en: 'GANGNAM', zh: '江南', ja: 'カンナム' },
  '부산': { en: 'BUSAN', zh: '釜山', ja: '釜山' },
  '제주': { en: 'JEJU', zh: '济州', ja: '済州' },
  '공연': { en: 'CONCERT', zh: '演出', ja: '公演' },
  '축제': { en: 'FESTIVAL', zh: '节庆', ja: '祭り' },
};
const REGION_ACCENT: Record<string, string> = {
  '성수': 'text-emerald-600 border-emerald-500',
  '홍대': 'text-orange-600 border-orange-500',
  '강북': 'text-yellow-600 border-yellow-500',
  '강남': 'text-pink-600 border-pink-500',
  '부산': 'text-sky-500 border-sky-500',
  '제주': 'text-[#0369a1] border-[#0369a1]',
  '공연': 'text-emerald-600 border-emerald-500',
  '축제': 'text-amber-600 border-amber-500',
};
const REGION_PILL_ACTIVE: Record<string, string> = {
  '성수': 'bg-emerald-500 text-white border-emerald-500',
  '홍대': 'bg-orange-500 text-white border-orange-500',
  '강북': 'bg-yellow-500 text-white border-yellow-500',
  '강남': 'bg-pink-500 text-white border-pink-500',
  '부산': 'bg-sky-500 text-white border-sky-500',
  '제주': 'bg-[#0369a1] text-white border-[#0369a1]',
  '공연': 'bg-emerald-500 text-white border-emerald-500',
  '축제': 'bg-amber-500 text-white border-amber-500',
};
// PACE PICK 박스(옛 "상세 정보") 배경색 — Recommendation.tsx의 지역 배지 색과 통일
// (성수=emerald/홍대=orange/강북=yellow/강남=pink/공연=purple/부산=sky/제주=커스텀블루/축제=amber).
// 지역이 없거나 매핑에 없으면 브랜드 기본색(pace)으로 폴백.
const PACE_PICK_BOX: Record<string, string> = {
  '성수': 'bg-emerald-50 border-emerald-100',
  '홍대': 'bg-orange-50 border-orange-100',
  '강북': 'bg-yellow-50 border-yellow-100',
  '강남': 'bg-pink-50 border-pink-100',
  '공연': 'bg-purple-50 border-purple-100',
  '부산': 'bg-sky-50 border-sky-100',
  '제주': 'bg-blue-50 border-blue-100',
  '축제': 'bg-amber-50 border-amber-100',
};
const PACE_PICK_TEXT: Record<string, string> = {
  '성수': 'text-emerald-600',
  '홍대': 'text-orange-600',
  '강북': 'text-yellow-700',
  '강남': 'text-pink-600',
  '공연': 'text-purple-600',
  '부산': 'text-sky-600',
  '제주': 'text-[#0369a1]',
  '축제': 'text-amber-600',
};
// category_tag(패션/뷰티/캐릭터/애니웹툰/엔터/종합) 아이콘 — 상세정보 옆에 붙여 한눈에 성격을 알려준다.
const CATEGORY_TAG_ICON: Record<string, string> = {
  '패션': '👗', '뷰티': '💄', '캐릭터': '🧸', '애니웹툰': '🎬', '엔터': '🎤', '종합': '✨',
};

// 카테고리별 쿠팡 파트너스 한 줄 링크(2026-09-03) — 전시는 공연과 같은 링크를 쓴다.
// 위 규칙에 안 걸리는 나머지(팝업/축제 등 기본)는 전부 "입장권" 링크로 폴백.
function getCoupangLink(region?: string | null, category?: string | null): { label: string; url: string } {
  if (region === '공연' || category === '전시') {
    return { label: '서울공연', url: 'https://link.coupang.com/a/gKfc808DJY' };
  }
  if (category === 'shopping') {
    return { label: '독립서점', url: 'https://link.coupang.com/a/gKfAIDqaCO' };
  }
  if (category === 'class') {
    return { label: '원데이클래스', url: 'https://link.coupang.com/a/gKfnZ2Dkiq' };
  }
  return { label: '입장권', url: 'https://link.coupang.com/a/gKfkB7DDP2' };
}

// /ranking/place/[slug] 지역 허브 페이지(lib/regionPopularHub.tsx)와 슬러그를 맞춤 —
// 값이 갈리면 여기서 만든 링크가 404로 빠진다.
const REGION_HUB_SLUG: Record<string, string> = {
  '성수': 'seongsu', '홍대': 'hongdae', '강북': 'gangbuk', '강남': 'gangnam', '부산': 'busan', '제주': 'jeju',
};
const LANG_PATH_PREFIX: Record<string, string> = { ko: '', en: '/en', zh: '/zh', ja: '/ja' };
const REGION_HUB_LABEL: Record<string, (region: string) => string> = {
  ko: (r) => `${r} 실시간 인기 팝업 더보기 →`,
  en: (r) => `See more trending pop-ups in ${REGION_LABEL[r]?.en ?? r} →`,
  zh: (r) => `查看更多${REGION_LABEL[r]?.zh ?? r}热门快闪店 →`,
  ja: (r) => `${REGION_LABEL[r]?.ja ?? r}の人気ポップアップをもっと見る →`,
};
// '엔터'는 지역 카테고리(여기)가 아니라 category_tag(핫플>카테고리)로 이동함(2026-09-11)
const CATEGORY_ORDER = ['popup', 'class', 'shopping', '전시', '행사'] as const;
const CATEGORY_LABEL: Record<string, { en: string; zh: string; ja: string; ko: string }> = {
  popup: { en: 'Pop-up', zh: '快闪店', ja: 'ポップアップ', ko: '팝업' },
  class: { en: 'Class', zh: '体验课程', ja: '体験', ko: '클래스' },
  shopping: { en: 'Shopping', zh: '购物', ja: 'ショッピング', ko: '쇼핑' },
  '전시': { en: 'Exhibit', zh: '展览', ja: '展示', ko: '전시' },
  '행사': { en: 'Event', zh: '活动', ja: 'イベント', ko: '행사' },
};

export interface BlogReview {
  title: string;
  url: string;
}

export interface Place {
  id: number;
  title: string;
  title_en?: string;
  title_zh?: string;
  title_ja?: string;
  content: string;
  content_en?: string;
  content_zh?: string;
  content_ja?: string;
  location: string;
  image_url: string;
  video_url?: string;
  date_range?: string;
  end_date?: string;
  latitude?: number;
  longitude?: number;
  region?: string;
  category?: string | null;
  naver_place_id?: string;
  blog_reviews?: BlogReview[] | string | null;
  link_url?: string | null;
  link_title?: string | null;
  created_at?: string | null;
  hot_rank?: number | null;
  hot_rank_updated_at?: string | null;
  mood_tags?: string[] | null;
  category_tag?: string | null;
}

interface Props {
  place: Place;
  lang: string;
  suggestions: Place[];
  regionTop3: Place[];
}

const T = {
  ko: {
    prevPlace: '이전 장소', nextPlace: '다음 장소', spotlight: '핫플레이스 상세',
    hotVerified: '핫플인증', closingSoon: '마감임박', new: 'NEW', updatedAt: '기준',
    duration: '운영 기간', openDaily: '상시 운영', status: '상태', active: '운영 중', ended: '운영 종료', upcoming: '오픈 예정',
    details: '상세 정보', pacePick: 'PACE PICK', pacePickHeadline: '지금 이곳을 주목해야 하는 이유',
    regionPopular: '이 지역 인기장소', regionPopularSeeAll: '전체보기',
    moreToExplore: '이런 곳도 있어요', location: '위치 안내',
    locationSyncing: '정확한 위치 정보 준비 중', watchVideo: '실시간 영상 보기', nowHere: 'NEMONE PACE',
    linkCopied: '링크가 복사되었습니다!',
    my: '마이',
    tagline: '당신 3시간의 알찬 설계',
  },
  en: {
    prevPlace: 'Previous place', nextPlace: 'Next place', spotlight: 'Hotplace Spotlight',
    hotVerified: 'Hot Pick', closingSoon: 'Closing Soon', new: 'NEW', updatedAt: 'as of',
    duration: 'Duration', openDaily: 'Open Daily', status: 'Status', active: 'Active', ended: 'Ended', upcoming: 'Opening Soon',
    details: 'Details', pacePick: 'PACE PICK', pacePickHeadline: 'Why this place is worth your time',
    regionPopular: 'Popular in this area', regionPopularSeeAll: 'See all',
    moreToExplore: 'More to explore', location: 'Location',
    locationSyncing: 'Location Data Syncing', watchVideo: 'Watch Video', nowHere: 'NEMONE PACE',
    linkCopied: 'Link copied!',
    my: 'My',
    tagline: 'A fulfilling plan for your 3 hours',
  },
  zh: {
    prevPlace: '上一个地点', nextPlace: '下一个地点', spotlight: '热门地点详情',
    hotVerified: '认证热门', closingSoon: '即将结束', new: 'NEW', updatedAt: '更新于',
    duration: '运营期间', openDaily: '全年营业', status: '状态', active: '营业中', ended: '已结束', upcoming: '即将开始',
    details: '详细信息', pacePick: 'PACE PICK', pacePickHeadline: '现在最值得关注的理由',
    regionPopular: '本地区人气场所', regionPopularSeeAll: '查看全部',
    moreToExplore: '更多推荐', location: '位置信息',
    locationSyncing: '位置信息准备中', watchVideo: '观看实时视频', nowHere: 'NEMONE PACE',
    linkCopied: '链接已复制！',
    my: '我的',
    tagline: '为您3小时的充实安排',
  },
  ja: {
    prevPlace: '前のスポット', nextPlace: '次のスポット', spotlight: 'ホットプレイス詳細',
    hotVerified: '人気認証', closingSoon: '終了間近', new: 'NEW', updatedAt: '基準',
    duration: '運営期間', openDaily: '常時営業', status: 'ステータス', active: '営業中', ended: '終了', upcoming: 'オープン予定',
    details: '詳細情報', pacePick: 'PACE PICK', pacePickHeadline: '今このスポットに注目すべき理由',
    regionPopular: 'このエリアの人気スポット', regionPopularSeeAll: 'すべて見る',
    moreToExplore: 'こんな場所も', location: '位置案内',
    locationSyncing: '位置情報を準備中', watchVideo: 'ライブ映像を見る', nowHere: 'NEMONE PACE',
    linkCopied: 'リンクをコピーしました！',
    my: 'マイ',
    tagline: 'あなたの3時間を充実させる',
  },
} as const;

export default function PlaceDetailClient({ place, lang: initialLang, suggestions, regionTop3 }: Props) {
  const router = useRouter();
  const { user, signInWithGoogle } = useAuth();
  const [navIndex, setNavIndex] = React.useState(0);
  const [liked, setLiked] = React.useState(false);
  const [showPwaNudge, setShowPwaNudge] = React.useState(false);
  const [lang, setLang] = React.useState(initialLang);
  const t = T[(lang as keyof typeof T)] || T.ko;
  const [banner, setBanner] = React.useState<{ text: string; url: string } | null>(null);
  const [availableCategories, setAvailableCategories] = React.useState<string[]>([...CATEGORY_ORDER]);
  const [headerRef, headerH] = useElementHeight<HTMLElement>(96);

  // 공유 root layout이 searchParam(?lang=)을 못 읽어 초기 HTML은 <html lang="ko"> 고정 —
  // 실제 콘텐츠 언어와 선언 언어가 어긋나지 않도록, 언어가 바뀌면 문서 lang 속성을 맞춤.
  // 초기 HTML엔 못 반영되지만 JS를 렌더링하는 크롤러(Googlebot)와 실제 사용자에겐 정확히 적용됨.
  React.useEffect(() => {
    const htmlLang = lang === 'en' ? 'en' : lang === 'zh' ? 'zh' : lang === 'ja' ? 'ja' : 'ko';
    document.documentElement.lang = htmlLang;
  }, [lang]);

  React.useEffect(() => {
    fetch('/api-now/banner')
      .then(res => res.json())
      .then((data: { text: string; url: string }) => {
        if (data?.text?.trim()) setBanner(data);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!place?.region || !(PLACE_REGIONS as readonly string[]).includes(place.region)) return;
    fetch(`/api-now/places/categories?region=${encodeURIComponent(place.region)}`)
      .then(res => res.json())
      .then((data: string[]) => setAvailableCategories(CATEGORY_ORDER.filter((c) => data.includes(c))))
      .catch(() => {});
  }, [place?.region]);

  React.useEffect(() => {
    if (user?.id && place?.id) {
      fetch(`/api-now/users/${user.id}/likes`)
        .then(res => res.json())
        .then((data: { id: number }[]) => setLiked(data.some(p => p.id === place.id)))
        .catch(() => {});
    }
  }, [user, place?.id]);

  const toggleLike = async () => {
    if (!place) return;
    if (!user) return signInWithGoogle();
    try {
      const res = await fetch('/api-now/likes/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, place_id: place.id }),
      });
      if (res.ok) {
        const { liked: nowLiked } = await res.json();
        setLiked(nowLiked);
        // 찜 3개 이상 달성 시점에 PWA 설치 배너 노출 — 이미 관심을 보인 유저에게만 자연스럽게 제안
        if (nowLiked) {
          fetch(`/api-now/users/${user.id}/likes`)
            .then((r) => r.json())
            .then((data: unknown[]) => { if (data.length >= 3) setShowPwaNudge(true); })
            .catch(() => {});
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleShare = async () => {
    if (!place) return;
    const url = `https://now.nemoneai.com/posts/${place.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: place.title, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert(t.linkCopied);
      } catch {}
    }
  };

  React.useEffect(() => {
    if (place?.id) {
      fetch(`/api-now/places/${place.id}/view`, { method: 'POST', keepalive: true }).catch(() => {});
    }
  }, [place?.id]);

  const handleBack = () => {
    // 외부 앱(카톡·네이버지도 등)에서 바로 들어온 경우 히스토리가 없어 back()이 안 먹힐 수 있어 홈으로 폴백
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const goToSuggestion = (direction: 1 | -1) => {
    if (suggestions.length === 0) return;
    const nextIndex = (navIndex + direction + suggestions.length) % suggestions.length;
    setNavIndex(nextIndex);
    const target = suggestions[nextIndex];
    router.push(`/posts/${target.id}?${new URLSearchParams({ ...(place?.region ? { region: place.region } : {}), lang }).toString()}`);
  };

  const displayTitle = (lang === 'en' && place.title_en) ? place.title_en
    : (lang === 'zh' && place.title_zh) ? place.title_zh
    : (lang === 'ja' && place.title_ja) ? place.title_ja
    : place.title;
  const displayContent = (lang === 'en' && place.content_en) ? place.content_en
    : (lang === 'zh' && place.content_zh) ? place.content_zh
    : (lang === 'ja' && place.content_ja) ? place.content_ja
    : place.content;

  const displayDateRange = (() => {
    if (place.category === 'class') return null; // 원데이클래스/체험 — 상시 운영, 임시 만료일(end_date)을 기간처럼 보여주지 않음
    if (place.date_range) return place.date_range;
    if (place.end_date) return `~ ${place.end_date}`;
    return null;
  })();

  const toISO = (s: string): string => {
    const clean = s.replace(/\s/g, '').replace(/\.+$/, '');
    const full = clean.match(/^(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})\.?$/);
    if (full) return `${full[1]}-${full[2].padStart(2,'0')}-${full[3].padStart(2,'0')}`;
    const short = clean.match(/^(\d{1,2})[.\-](\d{1,2})\.?$/);
    if (short) return `${new Date().getFullYear()}-${short[1].padStart(2,'0')}-${short[2].padStart(2,'0')}`;
    return new Date().toISOString().split('T')[0];
  };

  const [startDate, endDate] = (() => {
    const src = displayDateRange || '';
    const parts = src.split('~').map(s => s.trim());
    const start = parts[0] ? toISO(parts[0]) : new Date().toISOString().split('T')[0];
    const end = parts[1] ? toISO(parts[1]) : undefined;
    return [start, end];
  })();

  // 원데이클래스/체험은 상시 운영으로 취급해 종료 표기 대상에서 제외
  const isEnded = place.category !== 'class' && !!endDate && endDate < new Date().toISOString().split('T')[0];

  // 시작일이 아직 안 된 경우(수동 등록 등) "운영 중"으로 잘못 표시되던 문제 수정(2026-09-02) —
  // startDate는 이미 위에서 date_range 앞부분을 파싱해 계산해뒀음.
  const isUpcoming = !isEnded && place.category !== 'class' && !!startDate && startDate > new Date().toISOString().split('T')[0];

  // 마감임박(D-3 이내) — 종료된 곳/상시 클래스/아직 시작 전인 곳은 대상에서 제외
  const daysUntilClose = (place.category !== 'class' && !!endDate && !isEnded && !isUpcoming)
    ? Math.ceil((new Date(endDate + 'T00:00:00Z').getTime() - new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z').getTime()) / 86400000)
    : null;
  const isClosingSoon = daysUntilClose !== null && daysUntilClose >= 0 && daysUntilClose <= 3;

  // 신규 등록(7일 이내)
  const isNew = !!place.created_at && (Date.now() - new Date(place.created_at).getTime()) <= 7 * 24 * 60 * 60 * 1000;

  // 제주는 2026-07-21부터 팝업/클래스(성수·홍대 등과 동일한 실제 네이버 지도 소스)/쇼핑·행사(비짓제주)를
  // 함께 갖는 장소형 지역이 됨 — 공연/축제(KOPIS·문체부 등 외부 이벤트 소스만 있는 지역)와는 구분해야 함
  const isPerformanceRegion = place.region === '공연' || place.region === '축제';
  // 공연/축제/전시/행사는 AI가 소개문을 새로 쓰지 않고 원본 API 텍스트를 그대로 쓰는
  // 콘텐츠라 "PACE PICK"(에디터가 고른 이유) 프레이밍이 안 맞는다는 피드백(2026-09-11)
  // — 이 경우 예전처럼 중립적인 '상세 정보' 라벨만 쓰고 헤드라인 문구는 생략한다.
  const isApiOnlyContent = isPerformanceRegion || place.category === '전시' || place.category === '행사';
  const hasValidNaverId = place.naver_place_id &&
    !place.naver_place_id.startsWith('raw_') &&
    !place.naver_place_id.startsWith('seoul_') &&
    !place.naver_place_id.startsWith('seoulex_') &&
    !place.naver_place_id.startsWith('kopis_') &&
    !place.naver_place_id.startsWith('visitseoul_') &&
    !place.naver_place_id.startsWith('visitjeju_') &&
    !place.naver_place_id.startsWith('jeju_') &&
    !place.naver_place_id.startsWith('culture_') &&
    !place.naver_place_id.startsWith('concert_') &&
    !place.naver_place_id.startsWith('festival_') &&
    !place.naver_place_id.startsWith('kakao_');
  const kakaoPlaceId = place.naver_place_id?.startsWith('kakao_') ? place.naver_place_id.slice('kakao_'.length) : null;

  const pageUrl = `https://now.nemoneai.com/posts/${place.id}`;
  // 무드/카테고리 태그를 JSON-LD keywords로도 노출 — 리스크 없이 검색엔진에 주제 신호 보강
  const seoKeywords = [place.category_tag, ...(place.mood_tags || [])].filter(Boolean).join(', ');

  // FAQ(AEO 대응, 2026-09-11, fire-your-seo-agency 스킬 권고) — 실제 방문객이 검색할 법한
  // 질문 중 "데이터로 확정되는 것만" 담는다(입장료는 JSON-LD상 전 항목 "0원"으로 하드코딩된
  // 가정값이라 실제 유료 공연 등에서 틀릴 수 있어 FAQ에서 제외). 가시 텍스트와 JSON-LD가
  // 반드시 글자까지 동일해야 해서, 이 배열 하나로 화면 렌더링과 구조화 데이터를 함께 만든다.
  const statusLabel = isEnded ? t.ended : isUpcoming ? t.upcoming : t.active;
  const validLocation = place.location && place.location !== '확인 필요' && place.location !== '전국' ? place.location : null;
  const typeLabel = (place.region === '공연' || place.region === '축제')
    ? (lang === 'ko' ? place.region : (REGION_LABEL[place.region]?.[lang as 'en' | 'zh' | 'ja'] ?? place.region))
    : (() => {
        const catKey = (place.category && CATEGORY_LABEL[place.category]) ? place.category : 'popup';
        return lang === 'ko' ? CATEGORY_LABEL[catKey].ko : CATEGORY_LABEL[catKey][lang as 'en' | 'zh' | 'ja'];
      })();
  const regionNameLabel = place.region && place.region !== '공연' && place.region !== '축제'
    ? (lang === 'ko' ? place.region : (REGION_LABEL[place.region]?.[lang as 'en' | 'zh' | 'ja'] ?? place.region))
    : null;

  const faqItems: { q: string; a: string }[] = [
    {
      q: lang === 'en' ? 'How long does it run?' : lang === 'zh' ? '运营期间是什么时候?' : lang === 'ja' ? '運営期間はいつまでですか?' : '운영 기간은 어떻게 되나요?',
      a: displayDateRange
        ? (lang === 'en' ? `It runs ${displayDateRange}, and is currently ${statusLabel}.`
          : lang === 'zh' ? `运营期间为${displayDateRange},目前状态为${statusLabel}。`
          : lang === 'ja' ? `運営期間は${displayDateRange}で、現在${statusLabel}です。`
          : `운영 기간은 ${displayDateRange}이며, 현재 ${statusLabel} 상태입니다.`)
        : (lang === 'en' ? "It's open year-round with no set end date."
          : lang === 'zh' ? '常年营业,没有固定的结束日期。'
          : lang === 'ja' ? '通年営業しており、特定の終了日はありません。'
          : '상시 운영하는 곳으로, 별도의 운영 종료일이 없습니다.'),
    },
    ...(validLocation ? [{
      q: lang === 'en' ? 'Where is it located?' : lang === 'zh' ? '地址在哪里?' : lang === 'ja' ? '場所はどこですか?' : '위치는 어디인가요?',
      a: lang === 'en' ? `It's located at ${validLocation}.`
        : lang === 'zh' ? `地址是${validLocation}。`
        : lang === 'ja' ? `場所は${validLocation}です。`
        : `위치는 ${validLocation}입니다.`,
    }] : []),
    {
      q: lang === 'en' ? 'What kind of place is this?' : lang === 'zh' ? '这是什么类型的地方?' : lang === 'ja' ? 'どんな種類の場所ですか?' : '어떤 종류의 장소인가요?',
      a: regionNameLabel
        ? (lang === 'en' ? `It's a ${typeLabel} in ${regionNameLabel}.`
          : lang === 'zh' ? `这是${regionNameLabel}地区的${typeLabel}。`
          : lang === 'ja' ? `${regionNameLabel}エリアの${typeLabel}です。`
          : `${regionNameLabel} 지역의 ${typeLabel}입니다.`)
        : (lang === 'en' ? `It's a ${typeLabel}.`
          : lang === 'zh' ? `这是${typeLabel}。`
          : lang === 'ja' ? `${typeLabel}です。`
          : `${typeLabel}입니다.`),
    },
  ];
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqItems.map((item) => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": { "@type": "Answer", "text": item.a },
    })),
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": displayTitle,
    "description": displayContent.replace(/<[^>]*>/g, '').substring(0, 160),
    "url": pageUrl,
    "image": place.image_url || 'https://now.nemoneai.com/og-image.png',
    "location": {
      "@type": "Place",
      "name": place.location || (place.region === '제주' ? '제주아트센터' : '서울'),
      "address": {
        "@type": "PostalAddress",
        "streetAddress": place.location || undefined,
        "addressLocality": place.region === '제주' ? "Jeju" : "Seoul",
        "addressRegion": place.region === '제주' ? "Jeju-do" : undefined,
        "addressCountry": "KR"
      }
    },
    "startDate": startDate,
    "endDate": endDate || startDate,
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "performer": {
      "@type": "Organization",
      "name": displayTitle
    },
    "organizer": {
      "@type": "Organization",
      "name": displayTitle,
      "url": place.link_url || pageUrl
    },
    "offers": {
      "@type": "Offer",
      "url": place.link_url || pageUrl,
      "price": "0",
      "priceCurrency": "KRW",
      "availability": "https://schema.org/InStock",
      "validFrom": startDate
    },
    ...(seoKeywords ? { keywords: seoKeywords } : {}),
  };

  return (
    <div className={cn("min-h-screen bg-zinc-50 relative", WIDE_FRAME, WIDE_FRAME_BORDER)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* GNB */}
      <header ref={headerRef} className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-zinc-100 px-5 pt-3 pb-1">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={handleBack}
              className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-all"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <Logo />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 shadow-inner">
              {(['ko', 'en', 'zh', 'ja'] as const).map((l) => (
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
              <a href={`/my?lang=${lang}`} className="flex items-center bg-zinc-100 p-0.5 rounded-full border border-zinc-200 hover:bg-white transition-all">
                <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-white shadow-sm bg-zinc-200">
                  <img
                    src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=random`}
                    className="w-full h-full object-cover"
                    alt="profile"
                  />
                </div>
              </a>
            ) : (
              <button onClick={() => signInWithGoogle()} className="p-1.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
                <Users size={16} />
              </button>
            )}
          </div>
        </div>

        {/* 지역 탭 — 장소형(성수/홍대/강북/강남/제주) | 이벤트형(공연/축제) */}
        <div className="flex items-center gap-3 mb-1 overflow-x-auto no-scrollbar flex-nowrap">
          {PLACE_REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => router.push(`/?region=${encodeURIComponent(r)}&tab=list&lang=${lang}`)}
              className={cn(
                "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1 shrink-0 whitespace-nowrap",
                place.region === r ? REGION_ACCENT[r] : "text-zinc-300 border-transparent"
              )}
            >
              {lang === 'en' ? REGION_LABEL[r].en : lang === 'zh' ? REGION_LABEL[r].zh : lang === 'ja' ? REGION_LABEL[r].ja : r}
            </button>
          ))}
          <span className="text-zinc-200 font-bold select-none shrink-0">|</span>
          {EVENT_REGIONS.map((r) => (
            <button
              key={r}
              onClick={() => router.push(`/?region=${encodeURIComponent(r)}&tab=list&lang=${lang}`)}
              className={cn(
                "text-sm font-bold transition-all px-1 pb-1 border-b-2 flex items-center gap-1 shrink-0 whitespace-nowrap",
                place.region === r ? REGION_ACCENT[r] : "text-zinc-300 border-transparent"
              )}
            >
              {lang === 'en' ? REGION_LABEL[r].en : lang === 'zh' ? REGION_LABEL[r].zh : lang === 'ja' ? REGION_LABEL[r].ja : r}
            </button>
          ))}
        </div>

        {/* 공연 서브탭: 연극 | 뮤지컬 | 음악 | 종합 */}
        {place.region === '공연' && (
          <div className="flex items-center gap-2 mb-1 pl-1 mt-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-zinc-300 font-bold flex-shrink-0">›</span>
            {(['연극', '뮤지컬', '음악', '종합'] as const).map((c) => {
              const isActive = place.category === c;
              return (
                <button
                  key={c}
                  onClick={() => router.push(`/?region=${encodeURIComponent('공연')}&category=${encodeURIComponent(c)}&tab=list&lang=${lang}`)}
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
          </div>
        )}

        {/* 성수/홍대/강북/강남/제주 서브탭: 해당 지역에 실제 데이터가 있는 category만 동적 렌더링 */}
        {(PLACE_REGIONS as readonly string[]).includes(place.region || '') && (
          <div className="flex items-center gap-2 mb-1 pl-1 mt-2">
            <span className="text-[10px] text-zinc-300 font-bold">›</span>
            {availableCategories.map((c) => (
              <button
                key={c}
                onClick={() => router.push(`/?region=${encodeURIComponent(place.region!)}&category=${encodeURIComponent(c)}&tab=list&lang=${lang}`)}
                className={cn(
                  "text-xs font-bold transition-all px-2 py-0.5 rounded-full border",
                  (place.category === 'class' ? 'class' : place.category === 'shopping' ? 'shopping' : place.category === '전시' ? '전시' : place.category === '행사' ? '행사' : 'popup') === c
                    ? REGION_PILL_ACTIVE[place.region || '성수']
                    : "text-zinc-400 border-zinc-200 hover:border-zinc-400"
                )}
              >
                {lang === 'en' ? CATEGORY_LABEL[c].en : lang === 'zh' ? CATEGORY_LABEL[c].zh : lang === 'ja' ? CATEGORY_LABEL[c].ja : CATEGORY_LABEL[c].ko}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* 이전/다음 화살표는 프레임이 아니라 '본문 열'에 붙어야 한다 — 카드 레이아웃의 중앙 열은
          좌우 카드가 대칭이라 항상 화면 가운데 max-w-md 폭에 놓이므로, 여기도 max-w-md 유지.
          (프레임 폭 xl:max-w-6xl로 넓히면 화살표가 사이드카드 위로 올라간다) */}
      {suggestions.length > 0 && (
        <div className="fixed inset-0 max-w-md mx-auto z-30 pointer-events-none">
          <button
            onClick={() => goToSuggestion(-1)}
            aria-label={t.prevPlace}
            className="absolute left-2 top-[62%] -translate-y-1/2 pointer-events-auto w-11 h-11 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-zinc-100 flex items-center justify-center text-zinc-700 active:scale-95 transition-transform"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={() => goToSuggestion(1)}
            aria-label={t.nextPlace}
            className="absolute right-2 top-[62%] -translate-y-1/2 pointer-events-auto w-11 h-11 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-zinc-100 flex items-center justify-center text-zinc-700 active:scale-95 transition-transform"
          >
            <ChevronRight size={22} />
          </button>
        </div>
      )}

      <main>
      <SideCardLayout headerH={headerH} lang={lang}>
      {/* Hero Image */}
      <div className="relative h-[45vh] overflow-hidden bg-zinc-200">
        <img
          src={place.image_url || `https://picsum.photos/seed/seongsu-${place.id}/800/1200`}
          className="w-full h-full object-cover"
          alt={displayTitle}
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/seongsu-detail-${place.id}/800/1200`;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />

        {banner && (
          <a
            href={banner.url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-3 left-4 right-4 flex items-center gap-1.5 bg-black/40 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20 shadow-lg"
          >
            <Megaphone size={12} className="text-pace-400 flex-shrink-0" />
            <span className="text-[9px] font-black text-pace-400 uppercase tracking-widest flex-shrink-0">Notice</span>
            <span className="text-[11px] font-medium text-white truncate">{banner.text}</span>
          </a>
        )}

        {/* 무드 태그 — 2차 enrich에서 블로그 후기 + 대표 이미지를 근거로 생성(2026-09-02).
            공지 배너 바로 아래(배너 없으면 그 자리)에 얹고, 누르면 매거진의 '무드' 탭이
            해당 분위기로 열린다. 생성 전(null)이거나 근거 부족(빈 배열)이면 렌더 안 함. */}
        {place.mood_tags && place.mood_tags.length > 0 && (
          <div className={cn("absolute left-4 right-4 flex flex-wrap gap-1.5", banner ? "top-14" : "top-3")}>
            {place.mood_tags.map((tag) => (
              <Link
                key={tag}
                href={`/?mood=${encodeURIComponent(tag)}&lang=${lang}`}
                className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-white border border-white/20 shadow-lg no-underline active:scale-95 transition-transform"
              >
                {tag}
              </Link>
            ))}
          </div>
        )}

        <div className="absolute bottom-10 left-8 right-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-2">
              <span className="text-[10px] font-bold text-pace-400 uppercase tracking-widest">
                {t.spotlight}
              </span>
              {place.hot_rank && (
                <span className="flex items-center gap-1 text-[9px] font-black text-rose-300 bg-rose-500/20 border border-rose-400/30 rounded-full px-2 py-0.5">
                  <Flame size={9} fill="currentColor" />
                  {t.hotVerified} TOP {place.hot_rank}
                  {place.hot_rank_updated_at && (
                    <span className="text-rose-300/70 font-medium">
                      · {new Date(place.hot_rank_updated_at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })} {t.updatedAt}
                    </span>
                  )}
                </span>
              )}
              {isClosingSoon && (
                <span className="flex items-center gap-1 text-[9px] font-black text-amber-300 bg-amber-500/20 border border-amber-400/30 rounded-full px-2 py-0.5">
                  <Clock size={9} />
                  {t.closingSoon} D-{daysUntilClose}
                </span>
              )}
              {isNew && (
                <span className="flex items-center gap-1 text-[9px] font-black text-sky-300 bg-sky-500/20 border border-sky-400/30 rounded-full px-2 py-0.5">
                  <Sparkles size={9} />
                  {t.new}
                </span>
              )}
            </div>
            <div className="flex items-end justify-between gap-3">
              <h1 className="flex-1 text-3xl font-black text-white tracking-tighter leading-tight">{displayTitle}</h1>
              <div className="flex items-center gap-1.5 flex-shrink-0 mb-1">
                <a
                  href="https://nemoneai.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="네모네AIM (맛매치)"
                  className="w-9 h-9 rounded-full overflow-hidden border border-white/40 shadow-lg active:scale-95 transition-transform"
                >
                  <img src="/matmatch-icon.png" alt="네모네AIM" className="w-full h-full object-cover" />
                </a>
                <button
                  onClick={toggleLike}
                  aria-label={lang === 'en' ? 'Save' : lang === 'zh' ? '收藏' : lang === 'ja' ? '保存' : '찜하기'}
                  className="w-9 h-9 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 shadow-lg active:scale-95 transition-transform"
                >
                  <Heart size={16} className={liked ? 'fill-rose-500 text-rose-500' : ''} />
                </button>
                <button
                  onClick={handleShare}
                  aria-label={lang === 'en' ? 'Share' : lang === 'zh' ? '分享' : lang === 'ja' ? '共有' : '공유하기'}
                  className="w-9 h-9 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/40 shadow-lg active:scale-95 transition-transform"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-10 pb-28 space-y-10 -mt-6 bg-zinc-50 rounded-t-[40px] relative z-10 shadow-2xl">
        <div className="flex gap-4">
          <div className="flex-1 bg-white p-5 rounded-3xl border border-zinc-100 shadow-sm">
            <div className="w-10 h-10 bg-pace-50 rounded-xl flex items-center justify-center text-pace-600 mb-3">
              <Calendar size={20} />
            </div>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              {t.duration}
            </p>
            <p className="text-xs font-bold text-zinc-900">{displayDateRange || t.openDaily}</p>
          </div>
          <div className={cn(
            "flex-1 p-5 rounded-3xl border shadow-sm",
            isEnded ? "bg-zinc-900 border-zinc-900" : "bg-white border-zinc-100"
          )}>
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
              isEnded ? "bg-white/10 text-white" : isUpcoming ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
            )}>
              <Clock size={20} />
            </div>
            <p className={cn(
              "text-[10px] font-bold uppercase tracking-widest mb-1",
              isEnded ? "text-white/50" : "text-zinc-400"
            )}>
              {t.status}
            </p>
            <p className={cn("text-xs font-bold", isEnded ? "text-white" : isUpcoming ? "text-amber-600" : "text-zinc-900")}>
              {isEnded ? t.ended : isUpcoming ? t.upcoming : t.active}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {(() => {
            const LABEL_RE = /^(기간|출연|러닝타임|관람연령|티켓가격|공연시간|기획|장소|주최|문의):\s*(.+)$/;
            const lines = displayContent.replace(/\|/g, '\n').split('\n').map(l => l.trim()).filter(l => l.length > 0);
            const sourceLine = lines.find(l => l.includes('출처'));
            const infoLines = lines.filter(l => LABEL_RE.test(l));
            const textLines = lines.filter(l => !LABEL_RE.test(l) && !l.includes('출처'));
            // 상세 정보 박스 색 — 지역 대표색(REGION_ACCENT 등과 동일 팔레트)에 맞추고, 지역이
            // 없는 경우(제주 이벤트 등 region 미표기)엔 브랜드 기본색(pace)으로 폴백(2026-09-06).
            const pickBoxClass = (place.region && PACE_PICK_BOX[place.region]) || 'bg-pace-50 border-pace-100';
            const pickTextClass = (place.region && PACE_PICK_TEXT[place.region]) || 'text-pace-600';

            return (
              <>
                <div className={cn("rounded-3xl border p-5", pickBoxClass)}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest", pickTextClass)}>
                      {isApiOnlyContent ? t.details : <><Sparkles size={13} /> {t.pacePick}</>}
                    </span>
                    {place.category_tag && CATEGORY_TAG_ICON[place.category_tag] && (
                      <Link
                        href={`/?category_tag=${encodeURIComponent(place.category_tag)}&lang=${lang}`}
                        className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/70 text-zinc-600 no-underline active:scale-95 transition-transform"
                      >
                        <span aria-hidden>{CATEGORY_TAG_ICON[place.category_tag]}</span>
                        {place.category_tag}
                      </Link>
                    )}
                  </div>
                  {!isApiOnlyContent && (
                    <h2 className="text-base font-bold text-zinc-900 tracking-tight mb-2">
                      {t.pacePickHeadline}
                    </h2>
                  )}
                  {textLines.length > 0 && (
                    <div className="text-zinc-600 leading-relaxed text-sm font-medium space-y-2">
                      {textLines.map((line, i) =>
                        line.match(/map\.naver\.com/) ? null :
                        line.match(/https?:\/\/\S+/) ? (
                          <p key={i}>
                            <a href={line.match(/https?:\/\/\S+/)![0]} target="_blank" rel="noopener noreferrer" className="text-pace-600 underline font-bold">
                              바로가기: 링크 열기
                            </a>
                          </p>
                        ) : line.length > 60 ? (
                          // 축제 등 외부 API에서 온 긴 설명은 줄바꿈 없이 한 문단으로 뭉쳐 있어 가독성이 떨어져
                          // 문장 단위(마침표/느낌표/물음표 뒤 공백)로 나눠 각각 별도 문단으로 표시
                          line.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0).map((sentence, j) => (
                            <p key={`${i}-${j}`}>{sentence.trim()}</p>
                          ))
                        ) : (
                          <p key={i}>{line}</p>
                        )
                      )}
                    </div>
                  )}
                </div>

                {infoLines.length > 0 && (
                  <ul className="bg-white border border-zinc-100 rounded-2xl p-4 space-y-2.5">
                    {infoLines.map((line, i) => {
                      const m = line.match(LABEL_RE)!;
                      return (
                        <li key={i} className="flex gap-2 text-sm leading-snug">
                          <span className="text-pace-500 font-black flex-shrink-0">•</span>
                          <span>
                            <span className="font-bold text-zinc-800">{m[1]}</span>
                            <span className="text-zinc-500"> {m[2]}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {sourceLine && (
                  <p className="text-[11px] text-zinc-400 text-right">{sourceLine}</p>
                )}
              </>
            );
          })()}

          {place.link_url && (
            <a
              href={place.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-pace-50 border border-pace-100 rounded-2xl px-4 py-3 no-underline hover:bg-pace-100/70 transition-colors"
            >
              <Globe size={15} className="text-pace-600 flex-shrink-0" />
              <span className="text-sm font-bold text-pace-800 truncate">
                {place.link_title || (isPerformanceRegion ? '예매하기' : '공식 페이지')}
              </span>
              <span className="text-sm font-bold text-pace-600 flex-shrink-0">: 바로가기</span>
              <ChevronRight size={14} className="ml-auto text-pace-400 flex-shrink-0" />
            </a>
          )}

          {Array.isArray(place.blog_reviews) && place.blog_reviews.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">블로그 후기</p>
              <div className="flex flex-col gap-2">
                {(place.blog_reviews as BlogReview[]).map((r, i) => (
                  <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl p-3 shadow-sm hover:border-pace-200 transition-all no-underline group">
                    <span className="text-xs font-black text-zinc-300 w-4 flex-shrink-0">{i + 1}</span>
                    <span className="text-xs font-bold text-zinc-700 group-hover:text-pace-600 flex-grow leading-snug line-clamp-2">{r.title}</span>
                    <span className="text-zinc-300 flex-shrink-0 group-hover:text-pace-500">›</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {hasValidNaverId && (
            <a
              href={`https://map.naver.com/p/entry/place/${place.naver_place_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <img
                src={place.image_url || `https://picsum.photos/seed/naver-${place.id}/200/200`}
                alt={displayTitle}
                className="w-20 h-20 object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/naver-${place.id}/200/200`; }}
              />
              <div className="flex items-center gap-2 flex-1 pr-4">
                <span className="text-base font-black text-[#03C75A]">N</span>
                <span className="text-sm font-bold text-zinc-800">네이버지도에서 보기</span>
                <span className="ml-auto text-zinc-300 text-lg">›</span>
              </div>
            </a>
          )}

          {kakaoPlaceId && (
            <a
              href={`https://place.map.kakao.com/${kakaoPlaceId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <img
                src={place.image_url || `https://picsum.photos/seed/kakao-${place.id}/200/200`}
                alt={displayTitle}
                className="w-20 h-20 object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
                onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/kakao-${place.id}/200/200`; }}
              />
              <div className="flex items-center gap-2 flex-1 pr-4">
                <span className="text-base font-black text-[#FEE500] [text-shadow:0_0_1px_#3c1e1e]">K</span>
                <span className="text-sm font-bold text-zinc-800">카카오맵에서 보기</span>
                <span className="ml-auto text-zinc-300 text-lg">›</span>
              </div>
            </a>
          )}

          {hasValidNaverId && (
            <p className="text-[10px] text-zinc-400 text-center leading-relaxed">
              {lang === 'en'
                ? 'This content is AI-generated from public information and may differ from actual facts.'
                : lang === 'zh'
                  ? '本内容由AI根据公开信息生成，可能与实际情况有所出入。'
                  : lang === 'ja'
                    ? '公開情報をもとにAIが生成した内容のため、実際の事実と異なる場合があります。'
                    : 'AI로 분석하여 생성되어 실제 사실과 다를 수 있습니다.'}
            </p>
          )}

        </div>

        <InArticleAd />

        {/* "추천! 인기코스"(랜덤 코스/테마 홍보)를 "이 지역 인기장소"로 교체(2026-09-07) — 페이지
            내 활동성 강화 목적. 무작위 추천(suggestions)과 달리 실제 인기 랭킹(/places/popular)
            상위 3곳을 썸네일 카드로 보여주고, 전체보기는 이미 있는 지역 랭킹 허브 링크(아래
            REGION_HUB_SLUG 링크)와 동일한 목적지로 보내 랭킹 쪽 유입을 늘린다. */}
        {regionTop3.length > 0 && REGION_HUB_SLUG[place.region || ''] && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                <TrendingUp size={14} className="text-pace-500" />
                {t.regionPopular}
              </p>
              <Link
                href={`${LANG_PATH_PREFIX[lang] || ''}/ranking/place/${REGION_HUB_SLUG[place.region || '']}`}
                className="text-[11px] font-bold text-pace-600 hover:text-pace-700 flex items-center gap-0.5 flex-shrink-0"
              >
                {t.regionPopularSeeAll} <ChevronRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {regionTop3.map((p, idx) => {
                const pTitle = (lang === 'en' && p.title_en) ? p.title_en
                  : (lang === 'zh' && p.title_zh) ? p.title_zh
                  : (lang === 'ja' && p.title_ja) ? p.title_ja
                  : p.title;
                return (
                  <Link
                    key={p.id}
                    href={`/posts/${p.id}?region=${encodeURIComponent(p.region || place.region || '')}&lang=${lang}`}
                    className="group block"
                  >
                    <div className="relative aspect-square rounded-2xl overflow-hidden bg-zinc-100">
                      <img
                        src={p.image_url}
                        alt={pTitle}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-zinc-900/80 text-white text-[10px] font-black flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-zinc-800 mt-2 line-clamp-2 leading-snug">{pTitle}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest">
              {t.moreToExplore}
            </p>
            <div className="flex flex-col gap-3">
              {suggestions.slice(0, 3).map((s) => (
                <button
                  key={s.id}
                  onClick={() => router.push(`/posts/${s.id}?${new URLSearchParams({ ...(s.region ? { region: s.region } : {}), lang }).toString()}`)}
                  className="flex items-center gap-4 bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm text-left hover:shadow-md transition-shadow"
                >
                  <img
                    src={s.image_url}
                    alt={s.title}
                    className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://picsum.photos/seed/sug-${s.id}/200/200`; }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{s.title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{s.location}</p>
                    {s.category !== 'class' && (s.date_range || s.end_date) && (
                      <p className="text-xs text-pace-600 font-bold mt-1">
                        {s.date_range || `~ ${s.end_date}`}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {(() => {
          const coupang = getCoupangLink(place.region, place.category);
          return (
            <div className="space-y-1.5">
              <a
                href={coupang.url}
                target="_blank"
                rel="noopener noreferrer nofollow sponsored"
                className="flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-zinc-50 border border-zinc-100 text-sm font-bold text-zinc-700 no-underline hover:border-pace-300 hover:text-pace-600 transition-colors"
              >
                <span>
                  <span className="text-zinc-400 font-normal">관련상품추천 : </span>
                  {coupang.label} 보러가기
                </span>
                <span aria-hidden>→</span>
              </a>
              <p className="text-[10px] text-zinc-400 px-1">
                이 링크는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
              </p>
            </div>
          );
        })()}

        <div className="space-y-4">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            {t.location}
          </h2>
          <div className="flex items-center gap-2 text-sm text-pace-600 font-bold bg-pace-50 p-4 rounded-2xl border border-pace-100">
            <MapPin size={18} />
            {place.location}
          </div>
          {place.latitude && place.longitude && place.latitude !== 0 ? (
            <div className="w-full h-48 bg-zinc-200 rounded-3xl overflow-hidden border-4 border-white shadow-lg">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${place.latitude},${place.longitude}&z=16&output=embed`}
                allowFullScreen
              />
            </div>
          ) : place.location && place.location !== '확인 필요' && place.location !== '전국' ? (
            <div className="w-full h-48 bg-zinc-200 rounded-3xl overflow-hidden border-4 border-white shadow-lg">
              <iframe
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(place.location)}&z=16&output=embed`}
                allowFullScreen
              />
            </div>
          ) : (
            <div className="w-full h-48 bg-zinc-100 rounded-3xl flex flex-col items-center justify-center text-zinc-400 border-2 border-dashed border-zinc-200">
              <MapPin size={24} className="mb-2 opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-widest">
                {t.locationSyncing}
              </p>
            </div>
          )}
        </div>

        {/* FAQ(AEO) — 위 faqJsonLd와 문구를 정확히 공유(같은 faqItems 배열에서 생성) */}
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
            {lang === 'en' ? 'FAQ' : lang === 'zh' ? '常见问题' : lang === 'ja' ? 'よくある質問' : '자주 묻는 질문'}
          </h2>
          <div className="space-y-3">
            {faqItems.map((item, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-zinc-100">
                <p className="text-sm font-bold text-zinc-900 mb-1.5">Q. {item.q}</p>
                <p className="text-sm text-zinc-600 leading-relaxed">A. {item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {place.video_url && (
          <div className="pt-4">
            <button className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-pace-600 transition-all shadow-xl">
              <Video size={20} /> {t.watchVideo}
            </button>
          </div>
        )}

        {/* 지역 랭킹 허브로의 내부링크 — /ranking/place/[slug] 클러스터가 사이트맵에만 있고
            실제 방문 페이지(홈/상세)에서 링크가 하나도 없어 구글이 색인을 안 잡던 문제를
            여기서 고침(2026-09-02). posts/[id]는 실제로 색인되는 페이지라 여기서 링크를
            걸어야 랭킹 허브 페이지들도 크롤/색인 신호를 받는다. */}
        {REGION_HUB_SLUG[place.region || ''] && (
          <Link
            href={`${LANG_PATH_PREFIX[lang] || ''}/ranking/place/${REGION_HUB_SLUG[place.region || '']}`}
            className="block text-center text-[12px] font-bold text-pace-600 hover:text-pace-700 py-2"
          >
            {REGION_HUB_LABEL[lang]?.(place.region || '') ?? REGION_HUB_LABEL.ko(place.region || '')}
          </Link>
        )}

        <footer className="mt-6 mb-10 pt-6 border-t border-zinc-100 space-y-4">
          <div className="flex flex-col items-center text-center gap-1">
            <span className="text-[11px] font-black text-zinc-700 tracking-[0.2em] uppercase">
              {t.nowHere}
            </span>
            <span className="text-[10px] font-bold text-zinc-500 tracking-wide">
              {t.tagline}
            </span>
            <span className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase mt-1">
              © NEMONE INC. ALL RIGHTS RESERVED.
            </span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            {[
              { name: 'ABOUT', href: 'https://home.nemoneai.com' },
              { name: 'INSTAGRAM', href: 'https://www.instagram.com/nemone_pace/' },
              { name: '네모네AIM', href: 'https://nemoneai.com' },
              { name: 'FEEDBACK', href: `/feedback?lang=${lang}` },
            ].map((item) => (
              <a
                key={item.name}
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="text-[9px] font-black text-zinc-500 hover:text-pace-600 tracking-[0.25em] uppercase transition-colors"
              >
                {item.name}
              </a>
            ))}
          </nav>
        </footer>
      </div>
      </SideCardLayout>
      </main>

      <BottomNav region={place.region || '성수'} lang={lang} isPerformanceRegion={isPerformanceRegion} wide />
      <PwaInstallBanner show={showPwaNudge} dismissKey="pace_pwa_likes3" />
    </div>
  );
}
