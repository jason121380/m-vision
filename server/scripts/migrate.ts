import 'dotenv/config';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, pg } from '../src/db/index.ts';

async function main() {
  console.log('[migrate] running drizzle migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] done');
  await pg.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
