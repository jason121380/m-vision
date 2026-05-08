import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db, schema } from '../db/index.ts';
import { createSession, destroySession, findSession, SESSION_COOKIE } from '../auth/session.ts';

export const authRoutes = new Hono();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload' }, 400);
  const { username, password } = parsed.data;

  const rows = await db
    .select()
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.username, username))
    .limit(1);
  const user = rows[0];
  if (!user) return c.json({ error: 'invalid credentials' }, 401);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return c.json({ error: 'invalid credentials' }, 401);

  const { token, expiresAt } = await createSession(user.id);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
  return c.json({ ok: true, user: { id: user.id, username: user.username } });
});

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE) ?? '';
  await destroySession(token);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const token = getCookie(c, SESSION_COOKIE) ?? '';
  const hit = await findSession(token);
  if (!hit) return c.json({ user: null }, 200);
  return c.json({ user: { id: hit.user.id, username: hit.user.username } });
});
