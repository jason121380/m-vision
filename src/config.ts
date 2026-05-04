// =============================================================================
// 設定來源 / Configuration sources
// =============================================================================
//
// 1. CONFIG_SHEET_CSV_URLS
//    每個分頁發佈成 CSV 後的 URL。請在 Google Sheet 裡：
//      檔案 → 共用 → 發佈到網路 → 選分頁 → 格式 CSV → 發佈
//    然後把每個分頁的 URL 填到下面對應的 key。
//
//    若任何一個 URL 為空字串或抓取失敗，會 fallback 到 src/lib/defaults.ts
//    的內建預設值，讓你即使沒接 Sheet 也能跑起來。
//
// 2. SUBMISSION_ENDPOINT_URL
//    Google Apps Script Web App 的部署網址（doPost endpoint）。
//    部署完成後會拿到類似：
//      https://script.google.com/macros/s/AKfycb.../exec
//    把整段貼進去即可。Apps Script 範本見 apps-script/submit.gs。
//
// =============================================================================

export const CONFIG_SHEET_CSV_URLS = {
  services: '',
  cameras: '',
  ceremonies: '',
  addons: '',
  photographers: '',
  settings: '',
} as const;

export type ConfigKey = keyof typeof CONFIG_SHEET_CSV_URLS;

export const SUBMISSION_ENDPOINT_URL = '';
