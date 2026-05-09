// Admin 後端回傳的原始 row 形狀（含 DB id / sortOrder），跟前端 useConfig 的 AppConfig 不一樣。

export type ServiceRow = { id?: number; key: string; label: string; price: number; sortOrder?: number };
export type CameraRow = {
  id?: number;
  type: 'video' | 'photo';
  key: string;
  label: string;
  price: number;
  note: string;
  sortOrder?: number;
};
export type CeremonyRow = {
  id?: number;
  type: 'video' | 'photo';
  key: string;
  label: string;
  price: number;
  sortOrder?: number;
};
export type AddonRow = { id?: number; key: string; label: string; price: number; sortOrder?: number };
export type PhotographerRow = {
  id?: number;
  type: 'video' | 'photo';
  key: string;
  name: string;
  role: string;
  price: number;
  photo: string;
  desc: string;
  portfolio: string;
  sortOrder?: number;
};
export type SettingRow = { key: string; value: string };
export type BookingRow = {
  id?: number;
  date: string;
  videoSlots: number;
  photoSlots: number;
  videoCamsUsed: number;
  photoCamsUsed: number;
  videoLeads: string[];
  photoLeads: string[];
  notes: string;
};
export type SubmissionRow = {
  id: number;
  submittedAt: string;
  groom: string;
  bride: string;
  phone: string;
  eventDate: string;
  service: string;
  weddingTime: string;
  restaurant: string;
  hotel: string;
  cerWz: string;
  cerYq: string;
  cerZh: string;
  makeupTime: string;
  total: number;
  breakdown: string;
  signature: string;
  pdfUrl: string;
};
