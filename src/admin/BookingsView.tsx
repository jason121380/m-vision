import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { BookingRow } from './types';

type Draft = Omit<BookingRow, 'id'>;

const blankDraft = (): Draft => ({
  date: '',
  videoSlots: 0,
  photoSlots: 0,
  videoCamsUsed: 0,
  photoCamsUsed: 0,
  videoLeads: [],
  photoLeads: [],
  notes: '',
});

const splitLeads = (s: string): string[] =>
  s.split(',').map((x) => x.trim()).filter(Boolean);

export function BookingsView() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.get<BookingRow[]>('/api/admin/bookings');
    if (res.ok) {
      setRows(res.data);
      setErr('');
    } else {
      setErr(`載入失敗：${res.error}`);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const removeRow = async (id: number) => {
    if (!confirm('確定刪除這筆檔期？')) return;
    setBusyId(id);
    const res = await api.del<{ ok: boolean }>(`/api/admin/bookings/${id}`);
    setBusyId(null);
    if (res.ok) {
      setRows(rows.filter((r) => r.id !== id));
    } else {
      setErr(`刪除失敗：${res.error}`);
    }
  };

  const patchDraft = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      setErr('日期格式錯誤，請填 YYYY-MM-DD');
      return;
    }
    setSaving(true);
    setErr('');
    const res = await api.post<{ ok: boolean }>('/api/admin/bookings', draft);
    setSaving(false);
    if (res.ok) {
      setDraft(null);
      load();
    } else {
      setErr(`新增失敗：${res.error}`);
    }
  };

  return (
    <div>
      <h2>預約檔期 bookings</h2>
      <p className="admin-hint">
        客人送單後會自動寫入這裡。每一列代表一個日期，slots 是當天動態 / 平面場次數，camsUsed 是機位數累計，leads 是已綁主攝（key 用逗號分隔）。可以手動新增或刪除。
      </p>
      <div className="admin-toolbar">
        {!draft && (
          <button className="admin-btn primary" onClick={() => setDraft(blankDraft())}>
            + 新增檔期
          </button>
        )}
        {err && <span className="admin-status err">{err}</span>}
      </div>
      {loading && <div className="admin-status">載入中…</div>}
      {!loading && (
        <table className="adt">
          <thead>
            <tr>
              <th>日期</th>
              <th>動態場次</th>
              <th>動態機位</th>
              <th>動態主攝</th>
              <th>平面場次</th>
              <th>平面機位</th>
              <th>平面主攝</th>
              <th>備註</th>
              <th className="actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {draft && (
              <tr>
                <td>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => patchDraft({ date: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={draft.videoSlots}
                    onChange={(e) => patchDraft({ videoSlots: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={draft.videoCamsUsed}
                    onChange={(e) => patchDraft({ videoCamsUsed: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={draft.videoLeads.join(',')}
                    placeholder="逗號分隔"
                    onChange={(e) => patchDraft({ videoLeads: splitLeads(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={draft.photoSlots}
                    onChange={(e) => patchDraft({ photoSlots: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={draft.photoCamsUsed}
                    onChange={(e) => patchDraft({ photoCamsUsed: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={draft.photoLeads.join(',')}
                    placeholder="逗號分隔"
                    onChange={(e) => patchDraft({ photoLeads: splitLeads(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={draft.notes}
                    onChange={(e) => patchDraft({ notes: e.target.value })}
                  />
                </td>
                <td className="actions">
                  <button className="admin-btn primary" onClick={saveDraft} disabled={saving}>
                    {saving ? '...' : '儲存'}
                  </button>
                  <button
                    className="admin-btn"
                    onClick={() => {
                      setDraft(null);
                      setErr('');
                    }}
                    disabled={saving}
                  >
                    取消
                  </button>
                </td>
              </tr>
            )}
            {rows.length === 0 && !draft && (
              <tr>
                <td colSpan={9} className="adt-empty">尚無檔期</td>
              </tr>
            )}
            {rows.map((b) => (
              <tr key={b.id}>
                <td><strong>{b.date}</strong></td>
                <td>{b.videoSlots}</td>
                <td>{b.videoCamsUsed}</td>
                <td>{b.videoLeads.join(', ') || '—'}</td>
                <td>{b.photoSlots}</td>
                <td>{b.photoCamsUsed}</td>
                <td>{b.photoLeads.join(', ') || '—'}</td>
                <td>{b.notes}</td>
                <td className="actions">
                  <button
                    className="row-del"
                    onClick={() => removeRow(b.id!)}
                    disabled={busyId === b.id}
                  >
                    {busyId === b.id ? '...' : '刪'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
