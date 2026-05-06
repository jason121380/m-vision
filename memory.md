# memory.md

開發進度與決策紀錄。新東西寫在最上面。

## 目前狀態

**部署中、未完全驗證 end-to-end**

- ✅ 前端：React + Vite + TS，Zeabur 上線
- ✅ 設定：6 個 CSV 分頁，前端能讀（fallback defaults 也能擋）
- ✅ 簽名：SignaturePad re-render bug 已修
- ✅ PDF：html2canvas + jsPDF lazy-loaded，視覺式截圖
- ⚠️ **Apps Script PDF 上傳尚未驗證成功**（user 回報 Sheet/Drive 都沒看到 PDF，最近一次截圖只有 init 跑過、沒有 doPost 紀錄 → 懷疑部署版本不對或 endpoint URL 沒對齊）

## 接下來要做（優先順序）

1. **驗證 Apps Script 部署**：請 user 確認 manage deployments → ✏️ → 版本選新版本 → 部署。確認 endpoint URL 跟 `src/config.ts` 一致
2. **加 doPost smoke test**：把 `init` 擴充成模擬一次 doPost，user 不用真送表單就能驗 PDF + Drive
3. **舊資料 Sheet header 錯位**：之前用舊 schema（16 欄）寫過資料，新 schema 17 欄，header 對不齊。建議刪掉 `responses` 分頁讓它重建
4. **可能要做**：合併到 main branch（user 還沒答覆）

## 關鍵 ID

- 設定 Sheet（讀）：`1keLGOiVFkgnInnP4fa3lt3u5DeNvswbxkHZ9Wd5G3dc`
  - 公開 CSV base：`https://docs.google.com/spreadsheets/d/e/2PACX-1vTFQckgyvf1EHhsOPeI8X1SPsaqQTert9W53cOfeTHy3TkGseK1bfzI4jn7euXKS5CGlgYxJ18Ml2I-/pub`
- 回覆 Sheet（寫）：`1wMqpUncxpn-j_TxXr27UJsovOc4EaiDvRRCAM239Qtc`
- PDF 資料夾：`1os5QkoQ3x1Mzp0vcE45brJ9ICscQyCqd`
- Apps Script endpoint：`https://script.google.com/macros/s/AKfycbwLQeC7F5Ke5LhDgyrMVgnJjpQ0FPHO3FhZuCp3DI5NN9848_0A14Z-1gAV0wi8OSI/exec`
- GitHub repo：`jason121380/m-vision`
- Working branch：`claude/add-file-reading-3ARnV`（**還沒 merge 到 main**）

## 設計決策

### 為什麼用 Google Sheet 當設定來源
- User 想自己改價格/攝影師不用 push code
- 用「發佈成 CSV」最簡單，不需要 API key、不會洩漏

### 為什麼 PDF 用截圖式（html2canvas）而非純文字（jsPDF text）
- jsPDF 不支援中文字型
- 純文字要塞 2-3MB CJK 字型，bundle 太大
- User 確認用「預設字型」=瀏覽器渲染後截圖
- Trade-off：文字不能複製，視覺跟網頁一致

### 為什麼回覆用 Apps Script Web App 而非 Google Form
- User 明確要求「不是 Google Form」
- Apps Script 寫 Sheet + 上 Drive 一條龍，比 Form 彈性

### 為什麼 PDF lazy-loaded
- html2canvas + jsPDF = 180KB gzip
- 初始載入頁面只有 Page1 需要顯示
- `await import('./pdf')` 在送出時才下載，初次載入快

### 為什麼釘 Node 20 LTS
- Zeabur zbpack 預設 Node 22 + 跑 `npm update -g npm` 在容器內失敗
- 三處釘：`engines`、`.nvmrc`、`zbpack.json`，任一被讀都生效

## 廢棄方案（不要復活）

- ❌ Google Form formResponse POST → 改 Apps Script 後刪掉
- ❌ `getActiveSpreadsheet()` 寫到綁定的 Sheet → 改成 `openById(RESPONSE_SHEET_ID)`，因為設定/回覆是兩份不同的 Sheet
- ❌ 純文字 PDF + CJK 字型 → bundle 太大、開發成本高

## 史 / 大改動

1. 原始：975 行單檔 HTML（視覺漂亮、CSS 完整、邏輯全在 `<script>`）→ 留在 `legacy/index.html`
2. 拆成 React + Vite + TS，每個 Page 一個檔案，狀態統一在 App
3. 加設定 Sheet → useConfig hook，6 個 CSV 平行 fetch，失敗 fallback defaults
4. 加 Apps Script 送出（Form → Apps Script）
5. 設定/回覆改成兩份 Sheet（用 ID 顯式指定）
6. 加 PDF 生成 + Drive 上傳 + 客戶當下下載

## 環境

- Node 20.x
- 主要 deps：`react`、`react-dom`、`jspdf`、`html2canvas`
- 部署：Zeabur 靜態
- Apps Script runtime：V8（預設）
