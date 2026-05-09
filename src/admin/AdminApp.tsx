import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Editor } from './Editor';
import { BookingsView } from './BookingsView';
import { SubmissionsView } from './SubmissionsView';
import './admin.css';
import type {
  AddonRow,
  CameraRow,
  CeremonyRow,
  MediaRow,
  PhotographerRow,
  ServiceRow,
  SettingRow,
} from './types';

type AuthState =
  | { status: 'checking' }
  | { status: 'guest' }
  | { status: 'in'; user: { id: number; username: string } };

const TABS = [
  { key: 'settings', label: '基本資料' },
  { key: 'services', label: '服務選項' },
  { key: 'cameras', label: '機位' },
  { key: 'ceremonies', label: '儀式' },
  { key: 'addons', label: '加選項目' },
  { key: 'photographers', label: '攝影師' },
  { key: 'media', label: '輪播媒體' },
  { key: 'bookings', label: '檔期' },
  { key: 'submissions', label: '送單紀錄' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function AdminApp() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
  const [tab, setTab] = useState<TabKey>('settings');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.get<{ user: { id: number; username: string } | null }>('/api/auth/me').then((res) => {
      if (res.ok && res.data.user) {
        setAuth({ status: 'in', user: res.data.user });
      } else {
        setAuth({ status: 'guest' });
      }
    });
  }, []);

  const onLoggedIn = (user: { id: number; username: string }) => setAuth({ status: 'in', user });

  const onLogout = async () => {
    await api.post('/api/auth/logout', {});
    setAuth({ status: 'guest' });
  };

  const onImportSheet = async () => {
    if (importing) return;
    if (!confirm('從 Google Sheet 匯入會「整張覆蓋」目前資料（bookings 是 upsert 不會清空），後台手動修改的內容會被覆蓋。確定要繼續？')) return;
    setImporting(true);
    const res = await api.post<{ counts: Record<string, number> }>('/api/admin/import-sheet', {});
    setImporting(false);
    if (res.ok) {
      const c = res.data.counts;
      alert(
        `匯入完成\n\n` +
          `services: ${c.services}\n` +
          `cameras: ${c.cameras}\n` +
          `ceremonies: ${c.ceremonies}\n` +
          `addons: ${c.addons}\n` +
          `photographers: ${c.photographers}\n` +
          `media: ${c.media}\n` +
          `settings: ${c.settings}\n` +
          `bookings: ${c.bookings}\n\n` +
          `重新載入頁面以顯示新資料。`,
      );
      window.location.reload();
    } else {
      alert(`匯入失敗：${res.error}`);
    }
  };

  if (auth.status === 'checking') {
    return <div className="admin-login"><div>檢查登入狀態…</div></div>;
  }
  if (auth.status === 'guest') {
    return <LoginForm onLoggedIn={onLoggedIn} />;
  }

  return (
    <div className="admin">
      <div className="admin-top">
        <img
          src="/black.jpg"
          alt="M VISION"
          className="admin-logo"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.src.endsWith('/logo.jpg')) return;
            img.src = '/logo.jpg';
          }}
        />
        <div className="admin-top-right">
          <span>{auth.user.username}</span>
          <button className="admin-btn" onClick={onImportSheet} disabled={importing}>
            {importing ? '匯入中…' : '從 Sheet 匯入'}
          </button>
          <button className="admin-btn" onClick={onLogout}>登出</button>
          <a className="admin-btn" href="/">回前台</a>
        </div>
      </div>
      <div className="admin-body">
        <div className="admin-side">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? 'active' : ''}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="admin-content">
          <Section tab={tab} />
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onLoggedIn }: { onLoggedIn: (u: { id: number; username: string }) => void }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await api.post<{ ok: boolean; user: { id: number; username: string } }>(
      '/api/auth/login',
      { username, password },
    );
    setBusy(false);
    if (res.ok) onLoggedIn(res.data.user);
    else setErr(res.error || '登入失敗');
  };

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={submit}>
        <h1>M VISION</h1>
        <div className="sub">Admin</div>
        <label>USERNAME</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <label>PASSWORD</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <div className="err">{err}</div>
        <button type="submit" disabled={busy}>{busy ? '登入中…' : '登入'}</button>
      </form>
    </div>
  );
}

