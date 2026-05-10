import { useState } from 'react';
import { api } from '../lib/api';

type MergeReport = {
  username: string;
  keptKey: string;
  removedKeys: string[];
  bookingsUpdated: number;
};

type Props = {
  onDone: () => void | Promise<unknown>;
};

// 一鍵把同 username 的攝影師 row 合併成一筆
// （type 變 both / 作品集分動平 / bookings + 推播訂閱 + session 都跟著改 key）
export function MergeDuplicatesButton({ onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');

  const run = async () => {
    if (!confirm('將同帳號的多筆攝影師合併成一筆，並把 bookings / session 裡的舊 key 跟著替換。建議先在後台 → 預約檔期確認沒有「正在編輯中」的狀態再執行。要繼續嗎？')) {
      return;
    }
    setBusy(true);
    setMsg('');
    const res = await api.post<{ ok: boolean; mergedGroups: number; reports: MergeReport[] }>(
      '/api/admin/photographers/merge-duplicates',
      {},
    );
    setBusy(false);
    if (!res.ok) {
      setMsg(`合併失敗：${res.error}`);
      return;
    }
    if (res.data.mergedGroups === 0) {
      setMsg('沒有重複的帳號需要合併');
    } else {
      const summary = res.data.reports
        .map(
          (r) =>
            `${r.username}：合併 ${r.removedKeys.length} 筆 → 保留 1 筆${r.bookingsUpdated > 0 ? `（更新 ${r.bookingsUpdated} 筆預約）` : ''}`,
        )
        .join('\n');
      setMsg(`已合併 ${res.data.mergedGroups} 組：\n${summary}`);
    }
    await onDone();
  };

  return (
    <>
      <button className="admin-btn" onClick={run} disabled={busy} title="把同登入帳號的多筆攝影師合併成一筆，類型自動變「平面+動態」">
        {busy ? '合併中…' : '合併重複帳號'}
      </button>
      {msg && (
        <span
          className="admin-status"
          style={{ whiteSpace: 'pre-line', fontSize: 12, marginLeft: 6 }}
        >
          {msg}
        </span>
      )}
    </>
  );
}
