// Tests for Stage 8, the phone app: the manifest, the icons, the service worker (sw.js) and playing with no internet.
// Not part of the game. Run: node tests/test-stage8.js <screenshot folder>
// The game is served from a real local web address (http://127.0.0.1:<port>), because service workers only work on those.
const { chromium } = require('playwright');
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');
const { gameFiles, expected } = require('./bump-sw.js');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2] || '/tmp';
const results = [];
const problems = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

// ---------- Static checks: the files themselves ----------
function staticChecks() {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  const html = read('index.html');
  const png = (file) => { const b = fs.readFileSync(path.join(ROOT, file)); return { signature: b.subarray(0, 8).toString('hex') === '89504e470d0a1a0a', width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] }; };

  check('the manifest names the app, starts at "./", opens like an app, in any orientation, with the sky-blue colour', manifest.name === 'Power Heroes' && manifest.short_name === 'Power Heroes' && manifest.start_url === './' && manifest.scope === './' && manifest.display === 'standalone' && manifest.orientation === 'any' && /^#[0-9a-f]{6}$/i.test(manifest.theme_color) && manifest.theme_color === manifest.background_color && html.includes(`<meta name="theme-color" content="${manifest.theme_color}">`), JSON.stringify(manifest).slice(0, 200));

  const icons = manifest.icons.map((icon) => ({ ...icon, file: fs.existsSync(path.join(ROOT, icon.src)) }));
  const pngs = icons.filter((i) => i.type === 'image/png');
  const bad = pngs.filter((i) => { if (!i.file) return true; const p = png(i.src); return !p.signature || `${p.width}x${p.height}` !== i.sizes; });
  const has = (size, purpose) => pngs.some((i) => i.sizes === `${size}x${size}` && i.purpose === purpose);
  check('every icon in the manifest exists and is a real PNG of the size it says; there are 192 and 512 icons and a "maskable" 512 one', icons.every((i) => i.file) && bad.length === 0 && has(192, 'any') && has(512, 'any') && has(512, 'maskable'), JSON.stringify({ bad: bad.map((i) => i.src), icons: icons.map((i) => i.src) }));

  const svg = read('icons/icon.svg');
  const masked = read('icons/icon-maskable.svg');
  check('the SVG the icons are drawn from is kept (a rounded one and a full-square one)', svg.includes('viewBox="0 0 512 512"') && svg.includes('rx="112"') && masked.includes('viewBox="0 0 512 512"') && !masked.includes('rx="112"'));

  // iPhones turn see-through into black, and phones cut their own shape out of a maskable icon: both must be solid squares.
  const solid = ['icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'].map((f) => png(f).colorType);
  const round = ['icons/icon-192.png', 'icons/icon-512.png', 'icons/favicon-32.png'].map((f) => png(f).colorType);
  check('the maskable and the Apple icons are solid squares (no see-through part); the others have rounded, see-through corners', solid.every((t) => t === 2) && round.every((t) => t === 6) && png('icons/apple-touch-icon.png').width === 180 && png('icons/favicon-32.png').width === 32, JSON.stringify({ solid, round }));

  check('the page links the manifest, the icons, and the "opens like an app" tags for iPhones and Android', html.includes('<link rel="manifest" href="manifest.webmanifest">') && html.includes('<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">') && html.includes('rel="icon"') && html.includes('name="apple-mobile-web-app-capable" content="yes"') && html.includes('name="mobile-web-app-capable" content="yes"') && html.includes('name="apple-mobile-web-app-title" content="Power Heroes"'));

  const sw = read('sw.js');
  let compiles = true;
  try { new vm.Script(sw); } catch (e) { compiles = false; }
  const files = gameFiles();
  const listed = [...sw.matchAll(/^ {2}'([^']+)',$/gm)].map((m) => m[1]);
  const srcFiles = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => f.endsWith('.js')).map((f) => `src/${f}`);
  const missing = files.filter((f) => f !== './' && !fs.existsSync(path.join(ROOT, f)));
  check('sw.js is up to date: its file list and version match the game files (if not, run: node tests/bump-sw.js)', expected() === sw && compiles, 'run: node tests/bump-sw.js');
  check('it saves everything the game needs: the page, every stylesheet, every file in src/, the saved Three.js, the manifest and the icons; each exists and is listed once', listed.length === new Set(listed).size && listed[0] === './' && listed[1] === 'index.html' && srcFiles.every((f) => listed.includes(f)) && listed.includes('lib/three.module.min.js') && listed.includes('style.css') && listed.includes('story.css') && listed.includes('menus.css') && listed.includes('manifest.webmanifest') && manifest.icons.every((i) => listed.includes(i.src)) && listed.includes('icons/apple-touch-icon.png') && missing.length === 0, JSON.stringify({ missing, count: listed.length }));
  check('the saved copy is refreshed from the real files (not the browser\'s short-term copy), and an old copy is deleted when a new version starts', /cache: 'reload'/.test(sw) && /caches\.delete/.test(sw) && /skipWaiting/.test(sw) && /clients\.claim/.test(sw) && /ignoreSearch: true/.test(sw));
  check('the game asks for the service worker only on a real web address, and main.js does it', /\^https\?:\$/.test(read('src/offline.js')) && /registerOffline\(\)/.test(read('src/main.js')));
}

