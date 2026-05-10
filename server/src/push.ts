import webpush from 'web-push';
import { read, update } from './store/storage.ts';
import type { PushSubscriptionRow, VapidKeys } from './store/types.ts';

/*
 * Web Push 包一層：
 * - 第一次啟動 / data.json 沒 vapid → 自動產一組存進去
 * - sendPush 失敗回 410 / 404 視為訂閱失效，順便把 row 從 data.json 清掉
 * - 觸發點：客人下單 / 公告更新 / 預約檔期新增主攝 → 對應角色廣播
 *
 * 自託管，沒有第三方推播服務。
 */

let vapidReady = false;

async function ensureVapid(): Promise<VapidKeys> {
  const data = await read();
  if (data.vapid?.publicKey && data.vapid?.privateKey) {
    if (!vapidReady) {
      webpush.setVapidDetails(
        data.vapid.subject || 'mailto:admin@example.com',
        data.vapid.publicKey,
        data.vapid.privateKey,
      );
      vapidReady = true;
    }
    return data.vapid;
  }
  const generated = webpush.generateVAPIDKeys();
  const keys: VapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  };
  await update((d) => {
    d.vapid = keys;
  });
  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);
  vapidReady = true;
  console.log('[push] generated VAPID keys (saved to data.json)');
  return keys;
}

export async function getVapidPublicKey(): Promise<string> {
  const k = await ensureVapid();
  return k.publicKey;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

async function sendOne(sub: PushSubscriptionRow, payload: PushPayload): Promise<void> {
  await ensureVapid();
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: sub.keys },
      JSON.stringify(payload),
    );
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      // 訂閱已失效（使用者卸載 PWA / 撤銷權限），清掉
      await update((d) => {
        if (Array.isArray(d.pushSubscriptions)) {
          d.pushSubscriptions = d.pushSubscriptions.filter((s) => s.endpoint !== sub.endpoint);
        }
      });
      console.info('[push] dropped expired subscription', sub.endpoint.slice(0, 50));
    } else {
      console.warn('[push] send failed', status, err instanceof Error ? err.message : err);
    }
  }
}

export async function pushToAdmins(payload: PushPayload): Promise<void> {
  const data = await read();
  const subs = (data.pushSubscriptions ?? []).filter((s) => s.type === 'admin');
  if (subs.length === 0) return;
  await Promise.allSettled(subs.map((s) => sendOne(s, payload)));
}

export async function pushToStaff(staffKey: string, payload: PushPayload): Promise<void> {
  if (!staffKey) return;
  const data = await read();
  const subs = (data.pushSubscriptions ?? []).filter(
    (s) => s.type === 'staff' && s.staffKey === staffKey,
  );
  if (subs.length === 0) return;
  await Promise.allSettled(subs.map((s) => sendOne(s, payload)));
}

export async function pushToAllStaff(payload: PushPayload): Promise<void> {
  const data = await read();
  const subs = (data.pushSubscriptions ?? []).filter((s) => s.type === 'staff');
  if (subs.length === 0) return;
  await Promise.allSettled(subs.map((s) => sendOne(s, payload)));
}
