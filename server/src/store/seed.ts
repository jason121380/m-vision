import bcrypt from 'bcryptjs';
import { read, update } from './storage.ts';

/**
 * 啟動時呼叫一次：如果沒有任何 admin 就建一個（預設 admin/1234）。
 * 既有 admin 不會被覆蓋；要重置密碼請改 env ADMIN_PASSWORD 並刪掉 data/data.json
 * 裡的 admin user，或寫個獨立 script。
 */
export async function ensureAdmin(): Promise<void> {
  const data = await read();
  if (data.admins.length > 0) return;
  const username = process.env.ADMIN_USERNAME ?? 'admin';
  const password = process.env.ADMIN_PASSWORD ?? '1234';
  const passwordHash = await bcrypt.hash(password, 10);
  await update((d) => {
    d.admins.push({ id: d.nextAdminId++, username, passwordHash });
  });
  console.log(`[seed] created admin "${username}"`);
}
