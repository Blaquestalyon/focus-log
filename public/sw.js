/*
 * Focus Log service worker (blueprint §8 "Pop-up alerts").
 * It only shows pop-up alerts and opens Focus Log when one is clicked.
 * It has NO fetch handler and creates no caches, so it never serves pages or stale data.
 */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function parsePayload(event) {
  try {
    const data = event.data ? event.data.json() : null;
    if (data && typeof data.title === 'string' && typeof data.url === 'string') return data;
  } catch (e) {
    /* unreadable payload */
  }
  return null;
}

self.addEventListener('push', (event) => {
  const p = parsePayload(event);
  const title = p ? p.title : 'Focus Log';
  const options = p
    ? {
        body: p.body || '',
        tag: p.tag || 'fl-generic',
        icon: '/icons/icon-192.png',
        data: { url: p.url || '/' },
        requireInteraction: Boolean(p.requireInteraction),
      }
    : {
        body: "Open Focus Log to see what's happening.",
        tag: 'fl-generic',
        icon: '/icons/icon-192.png',
        data: { url: '/' },
        requireInteraction: false,
      };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/';
  const url = typeof raw === 'string' && raw.startsWith('/') ? raw : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const mine = list.find((c) => {
        try {
          return new URL(c.url).origin === self.location.origin;
        } catch (e) {
          return false;
        }
      });
      if (mine) {
        return Promise.resolve(mine.focus ? mine.focus() : mine).then((c) => {
          (c || mine).postMessage({ type: 'fl-open', url });
        });
      }
      return self.clients.openWindow(self.location.origin + url);
    }),
  );
});

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      let key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
      if (!key) {
        const res = await fetch('/api/push/subscriptions', { credentials: 'same-origin' });
        if (res.status === 401) return;
        const cfg = await res.json().catch(() => null);
        if (!cfg || !cfg.public_key) return;
        key = urlBase64ToUint8Array(cfg.public_key);
      }
      const sub = event.newSubscription || (await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
      const put = await fetch('/api/push/subscriptions', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (put.status === 401) return; // signed out: the next signed-in visit re-saves it
    })().catch(() => {}),
  );
});
