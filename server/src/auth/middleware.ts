import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { findSession, SESSION_COOKIE } from './session.ts';

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE) ?? '';
  const hit = await findSession(token);
  if (!hit) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', hit.user);
  c.set('session', hit.session);
  await next();
};
