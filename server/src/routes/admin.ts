import bcrypt from 'bcryptjs';
import { Hono } from 'hono';
import { z } from 'zod';
import { read, update } from '../store/storage.ts';
import { importFromSheet } from '../store/import-sheet.ts';
import { syncBookingsToSheet } from '../store/sync-bookings.ts';
import { requireAdmin } from '../auth/middleware.ts';
import type {
  AddonRow,
  BookingRow,
  CameraRow,
  CeremonyRow,
  PhotographerRow,
  ServiceRow,
  SettingsMap,
} from '../store/types.ts';

export const adminRoutes = new Hono();
adminRoutes.use('*', requireAdmin);

const camTypeEnum = z.enum(['video', 'photo']);

const servicesSchema = z.array(
  z.object({ key: z.string().min(1), label: z.string().min(1), price: z.number().int() }),
);
const camerasSchema = z.array(
  z.object({
    type: camTypeEnum,
    key: z.string().min(1),
    label: z.string().min(1),
    price: z.number().int(),
    note: z.string().optional().default(''),
  }),
);
const ceremoniesSchema = z.array(
  z.object({
    type: camTypeEnum,
    key: z.string().min(1),
    label: z.string().min(1),
    price: z.number().int(),
  }),
);
const addonsSchema = z.array(
  z.object({ key: z.string().min(1), label: z.string().min(1), price: z.number().int() }),
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
    username: z.string().optional().default(''),
    // 從 admin UI 進來時是明碼；存進 data.json 之前 hash 成 passwordHash
    password: z.string().optional().default(''),
    visible: z.boolean().optional().default(true),
  }),
);
const settingsSchema = z.array(
  z.object({ key: z.string().min(1), value: z.string().optional().default('') }),
);

const bookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  videoSlots: z.number().int().min(0),
  photoSlots: z.number().int().min(0),
  videoCamsUsed: z.number().int().min(0),
  photoCamsUsed: z.number().int().min(0),
  videoLeads: z.array(z.string()),
  photoLeads: z.array(z.string()),
  notes: z.string().optional().default(''),
});

// === GET 各表 ===
adminRoutes.get('/services', async (c) => c.json((await read()).services));
adminRoutes.get('/cameras', async (c) => c.json((await read()).cameras));
adminRoutes.get('/ceremonies', async (c) => c.json((await read()).ceremonies));
adminRoutes.get('/addons', async (c) => c.json((await read()).addons));
adminRoutes.get('/photographers', async (c) => {
  const d = await read();
  // 不要把 passwordHash 吐回前端；改用 hasPassword 旗標讓 UI 能顯示「已設定」
  return c.json(
    d.photographers.map((p) => {
      const { passwordHash, ...rest } = p;
      return { ...rest, hasPassword: !!passwordHash };
    }),
  );
});
adminRoutes.get('/settings', async (c) => {
  const d = await read();
  return c.json(Object.entries(d.settings).map(([key, value]) => ({ key, value })));
});
adminRoutes.get('/bookings', async (c) => {
  const d = await read();
  // 補上 id 欄位（用 array index）方便 admin UI 操作
  return c.json(d.bookings.map((b, idx) => ({ ...b, id: idx })));
});
adminRoutes.get('/submissions', async (c) => {
  const d = await read();
  return c.json(d.submissions.slice(0, 200));
});

// === PUT 整張覆蓋 ===
adminRoutes.put('/services', async (c) => {
  const body = await c.req.json();
  const parsed = servicesSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await update((d) => {
    d.services = parsed.data as ServiceRow[];
  });
  return c.json({ ok: true });
});

adminRoutes.put('/cameras', async (c) => {
  const body = await c.req.json();
  const parsed = camerasSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await update((d) => {
    d.cameras = parsed.data as CameraRow[];
  });
  return c.json({ ok: true });
});

adminRoutes.put('/ceremonies', async (c) => {
  const body = await c.req.json();
  const parsed = ceremoniesSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await update((d) => {
    d.ceremonies = parsed.data as CeremonyRow[];
  });
  return c.json({ ok: true });
});

adminRoutes.put('/addons', async (c) => {
  const body = await c.req.json();
  const parsed = addonsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await update((d) => {
    d.addons = parsed.data as AddonRow[];
  });
  return c.json({ ok: true });
});

adminRoutes.put('/photographers', async (c) => {
  const body = await c.req.json();
  const parsed = photographersSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);

  // 把現有的 passwordHash 用 key 索引備好。送進來的 row 若 password 留空，保留舊 hash；
  // 有新 password 就 bcrypt hash 後覆蓋。
  const cur = await read();
  const existingByKey = new Map<string, string>();
  for (const p of cur.photographers) {
    if (p.passwordHash) existingByKey.set(p.key, p.passwordHash);
  }

  const next: PhotographerRow[] = [];
  for (const r of parsed.data) {
    let passwordHash: string | undefined;
    if (r.password) {
      passwordHash = await bcrypt.hash(r.password, 10);
    } else {
      passwordHash = existingByKey.get(r.key);
    }
    next.push({
      type: r.type,
      key: r.key,
      name: r.name,
      role: r.role,
      price: r.price,
      photo: r.photo,
      desc: r.desc,
      portfolio: r.portfolio,
      username: r.username || undefined,
      passwordHash,
      visible: r.visible,
    });
  }

  await update((d) => {
    d.photographers = next;
  });
  return c.json({ ok: true });
});

adminRoutes.put('/settings', async (c) => {
  const body = await c.req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  await update((d) => {
    const next: SettingsMap = {};
    for (const r of parsed.data) next[r.key] = r.value;
    d.settings = next;
  });
  return c.json({ ok: true });
});

