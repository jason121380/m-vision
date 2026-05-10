# CLAUDE.md

## 專案性質

行動裝置優先的婚禮攝影預約 + 後台。前端 **單頁 SPA**（無 Router），後端 **Hono on Node 20**，所有資料存在一個 `data.json` 檔案裡（**沒有資料庫**）。

前端用 path 判斷三個入口（見 `src/main.tsx`），三者共用同一個 build：

| 路徑 | 入口 component | 用途 |
|---|---|---|
| `/` | `src/App.tsx` | 客戶 4 步驟預約表單 |
| `/admin/*` | `src/admin/AdminApp.tsx`（lazy） | 後台管理（admin 帳密） |
| `/booking/*` | `src/booking/BookingApp.tsx`（lazy） | 攝影師查自己的預約檔期 |

狀態管理：`App.tsx` 持有整份 `FormState`，靠 `update(patch: Partial<FormState>)` 往子 component 傳。子 component **不持有業務狀態**（簽名 canvas 的 ref 例外）。

## 必看檔案

### 前端
- `src/types.ts` — `FormState`、`AppConfig`、各 row 型別。新增欄位先改這
- `src/main.tsx` — 三個入口的 path routing
- `src/hooks/useConfig.ts` — 打 `GET /api/config` 拉設定，失敗就 `EMPTY_CONFIG`，**不偽裝有資料**
- `src/lib/api.ts` — `apiFetch` / `api.{get,post,put,del}`，cookie 走 `credentials: 'include'`
- `src/lib/submission.ts` — 組 payload + lazy-load PDF + `POST /api/booking`
- `src/lib/pricing.ts` — 總價計算 + 明細 rows
- `src/lib/defaults.ts` — **只剩 `HARDCODED_MEDIA`**（首頁輪播 banner.mp4）。其他 fallback 全砍了

### 後端
- `server/src/index.ts` — Hono 啟動 + `/api/*` route + 靜態 `dist/` + `/admin*` 改 manifest
- `server/src/store/storage.ts` — JSON 檔案儲存，atomic write（`.tmp` → `rename`）+ write chain 序列化
- `server/src/store/types.ts` — `DataShape`（與前端 row 型別重複，故意分開）
- `server/src/routes/public.ts` — `/api/config`、`/api/booking`、`/api/health`、`/api/_count`
- `server/src/routes/admin.ts` — `/api/admin/*`，整張 PUT 覆蓋（除了 bookings 是單筆 CRUD）
- `server/src/routes/staff.ts` — 攝影師登入 + `/api/staff/schedule`
- `server/src/routes/auth.ts` — admin 登入 / 登出 / me
- `server/src/auth/{session,staff-session,middleware}.ts` — 兩套 cookie session（admin / staff 分開）
- `server/src/store/{seed,import-sheet,sync-bookings}.ts` — 種預設 admin、從 Sheet CSV 匯入、把 bookings 推備份 Sheet

### 整合
- `apps-script/submit.gs` — **只剩兩件事**：(1) PDF base64 → Drive 拿公開 URL；(2) `action=syncBookings` 整張 bookings 覆寫到備份 Sheet。改完一定要在 Apps Script UI「管理部署作業 → ✏️ → 版本：新版本 → 部署」才生效
- `legacy/index.html` — 原始 975 行單檔版，視覺基準

## 命令

前端（repo 根）：
```bash
npm run dev          # vite，5173，/api proxy 到 :3001
npm run build        # tsc -b && vite build → dist/
npm run typecheck    # tsc -b --noEmit
```

後端（`cd server`）：
```bash
npm run dev          # tsx watch src/index.ts，3001
npm run start        # 部署用
npm run typecheck    # tsc --noEmit
npm run import:sheet # scripts/migrate-from-sheet.ts，從公開 CSV 整張覆蓋
```

完工前必跑 `npm run build` + `cd server && npm run typecheck`。

## 慣例

- **沒有 ESLint/Prettier 設定** — 跟現有檔案的風格走（雙/單引號 mix）
- **狀態流**：`App.tsx` 統一 state，`update(patch)` 下傳；admin / booking 各自管自己的 fetch
- **CSS**：客戶頁面 `src/App.css`、admin `src/admin/admin.css`、攝影師 `src/booking/booking.css`。class 名稱不要重新命名（網頁設計師對視覺敏感）
- **i18n**：不需要，介面 100% 中文，註解可中可英
- **後端 schema**：用 Zod 在 route 端驗，前端 row 型別 (`src/types.ts`) 和後端 (`server/src/store/types.ts`) **故意分開兩份**（前端不需要 `passwordHash` 之類欄位）
- **Cookie**：`session_v1` (admin) / `staff_session_v1` (staff)，httpOnly + sameSite=Lax，production 會自動加 `Secure`

