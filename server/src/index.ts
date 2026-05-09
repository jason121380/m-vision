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

const app = new Hono();

app.use('*', logger());

const origins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// 同源部署的話 CORS 不必要，但留著也沒成本（dev 跨 port 需要）
app.use(
  '*',
  cors({
    origin: origins.length > 0 ? origins : '*',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

// API routes 一定要在 static / SPA fallback 前面
app.route('/api/auth', authRoutes);
app.route('/api', publicRoutes);
app.route('/api/admin', adminRoutes);

// 靜態檔（前端 build 出來的 dist/）。STATIC_DIR 預設 '../dist'，假設從 server/ 啟動。
const STATIC_DIR = process.env.STATIC_DIR ?? '../dist';
app.use('/*', serveStatic({ root: STATIC_DIR }));

// SPA fallback：所有沒對到 file/route 的請求都送 index.html
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

const port = Number(process.env.PORT ?? 3001);
const hostname = process.env.HOSTNAME ?? '0.0.0.0';
serve({ fetch: app.fetch, port, hostname });
console.log(`[m-vision-server] listening on ${hostname}:${port}, static=${STATIC_DIR}`);
