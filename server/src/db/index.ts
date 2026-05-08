import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL 未設定（複製 .env.example 為 .env）');

// max=10 對應一般 Zeabur 小型 Postgres 連線數，本地 docker 也夠
export const pg = postgres(url, { max: 10 });
export const db = drizzle(pg, { schema });
export { schema };
