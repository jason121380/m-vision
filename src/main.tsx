import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// 鎖定深色模式（前後台共用）
document.documentElement.dataset.theme = 'dark';

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
