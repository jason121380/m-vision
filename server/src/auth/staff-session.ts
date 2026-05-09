import { randomBytes } from 'node:crypto';
import { read, update } from '../store/storage.ts';
import type { StaffSessionRow } from '../store/types.ts';

export const STAFF_SESSION_COOKIE = 'mv_staff_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天

function newToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createStaffSession(photographerKey: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await update((d) => {
    if (!Array.isArray(d.staffSessions)) d.staffSessions = [];
    d.staffSessions = d.staffSessions.filter((s) => s.expiresAt > Date.now());
    d.staffSessions.push({ token, photographerKey, expiresAt: expiresAt.getTime() });
  });
  return { token, expiresAt };
}

export async function findStaffSession(token: string): Promise<StaffSessionRow | null> {
  if (!token) return null;
  const data = await read();
  if (!Array.isArray(data.staffSessions)) return null;
  const row = data.staffSessions.find((s) => s.token === token);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    await update((d) => {
      d.staffSessions = (d.staffSessions ?? []).filter((s) => s.token !== token);
    });
    return null;
  }
  return row;
}

export async function destroyStaffSession(token: string): Promise<void> {
  if (!token) return;
  await update((d) => {
    if (Array.isArray(d.staffSessions)) {
      d.staffSessions = d.staffSessions.filter((s) => s.token !== token);
    }
  });
}
