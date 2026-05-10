import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function AnnouncementView() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'idle'; msg: string }>({
    kind: 'idle',
    msg: '',
  });

  useEffect(() => {
    api.get<{ text: string }>('/api/admin/announcement').then((res) => {
      if (res.ok) {
        setText(res.data.text ?? '');
        setStatus({ kind: 'idle', msg: '' });
      } else {
        setStatus({ kind: 'err', msg: `載入失敗：${res.error}` });
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus({ kind: 'idle', msg: '' });
    const res = await api.put<{ ok: boolean }>('/api/admin/announcement', { text });
    setSaving(false);
    if (res.ok) {
      setStatus({ kind: 'ok', msg: '已儲存' });
      setTimeout(() => setStatus({ kind: 'idle', msg: '' }), 2500);
    } else {
      setStatus({ kind: 'err', msg: `儲存失敗：${res.error}` });
    }
  };

  const clear = async () => {
    if (!confirm('確定清除公告？所有攝影師將不再看到內容。')) return;
    setText('');
    setSaving(true);
    setStatus({ kind: 'idle', msg: '' });
    const res = await api.put<{ ok: boolean }>('/api/admin/announcement', { text: '' });
    setSaving(false);
    if (res.ok) {
      setStatus({ kind: 'ok', msg: '已清除' });
      setTimeout(() => setStatus({ kind: 'idle', msg: '' }), 2500);
    } else {
      setStatus({ kind: 'err', msg: `清除失敗：${res.error}` });
    }
  };

  return (
    <div>
      <h2>發佈公告</h2>
      <p className="admin-hint">
        寫在這裡的文字會顯示在攝影師專區（/booking）行事曆上方，所有登入的攝影師都看得到。
        留空儲存等於不顯示公告。支援多行純文字（不解析 markdown 或 HTML）。
      </p>
      <div className="admin-toolbar">
        <button className="admin-btn primary" onClick={save} disabled={saving || loading}>
          {saving ? '儲存中…' : '儲存公告'}
        </button>
        <button className="admin-btn" onClick={clear} disabled={saving || loading || !text}>
          清除
        </button>
        {loading && <span className="admin-status">載入中…</span>}
        {!loading && status.kind !== 'idle' && (
          <span className={`admin-status ${status.kind}`}>{status.msg}</span>
        )}
      </div>
      {!loading && (
        <div className="adm-settings-form">
          <div className="adm-field">
            <label>公告內容</label>
            <textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="例：本週六公司大樓停電，當日器材請提前到 5 樓領取。"
            />
          </div>
        </div>
      )}
    </div>
  );
}
