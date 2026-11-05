'use client';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// 상단 우측: 언어 선택 + 로그인(또는 프로필). 홈 헤더와 같은 동작을 쓴다.
// 언어는 홈에서 ?lang= 으로 바뀌므로 홈 주소로 보낸다.
const LANGS = ['ko', 'en', 'zh', 'ja'] as const;

export default function HeaderActions({ currentLang = 'ko' }: { currentLang?: string }) {
  const { user, signInWithGoogle } = useAuth();
  return (
    <div className="ml-auto flex items-center gap-3">
      <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 shadow-inner">
        {LANGS.map((l) => (
          <Link
            key={l}
            href={l === 'ko' ? '/' : `/?lang=${l}`}
            className={
              'px-2.5 py-1 text-[11px] font-black rounded-md whitespace-nowrap ' +
              (currentLang === l ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400')
            }
          >
            {l.toUpperCase()}
          </Link>
        ))}
      </div>
      {user ? (
        <Link href="/my" className="flex items-center gap-2 bg-zinc-100 pl-1 pr-3 py-1 rounded-full border border-zinc-200 hover:bg-white transition-all">
          <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-white shadow-sm bg-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=random`}
              className="w-full h-full object-cover"
              alt="profile"
              referrerPolicy="no-referrer"
            />
          </div>
        </Link>
      ) : (
        <button onClick={() => signInWithGoogle()} className="p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
          <Users size={20} />
        </button>
      )}
    </div>
  );
}
