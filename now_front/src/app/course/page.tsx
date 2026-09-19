import type { Metadata } from 'next';
import CourseHubClient from './CourseHubClient';

const BASE_URL = 'https://now.nemoneai.com/course';

type Lang = 'ko' | 'en' | 'zh' | 'ja';
function pickLang(lang?: string): Lang {
  return lang === 'en' || lang === 'zh' || lang === 'ja' ? lang : 'ko';
}

// title은 접미사(" | NEMONE PACE")를 붙이지 않는다 — root layout의 title.template이 이
// 세그먼트(course/page.tsx, root와 다른 자식 세그먼트)엔 적용돼 자동으로 붙기 때문에, 여기서
// 직접 붙이면 "... | NEMONE PACE | NEMONE PACE"로 중복된다(홈 page.tsx는 root와 동일 세그먼트라
// 템플릿이 적용 안 돼 그쪽만 직접 붙임 — 세그먼트별로 다르니 새 라우트 추가 시 주의).
const COURSE_TEXT: Record<Lang, { title: string; description: string }> = {
  ko: {
    title: '3시간 AI 추천 코스',
    description: '지역과 동행을 고르면 AI가 팝업·쇼핑·전시를 엮어 서울 3시간 코스를 자동으로 만들어드립니다',
  },
  en: {
    title: '3-Hour AI Course',
    description: 'Pick a region and who you’re with — AI builds a 3-hour Seoul course from pop-ups, shopping, and exhibitions',
  },
  zh: {
    title: 'AI 3小时路线推荐',
    description: '选择地区和同行人，AI 会自动串联快闪店、购物、展览，为你生成首尔3小时路线',
  },
  ja: {
    title: 'AI 3時間コース提案',
    description: 'エリアと同行者を選ぶと、AIがポップアップ・ショッピング・展示を組み合わせてソウル3時間コースを自動作成します',
  },
};

// 이 라우트가 전부 'use client'(CourseHubClient)라 generateMetadata를 못 내보내던 문제 —
// 홈(page.tsx)/상세(posts/[id])와 달리 여기만 lang별 title/description이 전혀 없이 root
// layout 기본값을 그대로 상속해, 네이버 서치어드바이저가 course?lang=ko/en/zh/ja 4개를
// 홈과까지 묶어 "동일한 description인 문서 다수"로 진단(2026-09-20, 진단 CSV로 확인).
// 홈(page.tsx)의 패턴을 그대로 따라 얇은 서버 컴포넌트로 감싸 generateMetadata만 분리.
interface Props {
  searchParams: Promise<{ lang?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { lang: langParam } = await searchParams;
  const lang = pickLang(langParam);
  return { ...COURSE_TEXT[lang], alternates: { canonical: BASE_URL } };
}

export default function CourseHubPage() {
  return <CourseHubClient />;
}
