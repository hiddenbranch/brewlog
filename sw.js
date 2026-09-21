/* Brew Log service worker.
   index.html: network first (a reload always gets the newest page when online), cache fallback offline.
   Other shell files: cache first with background refresh. Wikimedia and CDN assets: network first, cached after. */
const VERSION = 'blog-1.6.0';
const SHELL = ['./', './index.html', './recipes.js?v=1.6.0', './beerxml.js?v=1.6.0', './data.js?v=1.6.0', './shop.js?v=1.6.0', './core.js?v=1.6.0', './app.js?v=1.6.0', './manifest.webmanifest?v=1.6.0', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => fetch(u, { cache: 'reload' }).then(r => { if (r.ok) return c.put(u, r); }).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== VERSION + '-lib').map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin === location.origin) {
    const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('index.html');
    if (isPage) {
      e.respondWith(fetch(e.request).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone())); return res; }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html'))));
    } else {
      e.respondWith(caches.match(e.request).then(hit => {
        const net = fetch(e.request).then(res => { if (res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone())); return res; }).catch(() => hit);
        return hit || net;
      }));
    }
  } else if (/cdnjs\.cloudflare\.com|jsdelivr\.net|unpkg\.com|tessdata|upload\.wikimedia\.org/.test(url.host + url.pathname)) {
    e.respondWith(fetch(e.request).then(res => { if (res.ok || res.type === 'opaque') caches.open(VERSION + '-lib').then(c => c.put(e.request, res.clone())); return res; }).catch(() => caches.match(e.request)));
  }
});
