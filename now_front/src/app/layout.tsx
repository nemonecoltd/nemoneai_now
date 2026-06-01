import type { Metadata } from "next";
import "./globals.css";
import Provider from "./Provider";
import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL('https://now.nemoneai.com'),
  title: {
    default: "지금 여기 | NOW HERE",
    template: "%s | NOW HERE"
  },
  description: "지금 바로 이 시간 성수와 홍대 팝업 및 공연을 한 눈에! AI-driven real-time guide for Seongsu and Hongdae's hottest pop-ups and hidden gems.",
  alternates: {
    canonical: 'https://now.nemoneai.com',
    languages: {
      'ko': 'https://now.nemoneai.com',
      'en': 'https://now.nemoneai.com',
    },
  },
  openGraph: {
    title: 'NOW HERE: Seongsu & Hongdae Live',
    description: 'Stop wasting time searching. Get your AI-powered local itinerary now.',
    url: 'https://now.nemoneai.com',
    images: ['/og-image.png'],
    type: 'website',
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NOW HERE: Seongsu & Hongdae Live',
    description: 'Stop wasting time searching. Get your AI-powered local itinerary now.',
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
  description: '지금 바로 이 시간 성수와 홍대 팝업 및 공연을 한 눈에! AI-driven real-time guide for Seongsu and Hongdae.',
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        {/* Google AdSense */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4274957638983041"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body>
        <Provider>
          {children}
        </Provider>

        {/* Naver Analytics */}
        <Script src="//wcs.pstatic.net/wcslog.js" strategy="afterInteractive" />
        <Script id="naver-analytics" strategy="afterInteractive">
          {`
            if(!wcs_add) var wcs_add = {};
            wcs_add["wa"] = "1944a0c151404f0";
            if(window.wcs) {
              wcs_do();
            }
          `}
        </Script>
      </body>
    </html>
  );
}
