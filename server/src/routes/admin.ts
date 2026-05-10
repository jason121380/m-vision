import bcrypt from 'bcryptjs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { read, update, dataDir } from '../store/storage.ts';
import { importFromSheet } from '../store/import-sheet.ts';
import { syncBookingsToSheet } from '../store/sync-bookings.ts';
import { requireAdmin } from '../auth/middleware.ts';
import { pushToAllStaff, pushToStaff } from '../push.ts';
import type {
  AddonRow,
  BookingRow,
  CameraRow,
  CeremonyRow,
  MediaRow,
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
    isSuperUser: z.boolean().optional().default(false),
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

  // 唯一性檢查：username 非空時不同 key 不能共用（同 key 代表同一人開動 / 平兩筆，允許共用）
  const seenUser = new Map<string, string>();
  for (const r of parsed.data) {
    const u = (r.username ?? '').trim();
    if (!u) continue;
    const prevKey = seenUser.get(u);
    if (prevKey !== undefined && prevKey !== r.key) {
      return c.json({ error: `登入帳號重複：「${u}」不同攝影師不能共用帳號` }, 400);
    }
    if (prevKey === undefined) seenUser.set(u, r.key);
  }

  // 同一個 key 多筆 row 的「新密碼」不能填不一致（同一人不能有兩組密碼）
  const newPwdByKey = new Map<string, string>();
  for (const r of parsed.data) {
    if (!r.password) continue;
    const prev = newPwdByKey.get(r.key);
    if (prev !== undefined && prev !== r.password) {
      return c.json({ error: `同一位攝影師（key="${r.key}"）的新密碼不一致，請填相同密碼或留空保留舊密碼` }, 400);
    }
    if (prev === undefined) newPwdByKey.set(r.key, r.password);
  }

  // 把現有的 passwordHash 用 key 索引備好。送進來的 row 若 password 留空，保留舊 hash；
  // 有新 password 就 bcrypt hash 後覆蓋。同一個 key 只 hash 一次，所有同 key 的 row 共用。
  const cur = await read();
  const existingByKey = new Map<string, string>();
  for (const p of cur.photographers) {
    if (p.passwordHash) existingByKey.set(p.key, p.passwordHash);
  }
  const newHashByKey = new Map<string, string>();
  for (const [k, pwd] of newPwdByKey) {
    newHashByKey.set(k, await bcrypt.hash(pwd, 10));
  }

  const next: PhotographerRow[] = [];
  for (const r of parsed.data) {
    const passwordHash = newHashByKey.get(r.key) ?? existingByKey.get(r.key);
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
      isSuperUser: r.isSuperUser,
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
const notifyStaffNewLeads = (date: string, addedV: string[], addedP: string[]) => {
  const skip = new Set(['', 'any', 'none']);
  for (const k of addedV) {
    if (skip.has(k)) continue;
    pushToStaff(k, {
      title: '新預約檔期',
      body: `${date}　動態`,
      url: '/booking',
      tag: `staff-${k}-${date}`,
    }).catch(() => {});
  }
  for (const k of addedP) {
    if (skip.has(k)) continue;
    pushToStaff(k, {
      title: '新預約檔期',
      body: `${date}　平面`,
      url: '/booking',
      tag: `staff-${k}-${date}`,
    }).catch(() => {});
  }
};

adminRoutes.post('/bookings', async (c) => {
  const body = await c.req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  // 同一個日期已存在 → upsert（避免重複行造成前台列表重複）
  const before = (await read()).bookings.find((b) => b.date === parsed.data.date);
  const beforeV = new Set(before?.videoLeads ?? []);
  const beforeP = new Set(before?.photoLeads ?? []);
  const result = await update((d) => {
    const idx = d.bookings.findIndex((b) => b.date === parsed.data.date);
    if (idx >= 0) d.bookings[idx] = parsed.data as BookingRow;
    else d.bookings.push(parsed.data as BookingRow);
    d.bookings.sort((a, b) => a.date.localeCompare(b.date));
  });
  syncBookingsToSheet(result.bookings).catch(() => {});
  const addedV = parsed.data.videoLeads.filter((k) => !beforeV.has(k));
  const addedP = parsed.data.photoLeads.filter((k) => !beforeP.has(k));
  notifyStaffNewLeads(parsed.data.date, addedV, addedP);
  return c.json({ ok: true });
});

adminRoutes.put('/bookings/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json();
  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  // 拿原本的 leads 比對，只通知「新增」的主攝；移除不通知
  const before = (await read()).bookings[id];
  const beforeV = new Set(before?.videoLeads ?? []);
  const beforeP = new Set(before?.photoLeads ?? []);
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
  const addedV = parsed.data.videoLeads.filter((k) => !beforeV.has(k));
  const addedP = parsed.data.photoLeads.filter((k) => !beforeP.has(k));
  notifyStaffNewLeads(parsed.data.date, addedV, addedP);
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

// === 公告 ===
const announcementSchema = z.object({ text: z.string() });

adminRoutes.get('/announcement', async (c) => {
  const d = await read();
  return c.json({ text: d.announcement ?? '' });
});

adminRoutes.put('/announcement', async (c) => {
  const body = await c.req.json();
  const parsed = announcementSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  const before = (await read()).announcement ?? '';
  const after = parsed.data.text;
  await update((d) => {
    d.announcement = after;
  });
  // 內容真的有變才推；單純打開儲存不通知
  if (after.trim() && after !== before) {
    const preview = after.length > 60 ? after.slice(0, 60) + '…' : after;
    pushToAllStaff({
      title: '公告更新',
      body: preview,
      url: '/booking',
      tag: 'announcement',
    }).catch(() => {});
  }
  return c.json({ ok: true });
});

// === 推播訂閱（admin） ===
const pushSubSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
  userAgent: z.string().optional().default(''),
});

adminRoutes.post('/push/subscribe', async (c) => {
  const body = await c.req.json();
  const parsed = pushSubSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'bad payload', issues: parsed.error.issues }, 400);
  const { endpoint, keys, userAgent } = parsed.data;
  await update((d) => {
    if (!Array.isArray(d.pushSubscriptions)) d.pushSubscriptions = [];
    // 同 endpoint + admin 算同一台裝置，後寫覆蓋前寫
    d.pushSubscriptions = d.pushSubscriptions.filter(
      (s) => !(s.endpoint === endpoint && s.type === 'admin'),
    );
    d.pushSubscriptions.push({
      endpoint,
      keys,
      type: 'admin',
      createdAt: new Date().toISOString(),
      userAgent,
    });
  });
  return c.json({ ok: true });
});

