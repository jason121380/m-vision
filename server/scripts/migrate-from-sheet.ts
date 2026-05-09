import 'dotenv/config';
import { db, pg, schema } from '../src/db/index.ts';

/*
 * 把目前 publish-to-web 的 Google Sheet 資料一次倒進 Postgres。
 * 跑：
 *   cd server
 *   npm run import:sheet
 * 完整覆蓋 catalog 類分頁，bookings 用 upsert 不蓋掉現有客戶資料。
 *
 * 你那份 Sheet 各分頁 gid（從前端 src/config.ts 對齊）：
 */
const GIDS = {
  services: '0',
  cameras: '799839686',
  ceremonies: '1996073086',
  addons: '839307070',
  photographers: '641524689',
  settings: '382208128',
  media: '1783636320',
  bookings: '770609893',
} as const;

const BASE = process.env.SHEET_CSV_BASE;
if (!BASE) throw new Error('SHEET_CSV_BASE 未設定');

function csvUrl(gid: string): string {
  return `${BASE}?gid=${gid}&single=true&output=csv`;
}

// 簡易 CSV parser（跟前端 src/lib/csv.ts 同邏輯）
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function csvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text.trim());
  if (rows.length === 0) return [];
  const headers = rows[0]!.map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => !(r[0] ?? '').trim().startsWith('#'))
    .map((r) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h] = (r[idx] ?? '').trim();
      });
      return obj;
    });
}

async function fetchTab(gid: string): Promise<Record<string, string>[]> {
  const res = await fetch(csvUrl(gid), { redirect: 'follow' });
  if (!res.ok) throw new Error(`fetch ${gid} failed: ${res.status}`);
  return csvToObjects(await res.text());
}

const num = (v: string | undefined): number => {
  const n = Number(String(v ?? '').replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const ty = (v: string | undefined): 'video' | 'photo' => (v === 'photo' ? 'photo' : 'video');
const mediaTy = (v: string | undefined): 'image' | 'video' => (v === 'video' ? 'video' : 'image');

async function main() {
  console.log('[import] fetching CSVs...');
  const [services, cameras, ceremonies, addons, photographers, media, settings, bookings] =
    await Promise.all([
      fetchTab(GIDS.services),
      fetchTab(GIDS.cameras),
      fetchTab(GIDS.ceremonies),
      fetchTab(GIDS.addons),
      fetchTab(GIDS.photographers),
      fetchTab(GIDS.media),
      fetchTab(GIDS.settings),
      fetchTab(GIDS.bookings),
    ]);

  console.log(
    `[import] rows: services=${services.length} cameras=${cameras.length} ceremonies=${ceremonies.length} addons=${addons.length} photographers=${photographers.length} media=${media.length} settings=${settings.length} bookings=${bookings.length}`,
  );

  await db.transaction(async (tx) => {
    // catalog 全清掉再插
    await tx.delete(schema.services);
    if (services.length > 0) {
      await tx.insert(schema.services).values(
        services.map((r, i) => ({
          key: r.key ?? '',
          label: r.label ?? '',
          price: num(r.price),
          sortOrder: i,
        })),
      );
    }

    await tx.delete(schema.cameras);
    if (cameras.length > 0) {
      await tx.insert(schema.cameras).values(
        cameras.map((r, i) => ({
          type: ty(r.type),
          key: r.key ?? '',
          label: r.label ?? '',
          price: num(r.price),
          note: r.note ?? '',
          sortOrder: i,
        })),
      );
    }

    await tx.delete(schema.ceremonies);
    if (ceremonies.length > 0) {
      await tx.insert(schema.ceremonies).values(
        ceremonies.map((r, i) => ({
          type: ty(r.type),
          key: r.key ?? '',
          label: r.label ?? '',
          price: num(r.price),
          sortOrder: i,
        })),
      );
    }

    await tx.delete(schema.addons);
    if (addons.length > 0) {
      await tx.insert(schema.addons).values(
        addons.map((r, i) => ({
          key: r.key ?? '',
          label: r.label ?? '',
          price: num(r.price),
          sortOrder: i,
        })),
      );
    }

    await tx.delete(schema.photographers);
    if (photographers.length > 0) {
      await tx.insert(schema.photographers).values(
        photographers.map((r, i) => ({
          type: ty(r.type),
          key: r.key ?? '',
          name: r.name ?? '',
          role: r.role ?? '',
          price: num(r.price),
          photo: r.photo ?? '',
          desc: r.desc ?? '',
          portfolio: r.portfolio ?? '',
          sortOrder: i,
        })),
      );
    }

    await tx.delete(schema.media);
    if (media.length > 0) {
      await tx.insert(schema.media).values(
        media
          .filter((r) => (r.url ?? '').trim() !== '')
          .map((r, i) => ({
            type: mediaTy(r.type),
            url: r.url ?? '',
            alt: r.alt ?? '',
            poster: r.poster ?? '',
            sortOrder: i,
          })),
      );
    }

    await tx.delete(schema.settings);
    if (settings.length > 0) {
      await tx.insert(schema.settings).values(
        settings
          .filter((r) => (r.key ?? '').trim() !== '')
          .map((r) => ({ key: r.key!, value: r.value ?? '' })),
      );
    }

    // bookings 用 upsert（保留現有預約）
    for (const r of bookings) {
      const date = (r.date ?? '').trim();
      if (!date) continue;
      const videoLeads = (r.videoLeads ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const photoLeads = (r.photoLeads ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      await tx
        .insert(schema.bookings)
        .values({
          date,
          videoSlots: num(r.videoSlots),
          photoSlots: num(r.photoSlots),
          videoCamsUsed: num(r.videoCamsUsed),
          photoCamsUsed: num(r.photoCamsUsed),
          videoLeads,
          photoLeads,
          notes: r.notes ?? '',
        })
        .onConflictDoUpdate({
          target: schema.bookings.date,
          set: {
            videoSlots: num(r.videoSlots),
            photoSlots: num(r.photoSlots),
            videoCamsUsed: num(r.videoCamsUsed),
            photoCamsUsed: num(r.photoCamsUsed),
            videoLeads,
            photoLeads,
            notes: r.notes ?? '',
          },
        });
    }
  });

  console.log('[import] done');
  await pg.end();
}

main().catch(async (err) => {
  console.error(err);
  await pg.end();
  process.exit(1);
});
