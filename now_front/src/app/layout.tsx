import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Provider from "./Provider";
import Script from "next/script";
import NaverAnalytics from "@/components/NaverAnalytics";

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
  alternates: {
    canonical: 'https://now.nemoneai.com',
    languages: {
      'ko': 'https://now.nemoneai.com',
      'en': 'https://now.nemoneai.com',
    },
  },
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
  verification: {
    google: 'eHAc5WBdeiR9-l5T2HvCw1v4XTdjKghnA3JCCSz-YAk',
    other: {
      'naver-site-verification': 'ca36f2387b65666b52d99f160ee37bbb17b38f8a',
    },
  },
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
    <html lang="ko" className={`${inter.variable} ${spaceGrotesk.variable}`}>
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
            gtag('config', 'G-7R6YCXT6RK');
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
      </body>
    </html>
  );
}
