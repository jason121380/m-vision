import { randomBytes } from 'node:crypto';
import { read, update } from '../store/storage.ts';
import type { SessionRow } from '../store/types.ts';

export const SESSION_COOKIE = 'mv_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天

/*
 * Sessions 存進 data.json，redeploy / 重啟後仍然有效。
 * 寫入跟其他資料一樣走 storage.update() 序列化，併發安全。
 * 每次 createSession 順便清掉過期的，避免無上限累積。
 */

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await update((d) => {
    if (!Array.isArray(d.sessions)) d.sessions = [];
    d.sessions = d.sessions.filter((s) => s.expiresAt > Date.now());
    d.sessions.push({ token, userId, expiresAt: expiresAt.getTime() });
  });
  return { token, expiresAt };
}

export async function findSession(token: string): Promise<SessionRow | null> {
  if (!token) return null;
  const data = await read();
  if (!Array.isArray(data.sessions)) return null;
  const row = data.sessions.find((s) => s.token === token);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await update((d) => {
      d.sessions = d.sessions.filter((s) => s.token !== token);
    });
    return null;
  }
  return row;
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await update((d) => {
    if (Array.isArray(d.sessions)) {
      d.sessions = d.sessions.filter((s) => s.token !== token);
    }
  });
}
