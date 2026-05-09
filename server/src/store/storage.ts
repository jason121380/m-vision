import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DataShape } from './types.ts';

/*
 * 簡易檔案資料庫：所有資料放在 DATA_DIR/data.json 一個檔案。
 * 寫入用 「先寫 .tmp 再 rename」確保 atomic（同分割區的 rename 是 POSIX 原子操作）。
 * 讀取用記憶體 cache，啟動時讀一次，所有寫入都同步更新 cache。
 * 用一個 mutex chain 序列化寫入，避免兩支同時寫造成最後一筆贏的競態。
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = resolve(__dirname, '../../data');

const DATA_DIR = process.env.DATA_DIR ? resolve(process.env.DATA_DIR) : DEFAULT_DATA_DIR;
const DATA_FILE = resolve(DATA_DIR, 'data.json');

const EMPTY: DataShape = {
  services: [],
  cameras: [],
  ceremonies: [],
  addons: [],
  photographers: [],
  media: [],
  settings: {},
  bookings: [],
  submissions: [],
  admins: [],
  nextSubmissionId: 1,
  nextAdminId: 1,
};

let cache: DataShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<DataShape> {
  if (cache) return cache;
  await mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DataShape>;
    cache = { ...EMPTY, ...parsed };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      cache = { ...EMPTY };
      await persistRaw(cache);
    } else {
      throw err;
    }
  }
  return cache!;
}

async function persistRaw(data: DataShape): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, DATA_FILE);
}

/** 序列化寫入：把所有 write 串成一條 chain，避免並發時互蓋 */
export async function read(): Promise<DataShape> {
  return load();
}

export async function update(mutator: (d: DataShape) => void | Promise<void>): Promise<DataShape> {
  await load();
  let next: DataShape | undefined;
  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      const cur = cache!;
      // 在 cache 上直接 mutate（簡單但有效）
      await mutator(cur);
      await persistRaw(cur);
      next = cur;
    });
  await writeChain;
  return next!;
}

/** Debug / 健康檢查用 */
export function dataDir(): string {
  return DATA_DIR;
}

/** 清掉記憶體 cache 強制下次重讀（測試或外部直接改檔案後使用） */
export function invalidate(): void {
  cache = null;
}
