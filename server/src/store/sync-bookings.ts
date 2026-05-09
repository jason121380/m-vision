import type { BookingRow } from './types.ts';

/**
 * 把整份 bookings 陣列推到 Apps Script 的 doPost (action='syncBookings')
 * → 它會把資料覆寫進備份 Sheet 的 bookings 分頁。
 *
 * fire-and-forget：失敗只 log，不擋呼叫端的 response。
 *
 * Endpoint 解析順序：BOOKINGS_SYNC_ENDPOINT 先；沒設就退到 PDF_UPLOAD_ENDPOINT
 * （兩條 action 共用同一支 Apps Script Web App URL）。
 */
export async function syncBookingsToSheet(bookings: BookingRow[]): Promise<void> {
  const endpoint = process.env.BOOKINGS_SYNC_ENDPOINT || process.env.PDF_UPLOAD_ENDPOINT;
  if (!endpoint) {
    console.warn('[bookings-sync] no endpoint set, skipping');
    return;
  }
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'syncBookings', bookings }),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; error?: string; count?: number }
      | null;
    if (!json?.ok) {
      console.warn('[bookings-sync] returned error:', json);
    } else {
      console.info(`[bookings-sync] synced ${json.count ?? '?'} rows`);
    }
  } catch (err) {
    console.warn('[bookings-sync] threw:', err);
  }
}
