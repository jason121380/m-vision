import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Editor } from './Editor';
import { BookingsView } from './BookingsView';
import { CeremoniesView } from './CeremoniesView';
import { ServicesView } from './ServicesView';
import { SettingsView } from './SettingsView';
import { SubmissionsView } from './SubmissionsView';
import './admin.css';
import type {
  AddonRow,
  CameraRow,
  PhotographerRow,
} from './types';

// 後台不要露 key，新增的列自動產生一個唯一 ID 當 key
const genKey = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().split('-')[0]!;
  }
  return Math.random().toString(36).slice(2, 10);
};

type Theme = 'light' | 'dark';
const readTheme = (): Theme => {
  if (typeof localStorage === 'undefined') return 'dark';
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
};

type AuthState =
  | { status: 'checking' }
  | { status: 'guest' }
  | { status: 'in'; user: { id: number; username: string } };

const SETTINGS_SUBTABS = [
  { key: 'settings', label: '基本資料' },
  { key: 'services', label: '服務選項' },
  { key: 'cameras', label: '機位' },
  { key: 'ceremonies', label: '儀式' },
  { key: 'addons', label: '加選項目' },
  { key: 'photographers', label: '攝影師' },
] as const;

type SettingsTabKey = (typeof SETTINGS_SUBTABS)[number]['key'];
type TabKey = SettingsTabKey | 'bookings' | 'submissions';

export function AdminApp() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
  const [tab, setTab] = useState<TabKey>('settings');
  const [settingsExpanded, setSettingsExpanded] = useState(true);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const inSettings = SETTINGS_SUBTABS.some((t) => t.key === tab);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

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


  if (auth.status === 'checking') {
    return <div className="admin-login"><div>檢查登入狀態…</div></div>;
  }
  if (auth.status === 'guest') {
    return <LoginForm onLoggedIn={onLoggedIn} />;
  }

  return (
    <div className="admin">
      <div className="admin-top">
        <div className="admin-brand">
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
          <span className="admin-brand-name">M 視覺影像記錄公司</span>
        </div>
        <div className="admin-top-right">
          <span>{auth.user.username}</span>
          <button
            className="admin-btn admin-theme-toggle"
            onClick={toggleTheme}
            aria-label="切換深淺色"
            title={theme === 'dark' ? '切換淺色' : '切換深色'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className="admin-btn" onClick={onLogout}>登出</button>
          <a className="admin-btn admin-link" href="/" target="_blank" rel="noopener noreferrer">查看客人預約頁面</a>
        </div>
      </div>
      <div className="admin-body">
        <div className="admin-side">
          <button
            type="button"
            className={`admin-side-group${inSettings ? ' active' : ''}`}
            onClick={() => setSettingsExpanded((x) => !x)}
            aria-expanded={settingsExpanded}
          >
            <span className="caret">{settingsExpanded ? '▾' : '▸'}</span>
            設定
          </button>
          {SETTINGS_SUBTABS.map((t) => (
            <button
              key={t.key}
              className={`admin-side-sub${tab === t.key ? ' active' : ''}${settingsExpanded ? '' : ' hidden-sub'}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
          <button
            className={tab === 'bookings' ? 'active' : ''}
            onClick={() => setTab('bookings')}
          >
            預約檔期
          </button>
          <button
            className={tab === 'submissions' ? 'active' : ''}
            onClick={() => setTab('submissions')}
          >
            收單紀錄
          </button>
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
        <div className="sub">後台管理</div>
        <label>帳號</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
        <label>密碼</label>
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
  if (tab === 'settings') return <SettingsView />;
  if (tab === 'services') return <ServicesView />;
  if (tab === 'ceremonies') return <CeremoniesView />;

  if (tab === 'cameras') {
    return (
      <Editor<CameraRow>
        title="機位"
        hint="客戶在第一頁選完服務後挑的機位數，類型分動態 / 平面。名稱裡必須含「單機 / 二機 / 雙機 / 三機 / 四機」其中一個關鍵字，因為系統會從名稱推算這是幾台機；少了關鍵字累計會錯。價格是該機位數的加價（基本價之外）。"
        path="cameras"
        columns={[
          { key: 'type', label: '類型', type: 'enum', options: ['video', 'photo'], optionLabels: { video: '動態', photo: '平面' }, width: '14%' },
          { key: 'label', label: '名稱', type: 'text' },
          { key: 'price', label: '價格', type: 'number', width: '14%' },
          { key: 'note', label: '備註', type: 'text' },
        ]}
        blank={() => ({ type: 'video', key: genKey(), label: '', price: 0, note: '' })}
      />
    );
  }
  if (tab === 'addons') {
    return (
      <Editor<AddonRow>
        title="加選項目"
        hint="客戶第二頁的選配項目（SDE 快剪快播、REELS 短影音等）。第一筆「無加選」是預設選中的選項，不可刪除。其他列直接寫名稱跟價格即可。"
        path="addons"
        columns={[
          { key: 'label', label: '名稱', type: 'text' },
          { key: 'price', label: '價格', type: 'number', width: '20%' },
        ]}
        blank={() => ({ key: genKey(), label: '', price: 0 })}
        locked={(r) => r.key === 'none'}
      />
    );
  }
  if (tab === 'photographers') {
    return (
      <Editor<PhotographerRow>
        title="攝影師"
        hint="客戶第二頁選的指定攝影師，類型分動態 / 平面分開列。同一個人若既能拍動態又能拍平面 → 開兩筆。每個類型第一筆「不指定（輪班）」是預設選項不可刪除。頭像可貼 Drive 分享連結或外部 https 圖片網址。設定帳號 / 密碼後，攝影師可到 /booking 用該帳密登入查看自己的預約檔期。"
        path="photographers"
        modalAdd
        addLabel="新增攝影師"
        columns={[
          { key: 'type', label: '類型', type: 'enum', options: ['video', 'photo'], optionLabels: { video: '動態', photo: '平面' }, width: '10%' },
          { key: 'name', label: '名字', type: 'text' },
          { key: 'role', label: '角色', type: 'text' },
          { key: 'price', label: '價格', type: 'number', width: '10%' },
          { key: 'visible', label: '顯示於前台', type: 'boolean', width: '10%' },
          { key: 'username', label: '登入帳號', type: 'text' },
          { key: 'password', label: '登入密碼', type: 'password' },
          { key: 'photo', label: '頭像', type: 'text' },
          { key: 'desc', label: '介紹', type: 'longtext' },
          { key: 'portfolio', label: '作品集', type: 'text' },
        ]}
        blank={() => ({ type: 'video', key: genKey(), name: '', role: '', price: 1000, photo: '', desc: '', portfolio: '', username: '', password: '', visible: true })}
        locked={(r) => r.key === 'any'}
      />
    );
  }
  if (tab === 'bookings') return <BookingsView />;
  if (tab === 'submissions') return <SubmissionsView />;
  return null;
}
