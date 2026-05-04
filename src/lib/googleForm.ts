import { GOOGLE_FORM } from '../config';
import { buildSummary, fmtMoney, computeTotal } from './pricing';
import type { AppConfig, FormState } from '../types';

const resolveAddr = (mode: string, addr: string, hotel: string, restaurant: string): string => {
  if (mode === 'none') return '';
  if (mode === 'hotel') return hotel;
  if (mode === 'rest') return restaurant;
  return addr;
};

export async function submitToGoogleForm(state: FormState, config: AppConfig): Promise<{ ok: boolean; error?: string }> {
  if (!GOOGLE_FORM.formResponseUrl) {
    return { ok: false, error: 'Google Form 尚未設定（src/config.ts → GOOGLE_FORM）' };
  }

  const summary = buildSummary(state, config);
  const total = computeTotal(state, config);

  const breakdown = summary
    .map((r) => `${r.lbl}: ${r.amt != null ? fmtMoney(r.amt) : r.val}`)
    .join('\n');

  const eventDate =
    state.year && state.month && state.day ? `${state.year}-${state.month.padStart(2, '0')}-${state.day.padStart(2, '0')}` : '';

  const wt = state.wt === 'lunch' ? '午宴' : state.wt === 'dinner' ? '晚宴' : '';

  const e = GOOGLE_FORM.entries;
  const pairs: Array<[string, string]> = [
    [e.groom, state.groom],
    [e.bride, state.bride],
    [e.phone, state.phone],
    [e.eventDate, eventDate],
    [e.service, config.services.find((s) => s.key === state.svc)?.label ?? ''],
    [e.weddingTime, wt],
    [e.restaurant, state.restaurant],
    [e.hotel, state.hotelMode === 'addr' ? state.hotel : ''],
    [e.cerWz, resolveAddr(state.wzMode, state.wz, state.hotel, state.restaurant)],
    [e.cerYq, resolveAddr(state.yqMode, state.yq, state.hotel, state.restaurant)],
    [e.cerZh, resolveAddr(state.zhMode, state.zh, state.hotel, state.restaurant)],
    [e.makeupTime, state.makeup],
    [e.breakdown, breakdown],
    [e.total, String(total)],
    [e.signature, state.signature],
  ];

  const body = new URLSearchParams();
  pairs.forEach(([k, v]) => {
    if (k) body.append(k, v ?? '');
  });

  try {
    await fetch(GOOGLE_FORM.formResponseUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    // no-cors 回應會是 opaque，無法檢查 status，假設成功
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
