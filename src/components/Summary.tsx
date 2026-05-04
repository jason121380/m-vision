import { fmtMoney, type SummaryRow } from '../lib/pricing';

type Props = { rows: SummaryRow[] };

export function Summary({ rows }: Props) {
  return (
    <div className="card">
      {rows.map((r, idx) => (
        <div className="sitem" key={idx}>
          <div className="snum">{idx + 1}</div>
          <div className="slbl">{r.lbl}</div>
          <div className="sval">{r.amt != null ? fmtMoney(r.amt) : r.val}</div>
        </div>
      ))}
    </div>
  );
}
