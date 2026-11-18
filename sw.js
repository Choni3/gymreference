// Offline support: the app shell is served cache-first from a versioned cache.
// Bump VERSION on every release; the app then shows "A new version is ready".
const VERSION = 'v16';
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
  'js/motion/player.js',
  'js/motion/pose.js',
  'js/motion/skeleton.js',
  'js/motion/view3d.js',
  'vendor/three/three.module.min.js',
  'assets/icon.svg',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

async function precache() {
  // cache: 'reload' skips the HTTP cache so a release never mixes old and new files.
  const request = (url) => new Request(url, { cache: 'reload' });
  const cache = await caches.open(CACHE);
  await cache.addAll(SHELL.map(request));
  const index = request('motions/index.json');
  const res = await fetch(index);
  if (!res.ok) throw new Error(`Motion index unavailable (HTTP ${res.status})`);
  const motions = await res.clone().json();
  await cache.put(index, res);
  await Promise.allSettled(motions.map(async (entry) => cache.add(request(`motions/${entry.file}`))));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache());
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

// A motion that failed to download during install is cached the first time it loads.
async function fetchAndKeep(req) {
  const res = await fetch(req);
  if (res.ok && new URL(req.url).pathname.includes('/motions/')) {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => cached || fetchAndKeep(req))
  );
});
