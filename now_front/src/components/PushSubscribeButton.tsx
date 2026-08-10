'use client';

import { Bell } from 'lucide-react';
import { usePushSubscription } from '@/lib/usePushSubscription';

// 코스 발행 완료 화면 등에서 쓰는 보조 버튼 — 이미 구독 중이거나 미지원 브라우저면 아예 표시 안 함.
export default function PushSubscribeButton({ show, regionPref }: { show: boolean; regionPref?: string | null }) {
  const { supported, subscribed, loading, subscribe } = usePushSubscription();

  if (!show || !supported || subscribed) return null;

  return (
    <button
      onClick={() => subscribe(regionPref)}
      disabled={loading}
      className="w-full flex items-center justify-center gap-1.5 mt-3 px-6 py-3 bg-white border border-zinc-200 text-zinc-600 rounded-2xl font-bold text-sm hover:bg-zinc-50 transition-all disabled:opacity-50"
    >
      <Bell size={14} /> 새 코스 소식도 받아보기
    </button>
  );
}
