const TAGLINE: Record<string, string> = {
  ko: '당신의 3시간을 알차게 설계합니다',
  en: 'Designing your next 3 hours, wisely',
  zh: '为您精心设计3小时',
};

export default function BrandTagline({ lang = 'ko' }: { lang?: string }) {
  return (
    <div className="border-t border-zinc-100 py-1.5 mt-1">
      <p className="text-[9px] font-black tracking-[0.25em] uppercase not-italic text-zinc-300 text-center">
        {TAGLINE[lang] || TAGLINE.ko}
      </p>
    </div>
  );
}
