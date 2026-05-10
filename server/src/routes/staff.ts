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
  // 同 username 可能對應多筆 row（同一個人 video + photo 各一筆 / 或 type=both 一筆）。
  // 任一筆的 hash 對得上密碼就算登入成功；session 記第一筆的 key（其餘 key 在 schedule 那邊收回來）
  const candidates = data.photographers.filter(
    (p) => p.username === username && p.passwordHash,
  );
  if (candidates.length === 0) return c.json({ error: 'invalid credentials' }, 401);
  let matched: typeof candidates[number] | undefined;
  for (const cand of candidates) {
    if (await bcrypt.compare(password, cand.passwordHash!)) {
      matched = cand;
      break;
    }
  }
  if (!matched) return c.json({ error: 'invalid credentials' }, 401);

  const { token, expiresAt } = await createStaffSession(matched.key);
  setCookie(c, STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
  });
  return c.json({
    ok: true,
    user: {
      key: matched.key,
      name: matched.name,
      role: matched.role,
      isSuperUser: candidates.some((p) => p.isSuperUser === true),
    },
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
  // 同 username 的所有 row 任一個 isSuperUser=true 就視為主管
  const sameUser = ph.username
    ? data.photographers.filter((p) => p.username === ph.username)
    : [ph];
  return c.json({
    user: {
      key: ph.key,
      name: ph.name,
      role: ph.role,
      photo: ph.photo,
      isSuperUser: sameUser.some((p) => p.isSuperUser === true),
    },
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

// 把 'YYYY-M-D' / 'YYYY/M/D' / '2026-5-2' 這類雜訊統一補零成 'YYYY-MM-DD'。
// 沒法解析就回空字串，呼叫端會把它過濾掉。
const normalizeDate = (raw: unknown): string => {
  if (typeof raw !== 'string') return '';
  const t = raw.trim().replace(/\//g, '-');
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return '';
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
};

staffRoutes.get('/schedule', async (c) => {
  const token = getCookie(c, STAFF_SESSION_COOKIE) ?? '';
  const sess = await findStaffSession(token);
  if (!sess) return c.json({ error: 'unauthorized' }, 401);
  const data = await read();
  const sessionKey = sess.photographerKey;
  const sessionPh = data.photographers.find((p) => p.key === sessionKey);

  // 把同 username 的所有 row 都當「我」(同一人在 video / photo 各有一筆 row 時)
  const myKeys = new Set<string>([sessionKey]);
  if (sessionPh?.username) {
    for (const p of data.photographers) {
      if (p.username === sessionPh.username) myKeys.add(p.key);
    }
  }
  const isMyKey = (k: string) => myKeys.has(k);

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
          isMe: isMyKey(k),
        };
      });

  // 最高主管：同 username 任一筆有 isSuperUser → 主管 → 看全部
  const isSuperUser = sessionPh?.username
    ? data.photographers.some((p) => p.username === sessionPh.username && p.isSuperUser)
    : sessionPh?.isSuperUser === true;
  const filtered = isSuperUser
    ? data.bookings
    : data.bookings.filter((b) => b.videoLeads.some(isMyKey) || b.photoLeads.some(isMyKey));

  // 不合併：每一筆 booking row 都當獨立的一場顯示（同日多場是合理的，例如午宴 + 晚宴）
  const dates = filtered
    .map((b) => ({
      date: normalizeDate(b.date),
      // 主管模式下 asVideo / asPhoto 反映「該 booking 是動 / 平」（看 slots），
      // 一般攝影師則反映「我（同 username 任一 key）是不是這場的主攝」
      asVideo: isSuperUser ? b.videoSlots > 0 : b.videoLeads.some(isMyKey),
      asPhoto: isSuperUser ? b.photoSlots > 0 : b.photoLeads.some(isMyKey),
      notes: b.notes ?? '',
      videoSlots: b.videoSlots,
      photoSlots: b.photoSlots,
      videoCamsUsed: b.videoCamsUsed,
      photoCamsUsed: b.photoCamsUsed,
      videoLeads: expandLeads(b.videoLeads),
      photoLeads: expandLeads(b.photoLeads),
    }))
    .filter((d) => d.date !== '')
    .sort((a, b) => a.date.localeCompare(b.date));
  return c.json({ dates });
});
