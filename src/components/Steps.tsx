type Props = { current: number; total: number };

const STEP_LABELS = ['服務', '加選', '資料', '確認'];

export function Steps({ current, total }: Props) {
  return (
    <div className="steps">
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        const status = idx < current ? 'done' : idx === current ? 'active' : '';
        return (
          <div key={idx} className={`step ${status}`}>
            <div className="step-dot">{idx}</div>
            <div className="step-label">{STEP_LABELS[i] ?? `第${idx}步`}</div>
          </div>
        );
      })}
    </div>
  );
}
