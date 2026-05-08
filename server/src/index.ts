import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth.ts';
import { publicRoutes } from './routes/public.ts';
import { adminRoutes } from './routes/admin.ts';

const app = new Hono();

app.use('*', logger());

const origins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  '*',
  cors({
    origin: origins.length > 0 ? origins : '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

app.get('/', (c) => c.json({ name: 'm-vision-server', ok: true }));

app.route('/api/auth', authRoutes);
app.route('/api', publicRoutes);
app.route('/api/admin', adminRoutes);

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port });
console.log(`[m-vision-server] listening on :${port}`);
