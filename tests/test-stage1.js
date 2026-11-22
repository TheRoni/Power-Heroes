// Throwaway Stage 1 checks (not part of the game).
const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/user/power-heroes';
const OUT = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const results = [];
const problems = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// When ARTIFACT_PAGE is set, test the Claude test-link page instead: wrapped the way Claude wraps it,
// and served with a strict content-security policy like the one Claude's viewer enforces.
const ARTIFACT = process.env.ARTIFACT_PAGE || '';
const SKELETON = (inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${inner}</body></html>`;
const CSP = "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com https://code.jquery.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:";

async function openGame(browser, label, options) {
  const context = await browser.newContext(options);
  await context.route('http://game.local/**', (route) => {
    let p = new URL(route.request().url()).pathname;
    if (p === '/' && ARTIFACT) {
      return route.fulfill({ contentType: 'text/html', headers: { 'content-security-policy': CSP }, body: SKELETON(fs.readFileSync(ARTIFACT, 'utf8')) });
    }
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + '/') || !fs.existsSync(file)) {
      problems.push(`[${label}] missing file: ${p}`);
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => problems.push(`[${label}] page error: ${e.message}`));
  page.on('console', (m) => {
    // "GPU stall" is a note from the test browser's software graphics about taking screenshots, not from the game.
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall')) problems.push(`[${label}] console ${m.type()}: ${m.text()}`);
  });
  await page.goto('http://game.local/' + (ARTIFACT ? '#debug' : '?debug'));
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 10, null, { timeout: 90000 });
  await page.evaluate(() => { window.__game.story.skip(); window.__game.waves.reset(); });   // the Stage 1 checks are about movement, so skip the story and switch the enemies off
  return { context, page };
}

const state = (page) => page.evaluate(() => {
  const g = window.__game;
  const el = g.renderer.domElement;
  return {
    x: g.ember.position.x, z: g.ember.position.z, vx: g.ember.velocity.x, vz: g.ember.velocity.z,
    mx: g.input.move.x, mz: g.input.move.z, camX: g.world.camera.position.x,
    aspect: g.world.camera.aspect, canvasW: el.width, canvasH: el.height,
    hintGone: document.getElementById('hint').classList.contains('gone'),
    stickOn: document.getElementById('joystick').classList.contains('active'),
  };
});
const teleport = (page, x, z) => page.evaluate(([x, z]) => {
  const g = window.__game; g.ember.position.set(x, 0, z); g.ember.velocity.x = 0; g.ember.velocity.z = 0;
}, [x, z]);
const until = (page, fn, arg) => page.waitForFunction(fn, arg, { timeout: 30000 });

(async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });

  // ---------------- Desktop, keyboard ----------------
  {
    const { page } = await openGame(browser, 'desktop', { viewport: { width: 1280, height: 720 } });
    await page.screenshot({ path: `${OUT}/desktop-rest.png` });
    const info = await page.evaluate(() => ({
      calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles,
      fps: document.getElementById('fps').textContent,
      keysHint: getComputedStyle(document.querySelector('.hint-keys')).display !== 'none',
      touchHint: getComputedStyle(document.querySelector('.hint-touch')).display !== 'none',
    }));
    check('keyboard hint shown (and touch hint hidden) on desktop', info.keysHint && !info.touchHint);
    results.push(`INFO  desktop: ${info.calls} draw calls, ${info.tris} triangles, ${info.fps} (software rendering, so fps says nothing about phones)`);

    await page.keyboard.down('d');
    await until(page, () => window.__game.ember.velocity.x > 6.5);
    let s = await state(page);
    check('D runs Ember right at full speed', s.x > 0 && s.vx > 6.5 && s.vx <= 7.01, `vx=${s.vx.toFixed(2)}`);
    await sleep(300);
    s = await state(page);
    check('camera follows Ember to the right', s.camX > 0.3, `camX=${s.camX.toFixed(2)}`);
    check('hint fades once moving', s.hintGone);
    await page.screenshot({ path: `${OUT}/desktop-running.png` });
    await page.keyboard.up('d');
    await until(page, () => Math.hypot(window.__game.ember.velocity.x, window.__game.ember.velocity.z) < 0.3);
    check('Ember slows to a stop when D is released', true);

    await teleport(page, 0, 0);
    await page.keyboard.down('d'); await page.keyboard.down('s');
    await until(page, () => Math.hypot(window.__game.ember.velocity.x, window.__game.ember.velocity.z) > 6.9);
    s = await state(page);
    const diag = Math.hypot(s.vx, s.vz);
    check('diagonal is not faster than straight', diag <= 7.01 && Math.abs(s.vx - s.vz) < 0.25, `speed=${diag.toFixed(2)}, vx=${s.vx.toFixed(2)}, vz=${s.vz.toFixed(2)}`);
    await page.keyboard.up('d'); await page.keyboard.up('s');

    await teleport(page, 0, 0);
    await page.keyboard.down('ArrowUp');
    await until(page, () => window.__game.ember.velocity.z < -6);
    check('Arrow Up runs Ember away from the camera', true);
    await page.keyboard.up('ArrowUp');

    await teleport(page, 9.5, 0);
    await page.keyboard.down('d');
    await sleep(1500);
    s = await state(page);
    check('Ember cannot leave the island edge', Math.hypot(s.x, s.z) <= 10.2001, `distance from centre=${Math.hypot(s.x, s.z).toFixed(3)}`);
    await page.keyboard.down('s');
    await sleep(1500);
    s = await state(page);
    check('Ember slides along the edge instead of sticking', s.z > 0.5 && Math.hypot(s.x, s.z) <= 10.2001, `x=${s.x.toFixed(2)} z=${s.z.toFixed(2)}`);
    await page.keyboard.up('d'); await page.keyboard.up('s');

    await teleport(page, 0, 0);
    await page.keyboard.down('d');
    await until(page, () => window.__game.input.move.x === 1);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    s = await state(page);
    check('losing window focus releases held keys', s.mx === 0 && s.mz === 0);
    await page.keyboard.up('d');

    await teleport(page, 0, -9.8); await sleep(2500);
    await page.screenshot({ path: `${OUT}/desktop-north-edge.png` });
    await teleport(page, 0, 9.8); await sleep(2500);
    await page.screenshot({ path: `${OUT}/desktop-south-edge.png` });

    await teleport(page, 0, 0);
    await page.setViewportSize({ width: 500, height: 900 });
    await sleep(2500);
    s = await state(page);
    check('picture resizes with the window', s.canvasW === 500 && s.canvasH === 900 && Math.abs(s.aspect - 500 / 900) < 0.01, `canvas ${s.canvasW}x${s.canvasH}, aspect ${s.aspect.toFixed(3)}`);
    await page.screenshot({ path: `${OUT}/desktop-narrow.png` });
  }

  // ---------------- Phone, touch (portrait) ----------------
  {
    const { context, page } = await openGame(browser, 'phone', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const client = await context.newCDPSession(page);
    const touch = (type, points) => client.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], i) => ({ x, y, id: i })) });
    const hints = await page.evaluate(() => ({ keys: getComputedStyle(document.querySelector('.hint-keys')).display !== 'none', touch: getComputedStyle(document.querySelector('.hint-touch')).display !== 'none' }));
    check('touch hint shown (and keyboard hint hidden) on a phone', hints.touch && !hints.keys);
    await page.screenshot({ path: `${OUT}/phone-rest.png` });

    await touch('touchStart', [[300, 600]]);
    await sleep(200);
    let s = await state(page);
    check('a touch on the right half does not steer', s.mx === 0 && s.mz === 0 && !s.stickOn);
    await touch('touchEnd', []);

    await touch('touchStart', [[90, 600]]);
    await touch('touchMove', [[150, 600]]);
    await until(page, () => window.__game.ember.velocity.x > 6.5);
    s = await state(page);
    check('dragging right on the left half runs Ember right', s.mx > 0.95 && s.vx > 6.5 && s.stickOn, `move.x=${s.mx.toFixed(2)}`);
    await touch('touchMove', [[150, 560]]);
    await sleep(300);
    await page.screenshot({ path: `${OUT}/phone-touch.png` });
    s = await state(page);
    check('dragging up-right is diagonal and not faster', Math.hypot(s.mx, s.mz) <= 1.0001 && s.mx > 0 && s.mz < 0, `move=(${s.mx.toFixed(2)}, ${s.mz.toFixed(2)})`);

    await touch('touchEnd', []);
    await sleep(200);
    s = await state(page);
    check('lifting the thumb stops the push and hides the joystick', s.mx === 0 && s.mz === 0 && !s.stickOn);

    await touch('touchStart', [[90, 600]]);   // a fresh touch, then a tiny 4-pixel drag
    await touch('touchMove', [[94, 600]]);
    await sleep(200);
    s = await state(page);
    check('a tiny drag inside the dead zone does nothing', s.mx === 0 && s.mz === 0 && s.stickOn, `move.x=${s.mx.toFixed(3)}`);
    await touch('touchMove', [[110, 600]]);   // a 20-pixel drag is a gentle push
    await sleep(200);
    s = await state(page);
    check('a medium drag gives a gentle push (analog speed)', s.mx > 0.2 && s.mx < 0.7, `move.x=${s.mx.toFixed(2)}`);
    await touch('touchEnd', []);
    check('phone picture is full size', s.canvasW === 390 && s.canvasH === 844, `canvas ${s.canvasW}x${s.canvasH}`);
  }

  // ---------------- Phone, landscape ----------------
  {
    const { page } = await openGame(browser, 'landscape', { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.screenshot({ path: `${OUT}/phone-landscape.png` });
  }

  // ---------------- A real phone's pixel density ----------------
  {
    const { page } = await openGame(browser, 'pixel7', { ...devices['Pixel 7'] });
    await page.screenshot({ path: `${OUT}/pixel7.png` });
  }

  await browser.close();
  console.log(results.join('\n'));
  console.log(problems.length ? '\nPROBLEMS:\n' + problems.join('\n') : '\nNo console errors, warnings, or missing files.');
})().catch((e) => { console.error('TEST SCRIPT FAILED:', e); process.exit(1); });
