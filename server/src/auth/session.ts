import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.ts';

export const SESSION_COOKIE = 'mv_admin_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 天

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(schema.sessions).values({ id: token, userId, expiresAt });
  return { token, expiresAt };
}

export async function findSession(token: string) {
  if (!token) return null;
  const rows = await db
    .select({
      session: schema.sessions,
      user: schema.adminUsers,
    })
    .from(schema.sessions)
    .innerJoin(schema.adminUsers, eq(schema.sessions.userId, schema.adminUsers.id))
    .where(eq(schema.sessions.id, token))
    .limit(1);
  const hit = rows[0];
  if (!hit) return null;
  if (hit.session.expiresAt.getTime() < Date.now()) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
    return null;
  }
  return hit;
}

export async function destroySession(token: string): Promise<void> {
  if (!token) return;
  await db.delete(schema.sessions).where(eq(schema.sessions.id, token));
}
