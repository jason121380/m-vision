import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authRoutes } from './routes/auth.ts';
import { publicRoutes } from './routes/public.ts';
import { adminRoutes } from './routes/admin.ts';
import { ensureAdmin } from './store/seed.ts';
import { dataDir } from './store/storage.ts';

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

app.route('/api/auth', authRoutes);
app.route('/api', publicRoutes);
app.route('/api/admin', adminRoutes);

const STATIC_DIR = process.env.STATIC_DIR ?? '../dist';
app.use('/*', serveStatic({ root: STATIC_DIR }));

let indexHtml: string | null = null;
async function getIndexHtml(): Promise<string> {
  if (indexHtml) return indexHtml;
  const path = resolve(process.cwd(), STATIC_DIR, 'index.html');
  indexHtml = await readFile(path, 'utf-8');
  return indexHtml;
}
app.notFound(async (c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'not found' }, 404);
  try {
    const html = await getIndexHtml();
    return c.html(html);
  } catch {
    return c.text('frontend not built — run `npm run build` at repo root first', 500);
  }
});

// 啟動前確保至少有一個 admin 帳號（從 env ADMIN_USERNAME / ADMIN_PASSWORD 讀，預設 admin/1234）
await ensureAdmin();

const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOSTNAME ?? '0.0.0.0';
serve({ fetch: app.fetch, port, hostname });
console.log(
  `[m-vision-server] listening on ${hostname}:${port}, static=${STATIC_DIR}, data=${dataDir()}`,
);
