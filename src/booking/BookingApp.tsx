import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { PushToggle } from '../components/PushToggle';
import { setupBadgeClearing } from '../lib/push';
import './booking.css';

type User = { key: string; name: string; role: string; photo?: string };
type LeadInfo = {
  key: string;
  name: string;
  role: string;
  photo: string;
  isMe: boolean;
};
type ScheduleDate = {
  date: string;
  asVideo: boolean;
  asPhoto: boolean;
  notes: string;
  videoSlots: number;
  photoSlots: number;
  videoCamsUsed: number;
  photoCamsUsed: number;
  videoLeads: LeadInfo[];
  photoLeads: LeadInfo[];
};
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
    document.title = 'M 視覺預約';
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  // app 打開 / focus 時清掉紅點
  useEffect(() => setupBadgeClearing(), []);

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

type ListTab = 'upcoming' | 'past';

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
  const [tab, setTab] = useState<ListTab>('upcoming');
  const [highlightDate, setHighlightDate] = useState<string>('');
  const itemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

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

  // 客戶端再排一次保險：upcoming 由近到遠（最早要拍的擺最前面）；past 由近到遠（剛結束的擺最前面）
  const upcoming = useMemo(
    () =>
      [...dates]
        .filter((d) => d.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [dates, today],
  );
  const past = useMemo(
    () =>
      [...dates]
        .filter((d) => d.date < today)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [dates, today],
  );

  const visible = tab === 'upcoming' ? upcoming : past;

  // 月曆點到某天 → 切到對應 tab + 高亮 + 滾到那張卡。
  // 用 setTimeout 讓 React 先 render 完，DOM 才有 ref 可以 scrollIntoView。
  const onPickDate = (date: string) => {
    const targetTab: ListTab = date >= today ? 'upcoming' : 'past';
    setTab(targetTab);
    setHighlightDate(date);
    window.setTimeout(() => {
      const el = itemRefs.current.get(date);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
    // 高亮 2 秒後淡掉
    window.setTimeout(() => setHighlightDate((d) => (d === date ? '' : d)), 2200);
  };

  return (
    <div className="bk-app">
      <div className="bk-top">
        <div className="bk-brand">
          <span className="bk-name">{user.name}</span>
          {user.role && <span className="bk-role">（{user.role}）</span>}
        </div>
        <div className="bk-top-right">
          <PushToggle kind="staff" className="bk-btn" />
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
              <MyCalendar
                view={view}
                setView={setView}
                dates={dates}
                today={today}
                onPickDate={onPickDate}
              />

              <div className="bk-tabs" role="tablist">
                <button
                  type="button"
                  className={`bk-tab${tab === 'upcoming' ? ' on' : ''}`}
                  onClick={() => setTab('upcoming')}
                  role="tab"
                  aria-selected={tab === 'upcoming'}
                >
                  即將到來 <span className="bk-tab-count">{upcoming.length}</span>
                </button>
                <button
                  type="button"
                  className={`bk-tab${tab === 'past' ? ' on' : ''}`}
                  onClick={() => setTab('past')}
                  role="tab"
                  aria-selected={tab === 'past'}
                >
                  已結束 <span className="bk-tab-count">{past.length}</span>
                </button>
              </div>

              {visible.length === 0 ? (
                <div className="bk-empty" key={`empty-${tab}`}>
                  {tab === 'upcoming' ? '目前沒有即將到來的檔期' : '尚無已結束的檔期'}
                </div>
              ) : (
                // key={tab} 強制 React 切 tab 時整個 ul 重新 mount，
                // 避免 reconciliation 把舊 tab 的 li 殘留下來
                <ul className="bk-list" key={`list-${tab}`}>
                  {visible.map((d) => (
                    <ScheduleItem
                      key={d.date}
                      d={d}
                      past={tab === 'past'}
                      highlight={highlightDate === d.date}
                      itemRef={(el) => {
                        if (el) itemRefs.current.set(d.date, el);
                        else itemRefs.current.delete(d.date);
                      }}
                    />
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

function ScheduleItem({
  d,
  past,
  highlight,
  itemRef,
}: {
  d: ScheduleDate;
  past: boolean;
  highlight: boolean;
  itemRef: (el: HTMLLIElement | null) => void;
}) {
  const dt = new Date(d.date + 'T00:00:00');
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][dt.getDay()];

  return (
    <li
      ref={itemRef}
      data-date={d.date}
      className={`bk-list-item${past ? ' past' : ''}${highlight ? ' highlight' : ''}`}
    >
      <div className="bk-item-head">
        <div className="bk-item-date">
          <span className="bk-item-date-main">{d.date}</span>
          <span className="bk-item-date-week">週{weekday}</span>
        </div>
        <div className="bk-list-types">
          {d.asVideo && <span className="bk-tag v">動態</span>}
          {d.asPhoto && <span className="bk-tag p">平面</span>}
        </div>
      </div>

      {(d.videoLeads.length > 0 || d.photoLeads.length > 0) && (
        <div className="bk-team">
          {d.videoLeads.length > 0 && (
            <div className="bk-team-row">
              <div className="bk-team-h">動態</div>
              <div className="bk-team-people">
                {d.videoLeads.map((p) => (
                  <span key={p.key} className={`bk-person${p.isMe ? ' me' : ''}`}>
                    <Avatar src={p.photo} name={p.name} size="md" />
                    <span className="bk-person-meta">
                      <span className="bk-person-name">{p.name}{p.isMe && ' (你)'}</span>
                      {p.role && <span className="bk-person-role">{p.role}</span>}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {d.photoLeads.length > 0 && (
            <div className="bk-team-row">
              <div className="bk-team-h">平面</div>
              <div className="bk-team-people">
                {d.photoLeads.map((p) => (
                  <span key={p.key} className={`bk-person${p.isMe ? ' me' : ''}`}>
                    <Avatar src={p.photo} name={p.name} size="md" />
                    <span className="bk-person-meta">
                      <span className="bk-person-name">{p.name}{p.isMe && ' (你)'}</span>
                      {p.role && <span className="bk-person-role">{p.role}</span>}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bk-stats">
        {d.asVideo && (
          <span className="bk-stat">動態 {d.videoSlots} 場 · {d.videoCamsUsed} 機</span>
        )}
        {d.asPhoto && (
          <span className="bk-stat">平面 {d.photoSlots} 場 · {d.photoCamsUsed} 機</span>
        )}
      </div>

      {d.notes && <div className="bk-list-notes">📝 {d.notes}</div>}
    </li>
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
  onPickDate,
}: {
  view: Date;
  setView: (d: Date) => void;
  dates: ScheduleDate[];
  today: string;
  onPickDate: (date: string) => void;
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
        <button type="button" onClick={() => setView(new Date(y, m - 1, 1))} aria-label="上個月">‹</button>
        <div>{y} 年 {m + 1} 月</div>
        <button type="button" onClick={() => setView(new Date(y, m + 1, 1))} aria-label="下個月">›</button>
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
          // 有預約的日期可以點：跳到下方對應的卡片
          const clickable = !!sd;
          return (
            <div
              key={i}
              className={cls.join(' ')}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={clickable ? () => onPickDate(key) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onPickDate(key);
                      }
                    }
                  : undefined
              }
            >
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
