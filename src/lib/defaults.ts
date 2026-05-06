import type { AppConfig } from '../types';

// 內建預設設定。當 Sheet CSV URL 沒填或抓取失敗時，前端會使用這份。
export const DEFAULT_CONFIG: AppConfig = {
  services: [
    { key: 'video', label: '動態錄影', price: 22000 },
    { key: 'photo', label: '平面拍照', price: 16000 },
    { key: 'both', label: '動態＋平面', price: 0 },
  ],
  cameras: [
    { type: 'video', key: '2cam', label: '二機', price: 0, note: '' },
    { type: 'video', key: '3cam', label: '三機', price: 4000, note: '' },
    { type: 'video', key: '4cam', label: '四機', price: 8000, note: '' },
    { type: 'photo', key: '1cam', label: '單機', price: 0, note: '' },
    { type: 'photo', key: '2cam', label: '雙機', price: 2000, note: '' },
    { type: 'photo', key: '3cam', label: '三機', price: 4000, note: '' },
  ],
  ceremonies: [
    { type: 'video', key: '0', label: '無儀式', price: 0 },
    { type: 'video', key: '1', label: '單儀式', price: 4000 },
    { type: 'video', key: '2', label: '雙儀式', price: 8000 },
    { type: 'video', key: '3', label: '三儀式', price: 12000 },
    { type: 'photo', key: '0', label: '無儀式', price: 0 },
    { type: 'photo', key: '1', label: '單儀式', price: 3000 },
    { type: 'photo', key: '2', label: '雙儀式', price: 6000 },
    { type: 'photo', key: '3', label: '三儀式', price: 9000 },
  ],
  addons: [
    { key: 'none', label: '無', price: 0 },
    { key: 'sde', label: 'SDE 快剪快播', price: 8000 },
    { key: 'reels1', label: 'REELS 30秒客訂短影音 1支', price: 2000 },
    { key: 'reels2', label: 'REELS 30秒客訂短影音 2支', price: 4000 },
  ],
  photographers: [
    { type: 'video', key: 'any', name: '不指定（輪班）', role: '', price: 0, photo: '', desc: '', portfolio: '' },
    { type: 'video', key: 'le', name: '阿樂', role: '主理人', price: 3000, photo: '', desc: '', portfolio: '' },
    { type: 'video', key: 'jb', name: '加冰', role: '動態平面老師', price: 1000, photo: '', desc: '', portfolio: '' },
    { type: 'video', key: 'jarvis', name: 'JARVIS', role: '動態老師', price: 1000, photo: '', desc: '', portfolio: '' },
    { type: 'photo', key: 'any', name: '不指定（輪班）', role: '', price: 0, photo: '', desc: '', portfolio: '' },
    { type: 'photo', key: 'le', name: '阿樂', role: '主理人', price: 3000, photo: '', desc: '', portfolio: '' },
    { type: 'photo', key: 'ryan', name: 'Ryan', role: '婚紗平面老師', price: 1000, photo: '', desc: '', portfolio: '' },
    { type: 'photo', key: 'zhh', name: '智皓', role: '婚紗平面老師', price: 1000, photo: '', desc: '', portfolio: '' },
  ],
  settings: {
    company_name: 'M 視覺影像記錄公司',
    tax_id: '45286851',
    owner_name: '鄭莛楷（阿樂）',
    owner_legal: '黃雯埼',
    address: '彰化縣員林市員林大道四段 175 號',
    bank: '國泰世華 013',
    account: '023506185891',
    deposit: '3000',
    court: '台灣彰化地方法院',
    max_video_slots_per_day: '2',
    max_photo_slots_per_day: '2',
    max_video_cameras_per_day: '6',
    max_photo_cameras_per_day: '2',
  },
  media: [
    { type: 'video', url: 'https://www.youtube.com/watch?v=4GBF8xtqCnM', alt: 'M Vision banner', poster: '' },
  ],
  bookings: [],
};
