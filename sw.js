// Naples Guest Guide — network-first so guests always get the latest content.
const CACHE = 'naples-guide-v2';
const SHELL = ['./index.html', './app.js', './style.css', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL).catch(() => {}))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // let Supabase + QR + YouTube hit the network
  e.respondWith(fetch(req).then(res => { if (res && res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});
