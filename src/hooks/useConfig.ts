import { useEffect, useState } from 'react';
import { csvToObjects } from '../lib/csv';
import { DEFAULT_CONFIG } from '../lib/defaults';
import { CONFIG_SHEET_CSV_URLS } from '../config';
import type {
  AddonRow,
  AppConfig,
  BookingRow,
  CameraRow,
  CamType,
  CeremonyRow,
  PhotographerRow,
  ServiceRow,
  SettingsMap,
} from '../types';

const num = (v: string | undefined): number => {
  const n = Number(String(v ?? '').replace(/[, ]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const ty = (v: string | undefined): CamType => (v === 'photo' ? 'photo' : 'video');

// 把 Drive 的分享連結 / 檔案 ID / YouTube URL 轉成前端能直接吃的 URL
function normalizeMediaUrl(url: string, type: 'image' | 'video'): string {
  if (!url) return url;
  const trimmed = url.trim();

  // YouTube：watch / youtu.be / 既有 embed
  const yt = trimmed.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) {
    const id = yt[1];
    if (type === 'video') {
      const params = new URLSearchParams({
        autoplay: '1',
        mute: '1',
        controls: '0',
        loop: '1',
        playlist: id,
        modestbranding: '1',
        rel: '0',
        playsinline: '1',
        iv_load_policy: '3',
        fs: '0',
        disablekb: '1',
        cc_load_policy: '0',
        showinfo: '0',
      });
      return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
    }
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }

  // 純檔案 ID（20+ 字元的英數加底線/減號）
  if (/^[\w-]{20,}$/.test(trimmed)) {
    return type === 'video'
      ? `https://drive.google.com/file/d/${trimmed}/preview`
      : `https://drive.google.com/thumbnail?id=${trimmed}&sz=w1600`;
  }

  // /file/d/{ID}/view 格式
  const m1 = trimmed.match(/\/file\/d\/([\w-]+)/);
  if (m1) {
    const id = m1[1];
    return type === 'video'
      ? `https://drive.google.com/file/d/${id}/preview`
      : `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
  }

  // ?id=... 格式
  const m2 = trimmed.match(/[?&]id=([\w-]+)/);
  if (m2) {
    const id = m2[1];
    return type === 'video'
      ? `https://drive.google.com/file/d/${id}/preview`
      : `https://drive.google.com/thumbnail?id=${id}&sz=w1600`;
  }

  return trimmed;
}

async function fetchTab(url: string): Promise<Record<string, string>[] | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    return csvToObjects(text);
  } catch (err) {
    console.warn(`[config] failed to fetch ${url}:`, err);
    return null;
  }
}

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [services, cameras, ceremonies, addons, photographers, settings, bookings] = await Promise.all([
        fetchTab(CONFIG_SHEET_CSV_URLS.services),
        fetchTab(CONFIG_SHEET_CSV_URLS.cameras),
        fetchTab(CONFIG_SHEET_CSV_URLS.ceremonies),
        fetchTab(CONFIG_SHEET_CSV_URLS.addons),
        fetchTab(CONFIG_SHEET_CSV_URLS.photographers),
        fetchTab(CONFIG_SHEET_CSV_URLS.settings),
        fetchTab(CONFIG_SHEET_CSV_URLS.bookings),
      ]);
      if (cancelled) return;

      const useRows = (rows: Record<string, string>[] | null, name: string): rows is Record<string, string>[] => {
        if (!rows) {
          console.warn(`[config] "${name}" fetch failed → using defaults`);
          return false;
        }
        if (rows.length === 0) {
          console.warn(`[config] "${name}" returned no rows → using defaults`);
          return false;
        }
        return true;
      };

      const next: AppConfig = {
        services: useRows(services, 'services')
          ? services.map<ServiceRow>((r) => ({ key: r.key, label: r.label, price: num(r.price) }))
          : DEFAULT_CONFIG.services,
        cameras: useRows(cameras, 'cameras')
          ? cameras.map<CameraRow>((r) => ({
              type: ty(r.type),
              key: r.key,
              label: r.label,
              price: num(r.price),
              note: r.note ?? '',
            }))
          : DEFAULT_CONFIG.cameras,
        ceremonies: useRows(ceremonies, 'ceremonies')
          ? ceremonies.map<CeremonyRow>((r) => ({
              type: ty(r.type),
              key: r.key,
              label: r.label,
              price: num(r.price),
            }))
          : DEFAULT_CONFIG.ceremonies,
        addons: useRows(addons, 'addons')
          ? addons.map<AddonRow>((r) => ({ key: r.key, label: r.label, price: num(r.price) }))
          : DEFAULT_CONFIG.addons,
        photographers: useRows(photographers, 'photographers')
          ? photographers.map<PhotographerRow>((r) => ({
              type: ty(r.type),
              key: r.key,
              name: r.name,
              role: r.role ?? '',
              price: num(r.price),
              photo: normalizeMediaUrl(r.photo ?? '', 'image'),
              desc: r.desc ?? '',
              portfolio: (r.portfolio ?? '').trim(),
            }))
          : DEFAULT_CONFIG.photographers,
        settings: useRows(settings, 'settings')
          ? settings.reduce<SettingsMap>((acc, r) => {
              if (!r.key) return acc;
              const v = r.value ?? '';
              acc[r.key] = r.key === 'logo' ? normalizeMediaUrl(v, 'image') : v;
              return acc;
            }, {})
          : DEFAULT_CONFIG.settings,
        // media 寫死在 defaults.ts，不從 Sheet 抓
        media: DEFAULT_CONFIG.media,
        bookings: useRows(bookings, 'bookings')
          ? bookings
              .map<BookingRow>((r) => ({
                date: (r.date ?? '').trim(),
                videoSlots: num(r.videoSlots),
                photoSlots: num(r.photoSlots),
                videoCamsUsed: num(r.videoCamsUsed),
                photoCamsUsed: num(r.photoCamsUsed),
                videoLeads: (r.videoLeads ?? '').split(',').map((s) => s.trim()).filter(Boolean),
                photoLeads: (r.photoLeads ?? '').split(',').map((s) => s.trim()).filter(Boolean),
                notes: r.notes ?? '',
              }))
              .filter((b) => b.date)
          : DEFAULT_CONFIG.bookings,
      };

      console.info('[config] loaded', {
        services: next.services.length,
        cameras: next.cameras.length,
        ceremonies: next.ceremonies.length,
        addons: next.addons.length,
        photographers: next.photographers.length,
        settings: Object.keys(next.settings).length,
        media: next.media.length,
        bookings: next.bookings.length,
      });

      setConfig(next);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loaded };
}
