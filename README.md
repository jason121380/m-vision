# M 視覺影像記錄公司 — 婚禮預約系統

行動裝置優先的婚禮攝影預約系統。客戶在四步驟內完成日期、服務、攝影師、客戶資料、簽名，送出後資料寫進後端 `data.json`、契約 PDF 自動上傳到 Drive。後台 (`/admin`) 管設定、檔期、收單；攝影師 (`/booking`) 用自己的帳密查預約。

## 技術棧

- **前端**：React 18 + Vite + TypeScript
- **後端**：Hono + Node 20，靜態 + API 同 process
- **資料儲存**：單檔 `data/data.json`（atomic write，不需要 DB）
- **PDF**：`html2canvas` + `jsPDF`，截圖式 PDF（lazy-loaded）
- **PDF 儲存**：Apps Script Web App 代上傳到 Google Drive，回傳公開連結
- **Bookings 備份**：每次更新 fire-and-forget 推到 Apps Script 寫進備份 Sheet
- **認證**：bcryptjs + cookie session（admin 與攝影師各一套）
- **部署**：Zeabur，前後端同一 service，需要掛 Volume 給 `data.json`

## 三個入口（同一個 SPA bundle）

| 路徑 | 對象 | 功能 |
|---|---|---|
| `/` | 客戶 | 4 步驟預約表單，送出寫 `data.json` + 上傳 PDF |
| `/admin` | 管理員 | 服務 / 機位 / 儀式 / 加選 / 攝影師 / 設定 / 預約檔期 / 收單紀錄 |
| `/booking` | 攝影師 | 用自己的帳密登入，看自己被指派的日期 |

`src/main.tsx` 用 path 判斷載入哪個 bundle（admin / booking 都 lazy-loaded）。

## 本地開發

兩個 terminal：

```bash
# Terminal 1 — 後端
cp server/.env.example server/.env   # 第一次
cd server && npm install && npm run dev
# → http://localhost:3001
# 第一次啟動自動建 admin / 1234，看 console

# Terminal 2 — 前端
npm install && npm run dev
# → http://localhost:5173，/api 自動 proxy 到 :3001
```

需要 Node 20.x。

完整建置：

```bash
npm run build                          # 前端 → dist/
cd server && npm run typecheck         # 後端型別檢查
```

## 環境變數（server/.env）

| Key | 說明 |
|---|---|
| `PORT` | 預設 3001，Zeabur 會自動注入 |
| `DATA_DIR` | `data.json` 存放路徑，部署要對應 volume |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 第一次啟動自動建立 admin（已存在則略過） |
| `CORS_ORIGINS` | 允許的前端 origin（同源部署可空） |
| `SHEET_CSV_BASE` | `npm run import:sheet` 從 Google Sheet 拉資料用 |
| `PDF_UPLOAD_ENDPOINT` | Apps Script `.../exec`，PDF 上傳 + bookings 備份共用 |
| `BOOKINGS_SYNC_ENDPOINT` | 若 bookings 備份要走另一個 endpoint，否則 fallback 到 `PDF_UPLOAD_ENDPOINT` |

## API

公開：
- `GET  /api/config` — 完整 config
- `POST /api/booking` — 客戶送單（會觸發 PDF 上傳 + bookings 累加 + 備份 Sheet）
- `GET  /api/health`、`GET /api/_count`

Admin（cookie session）：
- `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/me`
- `GET  /api/admin/{services|cameras|ceremonies|addons|photographers|settings|bookings|submissions}`
- `PUT  /api/admin/{services|cameras|ceremonies|addons|photographers|settings}` — 整張覆蓋
- `POST /PUT /DELETE /api/admin/bookings[/:id]` — 單筆 CRUD（id = array index）
- `DELETE /api/admin/submissions/:id` — 刪收單，並反向還原 bookings
- `POST /api/admin/import-sheet` — 從公開 CSV 整張覆蓋
- `POST /api/admin/sync-bookings` — 把現有 bookings 推到備份 Sheet

Staff（攝影師 cookie session）：
- `POST /api/staff/auth/login`、`POST /api/staff/auth/logout`、`GET /api/staff/auth/me`
- `GET  /api/staff/schedule` — 自己被指派的所有日期

## Apps Script

`apps-script/submit.gs` 部署為 Web App，**只剩兩件事**：

