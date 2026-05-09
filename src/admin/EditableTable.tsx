import { Fragment } from 'react';

export type ColumnSpec<T> = {
  key: keyof T;
  label: string;
  type: 'text' | 'number' | 'longtext' | 'enum' | 'password';
  options?: string[]; // 給 enum 用：實際值
  optionLabels?: Record<string, string>; // value → 顯示文字（中文化）
  width?: string;
};

type Props<T extends Record<string, unknown>> = {
  rows: T[];
  setRows: (rows: T[]) => void;
  columns: ColumnSpec<T>[];
  blank: () => T; // 新增 row 時的預設值
  emptyMessage?: string;
  /** 不允許新增（例如 settings 是 key-value 也用這張表） */
  noAdd?: boolean;
  /** 不允許刪除（settings 整張覆蓋時使用） */
  noDelete?: boolean;
  /** 判斷某列是否為「必要」鎖定列（無法刪除 / 排序，但欄位仍可改） */
  locked?: (row: T) => boolean;
};

export function EditableTable<T extends Record<string, unknown>>({
  rows,
  setRows,
  columns,
  blank,
  emptyMessage = '尚無資料',
  noAdd,
  noDelete,
  locked,
}: Props<T>) {
  const update = (idx: number, key: keyof T, val: unknown) => {
    const next = rows.slice();
    next[idx] = { ...next[idx]!, [key]: val } as T;
    setRows(next);
  };

  const remove = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= rows.length) return;
    const next = rows.slice();
    const a = next[idx]!;
    const b = next[target]!;
    next[idx] = b;
    next[target] = a;
    setRows(next);
  };

  const add = () => setRows([...rows, blank()]);

  return (
    <Fragment>
      <div className="adt-wrap">
      <table className="adt">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} style={col.width ? { width: col.width } : undefined}>
                {col.label}
              </th>
            ))}
            {!noDelete && <th className="actions">操作</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length + (noDelete ? 0 : 1)} className="adt-empty">
                {emptyMessage}
              </td>
            </tr>
          )}
          {rows.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => {
                const val = row[col.key];
                if (col.type === 'enum') {
                  return (
                    <td key={String(col.key)}>
                      <select
                        value={String(val ?? '')}
                        onChange={(e) => update(idx, col.key, e.target.value)}
                      >
                        {(col.options ?? []).map((o) => (
                          <option key={o} value={o}>
                            {col.optionLabels?.[o] ?? o}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                }
                if (col.type === 'number') {
                  return (
                    <td key={String(col.key)}>
                      <input
                        type="number"
                        value={Number(val ?? 0)}
                        onChange={(e) => update(idx, col.key, Number(e.target.value))}
                      />
                    </td>
                  );
                }
                if (col.type === 'longtext') {
                  return (
                    <td key={String(col.key)}>
                      <textarea
                        value={String(val ?? '')}
                        onChange={(e) => update(idx, col.key, e.target.value)}
                        rows={2}
                      />
                    </td>
                  );
                }
                if (col.type === 'password') {
                  const hasPwd = (row as { hasPassword?: boolean }).hasPassword;
                  return (
                    <td key={String(col.key)}>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder={hasPwd ? '已設定，留空 = 不變更' : '輸入密碼'}
                        value={String(val ?? '')}
                        onChange={(e) => update(idx, col.key, e.target.value)}
                      />
                    </td>
                  );
                }
                return (
                  <td key={String(col.key)}>
                    <input
                      type="text"
                      value={String(val ?? '')}
                      onChange={(e) => update(idx, col.key, e.target.value)}
                    />
                  </td>
                );
              })}
              {!noDelete && (
                <td className="actions">
                  {locked?.(row) ? (
                    <span className="adt-locked-tag">必要</span>
                  ) : (
                    <>
                      <button className="move" onClick={() => move(idx, -1)} disabled={idx === 0}>↑</button>
                      <button className="move" onClick={() => move(idx, +1)} disabled={idx === rows.length - 1}>↓</button>
                      <button className="row-del" onClick={() => remove(idx)}>刪</button>
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {!noAdd && (
        <div style={{ marginTop: 12 }}>
          <button className="admin-btn" onClick={add}>+ 新增一列</button>
        </div>
      )}
    </Fragment>
  );
}
