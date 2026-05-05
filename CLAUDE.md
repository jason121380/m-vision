# CLAUDE.md

## 專案性質

行動裝置優先的婚禮攝影預約表單。**單頁 SPA**，不是 multi-route 應用。所有狀態存在 `App.tsx` 的 `useState`，沒有 Router、沒有 Redux/Zustand。

## 必看檔案

- `src/types.ts` — `FormState`（27 個欄位）、`AppConfig`（6 個 collection），新增欄位先改這裡
- `src/lib/defaults.ts` — Sheet 抓不到時的 fallback 資料；改 schema 要兩邊一起改
- `src/config.ts` — 6 個 CSV URL + Apps Script endpoint，所有外部串接的 single source of truth
- `apps-script/submit.gs` — 後端邏輯，**改完一定要在 Apps Script UI 重新部署「新版本」**才生效
- `legacy/index.html` — 原始單檔版本，視覺基準，CSS 從這搬出來的

## 命令

```bash
npm run dev          開發
npm run build        正式 build（會跑 tsc -b 把錯抓出來）
npm run typecheck    只跑型別檢查
```

完工前必跑 `npm run build`。

## 慣例

- **沒有 ESLint/Prettier 設定** — 跟隨現有檔案的風格（雙引號、單引號 mix 都有，看上下文）
- **狀態管理**：父層 `state` + `update(patch: Partial<FormState>)` 往下傳。子組件不持有業務狀態（除了簽名 canvas 的 ref）
- **CSS**：全部在 `src/App.css`，class 名稱很短（`.opt`、`.stitle`），**不要重新命名**，網頁設計師對視覺敏感
- **i18n**：不需要，介面 100% 中文，註解可中可英
- **CSV schema 改動**：四個地方要同步：
  1. Google Sheet 真的改
  2. `src/types.ts`（如果欄位 type 改）
  3. `src/lib/defaults.ts`（fallback 資料）
  4. `src/hooks/useConfig.ts`（解析 row → object）

## 保留 key（不能改）

- `services` tab：`video`、`photo`、`both` 是程式判斷用，code 內寫死
- `addons` tab：`none` 是預設選中
- `photographers` tab：`none`、`any` 兩列有特殊外觀（圓圈），其餘列顯示頭像
- `settings` tab：`company_name`、`tax_id`、`owner_name`、`owner_legal`、`address`、`bank`、`account`、`deposit`、`court` 都被契約模板讀

## 已知坑

- **html2canvas 不支援 backdrop-filter / 部分 gradient**：`PrintableContract` 故意用平面白底黑字，**不要把 App.css 的星空效果搬進去**
- **Apps Script no-cors POST**：前端拿不到 response body，UI 預設「打出去就成功」。實際結果要去 Apps Script 執行記錄看
- **PDF 體積**：`jsPDF + html2canvas` ~180KB gzip，**已 lazy-loaded**（`await import('./pdf')` 在 `submission.ts`）。改動 `pdf.ts` 要確認 build log 仍然有獨立 chunk
- **SignaturePad 簽完會消失（已修）**：`useEffect` deps 不能放 `onChange`，每次 parent re-render 都會 reset canvas。用 `onChangeRef` 包起來、deps 設 `[]`
- **Zeabur Node 22 npm 失敗**：已用 `.nvmrc`、`engines.node`、`zbpack.json` 三處釘 Node 20
- **修改後新部署 ≠ 同個 URL**：Apps Script「管理部署作業 → ✏️ → 版本：新版本 → 部署」會保留 URL；按「新增部署作業」會給新 URL，前端 `config.ts` 就要更新

## 不要做的事

- **不要把 PDF 改成純文字版**：jsPDF 不支援中文，要塞 2-3MB CJK 字型，使用者已選擇截圖式
- **不要刪 `legacy/index.html`**：它是視覺基準，改網頁要對齊它
- **不要在 `App.css` 裡用 `@media print`**：列印不是這個 app 的功能，PDF 是另一條 pipeline
- **不要為了「乾淨」把 fallback defaults 拿掉**：那是 Sheet 故障時的安全網，留著

## 下一步常見任務

| 任務 | 起點 |
|---|---|
| 加新欄位（例如「親友見證人」）| `types.ts` → `Page3.tsx` UI → `submission.ts` payload → Apps Script `COLUMNS` |
| 改契約文字 | `src/components/Page4.tsx`（網頁顯示）+ `src/components/PrintableContract.tsx`（PDF）兩處同步 |
| 換攝影師清單 | 改 Google Sheet `photographers` 分頁即可，前端會自動 reload |
| 換配色 | 主要在 `App.css` 找 `rgba(110,90,200,...)`、`rgba(15,12,40,...)` 系列 |
| PDF 排版 | `src/components/PrintableContract.tsx` |
