import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import './booking.css';

type User = { key: string; name: string; role: string; photo?: string };
type ScheduleDate = { date: string; asVideo: boolean; asPhoto: boolean; notes: string };
type AuthState =
  | { status: 'checking' }
  | { status: 'guest' }
  | { status: 'in'; user: User };

type Theme = 'light' | 'dark';
const readTheme = (): Theme => {
  if (typeof localStorage === 'undefined') return 'dark';
  return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
};

export function BookingApp() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    document.title = '攝影師預約檔期';
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    api.get<{ user: User | null }>('/api/staff/auth/me').then((res) => {
      if (res.ok && res.data.user) setAuth({ status: 'in', user: res.data.user });
      else setAuth({ status: 'guest' });
    });
  }, []);

  const onLoggedIn = (user: User) => setAuth({ status: 'in', user });
  const onLogout = async () => {
    await api.post('/api/staff/auth/logout', {});
    setAuth({ status: 'guest' });
  };
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  if (auth.status === 'checking') {
    return <div className="bk-loading">載入中…</div>;
  }
  if (auth.status === 'guest') {
    return <LoginForm onLoggedIn={onLoggedIn} theme={theme} onToggleTheme={toggleTheme} />;
  }
  return <ScheduleView user={auth.user} onLogout={onLogout} theme={theme} onToggleTheme={toggleTheme} />;
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      className="bk-btn bk-theme-toggle"
      onClick={onToggle}
      aria-label="切換深淺色"
      title={theme === 'dark' ? '切換淺色' : '切換深色'}
    >
      {theme === 'dark' ? '☀' : '☾'}
    </button>
  );
}

function LoginForm({
  onLoggedIn,
  theme,
  onToggleTheme,
}: {
  onLoggedIn: (u: User) => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const res = await api.post<{ ok: boolean; user: User }>('/api/staff/auth/login', {
      username,
      password,
    });
    setBusy(false);
    if (res.ok) onLoggedIn(res.data.user);
    else setErr(res.error || '登入失敗');
  };

  return (
    <div className="bk-login">
      <div className="bk-floating-theme">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <form className="bk-login-card" onSubmit={submit}>
        <h1>M 視覺</h1>
        <div className="sub">攝影師專區</div>
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

function ScheduleView({
  user,
  onLogout,
  theme,
  onToggleTheme,
}: {
  user: User;
  onLogout: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [dates, setDates] = useState<ScheduleDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState(() => new Date());
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    api.get<{ dates: ScheduleDate[] }>('/api/staff/schedule').then((res) => {
      if (res.ok) setDates(res.data.dates);
      else setErr(res.error);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    api.get<{ text: string }>('/api/announcement').then((res) => {
      if (res.ok) setAnnouncement(res.data.text ?? '');
    });
  }, []);

  const today = useMemo(() => {
    const t = new Date();
    return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }, []);

  const monthDates = useMemo(() => {
    const y = view.getFullYear();
    const m = String(view.getMonth() + 1).padStart(2, '0');
    const prefix = `${y}-${m}-`;
    return dates.filter((d) => d.date.startsWith(prefix));
  }, [dates, view]);

  const monthLabel = `${view.getFullYear()} 年 ${view.getMonth() + 1} 月`;

  return (
    <div className="bk-app">
      <div className="bk-top">
        <div className="bk-brand">
          <span className="bk-name">{user.name}</span>
          {user.role && <span className="bk-role">（{user.role}）</span>}
        </div>
        <div className="bk-top-right">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button className="bk-btn" onClick={onLogout}>登出</button>
        </div>
      </div>

      <div className="bk-content">
        <div className="bk-inner">
          {announcement.trim() && (
            <div className="bk-announcement" role="status" aria-label="公告">
              <div className="bk-announcement-h">公告</div>
              <div className="bk-announcement-body">{announcement}</div>
            </div>
          )}

          <h2>我的預約檔期</h2>

          {loading && <div className="bk-status">載入中…</div>}
          {err && <div className="bk-status err">{err}</div>}

          {!loading && (
            <>
              <MyCalendar view={view} setView={setView} dates={dates} today={today} />

              <div className="bk-section-h">{monthLabel}</div>
              {monthDates.length === 0 && <div className="bk-empty">本月沒有預約</div>}
              {monthDates.length > 0 && (
                <ul className="bk-list">
                  {monthDates.map((d) => (
                    <li key={d.date} className="bk-list-item">
                      <div className="bk-list-date">{d.date}</div>
                      <div className="bk-list-types">
                        {d.asVideo && <span className="bk-tag v">動態</span>}
                        {d.asPhoto && <span className="bk-tag p">平面</span>}
                      </div>
                      {d.notes && <div className="bk-list-notes">{d.notes}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function MyCalendar({
  view,
  setView,
  dates,
  today,
}: {
  view: Date;
  setView: (d: Date) => void;
  dates: ScheduleDate[];
  today: string;
}) {
  const byDate = useMemo(() => new Map(dates.map((d) => [d.date, d])), [dates]);

  const y = view.getFullYear();
  const m = view.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bk-cal">
      <div className="bk-cal-head">
        <button onClick={() => setView(new Date(y, m - 1, 1))} aria-label="上個月">‹</button>
        <div>{y} 年 {m + 1} 月</div>
        <button onClick={() => setView(new Date(y, m + 1, 1))} aria-label="下個月">›</button>
      </div>
      <div className="bk-cal-week">
        {WEEK.map((w) => (
          <div key={w} className="bk-cal-w">{w}</div>
        ))}
      </div>
      <div className="bk-cal-grid">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className="bk-cal-cell empty" />;
          const key = ymd(y, m + 1, d);
          const sd = byDate.get(key);
          const cls = ['bk-cal-cell'];
          if (sd) cls.push('booked');
          if (key === today) cls.push('today');
          return (
            <div key={i} className={cls.join(' ')}>
              <div className="bk-cal-num">{d}</div>
              {sd && (
                <div className="bk-cal-tags">
                  {sd.asVideo && <span className="bk-cal-tag v">動</span>}
                  {sd.asPhoto && <span className="bk-cal-tag p">平</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
