import type { AppConfig, FormState } from '../types';

const findPrice = <T extends { key: string; price: number }>(rows: T[], key: string): number => {
  const r = rows.find((x) => x.key === key);
  return r ? r.price : 0;
};

export function computeTotal(state: FormState, config: AppConfig): number {
  const isV = state.svc === 'video' || state.svc === 'both';
  const isP = state.svc === 'photo' || state.svc === 'both';

  const videoBase = isV ? config.services.find((s) => s.key === 'video')?.price ?? 0 : 0;
  const photoBase = isP ? config.services.find((s) => s.key === 'photo')?.price ?? 0 : 0;

  const vc = isV ? findPrice(config.cameras.filter((c) => c.type === 'video'), state.vcKey) : 0;
  const pc = isP ? findPrice(config.cameras.filter((c) => c.type === 'photo'), state.pcKey) : 0;
  const vcer = isV ? findPrice(config.ceremonies.filter((c) => c.type === 'video'), state.vcerKey) : 0;
  const pcer = isP ? findPrice(config.ceremonies.filter((c) => c.type === 'photo'), state.pcerKey) : 0;

  const addon = state.addonKeys.reduce((sum, k) => sum + findPrice(config.addons, k), 0);

  const vp = isV
    ? findPrice(
        config.photographers.filter((p) => p.type === 'video').map((p) => ({ key: p.key, price: p.price })),
        state.vpKey,
      )
    : 0;
  const pp = isP
    ? findPrice(
        config.photographers.filter((p) => p.type === 'photo').map((p) => ({ key: p.key, price: p.price })),
        state.ppKey,
      )
    : 0;

  return videoBase + photoBase + vc + pc + vcer + pcer + addon + vp + pp;
}

export type SummaryRow = { lbl: string; val: string; amt: number | null };

export function buildSummary(state: FormState, config: AppConfig): SummaryRow[] {
  const isV = state.svc === 'video' || state.svc === 'both';
  const isP = state.svc === 'photo' || state.svc === 'both';
  const date = state.year && state.month && state.day ? `${state.year}年${state.month}月${state.day}日` : '—';
  const svcLabel = config.services.find((s) => s.key === state.svc)?.label ?? '—';
  const rows: SummaryRow[] = [
    { lbl: '婚宴日期', val: date, amt: null },
    { lbl: '服務選項', val: svcLabel, amt: null },
  ];
  const videoPrice = config.services.find((s) => s.key === 'video')?.price ?? 0;
  const photoPrice = config.services.find((s) => s.key === 'photo')?.price ?? 0;
  if (isV) {
    rows.push({ lbl: '錄影', val: `純宴客 ${videoPrice.toLocaleString('zh-TW')}元`, amt: videoPrice });
    const vc = config.cameras.find((c) => c.type === 'video' && c.key === state.vcKey);
    rows.push({ lbl: '錄影機位', val: vc?.label ?? '—', amt: vc?.price ?? 0 });
    const vcer = config.ceremonies.find((c) => c.type === 'video' && c.key === state.vcerKey);
    rows.push({ lbl: '錄影儀式', val: vcer?.label ?? '—', amt: vcer?.price ?? 0 });
  }
  if (isP) {
    rows.push({ lbl: '拍照', val: `純宴客 ${photoPrice.toLocaleString('zh-TW')}元`, amt: photoPrice });
    const pc = config.cameras.find((c) => c.type === 'photo' && c.key === state.pcKey);
    rows.push({ lbl: '拍照機位', val: pc?.label ?? '—', amt: pc?.price ?? 0 });
    const pcer = config.ceremonies.find((c) => c.type === 'photo' && c.key === state.pcerKey);
    rows.push({ lbl: '拍照儀式', val: pcer?.label ?? '—', amt: pcer?.price ?? 0 });
  }
  const pickedAddons = state.addonKeys
    .map((k) => config.addons.find((a) => a.key === k))
    .filter((a): a is NonNullable<typeof a> => !!a);
  if (pickedAddons.length === 0) {
    rows.push({ lbl: '加選項目', val: '無', amt: 0 });
  } else {
    pickedAddons.forEach((a, idx) => {
      rows.push({
        lbl: idx === 0 ? '加選項目' : '　　　　',
        val: a.label,
        amt: a.price,
      });
    });
  }
  if (isV) {
    const vp = config.photographers.find((p) => p.type === 'video' && p.key === state.vpKey);
    const name = vp ? (vp.role ? `${vp.name}（${vp.role}）` : vp.name) : '—';
    rows.push({
      lbl: `指定錄影　${name}`,
      val: name,
      amt: vp?.price ?? 0,
    });
  }
  if (isP) {
    const pp = config.photographers.find((p) => p.type === 'photo' && p.key === state.ppKey);
    const name = pp ? (pp.role ? `${pp.name}（${pp.role}）` : pp.name) : '—';
    rows.push({
      lbl: `指定攝影　${name}`,
      val: name,
      amt: pp?.price ?? 0,
    });
  }
  return rows;
}

export const fmtMoney = (n: number) => `${n.toLocaleString('zh-TW')} 元`;
