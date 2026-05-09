import { useEffect, useState } from 'react';
import { HARDCODED_MEDIA } from '../lib/defaults';
import { apiFetch } from '../lib/api';
import type {
  AddonRow,
  AppConfig,
  BookingRow,
  CameraRow,
  CeremonyRow,
  PhotographerRow,
  ServiceRow,
  SettingsMap,
} from '../types';

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

type ConfigResponse = {
  services: ServiceRow[];
  cameras: CameraRow[];
  ceremonies: CeremonyRow[];
  addons: AddonRow[];
  photographers: PhotographerRow[];
  settings: SettingsMap;
  bookings: BookingRow[];
};

const EMPTY_CONFIG: AppConfig = {
  services: [],
  cameras: [],
  ceremonies: [],
  addons: [],
  photographers: [],
  media: HARDCODED_MEDIA,
  settings: {},
  bookings: [],
};

export function useConfig() {
  const [config, setConfig] = useState<AppConfig>(EMPTY_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiFetch<ConfigResponse>('/api/config');
      if (cancelled) return;

      if (!res.ok) {
        console.warn('[config] /api/config failed:', res.error);
        // 不假裝有資料；保持 empty config，UI 自己判斷是否能用
        setConfig(EMPTY_CONFIG);
        setLoaded(true);
        return;
      }

      const d = res.data;
      const next: AppConfig = {
        services: d.services ?? [],
        cameras: d.cameras ?? [],
        ceremonies: d.ceremonies ?? [],
        addons: d.addons ?? [],
        photographers: (d.photographers ?? []).map<PhotographerRow>((p) => ({
          ...p,
          photo: normalizeMediaUrl(p.photo ?? '', 'image'),
          portfolio: (p.portfolio ?? '').trim(),
        })),
        media: HARDCODED_MEDIA,
        settings: d.settings
          ? Object.entries(d.settings).reduce<SettingsMap>((acc, [k, v]) => {
              acc[k] = k === 'logo' ? normalizeMediaUrl(v, 'image') : v;
              return acc;
            }, {})
          : {},
        bookings: d.bookings ?? [],
      };

      console.info('[config] loaded from /api/config', {
        services: next.services.length,
        cameras: next.cameras.length,
        ceremonies: next.ceremonies.length,
        addons: next.addons.length,
        photographers: next.photographers.length,
        settings: Object.keys(next.settings).length,
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
