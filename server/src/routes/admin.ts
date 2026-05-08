import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/index.ts';
import { requireAdmin } from '../auth/middleware.ts';

export const adminRoutes = new Hono();
adminRoutes.use('*', requireAdmin);

/*
 * Admin 編輯一律「整張表覆蓋」：前端送一個 array，後端 truncate + 重插。
 * 對小資料量（< 50 列）最簡單可靠，避免追蹤 add/edit/delete 三種狀態。
 * settings 是 key-value，也走全替換。
 * bookings、submissions 不允許整張覆蓋（會洗掉客人已下訂單），各自單筆 CRUD。
 */

const camTypeEnum = z.enum(['video', 'photo']);
const mediaTypeEnum = z.enum(['image', 'video']);

const servicesSchema = z.array(
  z.object({ key: z.string().min(1), label: z.string().min(1), price: z.number().int(), sortOrder: z.number().int().optional() }),
);
const camerasSchema = z.array(
  z.object({
    type: camTypeEnum,
    key: z.string().min(1),
    label: z.string().min(1),
    price: z.number().int(),
    note: z.string().optional().default(''),
    sortOrder: z.number().int().optional(),
  }),
);
const ceremoniesSchema = z.array(
  z.object({
    type: camTypeEnum,
    key: z.string().min(1),
    label: z.string().min(1),
    price: z.number().int(),
    sortOrder: z.number().int().optional(),
  }),
);
const addonsSchema = z.array(
  z.object({ key: z.string().min(1), label: z.string().min(1), price: z.number().int(), sortOrder: z.number().int().optional() }),
);
const photographersSchema = z.array(
  z.object({
    type: camTypeEnum,
    key: z.string().min(1),
    name: z.string().min(1),
    role: z.string().optional().default(''),
    price: z.number().int(),
    photo: z.string().optional().default(''),
    desc: z.string().optional().default(''),
    portfolio: z.string().optional().default(''),
    sortOrder: z.number().int().optional(),
  }),
);
const mediaSchema = z.array(
  z.object({
    type: mediaTypeEnum,
    url: z.string().min(1),
    alt: z.string().optional().default(''),
    poster: z.string().optional().default(''),
    sortOrder: z.number().int().optional(),
  }),
);
const settingsSchema = z.array(
  z.object({ key: z.string().min(1), value: z.string().optional().default('') }),
);

// === GET：拉目前 DB 內容（給前端編輯時 prefill） ===
adminRoutes.get('/services', async (c) =>
  c.json(await db.select().from(schema.services).orderBy(schema.services.sortOrder, schema.services.id)),
);
adminRoutes.get('/cameras', async (c) =>
  c.json(await db.select().from(schema.cameras).orderBy(schema.cameras.sortOrder, schema.cameras.id)),
);
adminRoutes.get('/ceremonies', async (c) =>
  c.json(await db.select().from(schema.ceremonies).orderBy(schema.ceremonies.sortOrder, schema.ceremonies.id)),
);
adminRoutes.get('/addons', async (c) =>
  c.json(await db.select().from(schema.addons).orderBy(schema.addons.sortOrder, schema.addons.id)),
);
adminRoutes.get('/photographers', async (c) =>
  c.json(await db.select().from(schema.photographers).orderBy(schema.photographers.sortOrder, schema.photographers.id)),
);
adminRoutes.get('/media', async (c) =>
  c.json(await db.select().from(schema.media).orderBy(schema.media.sortOrder, schema.media.id)),
);
adminRoutes.get('/settings', async (c) =>
  c.json(await db.select().from(schema.settings).orderBy(schema.settings.key)),
);
adminRoutes.get('/bookings', async (c) =>
  c.json(await db.select().from(schema.bookings).orderBy(schema.bookings.date)),
);
adminRoutes.get('/submissions', async (c) =>
  c.json(
    await db
      .select()
      .from(schema.submissions)
      .orderBy(sql`${schema.submissions.submittedAt} desc`)
      .limit(200),
  ),
);

// === PUT：整張覆蓋（catalog 類） ===
async function replaceTable<T extends { sortOrder?: number }>(
  table:
    | typeof schema.services
    | typeof schema.cameras
    | typeof schema.ceremonies
    | typeof schema.addons
    | typeof schema.photographers
    | typeof schema.media,
  rows: T[],
) {
  await db.transaction(async (tx) => {
    await tx.delete(table);
    if (rows.length === 0) return;
    await tx.insert(table).values(
      rows.map((r, i) => ({ ...r, sortOrder: r.sortOrder ?? i })),
    );
  });
}

adminRoutes.put('/services', async (c) => {
  const body = await c.req.json();
  const parsed = servicesSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await replaceTable(schema.services, parsed.data);
  return c.json({ ok: true });
});

adminRoutes.put('/cameras', async (c) => {
  const body = await c.req.json();
  const parsed = camerasSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await replaceTable(schema.cameras, parsed.data);
  return c.json({ ok: true });
});

adminRoutes.put('/ceremonies', async (c) => {
  const body = await c.req.json();
  const parsed = ceremoniesSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await replaceTable(schema.ceremonies, parsed.data);
  return c.json({ ok: true });
});

adminRoutes.put('/addons', async (c) => {
  const body = await c.req.json();
  const parsed = addonsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await replaceTable(schema.addons, parsed.data);
  return c.json({ ok: true });
});

adminRoutes.put('/photographers', async (c) => {
  const body = await c.req.json();
  const parsed = photographersSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await replaceTable(schema.photographers, parsed.data);
  return c.json({ ok: true });
});

adminRoutes.put('/media', async (c) => {
  const body = await c.req.json();
  const parsed = mediaSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await replaceTable(schema.media, parsed.data);
  return c.json({ ok: true });
});

adminRoutes.put('/settings', async (c) => {
  const body = await c.req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await db.transaction(async (tx) => {
    await tx.delete(schema.settings);
    if (parsed.data.length > 0) await tx.insert(schema.settings).values(parsed.data);
  });
  return c.json({ ok: true });
});

// === bookings 單筆 CRUD（不允許整張覆蓋） ===
const bookingPayload = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  videoSlots: z.number().int().min(0),
  photoSlots: z.number().int().min(0),
  videoCamsUsed: z.number().int().min(0),
  photoCamsUsed: z.number().int().min(0),
  videoLeads: z.array(z.string()),
  photoLeads: z.array(z.string()),
  notes: z.string().optional().default(''),
});

adminRoutes.post('/bookings', async (c) => {
  const body = await c.req.json();
  const parsed = bookingPayload.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  const inserted = await db.insert(schema.bookings).values(parsed.data).returning();
  return c.json(inserted[0]);
});

adminRoutes.put('/bookings/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const parsed = bookingPayload.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  const updated = await db
    .update(schema.bookings)
    .set(parsed.data)
    .where(eq(schema.bookings.id, id))
    .returning();
  if (updated.length === 0) return c.json({ error: 'not found' }, 404);
  return c.json(updated[0]);
});

adminRoutes.delete('/bookings/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await db.delete(schema.bookings).where(eq(schema.bookings.id, id));
  return c.json({ ok: true });
});
