// Web Push 구독 관리 — 로그인 여부와 무관하게 브라우저 단위(endpoint)로만 구독하는 익명 구독.
// PII를 서버에 보내지 않는다(now_back의 push_subscriptions 테이블도 user_id 컬럼이 없음).

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  return navigator.serviceWorker.register('/sw.js');
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  const reg = await getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function subscribeToPush(regionPref?: string | null): Promise<boolean> {
  const reg = await getRegistration();
  if (!reg) return false;

  try {
    const keyRes = await fetch('/api-now/push/vapid-public-key');
    const { publicKey } = await keyRes.json();
    if (!publicKey) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = sub.toJSON();
    const res = await fetch('/api-now/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        region_pref: regionPref || null,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error('push subscribe failed', e);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const sub = await getCurrentSubscription();
    if (!sub) return true;

    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch('/api-now/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
    return true;
  } catch (e) {
    console.error('push unsubscribe failed', e);
    return false;
  }
}
