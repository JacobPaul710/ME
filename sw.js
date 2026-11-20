// Keeps the app's files on the phone so it opens without signal.
// Bump VERSION with every patch so phones pick up the new files.
const VERSION = 'me-3.81.0';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'icons/icon-192-v3.png', 'icons/icon-512-v3.png', 'icons/apple-touch-icon-v3.png',
  'data/usda-foods.json',
  'js/app.js', 'js/config.js', 'js/data.js', 'js/celebrations.js',
  'js/core/auth.js', 'js/core/cheers.js', 'js/core/sfx.js', 'js/core/update.js', 'audio/cheers/list.json', 'audio/voice/list.json', 'js/seed.js', 'js/ui/restTimer.js', 'js/ui/braziers.js', 'js/core/foodapi.js', 'js/core/idb.js', 'js/core/scanner.js', 'js/core/store.js', 'js/core/sync.js',
  'js/logic/csv.js', 'js/logic/dates.js', 'js/logic/foods.js', 'js/logic/levels.js', 'js/logic/gear.js', 'js/logic/targets.js', 'js/logic/standards.js', 'js/logic/nutrition.js', 'js/logic/progression.js', 'js/logic/stats.js', 'js/logic/streak.js', 'js/logic/skills.js', 'js/logic/supplements.js',
  'js/ui/chart.js', 'js/ui/components.js', 'js/ui/dom.js', 'js/ui/food.js', 'js/ui/history.js', 'js/ui/levelThemes.js', 'js/ui/settings.js', 'js/ui/character.js', 'js/ui/monster.js', 'js/ui/monster-data.js',
  'js/ui/signin.js', 'js/ui/streakWidget.js', 'js/ui/today.js', 'js/ui/train.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// App files: answer from the phone first, refresh in the background.
// Other sites (Firebase, food database) are never cached here.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // always ask the server (update check)
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((res) => {
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net;
    if (res) return res;
    if (e.request.mode === 'navigate') return cache.match('index.html');
    return new Response('', { status: 504 });
  }));
});
