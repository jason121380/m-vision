import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { ServiceRow } from './types';

const KNOWN: { key: 'video' | 'photo' | 'both'; title: string; hint: string }[] = [
  { key: 'video', title: '動態錄影', hint: '只錄影的基本費' },
  { key: 'photo', title: '平面拍照', hint: '只拍照的基本費' },
  { key: 'both', title: '動態＋平面', hint: '兩個都要時的選項；價格通常設 0（系統會把動態 + 平面自動加總）' },
];

const KNOWN_KEYS: Set<string> = new Set(KNOWN.map((k) => k.key));

export function ServicesView() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [extras, setExtras] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'ok' | 'err'; msg: string }>({ kind: 'idle', msg: '' });

  useEffect(() => {
    api.get<ServiceRow[]>('/api/admin/services').then((res) => {
      if (res.ok) {
        const map = new Map<string, ServiceRow>();
        const others: ServiceRow[] = [];
        for (const r of res.data) {
          if (KNOWN_KEYS.has(r.key)) map.set(r.key, r);
          else if (r.key) others.push(r);
        }
        setRows(KNOWN.map((k) => map.get(k.key) ?? { key: k.key, label: k.title, price: 0 }));
        setExtras(others);
      } else {
        setStatus({ kind: 'err', msg: `載入失敗：${res.error}` });
      }
      setLoading(false);
    });
  }, []);

  const patch = (key: string, p: Partial<ServiceRow>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  };

  const save = async () => {
    setSaving(true);
    setStatus({ kind: 'idle', msg: '' });
    const res = await api.put<{ ok: boolean }>('/api/admin/services', [...rows, ...extras]);
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
      <h2>服務選項</h2>
      <p className="admin-hint">
        客戶第一頁的服務選項固定三項（動態 / 平面 / 動態＋平面），只開放改顯示名稱跟價格。
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
      {!loading && (
        <div className="adt-wrap">
        <table className="adt">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>服務</th>
              <th>顯示名稱</th>
              <th style={{ width: '20%' }}>價格</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const def = KNOWN[i]!;
              return (
                <tr key={r.key}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{def.title}</div>
                    <div className="adm-cell-hint">{def.hint}</div>
                  </td>
                  <td>
                    <input
                      type="text"
                      value={r.label}
                      onChange={(e) => patch(r.key, { label: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={r.price}
                      onChange={(e) => patch(r.key, { price: Number(e.target.value) })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
