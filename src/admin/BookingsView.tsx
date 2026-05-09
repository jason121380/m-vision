import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Modal } from './Modal';
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
      <h2>預約檔期</h2>
      <p className="admin-hint">
        每一列代表「某一天的預約佔用情況」。客戶送單會自動累加進來，你也可以手動新增（例如老闆自己有檔期要先擋住的日子）。
        欄位意義：動態 / 平面場次（當天接了幾組）、動態 / 平面機位（多組合計幾台機）、動態 / 平面主攝（已被綁住的攝影師 key，逗號分隔）。
        當這些數字達到「基本資料」裡 max_*_per_day 的上限，前台行事曆 / 機位 / 攝影師會自動變灰。想擋整天 → 把 slots 填到上限；想擋某攝影師 → 把他的 key 加到 leads。
      </p>
      <div className="admin-toolbar">
        <button className="admin-btn primary" onClick={() => setDraft(blankDraft())}>
          + 新增檔期
        </button>
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
            {rows.length === 0 && (
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

      <Modal
        open={!!draft}
        title="新增檔期"
        onClose={() => {
          setDraft(null);
          setErr('');
        }}
        footer={
          <>
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
            <button className="admin-btn primary" onClick={saveDraft} disabled={saving}>
              {saving ? '儲存中…' : '新增'}
            </button>
          </>
        }
      >
        {draft && (
          <>
            <div className="adm-field">
              <label>日期</label>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => patchDraft({ date: e.target.value })}
              />
            </div>
            <div className="adm-field-row">
              <div className="adm-field">
                <label>動態場次</label>
                <input
                  type="number"
                  min={0}
                  value={draft.videoSlots}
                  onChange={(e) => patchDraft({ videoSlots: Number(e.target.value) })}
                />
              </div>
              <div className="adm-field">
                <label>動態機位</label>
                <input
                  type="number"
                  min={0}
                  value={draft.videoCamsUsed}
                  onChange={(e) => patchDraft({ videoCamsUsed: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="adm-field">
              <label>動態主攝（key 逗號分隔）</label>
              <input
                type="text"
                value={draft.videoLeads.join(',')}
                placeholder="例如：le, jb"
                onChange={(e) => patchDraft({ videoLeads: splitLeads(e.target.value) })}
              />
            </div>
            <div className="adm-field-row">
              <div className="adm-field">
                <label>平面場次</label>
                <input
                  type="number"
                  min={0}
                  value={draft.photoSlots}
                  onChange={(e) => patchDraft({ photoSlots: Number(e.target.value) })}
                />
              </div>
              <div className="adm-field">
                <label>平面機位</label>
                <input
                  type="number"
                  min={0}
                  value={draft.photoCamsUsed}
                  onChange={(e) => patchDraft({ photoCamsUsed: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="adm-field">
              <label>平面主攝（key 逗號分隔）</label>
              <input
                type="text"
                value={draft.photoLeads.join(',')}
                placeholder="例如：ryan, zhh"
                onChange={(e) => patchDraft({ photoLeads: splitLeads(e.target.value) })}
              />
            </div>
            <div className="adm-field">
              <label>備註</label>
              <input
                type="text"
                value={draft.notes}
                onChange={(e) => patchDraft({ notes: e.target.value })}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
