const TAGLINE: Record<string, string> = {
  ko: '당신의 다음 3시간을 설계합니다',
  en: 'A fulfilling plan for your 3 hours',
  zh: '为您3小时的充实安排',
};

const BRAND: Record<string, string> = { ko: 'NEMONE PACE', en: 'NEMONE PACE', zh: 'NEMONE PACE' };

export default function SiteFooter({ lang = 'ko' }: { lang?: string }) {
  return (
    <footer className="mt-6 mb-10 pt-6 border-t border-zinc-100 space-y-4">
      <div className="flex flex-col items-center text-center gap-1">
        <span className="text-[11px] font-black text-zinc-700 tracking-[0.2em] uppercase">
          {BRAND[lang] || BRAND.ko}
        </span>
        <span className="text-[10px] font-bold text-zinc-500 tracking-wide">
          {TAGLINE[lang] || TAGLINE.ko}
        </span>
        <span className="text-[9px] font-bold text-zinc-400 tracking-widest uppercase mt-1">
          © NEMONE INC. ALL RIGHTS RESERVED.
        </span>
      </div>
      <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2">
        {[
          { name: 'ABOUT', href: 'https://home.nemoneai.com' },
          { name: 'YOUTUBE', href: 'https://www.youtube.com/@MatMatch' },
          { name: '네모네AIM', href: 'https://nemoneai.com' },
          { name: 'FEEDBACK', href: '/feedback' },
        ].map((item) => (
          <a
            key={item.name}
            href={item.href}
            target={item.href.startsWith('http') ? '_blank' : undefined}
            rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
            className="text-[9px] font-black text-zinc-500 hover:text-pace-600 tracking-[0.25em] uppercase transition-colors"
          >
            {item.name}
          </a>
        ))}
      </nav>
    </footer>
  );
}
