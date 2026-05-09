import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { EditableTable, type ColumnSpec } from './EditableTable';
import { Modal } from './Modal';

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
  /** 用 modal 取代 EditableTable 內建的「+ 新增一列」內聯模式 */
  modalAdd?: boolean;
  /** Modal 標題前綴（modalAdd 才用），例如「新增攝影師」 */
  addLabel?: string;
  /** 哪些列是必要的（無法刪除 / 移動，但欄位仍可改） */
  locked?: (row: T) => boolean;
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
  modalAdd,
  addLabel,
  locked,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'idle'; msg: string }>({
    kind: 'idle',
    msg: '',
  });
  const [draft, setDraft] = useState<T | null>(null);

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

  const openAdd = () => setDraft(blank());
  const closeAdd = () => setDraft(null);
  const confirmAdd = () => {
    if (!draft) return;
    setRows([...rows, draft]);
    setDraft(null);
  };
  const patchDraft = (key: keyof T, val: unknown) => {
    setDraft((d) => (d ? ({ ...d, [key]: val } as T) : d));
  };

  return (
    <div>
      <h2>{title}</h2>
      {hint && <p className="admin-hint">{hint}</p>}
      <div className="admin-toolbar">
        <button className="admin-btn primary" onClick={save} disabled={saving || loading}>
          {saving ? '儲存中…' : '儲存'}
        </button>
        {modalAdd && (
          <button className="admin-btn" onClick={openAdd} disabled={loading}>
            + {addLabel ?? '新增'}
          </button>
        )}
        {loading && <span className="admin-status">載入中…</span>}
        {!loading && status.kind !== 'idle' && (
          <span className={`admin-status ${status.kind}`}>{status.msg}</span>
        )}
      </div>
      {!loading && (
        <EditableTable
          rows={rows}
          setRows={setRows}
          columns={columns}
          blank={blank}
          noAdd={modalAdd}
          locked={locked}
        />
      )}

      <Modal
        open={!!draft}
        title={addLabel ?? `新增 ${title}`}
        onClose={closeAdd}
        footer={
          <>
            <button className="admin-btn" onClick={closeAdd}>取消</button>
            <button className="admin-btn primary" onClick={confirmAdd}>新增</button>
          </>
        }
      >
        {draft && columns.map((col) => {
          const val = draft[col.key];
          return (
            <div className="adm-field" key={String(col.key)}>
              <label>{col.label}</label>
              {col.type === 'enum' ? (
                <select
                  value={String(val ?? '')}
                  onChange={(e) => patchDraft(col.key, e.target.value)}
                >
                  {(col.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {col.optionLabels?.[o] ?? o}
                    </option>
                  ))}
                </select>
              ) : col.type === 'number' ? (
                <input
                  type="number"
                  value={Number(val ?? 0)}
                  onChange={(e) => patchDraft(col.key, Number(e.target.value))}
                />
              ) : col.type === 'longtext' ? (
                <textarea
                  rows={3}
                  value={String(val ?? '')}
                  onChange={(e) => patchDraft(col.key, e.target.value)}
                />
              ) : (
                <input
                  type="text"
                  value={String(val ?? '')}
                  onChange={(e) => patchDraft(col.key, e.target.value)}
                />
              )}
            </div>
          );
        })}
      </Modal>
    </div>
  );
}
