"use client";

import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const LANGS = ['ko', 'en', 'zh', 'ja'] as const;
const MY_LABEL: Record<string, string> = { ko: '마이', en: 'My', zh: '我的', ja: 'マイ' };

export default function HeaderControls() {
  const { user, signInWithGoogle } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lang = searchParams.get('lang') || 'ko';

  const setLang = (l: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('lang', l);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex bg-zinc-100 p-0.5 rounded-lg border border-zinc-200 mr-1 shadow-inner">
        {LANGS.map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`px-2.5 py-1 text-[11px] font-black rounded-md transition-all whitespace-nowrap ${
              lang === l ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-400"
            }`}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>

      {user ? (
        <Link href="/my" className="flex items-center gap-2 bg-zinc-100 pl-1 pr-3 py-1 rounded-full border border-zinc-200 hover:bg-white transition-all">
          <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-white shadow-sm bg-zinc-200">
            <img
              src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=random`}
              className="w-full h-full object-cover"
              alt="profile"
            />
          </div>
          <span className="text-[10px] font-black tracking-tight text-zinc-900 uppercase">{MY_LABEL[lang] || MY_LABEL.ko}</span>
        </Link>
      ) : (
        <button onClick={() => signInWithGoogle()} className="p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors">
          <Users size={20} />
        </button>
      )}
    </div>
  );
}
