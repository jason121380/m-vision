import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { BookingRow } from './types';

export function BookingsView() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');

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

  return (
    <div>
      <h2>檔期 bookings</h2>
      <p className="admin-hint">
        客人送單後會自動寫入這裡。每一列代表一個日期，slots 是當天動態 / 平面場次數，camsUsed 是機位數累計，leads 是已綁主攝。誤觸送單可以從這裡刪掉。整列覆蓋這個分頁不開放（會洗掉客戶資料）。
      </p>
      {loading && <div className="admin-status">載入中…</div>}
      {err && <div className="admin-status err">{err}</div>}
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
    </div>
  );
}