adminRoutes.post('/push/unsubscribe', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  await update((d) => {
    if (Array.isArray(d.pushSubscriptions)) {
      d.pushSubscriptions = d.pushSubscriptions.filter(
        (s) => !(s.endpoint === endpoint && s.type === 'admin'),
      );
    }
  });
  return c.json({ ok: true });
});

// === 網站 Banner / Media ===
// 檔案存進 DATA_DIR/media/<uuid>.<ext>，靜態走 /media/* serve（見 server/src/index.ts）。
// 容量上限見 BodyLimit middleware。
adminRoutes.get('/media', async (c) => {
  const d = await read();
  return c.json((d.media ?? []).map((m, idx) => ({ ...m, id: idx })));
});

const MAX_UPLOAD = 100 * 1024 * 1024; // 100MB

adminRoutes.post('/media', async (c) => {
  let body: Record<string, string | File>;
  try {
    body = await c.req.parseBody();
  } catch (err) {
    return c.json({ error: '解析上傳失敗：' + (err instanceof Error ? err.message : String(err)) }, 400);
  }
  const file = body['file'];
  const alt = typeof body['alt'] === 'string' ? body['alt'] : '';
  if (!(file instanceof File)) return c.json({ error: '請選擇檔案' }, 400);
  if (file.size > MAX_UPLOAD) return c.json({ error: `檔案超過 ${Math.round(MAX_UPLOAD / 1024 / 1024)}MB 上限` }, 413);

  const mime = file.type || '';
  let mtype: 'image' | 'video';
  if (mime.startsWith('image/')) mtype = 'image';
  else if (mime.startsWith('video/')) mtype = 'video';
  else return c.json({ error: '只接受圖片或影片格式' }, 400);

  const rawExt = (file.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const ext = rawExt || (mtype === 'video' ? 'mp4' : 'jpg');
  const filename = `${randomUUID()}.${ext}`;
  const mediaDir = resolve(dataDir(), 'media');
  await mkdir(mediaDir, { recursive: true });
  const filepath = resolve(mediaDir, filename);
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(filepath, Buffer.from(arrayBuffer));

  const row: MediaRow = {
    type: mtype,
    url: `/media/${filename}`,
    alt: alt || file.name,
    poster: '',
  };
  let nextLen = 0;
  await update((d) => {
    if (!Array.isArray(d.media)) d.media = [];
    d.media.push(row);
    nextLen = d.media.length;
  });
  return c.json({ ok: true, row: { ...row, id: nextLen - 1 } });
});

adminRoutes.delete('/media/:id', async (c) => {
  const id = Number(c.req.param('id'));
  let removed: MediaRow | undefined;
  await update((d) => {
    if (!Array.isArray(d.media)) return;
    if (id < 0 || id >= d.media.length) return;
    [removed] = d.media.splice(id, 1);
  });
  if (!removed) return c.json({ error: 'not found' }, 404);
  // 同步刪實體檔（best-effort，刪不掉也讓資料庫先更新）
  if (removed.url.startsWith('/media/')) {
    const filename = removed.url.slice('/media/'.length);
    try {
      await unlink(resolve(dataDir(), 'media', filename));
    } catch (err) {
      console.warn('[media] unlink failed:', err);
    }
  }
  return c.json({ ok: true });
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
