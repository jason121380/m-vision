// M 視覺 Web Push Service Worker
// admin / 攝影師都用這支；payload 由 server 帶 url，點開就導去那頁
// 紅點：每次 push 進來把 IndexedDB 的計數 +1，順便 setAppBadge；app 端打開時 postMessage('clear-badge') 清掉

const DB_NAME = 'mv-push';
const STORE = 'meta';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getBadgeCount() {
  try {
    const db = await openDB();
    return await new Promise((res) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get('badge');
      r.onsuccess = () => res(typeof r.result === 'number' ? r.result : 0);
      r.onerror = () => res(0);
    });
  } catch {
    return 0;
  }
}

async function setBadgeCount(n) {
  try {
    const db = await openDB();
    await new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(n, 'badge');
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {
    /* ignore */
  }
}

async function applyBadge(n) {
  if ('setAppBadge' in self.navigator) {
    try {
      if (n > 0) await self.navigator.setAppBadge(n);
      else await self.navigator.clearAppBadge();
    } catch {
      /* ignore */
    }
  }
}

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
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      const next = (await getBadgeCount()) + 1;
      await setBadgeCount(next);
      await applyBadge(next);
    })(),
  );
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

// 來自 app 的「我打開了，紅點清掉」訊息
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'clear-badge') {
    event.waitUntil(
      (async () => {
        await setBadgeCount(0);
        await applyBadge(0);
      })(),
    );
  }
});
