// Web Push 用戶端：註冊 SW、跟伺服器拿 VAPID public key、訂閱 / 取消訂閱
// admin 與 staff 用同一支 sw.js，靠不同的 subscribe endpoint 區分身分

import { apiFetch, apiUrl } from './api';

export type PushKind = 'admin' | 'staff';

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  typeof Notification !== 'undefined';

export type PushStatus = 'unsupported' | 'denied' | 'subscribed' | 'idle';

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return 'idle';
  const sub = await reg.pushManager.getSubscription();
  if (sub && Notification.permission === 'granted') return 'subscribed';
  return 'idle';
}

async function registerSW(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/sw.js');
  if (existing) {
    // 嘗試把後端有的新版 SW 拉下來，避免攝影師卡在舊版（iOS 會 cache 很久）
    existing.update().catch(() => undefined);
    return existing;
  }
  return navigator.serviceWorker.register('/sw.js');
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

export async function enablePush(
  kind: PushKind,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPushSupported()) return { ok: false, error: '此瀏覽器或環境不支援推播通知（iOS 需先加到主畫面）' };
  if (Notification.permission === 'denied') {
    return { ok: false, error: '通知權限已被封鎖，請到系統設定打開後再試' };
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, error: '需要允許通知權限' };

  const reg = await registerSW();
  await navigator.serviceWorker.ready;

  const keyRes = await apiFetch<{ publicKey: string }>('/api/push/vapid-public-key');
  if (!keyRes.ok) return { ok: false, error: `取不到伺服器金鑰：${keyRes.error}` };

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyRes.data.publicKey) as BufferSource,
      });
    } catch (err) {
      return { ok: false, error: `訂閱失敗：${err instanceof Error ? err.message : String(err)}` };
    }
  }

  const payload = {
    endpoint: sub.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(sub.getKey('p256dh')),
      auth: arrayBufferToBase64(sub.getKey('auth')),
    },
    userAgent: navigator.userAgent,
  };

  const url = kind === 'admin' ? '/api/admin/push/subscribe' : '/api/staff/push/subscribe';
  const res = await fetch(apiUrl(url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, error: `伺服器訂閱失敗（${res.status}）` };
  return { ok: true };
}

// 「靜默」嘗試自動開啟推播：已訂閱 / 被擋 / 不支援 → 直接放棄；
// 權限是 default 時會嘗試呼叫一次 requestPermission（瀏覽器會自己決定要不要彈窗）。
// 失敗都吞掉，不報錯，因為這條路是預設打開、不打擾使用者。
export async function tryAutoEnablePush(kind: PushKind): Promise<void> {
  try {
    if (!isPushSupported()) return;
    if (Notification.permission === 'denied') return;
    const status = await getPushStatus();
    if (status === 'subscribed') return;
    await enablePush(kind);
  } catch {
    /* ignore */
  }
}

// App 打開（focus / visibility 變回前景）時把紅點清掉。
// 同時告訴 SW 把 IndexedDB 的計數歸零。
export function clearBadge(): void {
  try {
    const nav = navigator as Navigator & {
      clearAppBadge?: () => Promise<void>;
    };
    nav.clearAppBadge?.().catch(() => {});
  } catch {
    /* ignore */
  }
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'clear-badge' });
  } catch {
    /* ignore */
  }
}

// 監聽 Service Worker 收到推播時 postMessage 過來的訊息（admin / booking 共用）。
// 回傳 cleanup function。
export type PushMessage = {
  type: 'push-notification';
  title: string;
  body: string;
  url: string;
  tag: string;
};
export function listenSwMessage(handler: (m: PushMessage) => void): () => void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return () => undefined;
  const onMessage = (event: MessageEvent) => {
    if (event.data && event.data.type === 'push-notification') {
      handler(event.data as PushMessage);
    }
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => {
    navigator.serviceWorker.removeEventListener('message', onMessage);
  };
}

// 在 useEffect 裡呼叫，回傳 cleanup function。
// 行為：立刻清一次紅點，並在 app 取得 focus / 變回前景時也清。
export function setupBadgeClearing(): () => void {
  if (typeof window === 'undefined') return () => undefined;
  clearBadge();
  const onVis = () => {
    if (!document.hidden) clearBadge();
  };
  window.addEventListener('focus', clearBadge);
  document.addEventListener('visibilitychange', onVis);
  return () => {
    window.removeEventListener('focus', clearBadge);
    document.removeEventListener('visibilitychange', onVis);
  };
}

// 主動把紅點數字打上去（讓使用者先驗證裝置支援；
// app 再次取得焦點時會自動被 clearBadge 清掉）
export async function setBadgeManual(n: number): Promise<{ ok: true } | { ok: false; reason: string }> {
  const nav = navigator as Navigator & {
    setAppBadge?: (n?: number) => Promise<void>;
  };
  if (!nav.setAppBadge) {
    return { ok: false, reason: '此裝置 / 瀏覽器不支援 App Badge API（需 iOS 16.4+ PWA、Android Chrome PWA、macOS Chrome 等）' };
  }
  try {
    await nav.setAppBadge(n);
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export const isBadgeSupported = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return 'setAppBadge' in navigator;
};

export async function disablePush(kind: PushKind): Promise<{ ok: true }> {
  if (!isPushSupported()) return { ok: true };
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  if (!reg) return { ok: true };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };

  const url = kind === 'admin' ? '/api/admin/push/unsubscribe' : '/api/staff/push/unsubscribe';
  await fetch(apiUrl(url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});

  await sub.unsubscribe().catch(() => {});
  return { ok: true };
}
