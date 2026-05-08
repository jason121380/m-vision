import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pg, schema } from '../src/db/index.ts';

const USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '1234';

async function main() {
  const existing = await db
    .select()
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.username, USERNAME))
    .limit(1);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  if (existing.length > 0) {
    await db
      .update(schema.adminUsers)
      .set({ passwordHash })
      .where(eq(schema.adminUsers.username, USERNAME));
    console.log(`[seed-admin] reset password for "${USERNAME}"`);
  } else {
    await db.insert(schema.adminUsers).values({ username: USERNAME, passwordHash });
    console.log(`[seed-admin] created user "${USERNAME}" / password "${PASSWORD}"`);
  }
  await pg.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
