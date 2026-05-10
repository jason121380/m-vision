import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { read, update } from '../store/storage.ts';
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

// === 推播訂閱（攝影師） ===
const pushSubSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  userAgent: z.string().optional().default(''),
});

staffRoutes.post('/push/subscribe', async (c) => {
  const token = getCookie(c, STAFF_SESSION_COOKIE) ?? '';
  const sess = await findStaffSession(token);
  if (!sess) return c.json({ error: 'unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = pushSubSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  const { endpoint, keys, userAgent } = parsed.data;
  const staffKey = sess.photographerKey;

  await update((d) => {
    if (!Array.isArray(d.pushSubscriptions)) d.pushSubscriptions = [];
    // 同 endpoint + staff(同 key) 算同一台裝置，後寫覆蓋前寫
    d.pushSubscriptions = d.pushSubscriptions.filter(
      (s) => !(s.endpoint === endpoint && s.type === 'staff' && s.staffKey === staffKey),
    );
    d.pushSubscriptions.push({
      endpoint,
      keys,
      type: 'staff',
      staffKey,
      createdAt: new Date().toISOString(),
      userAgent,
    });
  });
  return c.json({ ok: true });
});

staffRoutes.post('/push/unsubscribe', async (c) => {
  const token = getCookie(c, STAFF_SESSION_COOKIE) ?? '';
  const sess = await findStaffSession(token);
  if (!sess) return c.json({ error: 'unauthorized' }, 401);
  const body = await c.req.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  const staffKey = sess.photographerKey;
  await update((d) => {
    if (Array.isArray(d.pushSubscriptions)) {
      d.pushSubscriptions = d.pushSubscriptions.filter(
        (s) => !(s.endpoint === endpoint && s.type === 'staff' && s.staffKey === staffKey),
      );
    }
  });
  return c.json({ ok: true });
});

staffRoutes.get('/schedule', async (c) => {
  const token = getCookie(c, STAFF_SESSION_COOKIE) ?? '';
  const sess = await findStaffSession(token);
  if (!sess) return c.json({ error: 'unauthorized' }, 401);
  const data = await read();
  const myKey = sess.photographerKey;

  const photoById = new Map(data.photographers.map((p) => [p.key, p]));
  const expandLeads = (keys: string[]) =>
    keys
      .filter((k) => k && k !== 'any' && k !== 'none')
      .map((k) => {
        const p = photoById.get(k);
        return {
          key: k,
          name: p?.name ?? k,
          role: p?.role ?? '',
          photo: p?.photo ?? '',
          isMe: k === myKey,
        };
      });

  const dates = data.bookings
    .filter((b) => b.videoLeads.includes(myKey) || b.photoLeads.includes(myKey))
    .map((b) => ({
      date: b.date,
      asVideo: b.videoLeads.includes(myKey),
      asPhoto: b.photoLeads.includes(myKey),
      notes: b.notes ?? '',
      videoSlots: b.videoSlots,
      photoSlots: b.photoSlots,
      videoCamsUsed: b.videoCamsUsed,
      photoCamsUsed: b.photoCamsUsed,
      videoLeads: expandLeads(b.videoLeads),
      photoLeads: expandLeads(b.photoLeads),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return c.json({ dates });
});
