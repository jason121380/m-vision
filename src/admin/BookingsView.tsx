import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { Avatar } from './Avatar';
import { Modal } from './Modal';
import { TrashIcon } from './TrashIcon';
import { PencilIcon } from './PencilIcon';
import type { BookingRow, PhotographerRow } from './types';

type Draft = Omit<BookingRow, 'id'>;
type DraftState = { mode: 'new' } | { mode: 'edit'; id: number };

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

export function BookingsView() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [photographers, setPhotographers] = useState<PhotographerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftState, setDraftState] = useState<DraftState>({ mode: 'new' });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    const [bk, ph] = await Promise.all([
      api.get<BookingRow[]>('/api/admin/bookings'),
      api.get<PhotographerRow[]>('/api/admin/photographers'),
    ]);
    if (bk.ok) {
      setRows(bk.data);
      setErr('');
    } else {
      setErr(`載入失敗：${bk.error}`);
    }
    if (ph.ok) setPhotographers(ph.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // 過濾掉 any（輪班）跟 none（佔位），這兩個不能被綁
  const videoPpl = useMemo(
    () => photographers.filter((p) => p.type === 'video' && p.key !== 'any' && p.key !== 'none'),
    [photographers],
  );
  const photoPpl = useMemo(
    () => photographers.filter((p) => p.type === 'photo' && p.key !== 'any' && p.key !== 'none'),
    [photographers],
  );

  const renderLeads = (type: 'video' | 'photo', leads: string[]) => {
    if (leads.length === 0) return <span>—</span>;
    const list = type === 'video' ? videoPpl : photoPpl;
    return (
      <div className="bk-leads">
        {leads.map((k) => {
          const p = list.find((x) => x.key === k);
          const name = p ? p.name : k;
          return (
            <span className="bk-lead" key={k}>
              <Avatar src={p?.photo ?? ''} name={name} size="md" />
              <span>{name}</span>
            </span>
          );
        })}
      </div>
    );
  };

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

  const openNew = () => {
    setDraftState({ mode: 'new' });
    setDraft(blankDraft());
    setErr('');
  };

  const openEdit = (b: BookingRow) => {
    if (b.id == null) return;
    setDraftState({ mode: 'edit', id: b.id });
    setDraft({
      date: b.date,
      videoSlots: b.videoSlots,
      photoSlots: b.photoSlots,
      videoCamsUsed: b.videoCamsUsed,
      photoCamsUsed: b.photoCamsUsed,
      videoLeads: [...b.videoLeads],
      photoLeads: [...b.photoLeads],
      notes: b.notes,
    });
    setErr('');
  };

  const patchDraft = (patch: Partial<Draft>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const toggleLead = (type: 'video' | 'photo', key: string) => {
    if (!draft) return;
    const cur = type === 'video' ? draft.videoLeads : draft.photoLeads;
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    if (type === 'video') patchDraft({ videoLeads: next });
    else patchDraft({ photoLeads: next });
  };

  const saveDraft = async () => {
    if (!draft) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
      setErr('日期格式錯誤，請填 YYYY-MM-DD');
      return;
    }
    setSaving(true);
    setErr('');
    const res =
      draftState.mode === 'edit'
        ? await api.put<{ ok: boolean }>(`/api/admin/bookings/${draftState.id}`, draft)
        : await api.post<{ ok: boolean }>('/api/admin/bookings', draft);
    setSaving(false);
    if (res.ok) {
      setDraft(null);
      load();
    } else {
      setErr(`${draftState.mode === 'edit' ? '更新' : '新增'}失敗：${res.error}`);
    }
  };

  const closeModal = () => {
    setDraft(null);
    setErr('');
  };

  const syncToSheet = async () => {
    if (syncing) return;
    setSyncing(true);
    setErr('');
    const res = await api.post<{ count: number }>('/api/admin/sync-bookings', {});
    setSyncing(false);
    if (res.ok) {
      alert(`已備份 ${res.data.count} 筆預約檔期到 Google Sheet`);
    } else {
      setErr(`備份失敗：${res.error}`);
    }
  };

  const isEdit = draftState.mode === 'edit';

  // 排列規則：未過期（含今天）由近到遠在前；已過期擺到最下面（最近結束的擺前）
  const todayKey = useMemo(() => {
    const t = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }, []);
  const sortedRows = useMemo(() => {
    const upcoming = rows
      .filter((b) => b.date >= todayKey)
      .sort((a, b) => a.date.localeCompare(b.date));
    const past = rows
      .filter((b) => b.date < todayKey)
      .sort((a, b) => b.date.localeCompare(a.date));
    return [...upcoming, ...past];
  }, [rows, todayKey]);

  return (
    <div>
      <h2>預約檔期</h2>
      <p className="admin-hint">
        每一列代表「某一天的預約佔用情況」。客戶送單會自動累加進來，你也可以手動新增（例如老闆自己有檔期要先擋住的日子）。
        欄位意義：動態 / 平面場次（當天接了幾組）、動態 / 平面機位（多組合計幾台機）、動態 / 平面主攝（已被綁住的攝影師）。
        當這些數字達到「基本資料」裡 max_*_per_day 的上限，前台行事曆 / 機位 / 攝影師會自動變灰。想擋整天 → 把 slots 填到上限；想擋某攝影師 → 把他勾起來。
      </p>
      <div className="admin-toolbar">
        <button className="admin-btn primary" onClick={openNew}>
          + 新增檔期
        </button>
        <button className="admin-btn" onClick={syncToSheet} disabled={syncing || loading}>
          {syncing ? '備份中…' : '同步到 Sheet'}
        </button>
        {err && <span className="admin-status err">{err}</span>}
      </div>
      {loading && <div className="admin-status">載入中…</div>}
      {!loading && (
        <div className="adt-wrap">
        <table className="adt">
          <thead>
            <tr>
              <th style={{ width: 56 }}>No.</th>
              <th>日期</th>
              <th>動態主攝</th>
              <th>動態場次</th>
              <th>動態機位</th>
              <th>平面主攝</th>
              <th>平面場次</th>
              <th>平面機位</th>
              <th>備註</th>
              <th className="actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={10} className="adt-empty">尚無檔期</td>
              </tr>
            )}
            {sortedRows.map((b, i) => (
              <tr key={b.id} className={b.date < todayKey ? 'adt-row-past' : undefined}>
                <td className="adt-no">{i + 1}</td>
                <td><strong>{b.date}</strong></td>
                <td>{renderLeads('video', b.videoLeads)}</td>
                <td>{b.videoSlots}</td>
                <td>{b.videoCamsUsed}</td>
                <td>{renderLeads('photo', b.photoLeads)}</td>
                <td>{b.photoSlots}</td>
                <td>{b.photoCamsUsed}</td>
                <td>{b.notes}</td>
                <td className="actions">
                  <button
                    className="row-edit"
                    onClick={() => openEdit(b)}
                    disabled={busyId === b.id}
                    aria-label="編輯"
                    title="編輯"
                  >
                    <PencilIcon />
                  </button>
                  <button
                    className="row-del"
                    onClick={() => removeRow(b.id!)}
                    disabled={busyId === b.id}
                    aria-label="刪除"
                    title="刪除"
                  >
                    <TrashIcon />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}

      <Modal
        open={!!draft}
        title={isEdit ? '編輯檔期' : '新增檔期'}
        onClose={closeModal}
        footer={
          <>
            <button className="admin-btn" onClick={closeModal} disabled={saving}>
              取消
            </button>
            <button className="admin-btn primary" onClick={saveDraft} disabled={saving}>
              {saving ? '儲存中…' : isEdit ? '儲存' : '新增'}
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
                <label>動態機位（總台數）</label>
                <input
                  type="number"
                  min={0}
                  value={draft.videoCamsUsed}
                  onChange={(e) => patchDraft({ videoCamsUsed: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="adm-field">
              <label>動態主攝（可複選，已勾的當天會擋住）</label>
              {videoPpl.length === 0 ? (
                <div className="adm-empty-tip">尚未建動態攝影師</div>
              ) : (
                <div className="adm-checkbox-group">
                  {videoPpl.map((p) => {
                    const on = draft.videoLeads.includes(p.key);
                    return (
                      <label
                        key={p.key}
                        className={`adm-checkbox-item${on ? ' on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleLead('video', p.key)}
                        />
                        <Avatar src={p.photo} name={p.name} size="sm" />
                        {p.name}
                        {p.role && <span className="adm-checkbox-role">（{p.role}）</span>}
                      </label>
                    );
                  })}
                </div>
              )}
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
                <label>平面機位（總台數）</label>
                <input
                  type="number"
                  min={0}
                  value={draft.photoCamsUsed}
                  onChange={(e) => patchDraft({ photoCamsUsed: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="adm-field">
              <label>平面主攝（可複選，已勾的當天會擋住）</label>
              {photoPpl.length === 0 ? (
                <div className="adm-empty-tip">尚未建平面攝影師</div>
              ) : (
                <div className="adm-checkbox-group">
                  {photoPpl.map((p) => {
                    const on = draft.photoLeads.includes(p.key);
                    return (
                      <label
                        key={p.key}
                        className={`adm-checkbox-item${on ? ' on' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleLead('photo', p.key)}
                        />
                        <Avatar src={p.photo} name={p.name} size="sm" />
                        {p.name}
                        {p.role && <span className="adm-checkbox-role">（{p.role}）</span>}
                      </label>
                    );
                  })}
                </div>
              )}
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
