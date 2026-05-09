import 'dotenv/config';
import { importFromSheet } from '../src/store/import-sheet.ts';

async function main() {
  console.log('[import] fetching CSVs...');
  const counts = await importFromSheet();
  console.log(
    `[import] rows: services=${counts.services} cameras=${counts.cameras} ceremonies=${counts.ceremonies} addons=${counts.addons} photographers=${counts.photographers} media=${counts.media} settings=${counts.settings} bookings=${counts.bookings}`,
  );
  console.log('[import] done — wrote to data/data.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
