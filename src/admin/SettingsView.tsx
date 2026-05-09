import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SettingRow } from './types';

type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'longtext';
  placeholder?: string;
  hint?: string;
};

// 已知的設定鍵：UI 只露中文標題，key 固定不顯示。
// 不在這份清單裡的 key（從 Sheet 匯入或舊資料留下）會被保留但不顯示。
const FIELDS: FieldDef[] = [
  { key: 'company_name', label: '公司名稱', type: 'text', placeholder: 'M 視覺影像記錄公司' },
  { key: 'tax_id', label: '統一編號', type: 'text', placeholder: '45286851' },
  { key: 'owner_name', label: '負責人', type: 'text', placeholder: '鄭莛楷（阿樂）' },
  { key: 'owner_legal', label: '法人姓名', type: 'text', placeholder: '黃雯埼' },
  { key: 'address', label: '地址', type: 'text' },
  { key: 'bank', label: '匯款銀行', type: 'text', placeholder: '國泰世華 013' },
  { key: 'account', label: '銀行帳號', type: 'text' },
  { key: 'deposit', label: '訂金金額（元）', type: 'number' },
  { key: 'court', label: '管轄法院', type: 'text', placeholder: '台灣彰化地方法院' },
  { key: 'max_video_slots_per_day', label: '每日動態組數上限', type: 'number', hint: '當天接到這數字後行事曆會把那一天動態擋掉' },
  { key: 'max_photo_slots_per_day', label: '每日平面組數上限', type: 'number', hint: '當天接到這數字後行事曆會把那一天平面擋掉' },
  { key: 'max_video_cameras_per_day', label: '每日動態總機位上限', type: 'number', hint: '多組相加；超過後機位選項會灰' },
  { key: 'max_photo_cameras_per_day', label: '每日平面總機位上限', type: 'number', hint: '多組相加；超過後機位選項會灰' },
];

const KNOWN_KEYS = new Set(FIELDS.map((f) => f.key));

export function SettingsView() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err' | 'idle'; msg: string }>({
    kind: 'idle',
    msg: '',
  });

  useEffect(() => {
    api.get<SettingRow[]>('/api/admin/settings').then((res) => {
      if (res.ok) {
        const map: Record<string, string> = {};
        const others: SettingRow[] = [];
        for (const row of res.data) {
          if (KNOWN_KEYS.has(row.key)) {
            map[row.key] = row.value ?? '';
          } else if (row.key) {
            others.push(row);
          }
        }
        setValues(map);
        setExtras(others);
        setStatus({ kind: 'idle', msg: '' });
      } else {
        setStatus({ kind: 'err', msg: `載入失敗：${res.error}` });
      }
      setLoading(false);
    });
  }, []);

  const set = (key: string, val: string) => {
    setValues((v) => ({ ...v, [key]: val }));
  };

  const save = async () => {
    setSaving(true);
    setStatus({ kind: 'idle', msg: '' });
    const rows: SettingRow[] = [
      ...FIELDS.map((f) => ({ key: f.key, value: values[f.key] ?? '' })),
      ...extras,
    ];
    const res = await api.put<{ ok: boolean }>('/api/admin/settings', rows);
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
      <h2>基本資料</h2>
      <p className="admin-hint">
        公司資訊（公司名、稅號、負責人、地址、銀行、訂金金額）會出現在客戶看到的契約 PDF 上，照實填即可。
        每日上限的數字達到後，前台行事曆 / 機位會自動變灰擋住客戶選擇。
      </p>
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
        <div className="adm-settings-form">
          {FIELDS.map((f) => (
            <div className="adm-field" key={f.key}>
              <label>
                {f.label}
                {f.hint && <span className="adm-field-hint">　{f.hint}</span>}
              </label>
              {f.type === 'longtext' ? (
                <textarea
                  rows={3}
                  value={values[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              ) : (
                <input
                  type={f.type}
                  value={values[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
