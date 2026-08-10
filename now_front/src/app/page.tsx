import type { Metadata } from 'next';
import HomeClient from './HomeClient';

const BACKEND = process.env.BACKEND_URL || 'http://127.0.0.1:8081';

// 홈은 자기참조 canonical만 명시(root layout에서 alternates를 제거해, 이게 없으면 canonical이
// 아예 안 붙음). 홈의 ?lang= 다국어는 root 경로+쿼리라 Next가 hreflang URL에서 쿼리를 정규화로
// 떨궈 신호가 깨지고, 원래 홈(앱 셸)의 다국어 SEO 가치도 약함 — 실제 다국어 색인 무게는 상세페이지
// (posts/[id], hreflang 정상)와 전용 /en·/zh·/ja/ranking 페이지가 담당하므로 홈엔 hreflang 생략.
const BASE_URL = 'https://now.nemoneai.com';
export const metadata: Metadata = {
  alternates: { canonical: BASE_URL },
};

// 홈의 기본(핫플/종합) 랭킹 데이터를 서버에서 미리 fetch — 예전엔 이 페이지 전체가
// 'use client'라 크롤러가 받는 초기 HTML에 카드/링크가 하나도 없었음(2026-08-10 확인).
// 인터랙션(탭 전환/지역 필터 등)은 그대로 HomeClient(클라이언트 컴포넌트)에 넘기고,
// 여기서는 첫 렌더에 실제 콘텐츠가 보이도록 초기 데이터만 서버에서 채운다.
async function getInitialPlaces() {
  try {
    const res = await fetch(`${BACKEND}/places/popular`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const initialAllPlaces = await getInitialPlaces();
  return <HomeClient initialAllPlaces={initialAllPlaces} />;
}
