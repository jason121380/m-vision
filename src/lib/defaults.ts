import type { MediaRow } from '../types';

// 首頁輪播媒體。後台不可改、後端不讀，永遠用這個值。
// 過去整個 AppConfig 都有寫死的 fallback，現在已拿掉，
// 服務 / 機位 / 攝影師 / 設定 etc. 全部走 /api/config，
// 後端沒資料就讓前端空著（不偽裝）。
export const HARDCODED_MEDIA: MediaRow[] = [
  { type: 'video', url: '/banner.mp4', alt: 'M Vision banner', poster: '' },
];
