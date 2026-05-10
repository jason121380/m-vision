// M 視覺 Web Push Service Worker
// admin / 攝影師都用這支；payload 由 server 帶 url，點開就導去那頁

self.addEventListener('install', (event) => {
  // 跳過等待，新版 SW 立刻接手
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'M 視覺', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'M 視覺';
  const options = {
    body: data.body || '',
    icon: '/black.jpg',
    badge: '/black.jpg',
    tag: data.tag || 'mv-notification',
    data: { url: data.url || '/' },
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      // 找有沒有已經開著且包含目標路徑的視窗，有就 focus
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.pathname.startsWith(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        } catch {
          /* ignore */
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return null;
    })(),
  );
});
