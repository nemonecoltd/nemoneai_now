// PWA 설치 유도 — beforeinstallprompt는 페이지 어디서든 딱 한 번 발생하고, 나중에 다시
// 요청할 방법이 없어서 모듈 전역(싱글턴)에 캡처해둔다. 실제 배너를 어느 화면에서 보여줄지는
// 각 페이지가 usePwaInstall() 훅으로 구독해서 알아서 결정.
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const INSTALLED_KEY = 'pace_pwa_installed';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let captured = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function initPwaInstallCapture() {
  if (typeof window === 'undefined' || captured) return;
  captured = true;

  try {
    if (localStorage.getItem(INSTALLED_KEY) === '1') installed = true;
    if (window.matchMedia('(display-mode: standalone)').matches) installed = true;
  } catch {}

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    try { localStorage.setItem(INSTALLED_KEY, '1'); } catch {}
    notify();
  });
}

export function isPwaInstallable() {
  return !!deferredPrompt && !installed;
}

export function isPwaInstalled() {
  return installed;
}

export function isIOSSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

export async function promptPwaInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  notify();
  return choice.outcome === 'accepted';
}

export function subscribePwaInstall(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
