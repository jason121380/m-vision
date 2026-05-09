import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EditableTable, type ColumnSpec } from './EditableTable';

type Props<T extends Record<string, unknown>> = {
  title: string;
  hint?: string;
  /** 從 GET /api/admin/{path} 取列 */
  path: string;
  /** PUT 整張覆蓋的 endpoint，預設同 path */
  putPath?: string;
  columns: ColumnSpec<T>[];
  blank: () => T;
  /** 從 GET 結果到 array（例如 settings 也是 array of {key,value}） */
  pickRows?: (raw: unknown) => T[];
  /** 寫回前的 cleanup（移除 sortOrder=0 的 placeholder 等） */
  serialize?: (rows: T[]) => unknown;
};

export function Editor<T extends Record<string, unknown>>({
  title,
  hint,
  path,
  putPath,
  columns,
  blank,
  pickRows,
  serialize,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'idle'; msg: string }>({
    kind: 'idle',
    msg: '',
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get<unknown>(`/api/admin/${path}`).then((res) => {
      if (!alive) return;
      if (res.ok) {
        const data = pickRows ? pickRows(res.data) : (res.data as T[]);
        setRows(Array.isArray(data) ? data : []);
        setStatus({ kind: 'idle', msg: '' });
      } else {
        setStatus({ kind: 'err', msg: `載入失敗：${res.error}` });
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [path, pickRows]);

  const save = async () => {
    setSaving(true);
    setStatus({ kind: 'idle', msg: '' });
    const body = serialize ? serialize(rows) : rows;
    const res = await api.put<{ ok: boolean }>(`/api/admin/${putPath ?? path}`, body);
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
      <h2>{title}</h2>
      {hint && <p className="admin-hint">{hint}</p>}
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
        <EditableTable rows={rows} setRows={setRows} columns={columns} blank={blank} />
      )}
    </div>
  );
}
