import { update } from './storage.ts';
import type { SettingsMap } from './types.ts';

// media 不從 Sheet 拿，前端寫死 /banner.mp4（src/lib/defaults.ts）
const GIDS = {
  services: '0',
  cameras: '799839686',
  ceremonies: '1996073086',
  addons: '839307070',
  photographers: '641524689',
  settings: '382208128',
  bookings: '770609893',
} as const;

type TabKey = keyof typeof GIDS;
const TAB_KEYS = Object.keys(GIDS) as TabKey[];

const DEFAULT_BASE =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTFQckgyvf1EHhsOPeI8X1SPsaqQTert9W53cOfeTHy3TkGseK1bfzI4jn7euXKS5CGlgYxJ18Ml2I-/pub';

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

const num = (v: string | undefined): number => {
  const n = Number(String(v ?? '').replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const ty = (v: string | undefined): 'video' | 'photo' => (v === 'photo' ? 'photo' : 'video');

export type ImportResult = {
  counts: Partial<Record<TabKey, number>>;
  skipped: TabKey[];
  errors: Partial<Record<TabKey, string>>;
};

export async function importFromSheet(base?: string): Promise<ImportResult> {
  const csvBase = base ?? process.env.SHEET_CSV_BASE ?? DEFAULT_BASE;
  const csvUrl = (gid: string) => `${csvBase}?gid=${gid}&single=true&output=csv`;

  async function fetchTab(gid: string): Promise<Record<string, string>[]> {
    const res = await fetch(csvUrl(gid), { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return csvToObjects(await res.text());
  }

  const settled = await Promise.allSettled(TAB_KEYS.map((k) => fetchTab(GIDS[k])));

  const fetched: Partial<Record<TabKey, Record<string, string>[]>> = {};
  const skipped: TabKey[] = [];
  const errors: Partial<Record<TabKey, string>> = {};

  settled.forEach((r, i) => {
    const k = TAB_KEYS[i]!;
    if (r.status === 'fulfilled') {
      fetched[k] = r.value;
    } else {
      skipped.push(k);
      errors[k] = r.reason instanceof Error ? r.reason.message : String(r.reason);
    }
  });

  await update((d) => {
    if (fetched.services) {
      d.services = fetched.services.map((r) => ({
        key: r.key ?? '',
        label: r.label ?? '',
        price: num(r.price),
      }));
    }
    if (fetched.cameras) {
      d.cameras = fetched.cameras.map((r) => ({
        type: ty(r.type),
        key: r.key ?? '',
        label: r.label ?? '',
        price: num(r.price),
        note: r.note ?? '',
      }));
    }
    if (fetched.ceremonies) {
      d.ceremonies = fetched.ceremonies.map((r) => ({
        type: ty(r.type),
        key: r.key ?? '',
        label: r.label ?? '',
        price: num(r.price),
      }));
    }
    if (fetched.addons) {
      d.addons = fetched.addons.map((r) => ({
        key: r.key ?? '',
        label: r.label ?? '',
        price: num(r.price),
      }));
    }
    if (fetched.photographers) {
      d.photographers = fetched.photographers.map((r) => ({
        type: ty(r.type),
        key: r.key ?? '',
        name: r.name ?? '',
        role: r.role ?? '',
        price: num(r.price),
        photo: r.photo ?? '',
        desc: r.desc ?? '',
        portfolio: r.portfolio ?? '',
      }));
    }
    if (fetched.settings) {
      const next: SettingsMap = {};
      for (const r of fetched.settings) {
        if (r.key) next[r.key] = r.value ?? '';
      }
      d.settings = next;
    }
    if (fetched.bookings) {
      // bookings 用 upsert，保留現有預約資料
      for (const r of fetched.bookings) {
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
    }
  });

  const counts: Partial<Record<TabKey, number>> = {};
  if (fetched.services) counts.services = fetched.services.length;
  if (fetched.cameras) counts.cameras = fetched.cameras.length;
  if (fetched.ceremonies) counts.ceremonies = fetched.ceremonies.length;
  if (fetched.addons) counts.addons = fetched.addons.length;
  if (fetched.photographers) counts.photographers = fetched.photographers.length;
  if (fetched.settings) counts.settings = fetched.settings.filter((r) => !!r.key).length;
  if (fetched.bookings) counts.bookings = fetched.bookings.length;

  return { counts, skipped, errors };
}
