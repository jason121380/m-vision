import 'dotenv/config';
import { update } from '../src/store/storage.ts';
import type { SettingsMap } from '../src/store/types.ts';

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

// Sheet 的 publish-to-web 連結是 public 的，直接寫死當 fallback。
// 要從別份 Sheet 倒就 export SHEET_CSV_BASE=... 蓋過。
const DEFAULT_BASE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFQckgyvf1EHhsOPeI8X1SPsaqQTert9W53cOfeTHy3TkGseK1bfzI4jn7euXKS5CGlgYxJ18Ml2I-/pub';
const BASE = process.env.SHEET_CSV_BASE ?? DEFAULT_BASE;

function csvUrl(gid: string): string {
  return `${BASE}?gid=${gid}&single=true&output=csv`;
}

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
  const [services, cameras, ceremonies, addons, photographers, media, settingsRows, bookings] =
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
    `[import] rows: services=${services.length} cameras=${cameras.length} ceremonies=${ceremonies.length} addons=${addons.length} photographers=${photographers.length} media=${media.length} settings=${settingsRows.length} bookings=${bookings.length}`,
  );

  await update((d) => {
    d.services = services.map((r) => ({
      key: r.key ?? '',
      label: r.label ?? '',
      price: num(r.price),
    }));

    d.cameras = cameras.map((r) => ({
      type: ty(r.type),
      key: r.key ?? '',
      label: r.label ?? '',
      price: num(r.price),
      note: r.note ?? '',
    }));

    d.ceremonies = ceremonies.map((r) => ({
      type: ty(r.type),
      key: r.key ?? '',
      label: r.label ?? '',
      price: num(r.price),
    }));

    d.addons = addons.map((r) => ({
      key: r.key ?? '',
      label: r.label ?? '',
      price: num(r.price),
    }));

    d.photographers = photographers.map((r) => ({
      type: ty(r.type),
      key: r.key ?? '',
      name: r.name ?? '',
      role: r.role ?? '',
      price: num(r.price),
      photo: r.photo ?? '',
      desc: r.desc ?? '',
      portfolio: r.portfolio ?? '',
    }));

    d.media = media
      .filter((r) => (r.url ?? '').trim() !== '')
      .map((r) => ({
        type: mediaTy(r.type),
        url: r.url ?? '',
        alt: r.alt ?? '',
        poster: r.poster ?? '',
      }));

    const next: SettingsMap = {};
    for (const r of settingsRows) {
      if (r.key) next[r.key] = r.value ?? '';
    }
    d.settings = next;

    // bookings 用 upsert（保留現有預約）
    for (const r of bookings) {
      const date = (r.date ?? '').trim();
      if (!date) continue;
      const videoLeads = (r.videoLeads ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const photoLeads = (r.photoLeads ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const existing = d.bookings.find((b) => b.date === date);
      if (existing) {
        existing.videoSlots = num(r.videoSlots);
        existing.photoSlots = num(r.photoSlots);
        existing.videoCamsUsed = num(r.videoCamsUsed);
        existing.photoCamsUsed = num(r.photoCamsUsed);
        existing.videoLeads = videoLeads;
        existing.photoLeads = photoLeads;
        existing.notes = r.notes ?? '';
      } else {
        d.bookings.push({
          date,
          videoSlots: num(r.videoSlots),
          photoSlots: num(r.photoSlots),
          videoCamsUsed: num(r.videoCamsUsed),
          photoCamsUsed: num(r.photoCamsUsed),
          videoLeads,
          photoLeads,
          notes: r.notes ?? '',
        });
      }
    }
    d.bookings.sort((a, b) => a.date.localeCompare(b.date));
  });

  console.log('[import] done — wrote to data/data.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