## 後台 Schema 改動同步點

新增 / 改 row 欄位時要動的地方：

1. `server/src/store/types.ts` — `DataShape` 子型別
2. `server/src/routes/admin.ts` — Zod schema + PUT handler
3. `server/src/routes/public.ts` — 如果是公開欄位（出現在 `/api/config`）
4. `src/types.ts` — 前端 row 型別
5. `src/admin/AdminApp.tsx` — `Editor` columns 設定（或對應 `*View.tsx`）
6. 用到的 page component（如 `Page1.tsx`、`Page2.tsx`）

## 保留 key（不能改）

- `services` 表：`video`、`photo`、`both` 是程式判斷用，code 寫死
- `addons` 表：`none` 是預設選中，UI lock
- `photographers` 表：`any` 是「不指定（輪班）」，UI lock
- `settings` 表 keys：`company_name`、`tax_id`、`owner_name`、`owner_legal`、`address`、`bank`、`account`、`deposit`、`court` 都被契約模板讀

## 已知坑

- **html2canvas 不支援 backdrop-filter / 部分 gradient**：`PrintableContract.tsx` 故意用平面白底黑字，**不要把 App.css 的星空效果搬進去**
- **PDF 體積**：`jsPDF + html2canvas` ~180KB gzip，**已 lazy-loaded**（`await import('./pdf')` 在 `submission.ts`）。改 `pdf.ts` 要確認 build log 仍有獨立 chunk
- **SignaturePad 簽完會消失（已修）**：`useEffect` deps 不能放 `onChange`，每次 parent re-render 都會 reset canvas。用 `onChangeRef` 包起來、deps 設 `[]`
- **Zeabur Volume 必掛**：`DATA_DIR=/data` + 對應 volume，否則 redeploy 把 `data.json` 洗掉
- **Zeabur Node 22 npm 失敗**：已用 `.nvmrc`、`engines.node`、`zbpack.json` 三處釘 Node 20
- **Apps Script 新部署 ≠ 同個 URL**：「管理部署作業 → ✏️ → 版本：新版本 → 部署」會保留 URL；「新增部署作業」會給新 URL，要更新 server 的 `PDF_UPLOAD_ENDPOINT` 環境變數
- **`/api/config` 沒登入也讀得到**（公開）：客戶頁面要拉設定。但 admin / staff route 都被 middleware 擋
- **Booking 累加邏輯**：客戶送單會 upsert `bookings[date]`；後台刪 submissions 會反向減（見 `admin.ts` DELETE `/submissions/:id`）。`vpKey === 'any'` 不會記 lead，其他 photographer key 會記但同日多筆同一人不重複
- **第一次啟動自動建 admin**：用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` env（預設 `admin` / `1234`）。已有 admin 就略過，不會覆蓋密碼

## 不要做的事

- **不要把 PDF 改成純文字版**：jsPDF 不支援中文，要塞 2-3MB CJK 字型，使用者已選擇截圖式
- **不要刪 `legacy/index.html`**：視覺基準
- **不要在 `App.css` 裡用 `@media print`**：列印不是這個 app 的功能，PDF 是另一條 pipeline
- **不要把設定改回去 Google Sheet 直接讀**：已遷移到 `data.json` 後端，Sheet 只剩匯入工具 + bookings 備份
- **不要把 `src/lib/defaults.ts` 加回完整 fallback**：故意拿掉了，後端沒資料就讓 UI 顯示「後台尚未設定」（見 `App.tsx` 的 guard）

## 下一步常見任務

| 任務 | 起點 |
|---|---|
| 加新欄位（例如「親友見證人」）| `server/store/types.ts` → `routes/public.ts`（送單 schema）→ `src/types.ts` → `Page3.tsx` UI → `src/lib/submission.ts` payload |
| 改契約文字 | `src/components/Page4.tsx`（網頁顯示）+ `src/components/PrintableContract.tsx`（PDF）兩處同步 |
| 改攝影師清單 | 後台 `/admin` → 設定 → 攝影師 |
| 給攝影師開帳號 | 後台 → 攝影師 → 編輯該人，填「登入帳號 / 登入密碼」（密碼留空保留舊 hash），他到 `/booking` 登入 |
| 換配色 | `App.css` 找 `rgba(110,90,200,...)`、`rgba(15,12,40,...)` 系列 |
| PDF 排版 | `src/components/PrintableContract.tsx` |
| 從舊 Google Sheet 匯資料 | `cd server && npm run import:sheet`（讀 `SHEET_CSV_BASE` env）或後台 `POST /api/admin/import-sheet` |
| 補同步 bookings 到備份 Sheet | 後台「預約檔期」分頁的「同步到備份 Sheet」按鈕，或 `POST /api/admin/sync-bookings` |
