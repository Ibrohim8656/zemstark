/* Zemstark service worker: ilova qobig'i (sahifa, skriptlar, ikonalar) oflayn ham ochiladi.
   API so'rovlari va fayllar hech qachon keshlanmaydi — har doim tarmoqdan olinadi. */
const CACHE = 'zemstark-v2';
const SHELL = ['/', '/i18n.js', '/htmlkit.js', '/qimport.js', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/files/')) return;
  const key = r.mode === 'navigate' ? '/' : u.pathname;
  if (!SHELL.includes(key)) return;
  // avval tarmoq (yangi versiya darhol ko'rinsin), tarmoq bo'lmasa — kesh
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(key, cp)); } return res; })
    .catch(() => caches.match(key)));
});
