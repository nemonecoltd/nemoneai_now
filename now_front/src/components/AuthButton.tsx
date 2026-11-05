'use client';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

// 상단 우측 로그인 버튼 / 로그인 후 프로필 아바타 (홈과 같은 동작)
export default function AuthButton() {
  const { user, signInWithGoogle } = useAuth();
  if (user) {
    return (
      <Link href="/my" className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm bg-zinc-200">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || user.email || 'U')}&background=random`}
          className="w-full h-full object-cover"
          alt="profile"
          referrerPolicy="no-referrer"
        />
      </Link>
    );
  }
  return (
    <button onClick={() => signInWithGoogle()} className="flex-shrink-0 p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 transition-colors" aria-label="로그인">
      <Users size={18} />
    </button>
  );
}
