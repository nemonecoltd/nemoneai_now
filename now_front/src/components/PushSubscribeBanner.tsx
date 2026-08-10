'use client';

import { useEffect, useState } from 'react';
import { X, Bell } from 'lucide-react';
import { usePushSubscription } from '@/lib/usePushSubscription';

// 랭킹 스크롤 중간 지점처럼 "이미 관심을 보인" 시점에서만 부모가 show=true로 넘겨준다.
// 강제 팝업 대신 하단 배너로만, 세션당(dismissKey 기준) 1회만 노출.
export default function PushSubscribeBanner({
  show,
  dismissKey,
  regionPref,
}: {
  show: boolean;
  dismissKey: string;
  regionPref?: string | null;
}) {
  const { supported, subscribed, loading, subscribe } = usePushSubscription();
  const [seen, setSeen] = useState(true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setSeen(sessionStorage.getItem(dismissKey) === '1');
    } catch {
      setSeen(false);
    }
  }, [dismissKey]);

  useEffect(() => {
    if (show && !seen && supported && !subscribed) {
      setVisible(true);
    }
  }, [show, seen, supported, subscribed]);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(dismissKey, '1');
    } catch {}
  };

  const handleSubscribe = async () => {
    await subscribe(regionPref);
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-zinc-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold leading-snug">매주 목요일 랭킹 알림 받기</p>
      </div>
      <button
        onClick={handleSubscribe}
        disabled={loading}
        className="flex-shrink-0 flex items-center gap-1 bg-pace-500 text-white text-[11px] font-black px-3 py-1.5 rounded-full disabled:opacity-50"
      >
        <Bell size={12} /> 받기
      </button>
      <button onClick={dismiss} className="flex-shrink-0 text-zinc-400 hover:text-white" aria-label="닫기">
        <X size={16} />
      </button>
    </div>
  );
}
