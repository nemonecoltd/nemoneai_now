"use client";

import { useRouter } from 'next/navigation';
import ClosingSoonTicker from './ClosingSoonTicker';
import CrowdTicker from './CrowdTicker';

// 지역 랭킹 허브(/ranking/place/[slug])는 메인 앱(page.tsx)과 별개 라우트라, 유동인구 티커를 탭했을 때
// 메인의 지도 탭으로 실제 이동시키려면 여기서 라우터 네비게이션을 걸어줘야 함 — 메인에서는 탭 전환(상태
// 변경)이던 걸 여기서는 페이지 이동(router.push)으로 대체. 허브 페이지에 있는 콘텐츠와 함께 메인 앱으로
// 지속적으로 유도하기 위한 장치(2026-08-11, "메인처럼 뉴팝업/유동인구 넣어서 메인으로 유도" 요청).
export default function RegionHubTickers({ lang = 'ko' }: { lang?: string }) {
  const router = useRouter();
  return (
    <>
      <ClosingSoonTicker lang={lang} />
      <CrowdTicker lang={lang} onNavigateToMap={(region) => router.push(`/?tab=map&region=${encodeURIComponent(region)}`)} />
    </>
  );
}
