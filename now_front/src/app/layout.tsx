import type { Metadata } from "next";
import "./globals.css";
import Provider from "./Provider";
import Script from "next/script";
import NaverAnalytics from "@/components/NaverAnalytics";

export const metadata: Metadata = {
  metadataBase: new URL('https://now.nemoneai.com'),
  title: {
    default: "당신 3시간의 알찬 설계, 지금 여기 | 성수·홍대·강북·강남 팝업·공연·축제",
    template: "%s | 지금 여기"
  },
  description: "지금 바로 이 시간 성수·홍대·강북·강남 팝업, 서울 공연·전시, 제주 문화행사, 전국 축제 정보를 한 눈에! AI-driven real-time guide for Seoul pop-ups, performances, Jeju cultural events, and festivals nationwide.",
  alternates: {
    canonical: 'https://now.nemoneai.com',
    languages: {
      'ko': 'https://now.nemoneai.com',
      'en': 'https://now.nemoneai.com',
    },
  },
  openGraph: {
    title: '지금 여기 | 당신 3시간의 알찬 설계',
    description: 'Stop wasting time searching. AI-powered guide for Seoul pop-ups, performances, Jeju cultural events, and festivals nationwide.',
    url: 'https://now.nemoneai.com',
    images: ['/og-image.png'],
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: '지금 여기 | 당신 3시간의 알찬 설계',
    description: 'Stop wasting time searching. AI-powered guide for Seoul pop-ups, performances, Jeju cultural events, and festivals nationwide.',
    images: ['/og-image.png'],
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
  name: 'NOW HERE | 지금 여기',
  url: 'https://now.nemoneai.com',
  description: '지금 바로 이 시간 성수·홍대·강북·강남 팝업, 서울 공연·전시, 제주 문화행사, 전국 축제 정보를 한 눈에! AI-driven real-time guide for Seoul pop-ups, performances, Jeju cultural events, and festivals nationwide.',
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
    <html lang="ko">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
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
