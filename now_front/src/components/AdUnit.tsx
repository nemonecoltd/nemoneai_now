"use client";

import { useEffect } from 'react';

interface AdUnitProps {
  slotId: string;
  layoutKey?: string;
  format?: string;
}

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function AdUnit({ slotId, layoutKey = "-f8+65+2h-ct+dn", format = "fluid" }: AdUnitProps) {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense rendering error:", e);
    }
  }, []);

  return (
    <div className="w-full bg-zinc-900/5 rounded-3xl border border-zinc-100 p-4 my-4 overflow-hidden relative">
      <span className="absolute top-2 right-4 text-[8px] font-black text-zinc-300 uppercase tracking-widest">Sponsored</span>

      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-format={format}
        data-ad-layout-key={layoutKey}
        data-ad-client="ca-pub-4274957638983041"
        data-ad-slot={slotId}
      />
    </div>
  );
}

export function InArticleAd() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  return (
    <div style={{ minHeight: '280px', width: '100%' }}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center' }}
        data-ad-layout="in-article"
        data-ad-format="fluid"
        data-ad-client="ca-pub-4274957638983041"
        data-ad-slot="7053776315"
      />
    </div>
  );
}
