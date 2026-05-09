import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { read } from '../store/storage.ts';
import {
  createStaffSession,
  destroyStaffSession,
  findStaffSession,
  STAFF_SESSION_COOKIE,
} from '../auth/staff-session.ts';

export const staffRoutes = new Hono();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

staffRoutes.post('/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload' }, 400);
  const { username, password } = parsed.data;

  const data = await read();
  const photographer = data.photographers.find(
    (p) => p.username === username && p.passwordHash,
  );
  if (!photographer || !photographer.passwordHash) {
    return c.json({ error: 'invalid credentials' }, 401);
  }
  const ok = await bcrypt.compare(password, photographer.passwordHash);
  if (!ok) return c.json({ error: 'invalid credentials' }, 401);

  const { token, expiresAt } = await createStaffSession(photographer.key);
  setCookie(c, STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
  return c.json({
    ok: true,
    user: { key: photographer.key, name: photographer.name, role: photographer.role },
  });
});

staffRoutes.post('/auth/logout', async (c) => {
  const token = getCookie(c, STAFF_SESSION_COOKIE) ?? '';
  await destroyStaffSession(token);
  deleteCookie(c, STAFF_SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});

staffRoutes.get('/auth/me', async (c) => {
  const token = getCookie(c, STAFF_SESSION_COOKIE) ?? '';
  const sess = await findStaffSession(token);
  if (!sess) return c.json({ user: null });
  const data = await read();
  const ph = data.photographers.find((p) => p.key === sess.photographerKey);
  if (!ph) return c.json({ user: null });
  return c.json({
    user: { key: ph.key, name: ph.name, role: ph.role, photo: ph.photo },
  });
});

staffRoutes.get('/schedule', async (c) => {
  const token = getCookie(c, STAFF_SESSION_COOKIE) ?? '';
  const sess = await findStaffSession(token);
  if (!sess) return c.json({ error: 'unauthorized' }, 401);
  const data = await read();
  const myKey = sess.photographerKey;
  const dates = data.bookings
    .filter((b) => b.videoLeads.includes(myKey) || b.photoLeads.includes(myKey))
    .map((b) => ({
      date: b.date,
      asVideo: b.videoLeads.includes(myKey),
      asPhoto: b.photoLeads.includes(myKey),
      notes: b.notes ?? '',
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return c.json({ dates });
});
