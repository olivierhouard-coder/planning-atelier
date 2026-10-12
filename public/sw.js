self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || 'Un rappel de Planning Atelier.' }; }
  const title = data.title || 'Planning Atelier';
  const options = {
    body: data.body || 'Vous avez un rappel à consulter.',
    icon: '/logo-planning-atelier.png.png',
    badge: '/logo-planning-atelier.png.png',
    tag: data.tag || 'planning-atelier-reminder',
    data: { url: data.url || '/' },
    requireInteraction: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) {
        if ('navigate' in client) client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow(target);
  }));
});
