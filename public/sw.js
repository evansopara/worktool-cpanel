// Worktool service worker: receives Web Push messages from the Laravel API
// (App\Services\WebPushService) and shows them as system notifications,
// even when no Worktool tab is open.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Worktool';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/dashboard' },
  };
  // Same tag as the in-app poller's alert, so the browser shows one, not two.
  if (data.tag) options.tag = data.tag;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/dashboard', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        await existing.focus();
        if (existing.url !== target && 'navigate' in existing) await existing.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});

// The browser rotated this device's subscription. Re-subscribe with the same
// VAPID key; the app also re-syncs on every load, which posts the new one to
// the server (the service worker has no access to the user's auth token).
self.addEventListener('pushsubscriptionchange', (event) => {
  const options = event.oldSubscription?.options;
  if (!options) return;
  event.waitUntil(self.registration.pushManager.subscribe(options).catch(() => {}));
});
