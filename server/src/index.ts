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
import { staffRoutes } from './routes/staff.ts';
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
app.route('/api/staff', staffRoutes);

const STATIC_DIR = process.env.STATIC_DIR ?? '../dist';
app.use('/*', serveStatic({ root: STATIC_DIR }));

let publicHtml: string | null = null;
let adminHtml: string | null = null;

async function loadHtml(): Promise<{ pub: string; admin: string }> {
  if (publicHtml && adminHtml) return { pub: publicHtml, admin: adminHtml };
  const path = resolve(process.cwd(), STATIC_DIR, 'index.html');
  const raw = await readFile(path, 'utf-8');
  publicHtml = raw;
  // /admin* 用 admin.webmanifest（start_url=/admin），加到主畫面才會直接落 /admin
  adminHtml = raw
    .replace('/manifest.webmanifest', '/admin.webmanifest')
    .replace('content="M 視覺"', 'content="M 視覺後台"')
    .replace('<title>M 視覺影像記錄公司</title>', '<title>M 視覺後台</title>')
    .replace(/href="\/logo\.jpg"/g, 'href="/black.jpg"');
  return { pub: publicHtml, admin: adminHtml };
}

app.notFound(async (c) => {
  if (c.req.path.startsWith('/api/')) return c.json({ error: 'not found' }, 404);
  try {
    const { pub, admin } = await loadHtml();
    return c.html(c.req.path.startsWith('/admin') ? admin : pub);
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
