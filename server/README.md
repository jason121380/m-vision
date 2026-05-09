# m-vision-server

Hono server，前端 + 後端 + 後台共用一個服務。**不需要資料庫**：所有資料存在 `data/data.json` 一個檔案。

## 本地起服務

```bash
cp server/.env.example server/.env

cd server
npm install
npm run dev
# → http://localhost:3001（順便 serve 前端 dist/，但 dev 通常從 vite 那邊跑）

# 第一次啟動會自動建 admin / 1234 帳號（看 console）
# 要從現有 Google Sheet 倒資料進來：
npm run import:sheet
```

前端開發另一個 terminal：

```bash
cd ..
npm run dev          # → http://localhost:5173，會 proxy /api 到 :3001
```

## API

公開：
- `GET  /api/config` — 完整 config
- `POST /api/booking` — 客戶送單
- `GET  /api/health`
- `GET  /api/_count` — 列數摘要 + DATA_DIR 路徑

驗證：
- `POST /api/auth/login` — `{ username, password }` → 種 cookie
- `POST /api/auth/logout`
- `GET  /api/auth/me`

Admin（須登入）：
- `GET  /api/admin/{table}`
- `PUT  /api/admin/{services|cameras|ceremonies|addons|photographers|media|settings}` — 整張覆蓋
- `POST/PUT/DELETE /api/admin/bookings[/:id]` — 單筆 CRUD（id = array index）

## 資料儲存

- 預設 `server/data/data.json`，atomic write（先寫 .tmp 再 rename）
- 路徑可用環境變數 `DATA_DIR` 改

## Zeabur 部署

repo 根目錄 `zbpack.json` 已設好。一個 service 同時 build 前端 + 跑 server。

**重要：要掛 Volume，否則重新部署會把 `data/data.json` 洗掉。**

1. 推 code 上 GitHub
2. Zeabur 建 service 連到 repo
3. 環境變數設：
   - `ADMIN_USERNAME` / `ADMIN_PASSWORD`（第一次部署用，後續可拿掉）
   - `PDF_UPLOAD_ENDPOINT`（保留 PDF 上傳到 Drive）
   - `DATA_DIR=/data`（配合下面 volume）
4. 「Volumes」分頁掛一個 volume 到 `/data` 路徑
5. 部署完進 Console（如果要倒既有 Sheet 資料）：
   ```bash
   cd server
   npm run import:sheet
   ```
   不跑也行，後台手動加資料也可以。
