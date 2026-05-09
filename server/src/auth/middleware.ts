import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { read } from '../store/storage.ts';
import { findSession, SESSION_COOKIE } from './session.ts';

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE) ?? '';
  const sess = findSession(token);
  if (!sess) return c.json({ error: 'unauthorized' }, 401);
  const data = await read();
  const user = data.admins.find((u) => u.id === sess.userId);
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', { id: user.id, username: user.username });
  await next();
};
