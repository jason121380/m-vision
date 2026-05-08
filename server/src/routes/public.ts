import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/index.ts';

export const publicRoutes = new Hono();

// 前端 useConfig 改打這支：把所有靜態設定一次回傳
publicRoutes.get('/config', async (c) => {
  const [
    services,
    cameras,
    ceremonies,
    addons,
    photographers,
    media,
    settingsRows,
    bookings,
  ] = await Promise.all([
    db.select().from(schema.services).orderBy(schema.services.sortOrder, schema.services.id),
    db.select().from(schema.cameras).orderBy(schema.cameras.sortOrder, schema.cameras.id),
    db.select().from(schema.ceremonies).orderBy(schema.ceremonies.sortOrder, schema.ceremonies.id),
    db.select().from(schema.addons).orderBy(schema.addons.sortOrder, schema.addons.id),
    db.select().from(schema.photographers).orderBy(schema.photographers.sortOrder, schema.photographers.id),
    db.select().from(schema.media).orderBy(schema.media.sortOrder, schema.media.id),
    db.select().from(schema.settings),
    db.select().from(schema.bookings).orderBy(schema.bookings.date),
  ]);

  const settings: Record<string, string> = {};
  for (const r of settingsRows) settings[r.key] = r.value;

  return c.json({
    services: services.map((s) => ({ key: s.key, label: s.label, price: s.price })),
    cameras: cameras.map((c) => ({ type: c.type, key: c.key, label: c.label, price: c.price, note: c.note })),
    ceremonies: ceremonies.map((c) => ({ type: c.type, key: c.key, label: c.label, price: c.price })),
    addons: addons.map((a) => ({ key: a.key, label: a.label, price: a.price })),
    photographers: photographers.map((p) => ({
      type: p.type,
      key: p.key,
      name: p.name,
      role: p.role,
      price: p.price,
      photo: p.photo,
      desc: p.desc,
      portfolio: p.portfolio,
    })),
    media: media.map((m) => ({ type: m.type, url: m.url, alt: m.alt, poster: m.poster })),
    settings,
    bookings: bookings.map((b) => ({
      date: b.date,
      videoSlots: b.videoSlots,
      photoSlots: b.photoSlots,
      videoCamsUsed: b.videoCamsUsed,
      photoCamsUsed: b.photoCamsUsed,
      videoLeads: b.videoLeads,
      photoLeads: b.photoLeads,
      notes: b.notes,
    })),
  });
});

// 客戶送單。PDF 仍由 Apps Script 上傳到 Drive：server 收到後轉發 PDF 到那邊拿 URL
const submissionSchema = z.object({
  submittedAt: z.string().optional(),
  groom: z.string(),
  bride: z.string(),
  phone: z.string(),
  eventDate: z.string(),
  service: z.string(),
  weddingTime: z.string().optional().default(''),
  restaurant: z.string().optional().default(''),
  hotel: z.string().optional().default(''),
  cerWz: z.string().optional().default(''),
  cerYq: z.string().optional().default(''),
  cerZh: z.string().optional().default(''),
  makeupTime: z.string().optional().default(''),
  total: z.number(),
  breakdown: z.string().optional().default(''),
  signature: z.string().optional().default(''),
  pdfBase64: z.string().optional().default(''),
  pdfFilename: z.string().optional().default(''),
  // bookings 用
  svc: z.enum(['video', 'photo', 'both']),
  vpKey: z.string().optional().default(''),
  ppKey: z.string().optional().default(''),
  vCams: z.number().optional().default(0),
  pCams: z.number().optional().default(0),
});

publicRoutes.post('/booking', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  const data = parsed.data;

  // 1. PDF 仍走 Apps Script → Drive
  let pdfUrl = '';
  if (data.pdfBase64 && process.env.PDF_UPLOAD_ENDPOINT) {
    try {
      const res = await fetch(process.env.PDF_UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          // 用 action=pdfOnly 讓 Apps Script 知道只要上傳 PDF，不再寫 sheet
          action: 'pdfOnly',
          pdfBase64: data.pdfBase64,
          pdfFilename: data.pdfFilename,
        }),
      });
      const json = (await res.json().catch(() => null)) as { pdfUrl?: string } | null;
      if (json?.pdfUrl) pdfUrl = json.pdfUrl;
    } catch {
      // PDF 失敗不擋送單流程
    }
  }

  // 2. 寫 submissions（完整紀錄）
  await db.insert(schema.submissions).values({
    groom: data.groom,
    bride: data.bride,
    phone: data.phone,
    eventDate: data.eventDate,
    service: data.service,
    weddingTime: data.weddingTime,
    restaurant: data.restaurant,
    hotel: data.hotel,
    cerWz: data.cerWz,
    cerYq: data.cerYq,
    cerZh: data.cerZh,
    makeupTime: data.makeupTime,
    total: data.total,
    breakdown: data.breakdown,
    signature: data.signature,
    pdfUrl,
    raw: data,
  });

  // 3. 更新 bookings（同日累加）
  const addV = data.svc === 'video' || data.svc === 'both';
  const addP = data.svc === 'photo' || data.svc === 'both';
  const vKey = data.vpKey === 'any' ? '' : data.vpKey;
  const pKey = data.ppKey === 'any' ? '' : data.ppKey;

  const existing = await db
    .select()
    .from(schema.bookings)
    .where(eq(schema.bookings.date, data.eventDate))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(schema.bookings).values({
      date: data.eventDate,
      videoSlots: addV ? 1 : 0,
      photoSlots: addP ? 1 : 0,
      videoCamsUsed: addV ? data.vCams : 0,
      photoCamsUsed: addP ? data.pCams : 0,
      videoLeads: addV && vKey ? [vKey] : [],
      photoLeads: addP && pKey ? [pKey] : [],
    });
  } else {
    const cur = existing[0]!;
    const mergeLead = (arr: string[], k: string): string[] =>
      k && !arr.includes(k) ? [...arr, k] : arr;
    await db
      .update(schema.bookings)
      .set({
        videoSlots: cur.videoSlots + (addV ? 1 : 0),
        photoSlots: cur.photoSlots + (addP ? 1 : 0),
        videoCamsUsed: cur.videoCamsUsed + (addV ? data.vCams : 0),
        photoCamsUsed: cur.photoCamsUsed + (addP ? data.pCams : 0),
        videoLeads: addV ? mergeLead(cur.videoLeads, vKey) : cur.videoLeads,
        photoLeads: addP ? mergeLead(cur.photoLeads, pKey) : cur.photoLeads,
      })
      .where(eq(schema.bookings.id, cur.id));
  }

  return c.json({ ok: true, pdfUrl });
});

// 健康檢查
publicRoutes.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }));
publicRoutes.get('/_count', async (c) => {
  const [s] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.services);
  const [b] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.bookings);
  return c.json({ services: s?.n ?? 0, bookings: b?.n ?? 0 });
});
