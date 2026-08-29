// 캐러셀 위젯(iframe)은 쿠팡 쪽 재고 회전에 따라 종종 삭제/품절 상품이 섞여
// "상품을 찾을 수 없습니다" 오류로 이어졌다. 그래서 직접 고른 이미지 + 고정 링크
// 방식으로 교체 — 안정성이 우선이라 위젯보다 신선도는 떨어지지만 깨질 일이 없다.
const BANNER_HREF = "https://link.coupang.com/a/gBDAauwGyG";
const BANNER_IMAGE = "/coupang/early-fall-sale.png";

export default function CoupangBanner() {
  return (
    <div className="rounded-3xl overflow-hidden border border-zinc-100 bg-white">
      <a href={BANNER_HREF} target="_blank" rel="noopener noreferrer nofollow sponsored" className="block relative">
        <span className="absolute top-2 right-3 z-10 text-[8px] font-bold tracking-wider text-white/80 bg-black/30 rounded px-1.5 py-0.5">
          Sponsored
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BANNER_IMAGE} alt="" className="w-full h-auto block" />
      </a>
      {/* 공정위 심사지침에 따른 필수 고지 문구 — 대표님이 지정한 문구 그대로 사용 */}
      <p className="text-[10px] text-zinc-400 px-4 py-2.5 leading-relaxed">
        이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
      </p>
    </div>
  );
}
