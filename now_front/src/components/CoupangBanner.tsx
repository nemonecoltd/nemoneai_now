"use client";

import { useEffect, useRef, useState } from "react";

// 쿠팡 파트너스 위젯(캐러셀)은 800x400 고정 픽셀 iframe이라, 폰 화면 폭(~330~400px)에
// 맞춰 CSS transform:scale로 축소해서 반응형으로 보여준다. 원본 크기 그대로 두면
// 좁은 화면에서 잘리거나 가로 스크롤이 생김.
const NATIVE_WIDTH = 800;
const NATIVE_HEIGHT = 400;
const WIDGET_SRC =
  "https://ads-partners.coupang.com/widgets.html?id=1023712&template=carousel&trackingCode=AF3913203&subId=&width=800&height=400&tsource=";

export default function CoupangBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setScale(containerRef.current.offsetWidth / NATIVE_WIDTH);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <div className="rounded-3xl overflow-hidden border border-zinc-100 bg-white">
      <div ref={containerRef} className="relative w-full overflow-hidden" style={{ height: NATIVE_HEIGHT * scale }}>
        <iframe
          src={WIDGET_SRC}
          width={NATIVE_WIDTH}
          height={NATIVE_HEIGHT}
          scrolling="no"
          referrerPolicy="unsafe-url"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            border: 0,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
      {/* 공정위 심사지침에 따른 필수 고지 문구 — 대표님이 지정한 문구 그대로 사용 */}
      <p className="text-[10px] text-zinc-400 px-4 py-2.5 leading-relaxed">
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  );
}
