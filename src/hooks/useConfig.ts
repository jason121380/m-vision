import { useEffect, useState } from 'react';
import { csvToObjects } from '../lib/csv';
import { DEFAULT_CONFIG } from '../lib/defaults';
import { CONFIG_SHEET_CSV_URLS } from '../config';
import type {
  AddonRow,
  AppConfig,
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
      const [services, cameras, ceremonies, addons, photographers, settings] = await Promise.all([
        fetchTab(CONFIG_SHEET_CSV_URLS.services),
        fetchTab(CONFIG_SHEET_CSV_URLS.cameras),
        fetchTab(CONFIG_SHEET_CSV_URLS.ceremonies),
        fetchTab(CONFIG_SHEET_CSV_URLS.addons),
        fetchTab(CONFIG_SHEET_CSV_URLS.photographers),
        fetchTab(CONFIG_SHEET_CSV_URLS.settings),
      ]);
      if (cancelled) return;

      const next: AppConfig = {
        services: services
          ? services.map<ServiceRow>((r) => ({ key: r.key, label: r.label, price: num(r.price) }))
          : DEFAULT_CONFIG.services,
        cameras: cameras
          ? cameras.map<CameraRow>((r) => ({
              type: ty(r.type),
              key: r.key,
              label: r.label,
              price: num(r.price),
              note: r.note ?? '',
            }))
          : DEFAULT_CONFIG.cameras,
        ceremonies: ceremonies
          ? ceremonies.map<CeremonyRow>((r) => ({
              type: ty(r.type),
              key: r.key,
              label: r.label,
              price: num(r.price),
            }))
          : DEFAULT_CONFIG.ceremonies,
        addons: addons
          ? addons.map<AddonRow>((r) => ({ key: r.key, label: r.label, price: num(r.price) }))
          : DEFAULT_CONFIG.addons,
        photographers: photographers
          ? photographers.map<PhotographerRow>((r) => ({
              type: ty(r.type),
              key: r.key,
              name: r.name,
              role: r.role ?? '',
              price: num(r.price),
            }))
          : DEFAULT_CONFIG.photographers,
        settings: settings
          ? settings.reduce<SettingsMap>((acc, r) => {
              if (r.key) acc[r.key] = r.value ?? '';
              return acc;
            }, {})
          : DEFAULT_CONFIG.settings,
      };

      setConfig(next);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loaded };
}
