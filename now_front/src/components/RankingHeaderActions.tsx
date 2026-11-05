import Link from 'next/link';
import AuthButton from '@/components/AuthButton';

// 랭킹 페이지 상단 우측 — 언어 스위처(현재 언어 강조) + 로그인 버튼. 지역 허브(regionPopularHub)와 같은 모양.
type Lang = 'ko' | 'en' | 'zh' | 'ja';
const PREFIX: Record<Lang, string> = { ko: '', en: '/en', zh: '/zh', ja: '/ja' };

export default function RankingHeaderActions({ lang, path }: { lang: Lang; path: string }) {
  return (
    <>
      <div className="flex-1" />
      <div className="flex bg-zinc-100 p-0.5 rounded-lg text-[10px] font-bold flex-shrink-0">
        {(['ko', 'en', 'zh', 'ja'] as Lang[]).map((l) => (
          <Link
            key={l}
            href={`${PREFIX[l]}${path}`}
            className={`px-2 py-1 rounded-md uppercase transition-colors ${l === lang ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'}`}
          >
            {l}
          </Link>
        ))}
      </div>
      <AuthButton />
    </>
  );
}