// === bookings 單筆 CRUD（用 array index 當 id） ===
adminRoutes.post('/bookings', async (c) => {
  const body = await c.req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  const result = await update((d) => {
    d.bookings.push(parsed.data as BookingRow);
    d.bookings.sort((a, b) => a.date.localeCompare(b.date));
  });
  syncBookingsToSheet(result.bookings).catch(() => {});
  return c.json({ ok: true });
});

adminRoutes.put('/bookings/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  let updated = false;
  const result = await update((d) => {
    if (id >= 0 && id < d.bookings.length) {
      d.bookings[id] = parsed.data as BookingRow;
      d.bookings.sort((a, b) => a.date.localeCompare(b.date));
      updated = true;
    }
  });
  if (!updated) return c.json({ error: 'not found' }, 404);
  syncBookingsToSheet(result.bookings).catch(() => {});
  return c.json({ ok: true });
});

adminRoutes.delete('/bookings/:id', async (c) => {
  const id = Number(c.req.param('id'));
  let deleted = false;
  const result = await update((d) => {
    if (id >= 0 && id < d.bookings.length) {
      d.bookings.splice(id, 1);
      deleted = true;
    }
  });
  if (!deleted) return c.json({ error: 'not found' }, 404);
  syncBookingsToSheet(result.bookings).catch(() => {});
  return c.json({ ok: true });
});

// 手動把目前 data.json 的 bookings 整份推到備份 Sheet。
// 用於初次匯入或 Apps Script 失聯後補同步。回傳備份 Sheet 寫入幾筆。
adminRoutes.post('/sync-bookings', async (c) => {
  const endpoint = process.env.BOOKINGS_SYNC_ENDPOINT || process.env.PDF_UPLOAD_ENDPOINT;
  if (!endpoint) {
    return c.json({ error: '備份 endpoint 尚未設定（PDF_UPLOAD_ENDPOINT 或 BOOKINGS_SYNC_ENDPOINT）' }, 500);
  }
  const data = await read();
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'syncBookings', bookings: data.bookings }),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; count?: number; error?: string }
      | null;
    if (!json?.ok) {
      return c.json({ error: json?.error ?? '備份 Sheet 沒有正確回應' }, 502);
    }
    return c.json({ ok: true, count: json.count ?? data.bookings.length });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});

// 從 Google Sheet 公開 CSV 整張覆蓋（bookings 是 upsert）
// 任何分頁抓不到都會跳過，不會擋其他分頁繼續寫入
adminRoutes.post('/import-sheet', async (c) => {
  try {
    const result = await importFromSheet();
    return c.json({ ok: true, ...result });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// 刪除一筆收單，並反向還原該筆對 bookings 的累加（slots / camsUsed / leads）
adminRoutes.delete('/submissions/:id', async (c) => {
  const id = Number(c.req.param('id'));
  let removed = false;
  const result = await update((d) => {
    const idx = d.submissions.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const sub = d.submissions[idx]!;
    const raw = (sub.raw ?? {}) as {
      svc?: 'video' | 'photo' | 'both';
      vpKey?: string;
      ppKey?: string;
      vCams?: number;
      pCams?: number;
    };
    const eventDate = sub.eventDate || '';

    if (eventDate) {
      const bkIdx = d.bookings.findIndex((b) => b.date === eventDate);
      if (bkIdx >= 0) {
        const bk = d.bookings[bkIdx]!;
        const addV = raw.svc === 'video' || raw.svc === 'both';
        const addP = raw.svc === 'photo' || raw.svc === 'both';

        if (addV) {
          bk.videoSlots = Math.max(0, bk.videoSlots - 1);
          bk.videoCamsUsed = Math.max(0, bk.videoCamsUsed - (raw.vCams ?? 0));
          const vKey = raw.vpKey === 'any' ? '' : (raw.vpKey ?? '');
          if (vKey) {
            // 同一天若還有別筆送單也綁這個 lead，就不拔
            const stillUsed = d.submissions.some((s, i) => {
              if (i === idx) return false;
              if (s.eventDate !== eventDate) return false;
              return ((s.raw ?? {}) as { vpKey?: string }).vpKey === vKey;
            });
            if (!stillUsed) bk.videoLeads = bk.videoLeads.filter((k) => k !== vKey);
          }
        }
        if (addP) {
          bk.photoSlots = Math.max(0, bk.photoSlots - 1);
          bk.photoCamsUsed = Math.max(0, bk.photoCamsUsed - (raw.pCams ?? 0));
          const pKey = raw.ppKey === 'any' ? '' : (raw.ppKey ?? '');
          if (pKey) {
            const stillUsed = d.submissions.some((s, i) => {
              if (i === idx) return false;
              if (s.eventDate !== eventDate) return false;
              return ((s.raw ?? {}) as { ppKey?: string }).ppKey === pKey;
            });
            if (!stillUsed) bk.photoLeads = bk.photoLeads.filter((k) => k !== pKey);
          }
        }

        // booking 歸零且沒備註 → 移掉這個日期，避免 0/0/0 殘留
        if (
          bk.videoSlots === 0 &&
          bk.photoSlots === 0 &&
          bk.videoCamsUsed === 0 &&
          bk.photoCamsUsed === 0 &&
          bk.videoLeads.length === 0 &&
          bk.photoLeads.length === 0 &&
          !bk.notes
        ) {
          d.bookings.splice(bkIdx, 1);
        }
      }
    }

    d.submissions.splice(idx, 1);
    removed = true;
  });
  if (!removed) return c.json({ error: 'not found' }, 404);
  syncBookingsToSheet(result.bookings).catch(() => {});
  return c.json({ ok: true });
});
