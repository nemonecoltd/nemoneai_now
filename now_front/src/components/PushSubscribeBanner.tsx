'use client';

import { useEffect, useState } from 'react';
import { X, Bell } from 'lucide-react';
import { usePushSubscription } from '@/lib/usePushSubscription';

// 랭킹 스크롤 중간 지점처럼 "이미 관심을 보인" 시점에서만 부모가 show=true로 넘겨준다.
// 강제 팝업 대신 하단 배너로만 노출. 닫기를 누르면 localStorage에 시각을 남겨 DISMISS_DURATION_MS
// 동안 재노출 안 함(원래 sessionStorage였는데, 탭/브라우저를 닫으면 바로 초기화돼 다음날 다시 뜨는
// 문제가 있었음 — 2026-08-11, "닫기=한동안 안 봄" 기대와 어긋나서 3개월로 변경).
const DISMISS_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 3개월

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
      const dismissedAt = parseInt(localStorage.getItem(dismissKey) || '0', 10);
      setSeen(Date.now() - dismissedAt < DISMISS_DURATION_MS);
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
      localStorage.setItem(dismissKey, String(Date.now()));
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
