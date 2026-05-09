import 'dotenv/config';
import { importFromSheet } from '../src/store/import-sheet.ts';

async function main() {
  console.log('[import] fetching CSVs...');
  const result = await importFromSheet();
  const summary = Object.entries(result.counts)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.log(`[import] rows: ${summary || '(none)'}`);
  if (result.skipped.length > 0) {
    console.warn('[import] skipped tabs:');
    for (const k of result.skipped) {
      console.warn(`  - ${k}: ${result.errors[k]}`);
    }
  }
  console.log('[import] done — wrote to data/data.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
