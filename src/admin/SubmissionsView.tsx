import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SubmissionRow } from './types';

export function SubmissionsView() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get<SubmissionRow[]>('/api/admin/submissions').then((res) => {
      if (res.ok) setRows(res.data);
      else setErr(`載入失敗：${res.error}`);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h2>送單紀錄 submissions</h2>
      <p className="admin-hint">最近 200 筆，由新到舊。pdfUrl 點開可下載契約 PDF。</p>
      {loading && <div className="admin-status">載入中…</div>}
      {err && <div className="admin-status err">{err}</div>}
      {!loading && (
        <table className="adt">
          <thead>
            <tr>
              <th>送單時間</th>
              <th>新人</th>
              <th>電話</th>
              <th>場次日期</th>
              <th>服務</th>
              <th>地點</th>
              <th>金額</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="adt-empty">尚無送單</td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {new Date(s.submittedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}
                </td>
                <td>{s.groom} / {s.bride}</td>
                <td>{s.phone}</td>
                <td>{s.eventDate}</td>
                <td>{s.service}</td>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.restaurant || s.hotel}
                </td>
                <td>{s.total.toLocaleString('zh-TW')}</td>
                <td>
                  {s.pdfUrl ? (
                    <a href={s.pdfUrl} target="_blank" rel="noopener noreferrer">開</a>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
