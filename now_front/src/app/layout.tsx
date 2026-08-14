import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Provider from "./Provider";
import Script from "next/script";
import NaverAnalytics from "@/components/NaverAnalytics";
import GaPageViewTracker from "@/components/GaPageViewTracker";
import { cn } from "@/lib/utils";


// next/font가 빌드 타임에 폰트를 자체 호스팅 — fonts.gstatic.com 외부 요청 자체가 없어져
// Googlebot 크롤링 시 외부 폰트 fetch 실패/타임아웃 리스크와 CLS를 함께 제거
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-space-grotesk", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL('https://now.nemoneai.com'),
  title: {
    default: "NEMONE PACE | 성수·홍대·강남·부산·제주 팝업·전시·공연·축제 추천",
    template: "%s | NEMONE PACE"
  },
  description: "지금 이 시간 성수·홍대·강북·강남·부산·제주 팝업·쇼핑·전시, 서울 공연, 전국 축제를 AI가 3시간 코스로 추천합니다",
  // alternates(canonical/languages)를 root layout에 두면 모든 하위 페이지에 기본값으로 cascade돼서
  // /privacy·/feedback·/signup 등이 전부 canonical=홈으로 나가 "홈의 중복본"으로 취급되던 버그가
  // 있었음(2026-08-10). canonical/hreflang은 각 페이지(page.tsx)에서 자기참조로 명시하도록 이동 —
  // 홈은 page.tsx, 상세는 posts/[id]/page.tsx, 랭킹은 각 랭킹 페이지가 담당.
  openGraph: {
    title: 'NEMONE PACE, 당신의 다음 3시간을 설계합니다',
    description: '지금 이 시간 성수·홍대·강북·강남·부산·제주 팝업·쇼핑·전시, 서울 공연, 전국 축제를 AI가 3시간 코스로 추천합니다',
    url: 'https://now.nemoneai.com',
    images: ['/og-image.jpg'],
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NEMONE PACE, 당신의 다음 3시간을 설계합니다',
    description: '지금 이 시간 성수·홍대·강북·강남·부산·제주 팝업·쇼핑·전시, 서울 공연, 전국 축제를 AI가 3시간 코스로 추천합니다',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: '/manifest.json',
  verification: {
    google: 'eHAc5WBdeiR9-l5T2HvCw1v4XTdjKghnA3JCCSz-YAk',
    other: {
      'naver-site-verification': 'ca36f2387b65666b52d99f160ee37bbb17b38f8a',
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#35577A',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'NEMONE PACE',
  url: 'https://now.nemoneai.com',
  description: '지금 이 시간 성수·홍대·강북·강남·부산·제주 팝업·쇼핑·전시, 서울 공연, 전국 축제를 AI가 3시간 코스로 추천합니다',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://now.nemoneai.com/?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={cn(inter.variable, spaceGrotesk.variable, "font-sans")}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/brand/pace-icon-solid.svg" type="image/svg+xml" />
        <link rel="icon" href="/brand/pace-icon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/brand/pace-icon-16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        {/* Google Analytics */}
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-7R6YCXT6RK"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            // send_page_view: false — 탭 전환/언어 토글/필터처럼 pathname은 그대로고 쿼리스트링만
            // 바뀌는 것까지 GA4가 자동으로 "새 페이지"로 잡아 조회수가 부풀려지던 문제(2026-08-15) —
            // 자동 발사는 끄고 GaPageViewTracker가 pathname 변경 시에만 수동으로 page_view를 쏜다.
            gtag('config', 'G-7R6YCXT6RK', { send_page_view: false });
          `}
        </Script>
        {/* Google AdSense */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4274957638983041"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <Provider>
          {children}
        </Provider>

        {/* Naver Analytics */}
        <NaverAnalytics />
        {/* GA4 page_view — 자동 발사 대신 pathname 변경 시에만 수동 발사(위 send_page_view: false 참고) */}
        <GaPageViewTracker />
      </body>
    </html>
  );
}
