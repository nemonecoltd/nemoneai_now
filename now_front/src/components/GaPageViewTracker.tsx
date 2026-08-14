"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// GA4 기본(Enhanced Measurement의 "브라우저 히스토리 이벤트 기반 페이지 변경")은 탭 전환·언어
// 토글·필터 변경처럼 pathname은 그대로고 쿼리스트링만 바뀌는 router.push까지 전부 "새 페이지"로
// 잡아서 조회수가 실제 방문보다 훨씬 부풀려졌음(2026-08-15, 방문자 대비 조회수 과다 신고로 발견).
// layout.tsx에서 gtag config에 send_page_view: false를 줘서 자동 발사를 끄고, 대신 pathname이
// 실제로 바뀔 때(=진짜 다른 페이지로 이동했을 때)만 여기서 수동으로 page_view를 쏜다.
function pushPageView(pathname: string) {
  const w = window as any;
  const payload = { page_path: pathname, page_location: window.location.href, page_title: document.title };
  if (typeof w.gtag === 'function') {
    w.gtag('event', 'page_view', payload);
  } else if (Array.isArray(w.dataLayer)) {
    w.dataLayer.push(['event', 'page_view', payload]);
  }
}

export default function GaPageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    pushPageView(pathname);
  }, [pathname]);

  return null;
}
