"use client";

import Script from 'next/script';

export default function NaverAnalytics() {
  return (
    <Script
      src="//wcs.pstatic.net/wcslog.js"
      strategy="afterInteractive"
      onLoad={() => {
        const w = window as any;
        if (!w.wcs_add) w.wcs_add = {};
        w.wcs_add["wa"] = "1ab17935ca8ab30";
        if (w.wcs) w.wcs_do();
      }}
    />
  );
}
