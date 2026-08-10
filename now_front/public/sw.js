// Web Push 수신용 Service Worker — 익명 구독(usePushSubscription.ts)과 짝을 이룸.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'NEMONE PACE', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'NEMONE PACE';
  const options = {
    body: data.body || '',
    icon: '/brand/pace-icon-192.png',
    badge: '/brand/pace-icon-192.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
