# m-vision-server

Hono + Drizzle + Postgres 後端，取代 Google Apps Script + Sheet。

## 本地起服務

需要 Docker + Node 20。

```bash
# 1. 起 Postgres
docker compose up -d        # 在 repo 根目錄

# 2. 設定 env
cp server/.env.example server/.env
# 編輯 server/.env，至少把 SESSION_SECRET 換掉

# 3. 安裝依賴
cd server
npm install

# 4. 建表（drizzle-kit push 直接套 schema，不走 migration 檔案）
npm run db:push

# 5. 建 admin 帳號（預設 admin / 1234）
npm run seed:admin
# 或自訂：ADMIN_USERNAME=foo ADMIN_PASSWORD=bar npm run seed:admin

# 6. 從 Google Sheet 倒既有資料（一次性）
npm run import:sheet

# 7. 啟動
npm run dev
# → http://localhost:3001
```

## API

公開：

- `GET  /api/config` — 完整 config（前端 useConfig 會打）
- `POST /api/booking` — 客戶送單，會寫 submissions + 累加 bookings
- `GET  /api/health`

驗證：

- `POST /api/auth/login` — `{ username, password }` → 種 session cookie
- `POST /api/auth/logout`
- `GET  /api/auth/me`

Admin（須登入）：

- `GET  /api/admin/{services|cameras|ceremonies|addons|photographers|media|settings|bookings|submissions}`
- `PUT  /api/admin/{services|cameras|ceremonies|addons|photographers|media|settings}` — 整張覆蓋
- `POST/PUT/DELETE /api/admin/bookings[/:id]` — 單筆 CRUD

## Zeabur 部署

repo 根目錄是前端 Vite SPA，`server/` 是後端。Zeabur 設定兩個服務：

1. 前端 service：root `/`，build = `npm run build`，static publish dir `dist`
2. 後端 service：root `/server`，環境變數設 `DATABASE_URL` `SESSION_SECRET` `CORS_ORIGINS=https://m-vision.zeabur.app` `PDF_UPLOAD_ENDPOINT`

Postgres 用 Zeabur 的 Managed Postgres，把 connection string 設成後端 service 的 `DATABASE_URL`。

第一次部署完跑：

```bash
# Zeabur shell 或本地連線到 Zeabur Postgres
npm run db:push
ADMIN_USERNAME=admin ADMIN_PASSWORD=1234 npm run seed:admin
npm run import:sheet
```
