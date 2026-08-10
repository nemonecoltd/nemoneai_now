'use client';

import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import { usePwaInstall } from '@/lib/usePwaInstall';

// 코스 저장 완료 / 찜 3개 이상처럼 "이미 관심을 보인" 시점에서만 부모가 show=true로 넘겨준다.
// 강제 팝업 대신 하단 배너로만, 세션당(dismissKey 기준) 1회만 노출.
export default function PwaInstallBanner({ show, dismissKey }: { show: boolean; dismissKey: string }) {
  const { installable, installed, isIOS, promptInstall } = usePwaInstall();
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
    if (show && !seen && !installed && (installable || isIOS)) {
      setVisible(true);
    }
  }, [show, seen, installed, installable, isIOS]);

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(dismissKey, '1');
    } catch {}
  };

  const handleInstall = async () => {
    await promptInstall();
    dismiss();
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md bg-zinc-900 text-white rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        {isIOS ? (
          <p className="text-xs font-bold leading-snug">
            Safari 하단 공유 버튼 → &ldquo;홈 화면에 추가&rdquo;로 PACE를 더 빠르게 열어보세요
          </p>
        ) : (
          <p className="text-xs font-bold leading-snug">홈 화면에 PACE를 추가하고 더 빠르게 이용해보세요</p>
        )}
      </div>
      {!isIOS && (
        <button
          onClick={handleInstall}
          className="flex-shrink-0 flex items-center gap-1 bg-pace-500 text-white text-[11px] font-black px-3 py-1.5 rounded-full"
        >
          <Download size={12} /> 추가
        </button>
      )}
      <button onClick={dismiss} className="flex-shrink-0 text-zinc-400 hover:text-white" aria-label="닫기">
        <X size={16} />
      </button>
    </div>
  );
}
