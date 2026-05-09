import { Fragment, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SubmissionRow } from './types';

const COL_COUNT = 9;

export function SubmissionsView() {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    api.get<SubmissionRow[]>('/api/admin/submissions').then((res) => {
      if (res.ok) setRows(res.data);
      else setErr(`載入失敗：${res.error}`);
      setLoading(false);
    });
  }, []);

  const removeRow = async (id: number) => {
    if (!confirm('確定刪除這筆收單？同步把對應的預約檔期累加扣回去。')) return;
    setBusyId(id);
    const res = await api.del<{ ok: boolean }>(`/api/admin/submissions/${id}`);
    setBusyId(null);
    if (res.ok) {
      setRows(rows.filter((r) => r.id !== id));
      if (expandedId === id) setExpandedId(null);
    } else {
      setErr(`刪除失敗：${res.error}`);
    }
  };

  const toggle = (id: number) => {
    setExpandedId((cur) => (cur === id ? null : id));
  };

  return (
    <div>
      <h2>收單紀錄</h2>
      <p className="admin-hint">
        客戶送出表單會自動寫一筆紀錄到這裡，由新到舊排，最多顯示 200 筆。
        點「展開」會展開該筆所有客戶選擇的細節（地址、儀式、簽名等），點「PDF」會打開 Drive 上的契約 PDF。
        點「刪」會把這筆紀錄刪掉，並且自動把當天「預約檔期」裡對應的數字扣回去（避免錯誤紀錄占住客人實際還能用的檔期）。
      </p>
      {loading && <div className="admin-status">載入中…</div>}
      {err && <div className="admin-status err">{err}</div>}
      {!loading && (
        <table className="adt">
          <thead>
            <tr>
              <th>收單時間</th>
              <th>新人</th>
              <th>電話</th>
              <th>場次日期</th>
              <th>服務</th>
              <th>地點</th>
              <th>金額</th>
              <th>PDF</th>
              <th className="actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COL_COUNT} className="adt-empty">尚無收單</td>
              </tr>
            )}
            {rows.map((s) => {
              const expanded = expandedId === s.id;
              return (
                <Fragment key={s.id}>
                  <tr>
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
                    <td className="actions">
                      <button className="move" onClick={() => toggle(s.id)}>
                        {expanded ? '收合' : '展開'}
                      </button>
                      <button
                        className="row-del"
                        onClick={() => removeRow(s.id)}
                        disabled={busyId === s.id}
                      >
                        {busyId === s.id ? '...' : '刪'}
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="adt-detail">
                      <td colSpan={COL_COUNT}>
                        <SubmissionDetails s={s} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SubmissionDetails({ s }: { s: SubmissionRow }) {
  const fields: { lbl: string; val: string }[] = [
    { lbl: '先生', val: s.groom },
    { lbl: '太太', val: s.bride },
    { lbl: '電話', val: s.phone },
    { lbl: '婚宴日期', val: s.eventDate },
    { lbl: '宴客時間', val: s.weddingTime || '—' },
    { lbl: '餐廳地址', val: s.restaurant || '—' },
    { lbl: '飯店地址', val: s.hotel || '—' },
    { lbl: '文定儀式', val: s.cerWz || '—' },
    { lbl: '迎娶儀式', val: s.cerYq || '—' },
    { lbl: '證婚儀式', val: s.cerZh || '—' },
    { lbl: '新秘開妝', val: s.makeupTime || '—' },
    { lbl: '服務內容', val: s.service },
    { lbl: '合計', val: `${s.total.toLocaleString('zh-TW')} 元` },
  ];

  return (
    <div className="adt-detail-grid">
      <div className="adt-detail-fields">
        {fields.map((f) => (
          <div className="adt-detail-row" key={f.lbl}>
            <div className="adt-detail-lbl">{f.lbl}</div>
            <div className="adt-detail-val">{f.val}</div>
          </div>
        ))}
      </div>
      {s.breakdown && (
        <div className="adt-detail-block">
          <div className="adt-detail-h">費用明細</div>
          <pre className="adt-detail-pre">{s.breakdown}</pre>
        </div>
      )}
      {s.signature && (
        <div className="adt-detail-block">
          <div className="adt-detail-h">甲方簽名</div>
          <img src={s.signature} alt="signature" className="adt-detail-sig" />
        </div>
      )}
    </div>
  );
}