// ---------- A tiny web server for the game's folder ----------
// "server.sw" and "server.main" can change what sw.js / main.js say, to play a new version of the game.
function serve() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { requests.push(`404 ${p}`); res.writeHead(404); res.end(); return; }
    let body = fs.readFileSync(file);
    if (p === '/sw.js' && server.sw) body = Buffer.from(server.sw(body.toString()));
    if (p === '/src/main.js' && server.main) body = Buffer.from(server.main(body.toString()));
    requests.push(p);
    // Like GitHub Pages: the browser is told it may keep every file for 10 minutes.
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
    res.end(body);
  });
  server.requests = requests;
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function offlineChecks(browser) {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const context = await browser.newContext({ viewport: { width: 800, height: 450 }, deviceScaleFactor: 1 });
  const watch = (page, label) => {
    page.on('pageerror', (e) => problems.push(`[${label}] page error: ${e.message}`));
    page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall') && !m.text().includes('willReadFrequently')) problems.push(`[${label}] console ${m.type()}: ${m.text()}`); });
  };
  const ready = (page) => page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 10, null, { timeout: 90000 });

  const page = await context.newPage();
  watch(page, 'online');
  await page.goto(`${base}/?debug`);
  await ready(page);
  const saved = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const names = await caches.keys();
    const cache = await caches.open(names[0]);
    return { state: registration.active.state, scope: new URL(registration.scope).pathname, names, urls: (await cache.keys()).map((r) => new URL(r.url).pathname).sort() };
  });
  const want = gameFiles().map((f) => (f === './' ? '/' : `/${f}`)).sort();
  check('on a real web address the page installs the service worker, and it saves one copy of every game file', saved.state === 'activated' && saved.scope === '/' && saved.names.length === 1 && /^power-heroes-[0-9a-f]{8}$/.test(saved.names[0]) && JSON.stringify(saved.urls) === JSON.stringify(want), JSON.stringify({ state: saved.state, names: saved.names, extra: saved.urls.filter((u) => !want.includes(u)), lacking: want.filter((u) => !saved.urls.includes(u)) }));
  check('the game asked the server for no file that is missing', !server.requests.some((r) => r.startsWith('404')), server.requests.filter((r) => r.startsWith('404')).join());

  // No internet at all: the game still opens, from the saved copy.
  await context.setOffline(true);
  const before = server.requests.length;
  await page.reload();
  await ready(page);
  const offline = await page.evaluate(() => ({ title: document.title, frames: window.__game.renderer.info.render.frame, controlled: !!navigator.serviceWorker.controller, canvas: !!document.getElementById('game') }));
  check('with no internet, reloading opens the game from the saved copy (it is drawing frames, and the server heard nothing)', offline.controlled && offline.canvas && offline.frames > 10 && server.requests.length === before, JSON.stringify({ ...offline, newRequests: server.requests.length - before }));
  await page.screenshot({ path: `${OUT}/offline-1-reload.png` });

  const second = await context.newPage();
  watch(second, 'offline-new-tab');
  await second.goto(`${base}/`);
  await second.waitForFunction(() => document.getElementById('title') && !document.getElementById('title').hidden, null, { timeout: 90000 });
  const title = await second.evaluate(() => ({ name: document.getElementById('title-name').textContent, line: document.getElementById('title-line').textContent }));
  check('a new tab with no internet shows the title screen (no "?debug" needed)', title.name === 'Power Heroes' && title.line.length > 0 && server.requests.length === before, JSON.stringify(title));
  await second.screenshot({ path: `${OUT}/offline-2-title.png` });
  await second.close();

  // A new version of the game: the new copy replaces the old one, even though the server said "keep files for 10 minutes".
  await context.setOffline(false);
  server.sw = (text) => text.replace(/power-heroes-[0-9a-f]{8}/, 'power-heroes-newer');
  server.main = (text) => `${text}\n// the new version\n`;
  const updated = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    for (let i = 0; i < 200; i++) {
      const names = await caches.keys();
      if (names.length === 1 && names[0] === 'power-heroes-newer') break;
      await new Promise((r) => setTimeout(r, 100));
    }
    const names = await caches.keys();
    const main = await caches.match('/src/main.js');
    return { names, newCode: main ? (await main.text()).includes('the new version') : null, registrations: (await navigator.serviceWorker.getRegistrations()).length };
  });
  check('a new version of the game replaces the saved copy: the old one is deleted and the files are the new ones', updated.names.join() === 'power-heroes-newer' && updated.newCode === true && updated.registrations === 1, JSON.stringify(updated));

  await context.close();
  server.close();
}

(async () => {
  staticChecks();
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  await offlineChecks(browser);
  await browser.close();
  console.log(results.join('\n'));
  console.log(problems.length ? '\nPROBLEMS:\n' + problems.join('\n') : '\nNo console errors, warnings, or missing files.');
})().catch((e) => { console.log(results.join('\n')); console.error('TEST SCRIPT FAILED:', e.message); process.exit(1); });
