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
  PhotographerRow,
  ServiceRow,
  SettingRow,
} from './types';

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
  const inSettings = SETTINGS_SUBTABS.some((t) => t.key === tab);

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
          <button className="admin-btn" onClick={onLogout}>登出</button>
          <a className="admin-btn" href="/" target="_blank" rel="noopener noreferrer">查看客人預約頁面</a>
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
  if (tab === 'settings') {
    return (
      <Editor<SettingRow>
        title="基本資料"
        hint="公司資訊（公司名、稅號、負責人、地址、銀行、訂金金額）會出現在客戶看到的契約 PDF 上，照實填即可。max_video_slots_per_day / max_photo_slots_per_day 是每天最多接幾組動態 / 平面，超過前台行事曆那天會被擋。max_video_cameras_per_day / max_photo_cameras_per_day 是每天動態 / 平面總機位上限（多組相加），到上限後機位選項會灰掉。Key 欄是程式判斷用的識別碼，不要改；只改 Value。"
        path="settings"
        columns={[
          { key: 'key', label: 'Key', type: 'text', width: '40%' },
          { key: 'value', label: 'Value', type: 'text' },
        ]}
        blank={() => ({ key: '', value: '' })}
      />
    );
  }
  if (tab === 'services') {
    return (
      <Editor<ServiceRow>
        title="服務選項"
        hint="客戶在第一頁選的「動態錄影 / 平面拍照 / 動態＋平面」三個選項。價格是純宴客的基本費，後續加機位、加儀式、加攝影師都會疊加上去。Key 必須維持 video / photo / both 不能改（程式邏輯靠它判斷）；只改 label（顯示文字）跟 price（價格）。"
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
        title="機位"
        hint="客戶在第一頁選完服務後挑的機位數。Type 區分動態（video）跟平面（photo），各自有自己的選項清單。Label 文字裡必須含「單機 / 二機 / 雙機 / 三機 / 四機」其中一個關鍵字，因為系統會從 label 推算這是幾台機；少了關鍵字累計會錯。Price 是該機位數的加價（基本價之外）。"
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
        title="儀式"
        hint="儀式數量加價（文定 / 迎娶 / 證婚算幾個的加價）。Type 分動態 / 平面，各有自己一套價。Key 用 0 / 1 / 2 / 3 對應「無 / 單 / 雙 / 三儀式」固定不能改。Price 是該數量的加價（沒儀式 = 0）。"
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
        title="加選項目"
        hint="客戶第二頁的選配項目（SDE 快剪快播、REELS 短影音等）。第一筆 key=none 是「不加選」那列，必須保留，不然客戶會找不到「無」的選項。其他列的 key 可以隨便取（程式不靠它判斷），label 是顯示給客戶看的名稱，price 是該項目的加價。"
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
        title="攝影師"
        hint="客戶第二頁選的指定攝影師。Type 分動態（video）/ 平面（photo），分開列。同一個人若既能拍動態又能拍平面 → 建兩筆，key 一樣、type 不同。第一筆 key=any 是「不指定（輪班）」固定要有。Photo 是頭像，可貼 Drive 分享連結或外部 https 圖片網址。Price 是指定該攝影師的加價（不指定 = 0）。Desc 是介紹文，Portfolio 是作品集連結。"
        path="photographers"
        modalAdd
        addLabel="新增攝影師"
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
  if (tab === 'bookings') return <BookingsView />;
  if (tab === 'submissions') return <SubmissionsView />;
  return null;
}
