import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import './booking.css';

type User = { key: string; name: string; role: string; photo?: string };
type ScheduleDate = { date: string; asVideo: boolean; asPhoto: boolean; notes: string };
type AuthState =
  | { status: 'checking' }
  | { status: 'guest' }
  | { status: 'in'; user: User };

export function BookingApp() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });

  useEffect(() => {
    document.title = '攝影師預約檔期';
  }, []);

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

  if (auth.status === 'checking') {
    return <div className="bk-loading">載入中…</div>;
  }
  if (auth.status === 'guest') {
    return <LoginForm onLoggedIn={onLoggedIn} />;
  }
  return <ScheduleView user={auth.user} onLogout={onLogout} />;
}

function LoginForm({ onLoggedIn }: { onLoggedIn: (u: User) => void }) {
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

function ScheduleView({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [dates, setDates] = useState<ScheduleDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [view, setView] = useState(() => new Date());

  useEffect(() => {
    api.get<{ dates: ScheduleDate[] }>('/api/staff/schedule').then((res) => {
      if (res.ok) setDates(res.data.dates);
      else setErr(res.error);
      setLoading(false);
    });
  }, []);

  const today = useMemo(() => {
    const t = new Date();
    return ymd(t.getFullYear(), t.getMonth() + 1, t.getDate());
  }, []);

  const upcoming = useMemo(
    () => dates.filter((d) => d.date >= today),
    [dates, today],
  );

  return (
    <div className="bk-app">
      <div className="bk-top">
        <div className="bk-brand">
          <span className="bk-name">{user.name}</span>
          {user.role && <span className="bk-role">（{user.role}）</span>}
        </div>
        <button className="bk-btn" onClick={onLogout}>登出</button>
      </div>

      <div className="bk-content">
        <h2>我的預約檔期</h2>

        {loading && <div className="bk-status">載入中…</div>}
        {err && <div className="bk-status err">{err}</div>}

        {!loading && (
          <>
            <MyCalendar view={view} setView={setView} dates={dates} today={today} />

            <div className="bk-section-h">即將來臨</div>
            {upcoming.length === 0 && <div className="bk-empty">目前沒有預約</div>}
            {upcoming.length > 0 && (
              <ul className="bk-list">
                {upcoming.map((d) => (
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
