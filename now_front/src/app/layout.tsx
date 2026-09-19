import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Provider from "./Provider";
import Script from "next/script";
import NaverAnalytics from "@/components/NaverAnalytics";
import { cn } from "@/lib/utils";


// next/font가 빌드 타임에 폰트를 자체 호스팅 — fonts.gstatic.com 외부 요청 자체가 없어져
// Googlebot 크롤링 시 외부 폰트 fetch 실패/타임아웃 리스크와 CLS를 함께 제거
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-space-grotesk", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL('https://now.nemoneai.com'),
  // "핫플" 위주로만 최적화돼 실제 검색량이 있는 "서울 팝업스토어"로는 유입이 안 되던
  // 문제(2026-09-05) — 홈 타이틀 앞머리에 그 검색어를 넣어서 해결했었는데, "서울 팝업스토어"로
  // 시작해놓고 바로 뒤에 서울이 아닌 부산·제주가 붙어 지리적으로 앞뒤가 안 맞는다는 지적(2026-09-06)
  // — 키워드는 유지하되 "서울·부산·제주"로 넓혀 모순을 없애고, 홈 개편에 맞춰 "핫플레이스"·"실시간"도 반영.
  // 브랜드명("nemone pace")을 검색해도 후보군에 안 잡히던 문제(2026-09-19, Organization
  // 스키마 신설로 대응) 후속 조치로, title에서도 브랜드가 맨 앞에 오도록 순서를 뒤집었다
  // (2026-09-20) — 뒤쪽 키워드는 그대로 유지해 8/5에 이미 한 번 겪은 "브랜드가 키워드를
  // 걷어내는" 회귀는 반복하지 않는다. template도 같은 방향으로 뒤집어 사이트 전체(랭킹·상세·
  // 코스 등 수천 페이지)의 title이 일관되게 "NEMONE PACE | ..."로 나가게 해 엔터티 신호를 강화.
  title: {
    default: "NEMONE PACE | 서울·부산·제주 팝업스토어 실시간 랭킹 | 지금 뜨는 핫플레이스",
    template: "NEMONE PACE | %s"
  },
  description: "지금 이 시간 서울 팝업스토어(성수·홍대·강북·강남)와 부산·제주 팝업·쇼핑·전시, 서울 공연, 전국 축제를 AI가 3시간 코스로 추천합니다",
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

// 브랜드명("nemone pace") 검색에 사이트가 전혀 안 잡히던 문제 대응(2026-09-19).
// 색인·robots·title·h1은 전부 정상인데도 네이버 검색 결과에 PACE가 후보로조차 오르지
// 못하고 "팝업" 연관 콘텐츠만 나오는 상태였음 — 검색엔진이 이 문자열을 하나의 실체
// (entity)로 묶을 근거가 코드에 아예 없었던 게 원인 중 하나. WebSite 스키마만 있고
// Organization 선언도, 외부 공식 자산과의 sameAs 연결도 없었다(plants엔 이미 있었음).
// 아래는 표준 entity 선언 방식: @id로 두 노드를 묶고, 한글 표기 변형을 alternateName으로
// 명시하고, 우리 소유가 확실한 외부 공식 자산(구글 플레이 앱 등재)을 sameAs로 연결한다.
const ORG_ID = 'https://now.nemoneai.com/#organization';

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': ORG_ID,
  name: 'NEMONE PACE',
  // 검색 사용자가 실제로 입력할 수 있는 표기 변형만 — 없는 별칭을 지어내지 않는다
  alternateName: ['네모네 페이스', '네모네페이스', 'nemone pace'],
  url: 'https://now.nemoneai.com',
  logo: 'https://now.nemoneai.com/brand/pace-icon-512.png',
  description: '지금 이 시간 성수·홍대·강북·강남·부산·제주 팝업·쇼핑·전시, 서울 공연, 전국 축제를 AI가 3시간 코스로 추천합니다',
  // 우리가 실제로 소유·운영하는 공식 자산만 연결(검증됨) — 브랜드 실체의 외부 근거가 된다
  sameAs: ['https://play.google.com/store/apps/details?id=com.nemoneai.now'],
  parentOrganization: {
    '@type': 'Organization',
    name: '네모네',
    url: 'https://nemoneai.com',
  },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': 'https://now.nemoneai.com/#website',
  name: 'NEMONE PACE',
  alternateName: ['네모네 페이스', '네모네페이스'],
  url: 'https://now.nemoneai.com',
  inLanguage: 'ko',
  description: '지금 이 시간 성수·홍대·강북·강남·부산·제주 팝업·쇼핑·전시, 서울 공연, 전국 축제를 AI가 3시간 코스로 추천합니다',
  publisher: { '@id': ORG_ID },
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
        {/* 자체 언어 전환(KO/EN/ZH/JA) 기능이 있는데, 번역 안 된 필드가 일부 섞여 있으면 크롬이
            자기 판단으로 "한국어 페이지로 변경되었습니다" 자동번역을 걸어버려 우리 언어 전환과
            충돌함(2026-08-15 사용자 리포트로 발견) — 브라우저 자동번역 제안 자체를 차단.
            SEO에는 영향 없음(hreflang과는 별개, 크롬의 사용자용 번역 UI만 막는 것). */}
        <meta name="google" content="notranslate" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/brand/pace-icon-solid.svg" type="image/svg+xml" />
        <link rel="icon" href="/brand/pace-icon-32.png" type="image/png" sizes="32x32" />
        <link rel="icon" href="/brand/pace-icon-16.png" type="image/png" sizes="16x16" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
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
