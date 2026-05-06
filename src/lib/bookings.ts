import type { AppConfig, BookingRow, CamType } from '../types';

export function ymd(year: string, month: string, day: string): string {
  if (!year || !month || !day) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function findBooking(bookings: BookingRow[], date: string): BookingRow | undefined {
  if (!date) return undefined;
  return bookings.find((b) => b.date === date);
}

const numSetting = (config: AppConfig, key: string, fallback: number): number => {
  const n = Number(config.settings[key] ?? '');
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const maxVideoSlots = (config: AppConfig) => numSetting(config, 'max_video_slots_per_day', 2);
export const maxPhotoSlots = (config: AppConfig) => numSetting(config, 'max_photo_slots_per_day', 2);
export const maxVideoCams = (config: AppConfig) => numSetting(config, 'max_video_cameras_per_day', 6);
export const maxPhotoCams = (config: AppConfig) => numSetting(config, 'max_photo_cameras_per_day', 2);

// 該日「動態」是否已滿 slot
export function videoFull(config: AppConfig, date: string): boolean {
  const b = findBooking(config.bookings, date);
  if (!b) return false;
  return b.videoSlots >= maxVideoSlots(config);
}

export function photoFull(config: AppConfig, date: string): boolean {
  const b = findBooking(config.bookings, date);
  if (!b) return false;
  return b.photoSlots >= maxPhotoSlots(config);
}

// 整天禁選（動態+平面 都滿）
export function dayFullyBlocked(config: AppConfig, date: string): boolean {
  return videoFull(config, date) && photoFull(config, date);
}

// 從 camera label「二機/三機/四機/單機/雙機」推出機位數
export function cameraCount(label: string): number {
  const m: Record<string, number> = {
    一機: 1,
    單機: 1,
    二機: 2,
    雙機: 2,
    三機: 3,
    四機: 4,
    五機: 5,
    六機: 6,
  };
  return m[label.trim()] ?? 0;
}

// 給定該日該服務（video/photo）已用機位數，回傳「還能加多少」
export function camerasLeft(config: AppConfig, date: string, type: CamType): number {
  const b = findBooking(config.bookings, date);
  const max = type === 'video' ? maxVideoCams(config) : maxPhotoCams(config);
  if (!b) return max;
  const used = type === 'video' ? b.videoCamsUsed : b.photoCamsUsed;
  return Math.max(0, max - used);
}

// 該日該攝影師是否已被綁為主攝（無法被選）
export function photographerBlocked(config: AppConfig, date: string, type: CamType, key: string): boolean {
  const b = findBooking(config.bookings, date);
  if (!b) return false;
  const leads = type === 'video' ? b.videoLeads : b.photoLeads;
  return leads.includes(key);
}
