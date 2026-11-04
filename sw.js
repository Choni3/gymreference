// Offline support: the app shell is served cache-first from a versioned cache.
// Bump VERSION on every release; the app then shows "A new version is ready".
const VERSION = 'v8';
const CACHE = `gymreference-${VERSION}`;
const DEFAULTS_CACHE = 'gymreference-defaults-v1'; // filled by the page, see app.js
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/backup.js',
  'js/db.js',
  'js/images.js',
  'js/seed.js',
  'js/strong.js',
  'js/ui.js',
  'assets/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' skips the HTTP cache so a release never mixes old and new files.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('gymreference-') && k !== CACHE && k !== DEFAULTS_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetch(req))
  );
});
