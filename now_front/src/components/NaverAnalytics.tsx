"use client";

import Script from 'next/script';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const NAVER_WA_ID = "1ab17935ca8ab30";

function fireWcs() {
  const w = window as any;
  if (!w.wcs_add) w.wcs_add = {};
  w.wcs_add["wa"] = NAVER_WA_ID;
  if (w.wcs) w.wcs_do();
}

export default function NaverAnalytics() {
  const pathname = usePathname();
  const isFirstRun = useRef(true);

  useEffect(() => {
    // 최초 로드는 아래 Script의 onLoad가 이미 기록 — 여기서는 이후 경로 변경(SPA 내비게이션)만 재기록
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    fireWcs();
  }, [pathname]);

  return (
    <Script
      src="//wcs.pstatic.net/wcslog.js"
      strategy="afterInteractive"
      onLoad={fireWcs}
    />
  );
}
