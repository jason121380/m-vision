import type { AddrMode, AppConfig, FormState, TimeKey } from '../types';
import { Summary } from './Summary';
import { buildSummary, computeTotal, fmtMoney } from '../lib/pricing';

type Props = {
  state: FormState;
  update: (patch: Partial<FormState>) => void;
  config: AppConfig;
};

const optClass = (sel: boolean) => `opt${sel ? ' sel' : ''}`;
const chipClass = (sel: boolean) => `chip${sel ? ' sel' : ''}`;

const ADDR_MODES: { key: AddrMode; label: string }[] = [
  { key: 'none', label: '無' },
  { key: 'hotel', label: '同飯店' },
  { key: 'rest', label: '同餐廳' },
  { key: 'addr', label: '填地址' },
];

export function Page3({ state, update, config }: Props) {
  const summary = buildSummary(state, config);
  const total = computeTotal(state, config);

  return (
    <div className="page active">
      <div className="pnum">03</div>

      <div className="fg">
        <div className="flbl"><span className="req-dot" />先生姓名（必填）</div>
        <input
          className="tinput"
          type="text"
          placeholder="請輸入"
          value={state.groom}
          onChange={(e) => update({ groom: e.target.value })}
        />
      </div>
      <div className="fg">
        <div className="flbl"><span className="req-dot" />太太姓名（必填）</div>
        <input
          className="tinput"
          type="text"
          placeholder="請輸入"
          value={state.bride}
          onChange={(e) => update({ bride: e.target.value })}
        />
      </div>
      <div className="fg">
        <div className="flbl"><span className="req-dot" />手機號碼（必填）</div>
        <input
          className="tinput"
          type="tel"
          placeholder="0912-345-678"
          value={state.phone}
          onChange={(e) => update({ phone: e.target.value })}
        />
      </div>

      <div className="fg">
        <div className="flbl">宴客時間（必填）</div>
        <div className="card">
          {(['lunch', 'dinner'] as const).map((t) => (
            <div
              key={t}
              className={optClass(state.wt === t)}
              onClick={() => update({ wt: t as TimeKey })}
            >
              <div className="rc">
                <div className="rd" />
              </div>
              <div className="opt-t">{t === 'lunch' ? '午宴' : '晚宴'}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="fg">
        <div className="flbl">餐廳地址（必填）</div>
        <input
          className="tinput"
          type="text"
          placeholder="請輸入餐廳地址"
          value={state.restaurant}
          onChange={(e) => update({ restaurant: e.target.value })}
        />
      </div>

      <div className="fg">
        <div className="flbl">飯店地址</div>
        <div className="chips">
          <div className={chipClass(state.hotelMode === 'none')} onClick={() => update({ hotelMode: 'none' })}>
            無
          </div>
          <div className={chipClass(state.hotelMode === 'addr')} onClick={() => update({ hotelMode: 'addr' })}>
            填地址
          </div>
        </div>
        {state.hotelMode === 'addr' && (
          <input
            className="tinput"
            type="text"
            placeholder="飯店地址"
            value={state.hotel}
            onChange={(e) => update({ hotel: e.target.value })}
          />
        )}
      </div>

      <CerField
        label="文定儀式地址"
        mode={state.wzMode}
        value={state.wz}
        onMode={(m) => update({ wzMode: m })}
        onValue={(v) => update({ wz: v })}
        placeholder="文定儀式地址"
      />
      <CerField
        label="迎娶儀式地址"
        mode={state.yqMode}
        value={state.yq}
        onMode={(m) => update({ yqMode: m })}
        onValue={(v) => update({ yq: v })}
        placeholder="迎娶儀式地址"
      />
      <CerField
        label="證婚儀式地址"
        mode={state.zhMode}
        value={state.zh}
        onMode={(m) => update({ zhMode: m })}
        onValue={(v) => update({ zh: v })}
        placeholder="證婚儀式地址"
      />

      <div className="fg">
        <div className="flbl">新秘老師開妝時間</div>
        <input
          className="tinput"
          type="text"
          placeholder="如：07:00"
          value={state.makeup}
          onChange={(e) => update({ makeup: e.target.value })}
        />
      </div>

      <div className="fg">
        <div className="flbl">費用明細</div>
        <Summary rows={summary} />
        <div className="total-bar">
          <div className="total-lbl">合計</div>
          <div className="total-amt">{fmtMoney(total)}</div>
        </div>
      </div>
      <div className="sp" />
    </div>
  );
}

type CerFieldProps = {
  label: string;
  mode: AddrMode;
  value: string;
  placeholder: string;
  onMode: (mode: AddrMode) => void;
  onValue: (value: string) => void;
};

function CerField({ label, mode, value, placeholder, onMode, onValue }: CerFieldProps) {
  return (
    <div className="fg">
      <div className="flbl">{label}</div>
      <div className="chips">
        {ADDR_MODES.map((m) => (
          <div key={m.key} className={chipClass(mode === m.key)} onClick={() => onMode(m.key)}>
            {m.label}
          </div>
        ))}
      </div>
      {mode === 'addr' && (
        <input
          className="tinput"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onValue(e.target.value)}
        />
      )}
    </div>
  );
}
