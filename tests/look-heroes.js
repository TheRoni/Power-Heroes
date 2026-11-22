// Close-up pictures of heroes, for checking how a new hero looks. Run: node tests/look-heroes.js <folder> sol ember ...
// Not part of the game. Saves <kind>-idle.png, <kind>-run-side.png and <kind>-run-toward.png.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2];
const KINDS = process.argv.slice(3);
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };

const HTML = `<!doctype html><html><body style="margin:0;background:#cfe9f7">
<script type="module">
import * as THREE from '/lib/three.module.min.js';
import { createHero } from '/src/hero.js';
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(520, 520);
r.shadowMap.enabled = true;
document.body.appendChild(r.domElement);
const s = new THREE.Scene();
s.background = new THREE.Color(0xcfe9f7);
s.add(new THREE.HemisphereLight(0xdff3ff, 0x9bc46a, 1.5));
const sun = new THREE.DirectionalLight(0xfff1d8, 2.2);
sun.position.set(7, 14, 8);
sun.castShadow = true;
s.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshLambertMaterial({ color: 0x7ccf4a }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
s.add(floor);
const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
const heroes = {};
window.shot = (kind, frames, mx, mz, cx, cy, cz, tx, ty, tz) => {
  for (const k in heroes) heroes[k].group.visible = k === kind;
  if (!heroes[kind]) { heroes[kind] = createHero({ scene: s, bound: 100, kind }); heroes[kind].group.visible = true; }
  const hero = heroes[kind];
  for (let i = 0; i < frames; i++) hero.update(1 / 30, { x: mx, z: mz }, 1.3 + i / 30);
  hero.group.position.set(0, 0, 0);
  cam.position.set(cx, cy, cz);
  cam.lookAt(tx, ty, tz);
  r.render(s, cam);
};
window.ready = true;
</script></body></html>`;

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 520, height: 520 } });
  const problems = [];
  page.on('pageerror', (e) => problems.push('page error: ' + e.message));
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall')) problems.push(m.type() + ': ' + m.text()); });
  await page.route('http://game.local/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p === '/') return route.fulfill({ contentType: 'text/html', body: HTML });
    const file = path.join(ROOT, p);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto('http://game.local/');
  await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  const views = { idle: [3, 0, 0, 0, 1.3, 4.3, 0, 0.95, 0], 'run-side': [45, 1, 0, 3.6, 1.7, 3.8, 0, 0.9, 0], 'run-toward': [45, 0, 1, 0, 4.5, 5.5, 0, 0.9, 0] };
  for (const kind of KINDS) {
    for (const [name, v] of Object.entries(views)) {
      await page.evaluate(([k, a]) => window.shot(k, ...a), [kind, v]);
      await page.screenshot({ path: `${OUT}/${kind}-${name}.png` });
    }
  }
  await browser.close();
  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'Close-ups rendered with no errors.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