1. PDF base64 上傳到 Drive 資料夾，回傳公開 URL
2. `action=syncBookings`：bookings 整張陣列覆寫到備份 Sheet 的 `bookings` 分頁

需要先設好兩個常數：
- `PDF_FOLDER_ID`：契約 PDF 資料夾
- `BOOKINGS_BACKUP_SHEET_ID`：備份 Sheet（會自動建 `bookings` 分頁）

部署：擴充功能 → Apps Script → 貼上 → 執行 `init` 授權（DriveApp + SpreadsheetApp）→ 部署 → 網路應用程式（執行身分：我，存取：所有人）→ 把 `.../exec` URL 設給 server 的 `PDF_UPLOAD_ENDPOINT`。

**改 code 一定要「管理部署作業 → ✏️ → 版本：新版本 → 部署」**，否則 URL 後面跑舊版。

## 部署到 Zeabur

`zbpack.json` 已設好。一個 service 同時 build 前端 + 跑 server。

**重要：要掛 Volume，否則重新部署會把 `data/data.json` 洗掉。**

1. 推 code 上 GitHub
2. Zeabur 建 service 連 repo
3. 環境變數設：
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`（第一次部署用，後續可拿掉）
   - `PDF_UPLOAD_ENDPOINT`
   - `DATA_DIR=/data`（配合 volume）
   - 如有跨域：`CORS_ORIGINS`
4. Volumes 分頁掛一個 volume 到 `/data`
5. 第一次部署若要從現有 Google Sheet 倒資料，console 跑：
   ```bash
   cd server && npm run import:sheet
   ```
   或登入後台後打 `POST /api/admin/import-sheet`。

## 從 Google Sheet 匯入（一次性）

舊版用 Google Sheet 當設定來源，現在主來源是 `data.json`。如果還有歷史資料留在 Sheet：

1. 設好 `SHEET_CSV_BASE`（`server/.env`）
2. `cd server && npm run import:sheet`
3. 各分頁（services / cameras / ceremonies / addons / photographers / settings / bookings）會整張覆蓋

## 檔案結構

```
src/                                前端
├── main.tsx                        三個入口的 path routing（/、/admin、/booking）
├── App.tsx                         客戶預約表單主控
├── App.css                         客戶頁樣式
├── types.ts                        FormState / AppConfig / row 型別
├── components/                     Page1-Page4、SignaturePad、Steps、Summary、PrintableContract、MediaCarousel
├── admin/                          後台（lazy-loaded）
│   ├── AdminApp.tsx                Tab 切換 + 登入
│   ├── Editor.tsx                  通用 CRUD 表
│   ├── BookingsView.tsx            檔期管理（有日曆）
│   ├── ServicesView.tsx            服務 + 純宴客 / 加選宴客 special UI
│   ├── SettingsView.tsx            company_name / address / bank…
│   ├── SubmissionsView.tsx         收單紀錄
│   └── admin.css
├── booking/                        攝影師專區（lazy-loaded）
│   ├── BookingApp.tsx              登入 + 月曆
│   └── booking.css
├── hooks/useConfig.ts              拉 /api/config
└── lib/
    ├── api.ts                      apiFetch wrapper
    ├── submission.ts               組 payload + lazy-load PDF + POST /api/booking
    ├── pricing.ts                  總價 + 明細
    ├── pdf.ts                      html2canvas + jsPDF（lazy-loaded）
    ├── bookings.ts                 從 cam label 解析「幾機」
    └── defaults.ts                 只剩 HARDCODED_MEDIA（首頁 banner）

server/                             後端
├── src/
│   ├── index.ts                    Hono + 靜態 + admin manifest 改寫
│   ├── routes/{auth,public,admin,staff}.ts
│   ├── auth/{session,staff-session,middleware}.ts
│   └── store/
│       ├── storage.ts              JSON atomic write + write chain
│       ├── types.ts                DataShape
│       ├── seed.ts                 第一次啟動建 admin
│       ├── import-sheet.ts         從公開 CSV 拉設定
│       └── sync-bookings.ts        Bookings → Apps Script 備份 Sheet
├── scripts/migrate-from-sheet.ts   一次性匯入工具
└── data/data.json                  本地預設資料路徑

apps-script/submit.gs               PDF 上傳到 Drive + Bookings 備份到 Sheet
legacy/index.html                   原始單檔 HTML（視覺基準）
```
