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
// 2. GOOGLE_FORM
//    送出表單會 POST 到 formResponse endpoint。
//    每個 entry.xxxxx 對應 Google 表單的一個欄位。
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

// =============================================================================
// 送出表單 / Submission target
// =============================================================================
// 把 Google Form 的「viewform」URL 換成「formResponse」即可。
// entry IDs 從表單的「取得預先填入的連結」拿。

export const GOOGLE_FORM = {
  formResponseUrl: '',
  entries: {
    groom: '',
    bride: '',
    phone: '',
    eventDate: '',
    service: '',
    weddingTime: '',
    restaurant: '',
    hotel: '',
    cerWz: '',
    cerYq: '',
    cerZh: '',
    makeupTime: '',
    breakdown: '',
    total: '',
    signature: '',
  },
} as const;
