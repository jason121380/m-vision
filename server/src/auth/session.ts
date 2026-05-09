import { randomBytes } from 'node:crypto';

export const SESSION_COOKIE = 'mv_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天

type SessionRow = { token: string; userId: number; expiresAt: number };

// in-memory store；container 重啟 = 全部 session 失效需要重新登入。
// 個人後台使用量很小，這個取捨值得。
const sessions = new Map<string, SessionRow>();

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

export function createSession(userId: number): { token: string; expiresAt: Date } {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  sessions.set(token, { token, userId, expiresAt: expiresAt.getTime() });
  return { token, expiresAt };
}

export function findSession(token: string): SessionRow | null {
  if (!token) return null;
  const row = sessions.get(token);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return row;
}

export function destroySession(token: string): void {
  if (!token) return;
  sessions.delete(token);
}
