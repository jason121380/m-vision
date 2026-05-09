import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// 主題（admin 右上有開關，存 localStorage）；首次或解析失敗都預設深色
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark';

// 動態載入 admin bundle，只有 ?admin=1 才會抓
const AdminApp = lazy(() =>
  import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })),
);

const isAdmin =
  typeof window !== 'undefined' &&
  /^\/admin(\/|$)/.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>載入後台…</div>}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
