// 跟 admin / 前端共用的 row 形狀。沒有 DB id，用 array index 識別。
// 存進 JSON 檔的形狀就是這幾個 type。

export type CamType = 'video' | 'photo';
// 攝影師可以是純動態 / 純平面 / 兩種都拍。'both' 在前後台清單會同時出現於動態與平面。
export type PhotographerType = 'video' | 'photo' | 'both';

export type ServiceRow = { key: string; label: string; price: number };
export type CameraRow = { type: CamType; key: string; label: string; price: number; note: string };
export type CeremonyRow = { type: CamType; key: string; label: string; price: number };
export type AddonRow = { key: string; label: string; price: number };
export type PhotographerRow = {
  type: PhotographerType;
  key: string;
  name: string;
  role: string;
  price: number;
  photo: string;
  desc: string;
  portfolio: string;
  username?: string;
  passwordHash?: string;
  // 是否顯示於前台選單；undefined 視為 true（保留舊資料行為）
  visible?: boolean;
  // 最高主管：登入 /booking 時可看到所有人的預約檔期，不只自己被綁的
  isSuperUser?: boolean;
};
export type SettingsMap = Record<string, string>;
export type MediaRow = {
  type: 'image' | 'video';
  url: string;
  alt: string;
  poster: string;
};
export type BookingRow = {
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
  submittedAt: string; // ISO
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
  pdfUrl: string;
  signature: string;
  raw: unknown;
};
export type AdminUser = { id: number; username: string; passwordHash: string };
export type SessionRow = { token: string; userId: number; expiresAt: number };
export type StaffSessionRow = { token: string; photographerKey: string; expiresAt: number };

// Web Push 訂閱：同一個 endpoint 在不同身分（admin / staff）算兩筆。
// 觸發時 server 走 web-push 把 payload 送到瀏覽器（即使 PWA 關著也收得到）。
export type PushSubscriptionRow = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  type: 'admin' | 'staff';
  staffKey?: string;
  createdAt: string;
  userAgent?: string;
};

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export type DataShape = {
  services: ServiceRow[];
  cameras: CameraRow[];
  ceremonies: CeremonyRow[];
  addons: AddonRow[];
  photographers: PhotographerRow[];
  settings: SettingsMap;
  bookings: BookingRow[];
  submissions: SubmissionRow[];
  admins: AdminUser[];
  sessions: SessionRow[];
  staffSessions: StaffSessionRow[];
  nextSubmissionId: number;
  nextAdminId: number;
  announcement: string;
  media: MediaRow[];
  pushSubscriptions: PushSubscriptionRow[];
  vapid?: VapidKeys;
};
