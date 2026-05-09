import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { read } from '../store/storage.ts';
import {
  createSession,
  destroySession,
  findSession,
  SESSION_COOKIE,
} from '../auth/session.ts';

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

  const data = await read();
  const user = data.admins.find((u) => u.username === username);
  if (!user) return c.json({ error: 'invalid credentials' }, 401);

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return c.json({ error: 'invalid credentials' }, 401);

  const { token, expiresAt } = createSession(user.id);
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
  destroySession(token);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', async (c) => {
  const token = getCookie(c, SESSION_COOKIE) ?? '';
  const sess = findSession(token);
  if (!sess) return c.json({ user: null });
  const data = await read();
  const user = data.admins.find((u) => u.id === sess.userId);
  if (!user) return c.json({ user: null });
  return c.json({ user: { id: user.id, username: user.username } });
});
