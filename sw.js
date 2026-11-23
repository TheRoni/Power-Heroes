// sw.js: the service worker (a small script the browser keeps running for the game). The first visit saves every game
// file on the phone; after that the game loads from the saved copy, so it opens fast and works with no internet.
// When a game file changes, the version below changes (node tests/bump-sw.js), the new copy is saved and the old one is
// thrown away. The part between BEGIN and END is written by that script: do not edit it by hand.

// BEGIN GENERATED (node tests/bump-sw.js)
const VERSION = 'power-heroes-e36f3957';
const FILES = [
  './',
  'index.html',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'lib/three.module.min.js',
  'manifest.webmanifest',
  'menus.css',
  'src/audio.js',
  'src/aura.js',
  'src/combos.js',
  'src/gloom.js',
  'src/hero-models.js',
  'src/hero.js',
  'src/heroes-data.js',
  'src/input.js',
  'src/main.js',
  'src/marlo.js',
  'src/menus.js',
  'src/music-data.js',
  'src/music.js',
  'src/offline.js',
  'src/overdrive.js',
  'src/pip.js',
  'src/power.js',
  'src/powers.js',
  'src/prologue.js',
  'src/rankings.js',
  'src/rounds.js',
  'src/save.js',
  'src/scene.js',
  'src/sky.js',
  'src/squad.js',
  'src/story-data.js',
  'src/story.js',
  'src/superpowers.js',
  'src/types.js',
  'src/ui.js',
  'src/waves.js',
  'story.css',
  'style.css',
];
// END GENERATED

self.addEventListener('install', (event) => {
  // "reload" skips the browser's own short-term copy, so a new version really is the new files.
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name)))).then(() => self.clients.claim()));
});

// Saved copy first (ignoring "?debug" and the like), the internet only for something that was not saved.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((saved) => saved || fetch(request)));
});
