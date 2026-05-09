import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// 主題（admin 右上有開關，存 localStorage）；首次或解析失敗都預設深色
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null;
document.documentElement.dataset.theme = stored === 'light' ? 'light' : 'dark';

// 動態載入 admin / booking bundle，只有對應 path 才會抓
const AdminApp = lazy(() =>
  import('./admin/AdminApp').then((m) => ({ default: m.AdminApp })),
);
const BookingApp = lazy(() =>
  import('./booking/BookingApp').then((m) => ({ default: m.BookingApp })),
);

const path = typeof window !== 'undefined' ? window.location.pathname : '';
const isAdmin = /^\/admin(\/|$)/.test(path);
const isBooking = /^\/booking(\/|$)/.test(path);

// PWA：在 /admin 切換成 admin manifest，「加入主畫面」就會以 /admin 為 start_url
if (typeof document !== 'undefined') {
  const link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
  if (link) {
    link.href = isAdmin ? '/admin.webmanifest' : '/manifest.webmanifest';
  }
  if (isAdmin) {
    document.title = 'M 視覺後台';
    const titleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (titleMeta) titleMeta.setAttribute('content', 'M 視覺後台');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.setAttribute('content', '#000000');
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>載入後台…</div>}>
        <AdminApp />
      </Suspense>
    ) : isBooking ? (
      <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>載入中…</div>}>
        <BookingApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
