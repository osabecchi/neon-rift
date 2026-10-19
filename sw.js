'use strict';
/* NEON RIFT — サービスワーカー(ホーム画面のアプリとして入れたときに、オフラインでも起動できるようにする) */
const CACHE = 'neon-rift-v2';
const FILES = [
  './', './index.html', './manifest.webmanifest', './css/style.css',
  './js/core.js', './js/data.js', './js/save.js', './js/audio.js', './js/input.js', './js/sprites.js',
  './js/gfx.js', './js/icons.js', './js/fx.js', './js/weapons.js', './js/enemies.js', './js/bosses.js',
  './js/game.js', './js/ui.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('neon-rift-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // ゲーム本体: 通信できるときは常に最新を取り(ブラウザーのキャッシュも素通りして確認する)、取れないときだけ保存済みのものを使う
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match('./index.html')))
    );
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // フォント: 一度取れたら保存したものを使う
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});
