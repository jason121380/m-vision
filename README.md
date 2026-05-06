# M 視覺影像記錄公司 — 婚禮預約表單

行動裝置優先的婚禮攝影預約表單。客戶在四個步驟內完成日期、服務、攝影師、客戶資料、簽名，送出後資料寫進 Google Sheet、契約 PDF 自動存到 Drive 並回傳下載連結。

## 技術棧

- **前端**：React 18 + Vite + TypeScript
- **設定來源**：Google Sheet（6 個分頁，發佈成 CSV，前端 fetch）
- **回覆儲存**：Google Sheet（透過 Apps Script Web App 寫入）
- **PDF 產生**：`html2canvas` + `jsPDF`，截圖式 PDF（lazy-loaded）
- **PDF 儲存**：Google Drive 資料夾，Apps Script 上傳並回傳公開連結
- **部署**：Zeabur 靜態站

## 本地開發

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # 產出 dist/
npm run typecheck    # tsc -b --noEmit
```

需要 Node 20.x。

## 設定

打開 `src/config.ts`：

```ts
// 6 個分頁的 CSV URL
export const CONFIG_SHEET_CSV_URLS = {
  services: '...',
  cameras: '...',
  ceremonies: '...',
  addons: '...',
  photographers: '...',
  settings: '...',
};

// Apps Script Web App 的部署網址
export const SUBMISSION_ENDPOINT_URL = 'https://script.google.com/macros/s/.../exec';
```

設定 Sheet 的欄位 schema 見 `src/lib/defaults.ts`（提供 fallback 預設值）。

## Google Sheet（設定）

6 個分頁，發佈為 CSV：

| 分頁 | 欄位 |
|---|---|
| `services` | `key, label, price` |
| `cameras` | `type, key, label, price, note` |
| `ceremonies` | `type, key, label, price` |
| `addons` | `key, label, price` |
| `photographers` | `type, key, name, role, price` |
| `settings` | `key, value` |

CSV URL 格式：`.../pub?gid=<GID>&single=true&output=csv`

## Apps Script（回覆 + PDF）

`apps-script/submit.gs` 部署為 Web App。需要：

- 一個**回覆 Sheet**（ID 填到 `RESPONSE_SHEET_ID`）
- 一個 **Drive 資料夾**（ID 填到 `PDF_FOLDER_ID`）

部署：擴充功能 → Apps Script → 貼上 → 執行 `init` 授權（SpreadsheetApp + DriveApp）→ 部署 → 網路應用程式（執行身分：我，存取：所有人）→ 把 `.../exec` 網址貼到前端 config。

每次改 Apps Script 都要「管理部署作業 → ✏️ → 版本：新版本 → 部署」，否則網址背後跑的還是舊版。

## 部署到 Zeabur

連 GitHub repo → 選 branch → Zeabur auto-detect Vite → 自動 build & serve `dist/`。Node 版本透過 `package.json` engines、`.nvmrc`、`zbpack.json` 三處釘 Node 20。

## 檔案結構

```
src/
├── App.tsx                 主控頁面切換 + 送出邏輯
├── App.css                 全部樣式
├── config.ts               CSV URL + Apps Script endpoint
├── types.ts                FormState / AppConfig 型別
├── components/
│   ├── Page1-Page4.tsx     四個步驟頁面
│   ├── PrintableContract.tsx  PDF 用的純文字版面
│   ├── SignaturePad.tsx    手寫簽名 canvas
│   ├── StarsBackground.tsx 背景星空
│   ├── Steps.tsx           步驟指示
│   └── Summary.tsx         費用明細
├── hooks/useConfig.ts      平行 fetch 6 個 CSV，失敗 fallback defaults
└── lib/
    ├── csv.ts              CSV parser
    ├── defaults.ts         後備設定（Sheet 失敗時使用）
    ├── pdf.ts              html2canvas + jsPDF（lazy-loaded）
    ├── pricing.ts          總價計算 + 明細 rows
    └── submission.ts       打 Apps Script + 帶 PDF base64

apps-script/submit.gs       Apps Script doPost：寫 Sheet + 上傳 PDF
legacy/index.html           原始單檔 HTML（備份）
```
