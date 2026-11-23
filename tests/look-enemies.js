// A line-up picture of every kind of Gloom, for checking how they look. Run: node tests/look-enemies.js <folder>
// Not part of the game. Saves lineup.png (the five kinds, nature) and lineup-fire.png (the same, in fire red), seen from the game's camera.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };

const HTML = `<!doctype html><html><body style="margin:0;background:#cfe9f7">
<script type="module">
import * as THREE from '/lib/three.module.min.js';
import { createGloomling } from '/src/gloom.js';
const r = new THREE.WebGLRenderer({ antialias: true });
r.setSize(900, 420);
r.shadowMap.enabled = true;
document.body.appendChild(r.domElement);
const s = new THREE.Scene();
s.background = new THREE.Color(0xcfe9f7);
s.add(new THREE.HemisphereLight(0xdff3ff, 0x9bc46a, 1.5));
const sun = new THREE.DirectionalLight(0xfff1d8, 2.2);
sun.position.set(7, 14, 8);
sun.castShadow = true;
s.add(sun);
const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 32), new THREE.MeshLambertMaterial({ color: 0x7ccf4a }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
s.add(floor);
const cam = new THREE.PerspectiveCamera(35, 900 / 420, 0.1, 80);
const target = { position: new THREE.Vector3(0, 0, 12), down: false, takeHit() {} };   // the hero stands in front of them all
let live = [];
window.show = (type, kinds) => {
  for (const g of live) g.remove();
  live = kinds.map((kind, i) => createGloomling({ scene: s, x: (i - (kinds.length - 1) / 2) * 3.4, z: 0, type, kind, power: 10 }));
  for (let f = 0; f < 30; f++) for (const g of live) g.update(1 / 30, target, 1 + f / 30, []);
  cam.position.set(0, 6.5, 14);
  cam.lookAt(0, 0.8, 0);
  r.render(s, cam);
};
window.ready = true;
</script></body></html>`;

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 420 } });
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
  for (const [name, type] of [['lineup', 'nature'], ['lineup-fire', 'fire']]) {
    await page.evaluate((t) => window.show(t, ['gloomling', 'brute', 'spitter', 'shielder', 'golden']), type);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
  await browser.close();
  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'Line-ups rendered with no errors.');
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
