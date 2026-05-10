import { useEffect, useRef, useState } from 'react';
import { apiFetch, apiUrl } from '../lib/api';
import { TrashIcon } from './TrashIcon';

type MediaItem = {
  id: number;
  type: 'image' | 'video';
  url: string;
  alt: string;
  poster: string;
};

export function MediaView() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'idle'; msg: string }>({
    kind: 'idle',
    msg: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<MediaItem[]>('/api/admin/media');
    if (res.ok) {
      setItems(res.data);
      setStatus({ kind: 'idle', msg: '' });
    } else {
      setStatus({ kind: 'err', msg: `載入失敗：${res.error}` });
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const onPick = () => fileInputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset 讓同一檔可再次選擇
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setStatus({ kind: 'err', msg: '只接受圖片或影片檔案' });
      return;
    }

    setUploading(true);
    setStatus({ kind: 'idle', msg: `上傳中（${(file.size / 1024 / 1024).toFixed(1)}MB）…` });
    const fd = new FormData();
    fd.append('file', file);
    fd.append('alt', file.name);
    try {
      const res = await fetch(apiUrl('/api/admin/media'), {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; row?: MediaItem; error?: string }
        | null;
      if (!res.ok || !json?.ok) {
        setStatus({ kind: 'err', msg: `上傳失敗：${json?.error ?? res.statusText}` });
      } else {
        setStatus({ kind: 'ok', msg: '已上傳' });
        setTimeout(() => setStatus({ kind: 'idle', msg: '' }), 2500);
        load();
      }
    } catch (err) {
      setStatus({ kind: 'err', msg: `上傳錯誤：${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('確定刪除這個 Banner？前台會立即生效。')) return;
    setBusyId(id);
    const res = await apiFetch<{ ok: boolean }>(`/api/admin/media/${id}`, { method: 'DELETE' });
    setBusyId(null);
    if (res.ok) {
      setStatus({ kind: 'ok', msg: '已刪除' });
      setTimeout(() => setStatus({ kind: 'idle', msg: '' }), 2500);
      load();
    } else {
      setStatus({ kind: 'err', msg: `刪除失敗：${res.error}` });
    }
  };

  return (
    <div>
      <h2>網站 Banner</h2>
      <p className="admin-hint">
        客戶在預約頁第一頁看到的輪播圖 / 影片，依清單順序播放。可上傳圖片（.jpg / .png / .webp 等）或影片（.mp4 / .webm 等），單檔上限 100MB。
        留空 → 客戶頁不顯示輪播。
      </p>
      <div className="admin-toolbar">
        <button className="admin-btn primary" onClick={onPick} disabled={uploading || loading}>
          {uploading ? '上傳中…' : '+ 上傳檔案'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={onFile}
        />
        {loading && <span className="admin-status">載入中…</span>}
        {!loading && status.kind !== 'idle' && (
          <span className={`admin-status ${status.kind}`}>{status.msg}</span>
        )}
      </div>

      {!loading && items.length === 0 && (
        <div className="adt-empty" style={{ padding: 60, background: 'var(--bg-card)', border: '1px dashed var(--line)', borderRadius: 12 }}>
          尚未上傳任何 Banner，前台不會顯示輪播
        </div>
      )}

      {!loading && items.length > 0 && (
        <div className="media-grid">
          {items.map((m) => (
            <div className="media-card" key={`${m.id}-${m.url}`}>
              <div className="media-preview">
                {m.type === 'image' ? (
                  <img src={apiUrl(m.url)} alt={m.alt} />
                ) : (
                  <video src={apiUrl(m.url)} controls muted playsInline preload="metadata" />
                )}
              </div>
              <div className="media-meta">
                <div className="media-name" title={m.alt}>{m.alt || m.url}</div>
                <div className="media-type">{m.type === 'image' ? '圖片' : '影片'}</div>
              </div>
              <button
                className="row-del media-del"
                onClick={() => remove(m.id)}
                disabled={busyId === m.id}
                aria-label="刪除"
                title="刪除"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
