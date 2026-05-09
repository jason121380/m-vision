import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CeremonyRow } from './types';

type CamType = 'video' | 'photo';

const LEVELS: { key: '0' | '1' | '2' | '3'; title: string }[] = [
  { key: '0', title: '無儀式' },
  { key: '1', title: '單儀式' },
  { key: '2', title: '雙儀式' },
  { key: '3', title: '三儀式' },
];

const SECTIONS: { type: CamType; label: string }[] = [
  { type: 'video', label: '動態錄影' },
  { type: 'photo', label: '平面拍照' },
];

const isKnown = (r: CeremonyRow) =>
  (r.type === 'video' || r.type === 'photo') &&
  ['0', '1', '2', '3'].includes(r.key);

export function CeremoniesView() {
  const [rows, setRows] = useState<CeremonyRow[]>([]);
  const [extras, setExtras] = useState<CeremonyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; msg: string }>({ kind: 'idle', msg: '' });

  useEffect(() => {
    api.get<CeremonyRow[]>('/api/admin/ceremonies').then((res) => {
      if (res.ok) {
        const map = new Map<string, CeremonyRow>();
        const others: CeremonyRow[] = [];
        for (const r of res.data) {
          if (isKnown(r)) map.set(`${r.type}/${r.key}`, r);
          else others.push(r);
        }
        // 確保 8 筆都存在
        const filled: CeremonyRow[] = [];
        for (const s of SECTIONS) {
          for (const lv of LEVELS) {
            const k = `${s.type}/${lv.key}`;
            filled.push(
              map.get(k) ?? { type: s.type, key: lv.key, label: lv.title, price: 0 },
            );
          }
        }
        setRows(filled);
        setExtras(others);
      } else {
        setStatus({ kind: 'err', msg: `載入失敗：${res.error}` });
      }
      setLoading(false);
    });
  }, []);

  const patch = (type: CamType, key: string, p: Partial<CeremonyRow>) => {
    setRows((rs) =>
      rs.map((r) => (r.type === type && r.key === key ? { ...r, ...p } : r)),
    );
  };

  const save = async () => {
    setSaving(true);
    setStatus({ kind: 'idle', msg: '' });
    const res = await api.put<{ ok: boolean }>('/api/admin/ceremonies', [...rows, ...extras]);
    setSaving(false);
    if (res.ok) {
      setStatus({ kind: 'ok', msg: '已儲存' });
      setTimeout(() => setStatus({ kind: 'idle', msg: '' }), 2500);
    } else {
      setStatus({ kind: 'err', msg: `儲存失敗：${res.error}` });
    }
  };

  return (
    <div>
      <h2>儀式</h2>
      <p className="admin-hint">
        儀式數量加價（文定 / 迎娶 / 證婚共幾個的加價），動態 / 平面分開定價。
        固定四個級別（無 / 單 / 雙 / 三儀式）只開放改顯示名稱跟價格。
      </p>
      <div className="admin-toolbar">
        <button className="admin-btn primary" onClick={save} disabled={saving || loading}>
          {saving ? '儲存中…' : '儲存'}
        </button>
        {loading && <span className="admin-status">載入中…</span>}
        {!loading && status.kind !== 'idle' && (
          <span className={`admin-status ${status.kind}`}>{status.msg}</span>
        )}
      </div>

      {!loading && SECTIONS.map((s) => (
        <div key={s.type} style={{ marginBottom: 24 }}>
          <h3 className="adm-section-h">{s.label}</h3>
          <table className="adt">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>級別</th>
                <th>顯示名稱</th>
                <th style={{ width: '25%' }}>價格</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((lv) => {
                const r = rows.find((x) => x.type === s.type && x.key === lv.key);
                if (!r) return null;
                return (
                  <tr key={lv.key}>
                    <td><div style={{ fontWeight: 600 }}>{lv.title}</div></td>
                    <td>
                      <input
                        type="text"
                        value={r.label}
                        onChange={(e) => patch(s.type, r.key, { label: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={r.price}
                        onChange={(e) => patch(s.type, r.key, { price: Number(e.target.value) })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
