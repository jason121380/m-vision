import { SUBMISSION_ENDPOINT_URL } from '../config';
import { buildSummary, computeTotal, fmtMoney } from './pricing';
import type { PdfResult } from './pdf';
import type { AppConfig, FormState } from '../types';

const resolveAddr = (mode: string, addr: string, hotel: string, restaurant: string): string => {
  if (mode === 'none') return '';
  if (mode === 'hotel') return hotel;
  if (mode === 'rest') return restaurant;
  return addr;
};

export type SubmissionPayload = {
  submittedAt: string;
  groom: string;
  bride: string;
  phone: string;
  eventDate: string;
  service: string;
  weddingTime: string;
  restaurant: string;
  hotel: string;
  cerWz: string;
  cerYq: string;
  cerZh: string;
  makeupTime: string;
  breakdown: string;
  total: number;
  signature: string;
  pdfBase64: string;
  pdfFilename: string;
};

export function buildPayload(state: FormState, config: AppConfig, pdf?: PdfResult): SubmissionPayload {
  const summary = buildSummary(state, config);
  const total = computeTotal(state, config);
  const breakdown = summary
    .map((r) => `${r.lbl}: ${r.amt != null ? fmtMoney(r.amt) : r.val}`)
    .join('\n');
  const eventDate =
    state.year && state.month && state.day
      ? `${state.year}-${state.month.padStart(2, '0')}-${state.day.padStart(2, '0')}`
      : '';
  const wt = state.wt === 'lunch' ? '午宴' : state.wt === 'dinner' ? '晚宴' : '';

  return {
    submittedAt: new Date().toISOString(),
    groom: state.groom,
    bride: state.bride,
    phone: state.phone,
    eventDate,
    service: config.services.find((s) => s.key === state.svc)?.label ?? '',
    weddingTime: wt,
    restaurant: state.restaurant,
    hotel: state.hotelMode === 'addr' ? state.hotel : '',
    cerWz: resolveAddr(state.wzMode, state.wz, state.hotel, state.restaurant),
    cerYq: resolveAddr(state.yqMode, state.yq, state.hotel, state.restaurant),
    cerZh: resolveAddr(state.zhMode, state.zh, state.hotel, state.restaurant),
    makeupTime: state.makeup,
    breakdown,
    total,
    signature: state.signature,
    pdfBase64: pdf?.base64 ?? '',
    pdfFilename: pdf?.filename ?? '',
  };
}

export type SubmissionResult = { ok: boolean; error?: string; pdf?: PdfResult };

export async function submitToSheet(
  state: FormState,
  config: AppConfig,
): Promise<SubmissionResult> {
  if (!SUBMISSION_ENDPOINT_URL) {
    return { ok: false, error: 'Apps Script endpoint 尚未設定（src/config.ts → SUBMISSION_ENDPOINT_URL）' };
  }

  let pdf: PdfResult | undefined;
  try {
    const { generateContractPdf } = await import('./pdf');
    pdf = await generateContractPdf(state);
  } catch (err) {
    console.warn('[submit] PDF generation failed, continuing without PDF:', err);
  }

  const payload = buildPayload(state, config, pdf);
  try {
    // text/plain 避免觸發 CORS preflight；Apps Script 端用 JSON.parse(e.postData.contents) 解析
    await fetch(SUBMISSION_ENDPOINT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return { ok: true, pdf };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), pdf };
  }
}