function Section({ tab }: { tab: TabKey }) {
  if (tab === 'settings') {
    return (
      <Editor<SettingRow>
        title="基本資料 settings"
        hint="key 是程式判斷用，不要亂改。value 是顯示給使用者看的字串。例：max_photo_cameras_per_day=3 控制平面單日機位上限。"
        path="settings"
        columns={[
          { key: 'key', label: 'Key', type: 'text', width: '40%' },
          { key: 'value', label: 'Value', type: 'longtext' },
        ]}
        blank={() => ({ key: '', value: '' })}
      />
    );
  }
  if (tab === 'services') {
    return (
      <Editor<ServiceRow>
        title="服務選項 services"
        hint="key 必須是 video / photo / both（程式判斷用，code 寫死）。"
        path="services"
        columns={[
          { key: 'key', label: 'Key', type: 'text', width: '20%' },
          { key: 'label', label: '名稱', type: 'text' },
          { key: 'price', label: '價格', type: 'number', width: '15%' },
        ]}
        blank={() => ({ key: '', label: '', price: 0 })}
      />
    );
  }
  if (tab === 'cameras') {
    return (
      <Editor<CameraRow>
        title="機位 cameras"
        hint="label 必須含「單機/二機/雙機/三機/四機/五機/六機」其中一個（前端用來算機位數累加）。"
        path="cameras"
        columns={[
          { key: 'type', label: 'Type', type: 'enum', options: ['video', 'photo'], width: '12%' },
          { key: 'key', label: 'Key', type: 'text', width: '15%' },
          { key: 'label', label: '名稱', type: 'text' },
          { key: 'price', label: '價格', type: 'number', width: '12%' },
          { key: 'note', label: '備註', type: 'text' },
        ]}
        blank={() => ({ type: 'video', key: '', label: '', price: 0, note: '' })}
      />
    );
  }
  if (tab === 'ceremonies') {
    return (
      <Editor<CeremonyRow>
        title="儀式 ceremonies"
        hint="key 0/1/2/3 對應無/單/雙/三儀式。"
        path="ceremonies"
        columns={[
          { key: 'type', label: 'Type', type: 'enum', options: ['video', 'photo'], width: '12%' },
          { key: 'key', label: 'Key', type: 'text', width: '15%' },
          { key: 'label', label: '名稱', type: 'text' },
          { key: 'price', label: '價格', type: 'number', width: '15%' },
        ]}
        blank={() => ({ type: 'video', key: '', label: '', price: 0 })}
      />
    );
  }
  if (tab === 'addons') {
    return (
      <Editor<AddonRow>
        title="加選項目 addons"
        hint="key=none 為預設選中那列。"
        path="addons"
        columns={[
          { key: 'key', label: 'Key', type: 'text', width: '20%' },
          { key: 'label', label: '名稱', type: 'text' },
          { key: 'price', label: '價格', type: 'number', width: '15%' },
        ]}
        blank={() => ({ key: '', label: '', price: 0 })}
      />
    );
  }
  if (tab === 'photographers') {
    return (
      <Editor<PhotographerRow>
        title="攝影師 photographers"
        hint="同一個人能拍動態+平面就建兩列同 key 不同 type。photo 欄位可貼 Drive 分享連結或 https URL。"
        path="photographers"
        columns={[
          { key: 'type', label: 'Type', type: 'enum', options: ['video', 'photo'], width: '10%' },
          { key: 'key', label: 'Key', type: 'text', width: '12%' },
          { key: 'name', label: '名字', type: 'text' },
          { key: 'role', label: '角色', type: 'text' },
          { key: 'price', label: '價格', type: 'number', width: '10%' },
          { key: 'photo', label: '頭像 URL', type: 'text' },
          { key: 'desc', label: '介紹', type: 'longtext' },
          { key: 'portfolio', label: '作品集 URL', type: 'text' },
        ]}
        blank={() => ({ type: 'video', key: '', name: '', role: '', price: 1000, photo: '', desc: '', portfolio: '' })}
      />
    );
  }
  if (tab === 'media') {
    return (
      <Editor<MediaRow>
        title="輪播媒體 media"
        hint="image 或 video。url 可貼 Drive / YouTube / 直接 URL。poster 可選（影片預覽圖）。"
        path="media"
        columns={[
          { key: 'type', label: 'Type', type: 'enum', options: ['image', 'video'], width: '12%' },
          { key: 'url', label: 'URL', type: 'text' },
          { key: 'alt', label: '替代文字', type: 'text' },
          { key: 'poster', label: 'Poster URL', type: 'text' },
        ]}
        blank={() => ({ type: 'image', url: '', alt: '', poster: '' })}
      />
    );
  }
  if (tab === 'bookings') return <BookingsView />;
  if (tab === 'submissions') return <SubmissionsView />;
  return null;
}
