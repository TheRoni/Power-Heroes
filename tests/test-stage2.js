// Throwaway Stage 2 checks (not part of the game). Run: node test-stage2.js <screenshot folder> [chunk numbers, e.g. 1]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = '/home/user/power-heroes';
const OUT = process.argv[2];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
const results = [];
const problems = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
const near = (value, target, tolerance) => Math.abs(value - target) <= tolerance;

// When ARTIFACT_PAGE is set, test the Claude test-link page: wrapped the way Claude wraps it, under a strict security policy.
const ARTIFACT = process.env.ARTIFACT_PAGE || '';
const SKELETON = (inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${inner}</body></html>`;
const CSP = "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://cdn.tailwindcss.com https://code.jquery.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:";

let KEEP_INTRO = false;   // the story tests want the opening conversation; every other test skips it

async function openGame(browser, label, viewport = { width: 800, height: 450 }, hasTouch = false, extra = {}) {
  const context = await browser.newContext({ viewport, hasTouch, isMobile: hasTouch, deviceScaleFactor: 1, ...extra });
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
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall')) problems.push(`[${label}] console ${m.type()}: ${m.text()}`);
  });
  await page.goto('http://game.local/' + (ARTIFACT ? '#debug' : '?debug'));
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 10, null, { timeout: 90000 });
  if (!KEEP_INTRO) await page.evaluate(() => window.__game.story.skip());
  return { page, context };
}
const until = (page, fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout });

// ---------- Chunk 1: Gloomlings, Ember's health, health bars ----------
// Exact, repeatable checks: the game code is run step by step with a fixed time step, away from the live game.
const chunk1Unit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createHero } = await import('/src/hero.js');
  const out = {};
  const scene = new THREE.Scene();
  const target = (x, z) => { const t = { position: { x, z }, down: false, bumps: 0, takeHit() { t.bumps++; return true; } }; return t; };
  const step = (g, t, frames, others = []) => { for (let i = 0; i < frames; i++) g.update(1 / 30, t, i / 30, others); };

  { const t = target(0, 9.5); const g = createGloomling({ scene, x: 0, z: 0 }); step(g, t, 30); out.chaseDistance = g.position.z; g.remove(); }
  { const t = target(0, 1.0); const g = createGloomling({ scene, x: 0, z: 0 }); step(g, t, 120); out.bumpsIn3s = t.bumps; g.remove(); }
  { const t = target(0, 1.0); const g = createGloomling({ scene, x: 0, z: 0 }); step(g, t, 5); out.modeBefore = g.mode; g.hit(1, 0, -1.5); step(g, t, 25); out.bumpsAfterShove = t.bumps; g.remove(); }
  { const t = target(0, 0); const g = createGloomling({ scene, x: 10, z: 0 }); g.hit(1, 60, 0); step(g, t, 60); out.edge = Math.hypot(g.position.x, g.position.z); g.remove(); }
  { const g = createGloomling({ scene, x: 0, z: 0 }); g.hit(10); out.healthAfter10 = g.health; out.killed = g.hit(30); out.aliveAfter = g.alive; g.remove(); }
  {
    const t = target(9, 0);
    const a = createGloomling({ scene, x: 0, z: 0 });
    const b = createGloomling({ scene, x: 0.05, z: 0 });
    const both = [a, b];
    for (let i = 0; i < 30; i++) { a.update(1 / 30, t, i / 30, both); b.update(1 / 30, t, i / 30, both); }
    out.apart = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
    a.remove(); b.remove();
  }
  {
    let hurt = 0, downs = 0;
    const e = createHero({ scene, bound: 10.2, onHurt: () => hurt++, onDown: () => downs++ });
    out.hit1 = e.takeHit(8, 5, 0);
    out.healthAfter1 = e.health;
    out.hit2 = e.takeHit(8, 5, 0);   // too soon after the first: she is protected
    e.update(0.5, { x: 0, z: 0 }, 0);
    out.hit3 = e.takeHit(8, 5, 0);
    out.healthAfter3 = e.health;
    e.update(0.5, { x: 0, z: 0 }, 0);
    e.takeHit(1000, 5, 0);
    out.down = e.down; out.downs = downs; out.hurt = hurt;
    for (let i = 0; i < 30; i++) e.update(1 / 30, { x: 1, z: 0 }, i / 30);   // pushing the controls while knocked out
    out.vxWhileDown = e.velocity.x;
    e.reset();
    out.afterReset = { health: e.health, down: e.down, x: e.position.x, z: e.position.z };
  }
  return out;
};

async function chunk1(browser) {
  let { page } = await openGame(browser, 'chunk1-unit');
  const u = await page.evaluate(chunk1Unit);
  check('Gloomling runs 3 units per second', near(u.chaseDistance, 3, 0.15), `moved ${u.chaseDistance.toFixed(2)} in 1 s`);
  check('it bumps, rests, and bumps again about every 1.3 s (3 bumps in 4 s)', u.bumpsIn3s === 3, `bumps=${u.bumpsIn3s}`);
  check('it warns (windup) before bumping', u.modeBefore === 'windup', u.modeBefore);
  check('a shove cancels a bump that was about to land', u.bumpsAfterShove === 0, `bumps=${u.bumpsAfterShove}`);
  check('a hard shove cannot push it off the island', u.edge <= 11.21, `distance=${u.edge.toFixed(2)}`);
  check('damage lowers health, and 40 total defeats it', u.healthAfter10 === 20 && u.killed === true && u.aliveAfter === false);
  check('Gloomlings keep apart instead of stacking', u.apart > 0.85, `gap=${u.apart.toFixed(2)}`);
  check('Ember loses 8 health per hit', u.hit1 === true && u.healthAfter1 === 92);
  check('Ember is protected right after a hit', u.hit2 === false);
  check('and can be hit again a moment later', u.hit3 === true && u.healthAfter3 === 84);
  check('Ember reports each hit and the knock-out once', u.hurt === 3 && u.downs === 1 && u.down === true, `hurt=${u.hurt}, downs=${u.downs}`);
  check('a knocked-out Ember ignores the controls', u.vxWhileDown <= 0.001, `vx=${u.vxWhileDown.toFixed(3)}`);
  check('reset gives full health, standing, in the middle', u.afterReset.health === 100 && !u.afterReset.down && u.afterReset.x === 0 && u.afterReset.z === 0);

  // Live game, with the waves and Ember's fireballs switched off, so only the chasing and bumping are tested.
  const calm = (page) => page.evaluate(async () => {
    const G = window.__game;
    G.waves.reset();
    G.powers.update = () => {};   // no fireballs
    const { createGloomling } = await import('/src/gloom.js');
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      G.gloomlings.push(createGloomling({ scene: G.world.scene, x: Math.cos(a) * 10.8, z: Math.sin(a) * 10.8 }));
    }
  });
  ({ page } = await openGame(browser, 'chunk1-live'));
  await calm(page);
  const rim = await page.evaluate(() => window.__game.gloomlings.map((m) => Math.hypot(m.position.x, m.position.z)));
  check('4 Gloomlings appear at the rim and walk inward', rim.length === 4 && rim.every((r) => r > 9.5 && r < 11.3), rim.map((r) => r.toFixed(1)).join(', '));
  const meanDistance = () => {
    const G = window.__game;
    return G.gloomlings.reduce((sum, m) => sum + Math.hypot(m.position.x - G.ember.position.x, m.position.z - G.ember.position.z), 0) / G.gloomlings.length;
  };
  const start = await page.evaluate(meanDistance);
  await until(page, (from) => {
    const G = window.__game;
    return G.gloomlings.reduce((sum, m) => sum + Math.hypot(m.position.x - G.ember.position.x, m.position.z - G.ember.position.z), 0) / G.gloomlings.length < from - 3;
  }, start);
  check('they run toward Ember', true);
  await until(page, () => window.__game.gloomlings.some((m) => m.mode === 'windup'));
  const healthAtWarning = await page.evaluate(() => window.__game.ember.health);
  await page.screenshot({ path: `${OUT}/stage2-1-windup.png` });
  check('the first warning comes before any damage', healthAtWarning === 100, `health=${healthAtWarning}`);
  await until(page, () => document.querySelector('.floater.hurt'));
  const after = await page.evaluate(() => ({ health: window.__game.ember.health, fill: document.getElementById('hud-fill').style.transform }));
  check('a bump takes health in steps of 8', after.health <= 92 && (100 - after.health) % 8 === 0, `health=${after.health}`);
  check('a red damage number pops up', true);
  await until(page, () => document.getElementById('hud-fill').style.transform !== 'scaleX(1)');
  check('the corner health bar shrinks', true);
  const onIsland = await page.evaluate(() => window.__game.gloomlings.every((m) => Math.hypot(m.position.x, m.position.z) <= 11.21));
  check('Gloomlings stay on the island', onIsland);

  // Live game: knocked out.
  ({ page } = await openGame(browser, 'chunk1-down'));
  await page.evaluate(() => { const G = window.__game; G.waves.reset(); G.ember.takeHit(1000, 0, 0); });
  const downNow = await page.evaluate(() => ({ down: window.__game.ember.down, health: window.__game.ember.health }));
  check('Ember is knocked out at 0 health', downNow.down && downNow.health === 0);
  await page.keyboard.down('d');
  await page.waitForTimeout(600);
  const stillX = await page.evaluate(() => window.__game.ember.velocity.x);
  await page.keyboard.up('d');
  check('the controls do nothing while she is out', Math.abs(stillX) < 0.01, `vx=${stillX.toFixed(3)}`);
}


// ---------- Chunk 2: fireballs, Flame Wave, button ----------
const chunk2Unit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createPowers } = await import('/src/powers.js');
  const out = {};
  const makeEmber = (x = 0, z = 0, yaw = 0) => ({ position: new THREE.Vector3(x, 0, z), yaw, down: false, faced: null, face(a) { this.yaw = a; this.faced = a; } });
  const setup = (positions, emberAt = [0, 0, 0]) => {
    const scene = new THREE.Scene();
    const ember = makeEmber(...emberAt);
    const gloomlings = positions.map(([x, z]) => createGloomling({ scene, x, z }));
    const log = { hits: [], kinds: [], defeats: 0, casts: 0 };
    const powers = createPowers({ scene, ember, gloomlings, events: { hit: (g, a, k) => { log.hits.push(a); log.kinds.push(k); }, defeat: () => { log.defeats++; }, cast: () => { log.casts++; } } });
    return { scene, ember, gloomlings, powers, log };
  };
  const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) s.powers.update(1 / 30, i / 30); };

  { const s = setup([[5, 0]]); run(s, 2.5); out.fire = { hits: s.log.hits.length, each: s.log.hits[0], defeats: s.log.defeats, left: s.gloomlings.length, balls: s.powers.fireballCount }; }
  { const s = setup([[8, 0]]); run(s, 2); out.outOfRange = { hits: s.log.hits.length, health: s.gloomlings[0].health }; }
  { const s = setup([[3, 0], [6, 0]]); run(s, 0.5); out.nearest = { near: s.gloomlings[0].health, far: s.gloomlings[1].health }; }
  { const s = setup([[3, 0]]); s.ember.down = true; run(s, 1.5); out.downNoFire = s.log.hits.length; }
  {
    const s = setup([[0, 3], [0, 7], [3, 3], [4, 2], [0, -3.5], [-2, 5]]);
    const [A, B, C, D, E, F] = s.gloomlings;
    s.powers.castWave();
    run(s, 1.2);
    out.cone = { A: A.alive, B: B.alive, C: C.alive, D: D.alive, E: E.alive, F: F.alive, bigHits: s.log.kinds.filter((k) => k === 'big').length, casts: s.log.casts };
  }
  {
    const s = setup([]);
    out.cd = { first: s.powers.castWave(), second: s.powers.castWave(), progressStart: s.powers.waveProgress, readyStart: s.powers.waveReady };
    run(s, 2.5); out.cd.halfway = s.powers.waveProgress;
    run(s, 2.6); out.cd.ready = s.powers.waveReady; out.cd.third = s.powers.castWave();
    run(s, 5.2); s.ember.down = true; out.cd.whileDown = s.powers.castWave();
  }
  { const s = setup([[0, 4]], [0, 0, Math.PI]); s.powers.castWave(); out.aim = { faced: s.ember.faced }; run(s, 0.6); out.aim.defeats = s.log.defeats; }
  { const s = setup([], [0, 0, 1.0]); s.powers.castWave(); out.straight = s.ember.faced; }
  {
    const calls = [];
    const fake = { position: { x: 0, z: 3 }, radius: 0.5, alive: true, hit(d, px, pz) { calls.push({ d, px, pz }); return false; }, remove() {} };
    const scene = new THREE.Scene();
    const powers = createPowers({ scene, ember: makeEmber(0, 0, 0), gloomlings: [fake], events: {} });
    powers.castWave();
    for (let i = 0; i < 15; i++) powers.update(1 / 30, i / 30);
    out.wavePush = calls.find((c) => c.d === 45);
    out.firePush = calls.find((c) => c.d === 10);
  }
  {
    const s = setup([]);
    for (let i = 0; i < 1000; i++) s.powers.sparks.emit(0, 1, 0, 1, 1, 1, 0.5, 0.2, 0xffffff);
    out.sparksLive = s.powers.sparks.live;
    for (let i = 0; i < 40; i++) s.powers.sparks.update(1 / 30);
    out.sparksAfter = s.powers.sparks.live;
  }
  return out;
};

async function chunk2(browser) {
  let { page, context } = await openGame(browser, 'chunk2-unit');
  const u = await page.evaluate(chunk2Unit);
  check('auto-fire: 3 fireballs of 10 damage defeat a Gloomling', u.fire.hits === 3 && u.fire.each === 10 && u.fire.defeats === 1 && u.fire.left === 0, JSON.stringify(u.fire));
  check('fireballs disappear after they hit', u.fire.balls === 0);
  check('nothing is fired at a Gloomling out of range', u.outOfRange.hits === 0 && u.outOfRange.health === 30);
  check('fireballs go at the nearest Gloomling first', u.nearest.near === 20 && u.nearest.far === 30, JSON.stringify(u.nearest));
  check('Ember does not fire while knocked out', u.downNoFire === 0);
  check('Flame Wave hits what is in the cone and nothing else', !u.cone.A && !u.cone.C && !u.cone.F && u.cone.B && u.cone.D && u.cone.E && u.cone.bigHits === 3 && u.cone.casts === 1, JSON.stringify(u.cone));
  check('Flame Wave refuses a second cast while recharging', u.cd.first === true && u.cd.second === false && u.cd.readyStart === false && near(u.cd.progressStart, 0, 0.01));
  check('recharge is halfway after 2.5 s and ready after 5 s', near(u.cd.halfway, 0.5, 0.04) && u.cd.ready === true && u.cd.third === true, `halfway=${u.cd.halfway.toFixed(2)}`);
  check('Flame Wave does nothing while Ember is knocked out', u.cd.whileDown === false);
  check('Flame Wave turns Ember toward the nearest Gloomling', near(u.aim.faced, 0, 0.01) && u.aim.defeats === 1, `faced=${u.aim.faced.toFixed(3)}`);
  check('with nothing near, it fires straight ahead', u.straight === 1.0);
  check('Flame Wave shoves 3 units away from Ember', u.wavePush && near(u.wavePush.px, 0, 0.01) && near(u.wavePush.pz, 3, 0.01), JSON.stringify(u.wavePush));
  check('a fireball only taps (0.3 units, no stun)', u.firePush && near(Math.hypot(u.firePush.px, u.firePush.pz), 0.3, 0.01));
  check('sparks never exceed their pool and all fade out', u.sparksLive <= 240 && u.sparksAfter === 0, `live=${u.sparksLive}, after=${u.sparksAfter}`);

  // Live game: keyboard, mouse, auto-fire.
  ({ page } = await openGame(browser, 'chunk2-live'));
  check('the Flame Wave button starts out glowing (ready)', await page.evaluate(() => document.getElementById('wave-button').classList.contains('ready')));
  await page.keyboard.press('Space');
  await until(page, () => !document.getElementById('wave-button').classList.contains('ready'));
  const sweep = await page.evaluate(() => ({ p: window.__game.powers.waveProgress, left: parseFloat(document.getElementById('wave-button').style.getPropertyValue('--left')) }));
  check('Space fires it, and the button shows the recharge sweep', sweep.p < 0.3 && sweep.left > 0.6, `progress=${sweep.p.toFixed(2)}, sweep=${sweep.left}`);
  await until(page, () => document.getElementById('wave-button').classList.contains('ready'), null, 180000);
  check('the button glows again when the wave is ready', true);
  await page.click('#wave-button');
  check('clicking the button fires it too', (await page.evaluate(() => window.__game.powers.waveProgress)) < 0.3);
  await until(page, () => document.querySelector('.floater.hit, .floater.big'));
  check('damage numbers pop up over hit Gloomlings', true);
  await until(page, () => window.__game.waves.progress > 0 || window.__game.ember.down);
  check('Gloomlings get defeated in the live game', await page.evaluate(() => window.__game.waves.progress > 0));

  // Screenshot in the middle of a Flame Wave.
  ({ page } = await openGame(browser, 'chunk2-shot'));
  await until(page, () => { const G = window.__game; return G.gloomlings.filter((m) => Math.hypot(m.position.x - G.ember.position.x, m.position.z - G.ember.position.z) < 5.5).length >= 2; });
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/stage2-2-wave.png` });

  // Phone: tapping the button fires the wave without touching the joystick.
  ({ page, context } = await openGame(browser, 'chunk2-touch', { width: 390, height: 844 }, true));
  const client = await context.newCDPSession(page);
  const geometry = await page.evaluate(() => {
    const b = document.getElementById('wave-button').getBoundingClientRect();
    const h = document.getElementById('hint').getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, half: window.innerWidth / 2, overlap: !(h.right < b.left || h.left > b.right || h.bottom < b.top || h.top > b.bottom), inside: b.right <= window.innerWidth && b.bottom <= window.innerHeight };
  });
  check('the button is on the right half and on screen', geometry.x > geometry.half && geometry.inside);
  check('the hint text does not overlap the button', !geometry.overlap);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: geometry.x, y: geometry.y, id: 0 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const tap = await page.evaluate(() => ({ p: window.__game.powers.waveProgress, stick: document.getElementById('joystick').classList.contains('active'), move: window.__game.input.move.x }));
  check('a tap on the button fires the wave without steering', tap.p < 0.3 && !tap.stick && tap.move === 0, `progress=${tap.p.toFixed(2)}`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${OUT}/stage2-2-phone.png` });
}


// ---------- Chunk 3: waves, banner, win and lose screens ----------
const chunk3Unit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createWaves } = await import('/src/waves.js');
  const out = {};
  const make = () => {
    const scene = new THREE.Scene();
    const ember = { position: new THREE.Vector3(0, 0, 0), down: false };
    const gloomlings = [];
    const log = { waves: [], spawns: 0, cleared: [], end: [] };
    const waves = createWaves({ scene, ember, gloomlings, events: { wave: (n, t) => log.waves.push(`${n}/${t}`), spawn: () => { log.spawns++; }, cleared: (n) => log.cleared.push(n), end: (k) => log.end.push(k) } });
    return { scene, ember, gloomlings, waves, log };
  };
  const step = (s, seconds, killAll = false) => {
    for (let i = 0; i < Math.round(seconds * 30); i++) {
      if (killAll) s.gloomlings.splice(0).forEach((g) => g.remove());
      s.waves.update(1 / 30);
    }
  };

  { const s = make(); s.waves.start(); step(s, 0.4); out.early = { waves: s.log.waves.length, spawns: s.log.spawns, state: s.waves.state }; }
  {
    const s = make(); s.waves.start();
    step(s, 0.8); out.announce = { waves: s.log.waves.slice(), spawns: s.log.spawns };
    step(s, 3.4);
    out.first = { spawns: s.log.spawns, alive: s.gloomlings.length, remaining: s.waves.remaining, state: s.waves.state, radii: s.gloomlings.map((g) => Math.hypot(g.position.x, g.position.z)) };
  }
  {
    const s = make(); s.waves.start(); step(s, 4.2);
    s.gloomlings.splice(0).forEach((g) => g.remove());
    step(s, 1.3); out.breakWaiting = { waves: s.log.waves.length, state: s.waves.state, label: s.waves.wave };
    step(s, 0.4); out.nextWave = { waves: s.log.waves.slice(), cleared: s.log.cleared.slice() };
  }
  { const s = make(); s.waves.start(); step(s, 3.1, true); out.notYet = { cleared: s.log.cleared.length, spawns: s.log.spawns }; step(s, 1.1, true); out.nowCleared = s.log.cleared.length; }
  {
    const s = make(); s.waves.start(); step(s, 40, true);
    out.win = { end: s.log.end.slice(), spawns: s.log.spawns, waves: s.log.waves.slice(), state: s.waves.state, progress: s.waves.progress };
    s.ember.down = true; step(s, 5, true); out.winThenDown = s.log.end.slice();
  }
  {
    const s = make(); s.waves.start(); step(s, 2); s.ember.down = true; step(s, 1.0);
    out.loseEarly = s.log.end.length; step(s, 0.8);
    out.lose = { end: s.log.end.slice(), state: s.waves.state };
    const before = s.log.spawns; step(s, 5); out.spawnsAfterLoss = s.log.spawns - before;
  }
  {
    const s = make(); s.waves.start(); step(s, 3); s.ember.down = true; step(s, 2); s.ember.down = false;
    s.waves.start();
    out.restart = { alive: s.gloomlings.length, state: s.waves.state, wave: s.waves.wave };
    step(s, 1); out.restartAnnounce = s.log.waves.length;
  }
  { const s = make(); s.waves.start(); while (s.log.cleared.length < 2) step(s, 1 / 30, true); out.progress = s.waves.progress; }
  return out;
};

async function chunk3(browser) {
  let { page, context } = await openGame(browser, 'chunk3-unit');
  const u = await page.evaluate(chunk3Unit);
  check('a short pause, then wave 1 is announced and the first Gloomling appears', u.early.waves === 0 && u.early.spawns === 0 && u.announce.waves.join() === '1/3' && u.announce.spawns === 1, JSON.stringify([u.early, u.announce]));
  check('wave 1 brings 4 Gloomlings, one a second, all on the rim', u.first.spawns === 4 && u.first.alive === 4 && u.first.remaining === 4 && u.first.state === 'fighting' && u.first.radii.every((r) => near(r, 10.8, 0.01)), JSON.stringify(u.first));
  check('after a wave is cleared there is a 1.5 s break first', u.breakWaiting.waves === 1 && u.breakWaiting.state === 'break' && u.breakWaiting.label === 2, JSON.stringify(u.breakWaiting));
  check('then wave 2 is announced', u.nextWave.waves.join() === '1/3,2/3' && u.nextWave.cleared.join() === '1', JSON.stringify(u.nextWave));
  check('a wave is not over while Gloomlings are still to appear', u.notYet.cleared === 0 && u.notYet.spawns === 3 && u.nowCleared === 1, JSON.stringify([u.notYet, u.nowCleared]));
  check('all 3 waves (4 + 6 + 8 = 18 Gloomlings) lead to one win', u.win.end.join() === 'won' && u.win.spawns === 18 && u.win.waves.join() === '1/3,2/3,3/3' && u.win.state === 'over' && near(u.win.progress, 1, 0.001), JSON.stringify(u.win));
  check('a win stays a win, even if Ember is knocked out afterwards', u.winThenDown.join() === 'won');
  check('being knocked out ends the round after a short pause, once', u.loseEarly === 0 && u.lose.end.join() === 'lost' && u.lose.state === 'over', JSON.stringify([u.loseEarly, u.lose]));
  check('no more Gloomlings appear after Ember is out', u.spawnsAfterLoss === 0);
  check('starting again clears the field and begins at wave 1', u.restart.alive === 0 && u.restart.state === 'break' && u.restart.wave === 1 && u.restartAnnounce === 2, JSON.stringify([u.restart, u.restartAnnounce]));
  check('progress counts what has been beaten (10 of 18 after two waves)', near(u.progress, 10 / 18, 0.001), `progress=${u.progress.toFixed(3)}`);

  // Live game: banner, corner note, win screen, retry.
  ({ page } = await openGame(browser, 'chunk3-live'));
  await until(page, () => document.getElementById('banner-title').textContent === 'Wave 1');
  const banner = await page.evaluate(() => `${document.getElementById('banner-title').textContent} | ${document.getElementById('banner-sub').textContent}`);
  check('wave 1 is announced with a banner', banner === 'Wave 1 | of 3', banner);
  await page.screenshot({ path: `${OUT}/stage2-3-banner.png` });
  await until(page, () => /^Wave 1\/3 · \d left$/.test(document.getElementById('hud-wave').textContent));
  check('the corner note shows the wave and how many are left', true);

  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 40; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  // All in one step, so a slow computer cannot make the 0.8 s lock run out in between: skip the win conversation,
  // read the end screen, then press Space straight away.
  const { win, early } = await page.evaluate(() => {
    const G = window.__game;
    G.story.skip();
    const win = { hidden: document.getElementById('end').hidden, title: document.getElementById('end-title').textContent, button: document.getElementById('end-button').textContent, state: G.waves.state };
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true, cancelable: true }));
    return { win, early: { hidden: document.getElementById('end').hidden, ready: G.powers.waveReady } };
  });
  check('beating wave 3 shows "Isle saved!" and a Play again button', !win.hidden && win.title === 'Isle saved!' && win.button === 'Play again' && win.state === 'over', JSON.stringify(win));
  check('a key press in the first moment is ignored (no accidental skip)', !early.hidden && early.ready);
  await page.screenshot({ path: `${OUT}/stage2-3-win.png` });
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await until(page, () => document.getElementById('end').hidden);
  const again = await page.evaluate(() => ({ state: window.__game.waves.state, health: window.__game.ember.health, ready: window.__game.powers.waveReady, wave: window.__game.waves.wave, count: window.__game.gloomlings.length }));
  check('Space on the win screen starts a fresh round (and does not fire the wave)', again.health === 100 && again.ready && again.wave === 1 && again.count === 0 && ['break', 'spawning'].includes(again.state), JSON.stringify(again));

  await page.evaluate(() => { const G = window.__game; G.ember.takeHit(1000, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); G.story.skip(); });
  const lose = await page.evaluate(() => ({ hidden: document.getElementById('end').hidden, title: document.getElementById('end-title').textContent, button: document.getElementById('end-button').textContent }));
  check('being knocked out shows "Knocked out" and a Try again button', !lose.hidden && lose.title === 'Knocked out' && lose.button === 'Try again', JSON.stringify(lose));
  await page.screenshot({ path: `${OUT}/stage2-3-lose.png` });
  await page.waitForTimeout(900);
  await page.click('#end-button');
  await until(page, () => document.getElementById('end').hidden);
  const retry = await page.evaluate(() => ({ health: window.__game.ember.health, down: window.__game.ember.down, wave: window.__game.waves.wave }));
  check('clicking Try again gives Ember full health and wave 1', retry.health === 100 && !retry.down && retry.wave === 1, JSON.stringify(retry));

  // Phone: the end screen fits, and touches on it never steer.
  ({ page, context } = await openGame(browser, 'chunk3-touch', { width: 390, height: 844 }, true));
  const client = await context.newCDPSession(page);
  await page.evaluate(() => { const G = window.__game; G.ember.takeHit(1000, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); G.story.skip(); });
  await page.waitForTimeout(900);
  const spot = await page.evaluate(() => { const r = document.getElementById('end-button').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, shown: !document.getElementById('end').hidden, fits: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
  check('the end screen fits a phone screen', spot.shown && spot.fits);
  await page.screenshot({ path: `${OUT}/stage2-3-phone.png` });
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 30, y: 400, id: 0 }] });
  const behind = await page.evaluate(() => document.getElementById('joystick').classList.contains('active'));
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check('touching the dark area behind the end screen does not start the joystick', !behind);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: spot.x, y: spot.y, id: 0 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await until(page, () => document.getElementById('end').hidden);
  check('tapping Try again on a phone restarts the round', await page.evaluate(() => window.__game.ember.health === 100 && !document.getElementById('joystick').classList.contains('active')));
}


// ---------- Chunk 4: screen shake, freeze-frame, returning colour, confetti ----------
async function chunk4(browser) {
  let { page } = await openGame(browser, 'chunk4');
  const veil0 = await page.evaluate(() => parseFloat(document.getElementById('tint').style.opacity));
  check('the island starts washed-out (grey veil about 0.6)', near(veil0, 0.6, 0.03), `opacity=${veil0}`);
  await page.screenshot({ path: `${OUT}/stage2-4-washed-out.png` });

  await page.evaluate(() => { const G = window.__game; G.waves.reset(); G.ember.takeHit(8, 5, 0); });
  const shaken = await page.evaluate(() => window.__game.fx.shake);
  check('Ember being hit shakes the screen', shaken > 0.04, `shake=${shaken.toFixed(2)}`);
  await until(page, () => window.__game.fx.shake === 0);
  check('the shake fades away by itself', true);

  await page.evaluate(async () => {
    const G = window.__game;
    G.waves.reset();
    const { createGloomling } = await import('/src/gloom.js');
    for (const [x, z] of [[0, 3], [1.5, 3.5], [-1.5, 3.5]]) G.gloomlings.push(createGloomling({ scene: G.world.scene, x, z }));
    G.ember.position.set(0, 0, 0);
  });
  const before = await page.evaluate(() => window.__game.fx.freezes);
  await page.keyboard.press('Space');
  const castShake = await page.evaluate(() => window.__game.fx.shake);
  check('firing the Flame Wave shakes the screen a little', castShake > 0.03, `shake=${castShake.toFixed(2)}`);
  await until(page, (n) => window.__game.fx.freezes > n, before);
  await page.waitForTimeout(800);
  const freezes = await page.evaluate(() => window.__game.fx.freezes);
  check('a Flame Wave that lands freezes the game once, even if it hits three Gloomlings', freezes === before + 1, `freezes=${freezes - before}`);

  await page.evaluate(() => {
    const G = window.__game;
    G.waves.reset();
    G.ember.velocity.x = 7;
    window.__x0 = G.ember.position.x;
    window.__f0 = G.renderer.info.render.frame;
    G.fx.freeze = 0.5;
  });
  await until(page, () => window.__game.renderer.info.render.frame > window.__f0 + 1);
  const held = await page.evaluate(() => Math.abs(window.__game.ember.position.x - window.__x0));
  check('during a freeze-frame nothing moves', held < 1e-9, `moved ${held}`);
  await until(page, () => Math.abs(window.__game.ember.position.x - window.__x0) > 0.01);
  check('and then the game carries on', true);

  ({ page } = await openGame(browser, 'chunk4-calm', undefined, false, { reducedMotion: 'reduce' }));
  await page.evaluate(() => { const G = window.__game; G.waves.reset(); G.ember.takeHit(8, 5, 0); });
  check('with "reduce motion" switched on there is no screen shake', (await page.evaluate(() => window.__game.fx.shake)) === 0);

  ({ page } = await openGame(browser, 'chunk4-colour'));
  const fast = (seconds) => page.evaluate((n) => { const G = window.__game; for (let i = 0; i < 30 * n; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } }, seconds);
  await fast(8);
  await until(page, () => parseFloat(document.getElementById('tint').style.opacity) < 0.5);
  check('beating Gloomlings brings colour back (the veil gets thinner)', true);
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 60 && G.waves.state !== 'won'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  const confetti = await page.evaluate(() => window.__game.powers.sparks.live);
  check('clearing the last wave sets off a burst of confetti', confetti > 60, `sparks=${confetti}`);
  await until(page, () => parseFloat(document.getElementById('tint').style.opacity) < 0.03);
  check('after the last wave the island is in full colour', true);
  await page.screenshot({ path: `${OUT}/stage2-4-full-colour.png` });
  await until(page, () => window.__game.story.active);
  await page.evaluate(() => window.__game.story.skip());   // skip the win conversation, to reach the end screen
  await until(page, () => !document.getElementById('end').hidden);
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await until(page, () => document.getElementById('end').hidden);
  await until(page, () => parseFloat(document.getElementById('tint').style.opacity) > 0.5);
  check('a new round starts washed-out again', true);
}


// ---------- Story: Pip, conversations, bubbles ----------
const storyUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createStory } = await import('/src/story.js');
  const { SCENES, BUBBLES } = await import('/src/story-data.js');
  const out = {};
  const make = (touch) => {
    const doc = document.implementation.createHTMLDocument('story test');
    doc.body.innerHTML = '<div id="bubble"></div><div id="dialogue" hidden><div id="dialogue-box"><div id="dialogue-face"></div><div id="dialogue-body"><div id="dialogue-name"></div><p id="dialogue-text"></p></div><div id="dialogue-next"></div></div></div>';
    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 100);
    camera.position.set(0, 10, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const log = { started: 0, spoke: 0, done: 0 };
    const story = createStory({ camera, anchor: new THREE.Object3D(), root: doc, touch, onStart: () => { log.started++; }, onSpeak: () => { log.spoke++; } });
    return { story, log, $: (id) => doc.getElementById(id) };
  };
  const press = (code) => document.body.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true }));   // like a real key press: it starts at the page and travels up
  const letters = (s) => s.$('dialogue-text').textContent.length;
  const tap = (s) => s.$('dialogue').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));

  {
    const s = make(false);
    s.story.scene('intro', () => { s.log.done++; });
    out.opened = { active: s.story.active, shown: !s.$('dialogue').hidden, started: s.log.started, name: s.$('dialogue-name').textContent, spoke: s.log.spoke };
    s.story.update(0.1);
    out.typingEarly = letters(s);
    press('Space');
    out.lockHeld = letters(s) < SCENES.intro[0][1].length;
    s.story.update(0.3);
    out.typingLater = letters(s);
    press('Space');
    out.finished = s.$('dialogue-text').textContent === SCENES.intro[0][1] && s.$('dialogue-next').classList.contains('on');
    press('Space');
    out.nextLine = { name: s.$('dialogue-name').textContent, letters: letters(s) };
    for (let i = 0; i < 2; i++) { press('Space'); press('Space'); }
    out.emberLine = s.$('dialogue-name').textContent;
    for (let i = 0; i < 6; i++) { press('Space'); press('Space'); }
    out.ended = { active: s.story.active, hidden: s.$('dialogue').hidden, done: s.log.done };
  }
  for (const [touch, key] of [[true, 'phone'], [false, 'computer']]) {
    const s = make(touch);
    s.story.scene('intro');
    s.story.update(0.3);
    for (let i = 0; i < 5; i++) { press('Space'); press('Space'); }
    s.story.update(5);
    out[key] = s.$('dialogue-text').textContent;
    s.story.skip();
  }
  {
    let spaces = 0, ws = 0;
    const probe = (e) => { if (e.code === 'Space') spaces++; if (e.code === 'KeyW') ws++; };
    window.addEventListener('keydown', probe);
    const s = make(false);
    s.story.scene('lose'); s.story.update(1);
    press('Space'); press('KeyW');
    out.swallowed = { spaces, ws };
    s.story.skip();
    press('Space'); press('KeyW');
    out.passed = { spaces, ws };
    window.removeEventListener('keydown', probe);
  }
  {
    const s = make(false);
    s.story.scene('lose'); s.story.update(0.05);
    tap(s);
    out.tapTooSoon = letters(s) < SCENES.lose[0][1].length && s.$('dialogue-name').textContent === 'Pip';
    s.story.update(0.3);
    const before = letters(s);
    tap(s);
    out.tapFinishes = letters(s) > before && s.$('dialogue-text').textContent === SCENES.lose[0][1];
  }
  {
    const s = make(false);
    out.said = s.story.say('wave1');
    const text = s.$('bubble').textContent;
    out.bubble = { valid: BUBBLES.wave1.includes(text), visible: s.$('bubble').classList.contains('show'), spoke: s.log.spoke };
    s.story.update(1); s.story.update(1); s.story.update(1.5);
    out.bubbleGone = !s.$('bubble').classList.contains('show');
    let repeats = 0, previous = '';
    for (let i = 0; i < 40; i++) { s.story.say('wave1'); const t = s.$('bubble').textContent; if (t === previous) repeats++; previous = t; }
    out.repeats = repeats;
    s.story.scene('lose');
    out.duringScene = s.story.say('wave1');
    s.story.skip();
    out.unknown = s.story.say('nonsense');
  }
  return out;
};

async function readOn(page) {   // one press at a time: it finishes the line, or goes on to the next
  for (let guard = 0; guard < 80; guard++) {
    if (!(await page.evaluate(() => window.__game.story.active))) return;
    await page.waitForTimeout(350);
    await page.keyboard.press('Space');
  }
}

async function chunk5(browser) {
  let { page, context } = await openGame(browser, 'story-unit');
  const u = await page.evaluate(storyUnit);
  check('a conversation opens, Pip speaks, and the controls are let go', u.opened.active && u.opened.shown && u.opened.started === 1 && u.opened.name === 'Pip' && u.opened.spoke === 1, JSON.stringify(u.opened));
  check('the words appear letter by letter', u.typingEarly > 0 && u.typingEarly < 12 && u.typingLater > u.typingEarly, `${u.typingEarly} then ${u.typingLater}`);
  check('a press in the first moment is ignored (tap lock)', u.lockHeld);
  check('the first press finishes the line, the next goes on', u.finished && u.nextLine.name === 'Pip' && u.nextLine.letters === 0, JSON.stringify(u.nextLine));
  check('Ember has her own lines', u.emberLine === 'Ember', u.emberLine);
  check('after the last line the conversation closes and "done" runs once', !u.ended.active && u.ended.hidden && u.ended.done === 1, JSON.stringify(u.ended));
  check('a phone is told about the thumb controls', /Drag on the left/.test(u.phone), u.phone);
  check('a computer is told about the keys', /WASD/.test(u.computer), u.computer);
  check('during a conversation Space and movement keys never reach the game', u.swallowed.spaces === 0 && u.swallowed.ws === 0 && u.passed.spaces === 1 && u.passed.ws === 1, JSON.stringify([u.swallowed, u.passed]));
  check('a tap too soon is ignored, a later one finishes the line', u.tapTooSoon && u.tapFinishes);
  check('Pip bubbles show a line from the right set and fade after about 3 s', u.said && u.bubble.valid && u.bubble.visible && u.bubbleGone, JSON.stringify(u.bubble));
  check('a bubble never repeats the line before it', u.repeats === 0, `repeats=${u.repeats}`);
  check('bubbles are refused during a conversation and for unknown names', u.duringScene === false && u.unknown === false);

  // Live game: the opening.
  KEEP_INTRO = true;
  ({ page } = await openGame(browser, 'story-live'));
  KEEP_INTRO = false;
  const open = await page.evaluate(() => ({ active: window.__game.story.active, state: window.__game.waves.state, name: document.getElementById('dialogue-name').textContent, shown: !document.getElementById('dialogue').hidden, bannerTitle: document.getElementById('banner-title').textContent, bannerSub: document.getElementById('banner-sub').textContent }));
  check('the game opens with the chapter title and Pip talking', open.active && open.shown && open.name === 'Pip' && open.state === 'idle' && open.bannerTitle === 'Sunmeadow' && open.bannerSub === 'Chapter 1', JSON.stringify(open));
  await until(page, () => document.getElementById('dialogue-text').textContent.length > 20);
  await page.screenshot({ path: `${OUT}/story-1-intro.png` });
  await until(page, () => { const G = window.__game; return Math.hypot(G.pip.group.position.x - G.ember.position.x, G.pip.group.position.z - G.ember.position.z) < 4; });
  check('Pip flies in to Ember\'s side', true);
  await page.keyboard.down('d');
  await page.waitForTimeout(500);
  const held = await page.evaluate(() => ({ x: window.__game.ember.position.x, state: window.__game.waves.state, ready: window.__game.powers.waveReady }));
  await page.keyboard.up('d');
  check('the fight waits: Ember cannot walk off and no wave starts', Math.abs(held.x) < 1e-6 && held.state === 'idle', JSON.stringify(held));
  await readOn(page);
  const afterIntro = await page.evaluate(() => ({ active: window.__game.story.active, ready: window.__game.powers.waveReady, state: window.__game.waves.state }));
  check('reading the last line starts the first wave', !afterIntro.active && ['break', 'spawning'].includes(afterIntro.state), JSON.stringify(afterIntro));
  check('Space during the conversation did not fire the Flame Wave', afterIntro.ready);
  await until(page, () => document.getElementById('bubble').classList.contains('show'));
  const bubbleText = await page.evaluate(() => document.getElementById('bubble').textContent);
  const { BUBBLES } = { BUBBLES: { wave1: ['Here they come! Try not to get bumped.', 'Incoming! Stay bouncy!'] } };
  check('Pip cheers on the first wave with a speech bubble', BUBBLES.wave1.includes(bubbleText), bubbleText);
  await page.screenshot({ path: `${OUT}/story-2-bubble.png` });

  // Live game: the win and knocked-out conversations come before the end screens.
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  await until(page, () => window.__game.story.active);
  const winTalk = await page.evaluate(() => ({ endHidden: document.getElementById('end').hidden, text: document.getElementById('dialogue-name').textContent }));
  check('after the last wave Pip and Ember talk first, with no end screen yet', winTalk.endHidden && winTalk.text === 'Pip', JSON.stringify(winTalk));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/story-3-win.png` });
  await readOn(page);
  await until(page, () => !document.getElementById('end').hidden);
  check('then the "Isle saved!" screen appears', (await page.evaluate(() => document.getElementById('end-title').textContent)) === 'Isle saved!');
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await until(page, () => document.getElementById('end').hidden);
  const again = await page.evaluate(() => ({ active: window.__game.story.active, state: window.__game.waves.state }));
  check('playing again skips the introduction and starts straight away', !again.active && ['break', 'spawning'].includes(again.state), JSON.stringify(again));

  await page.evaluate(() => { const G = window.__game; G.ember.takeHit(1000, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); });
  await until(page, () => window.__game.story.active);
  check('being knocked out brings a short conversation too, with no end screen yet', await page.evaluate(() => document.getElementById('end').hidden));
  await readOn(page);
  await until(page, () => !document.getElementById('end').hidden);
  check('then the "Knocked out" screen appears', (await page.evaluate(() => document.getElementById('end-title').textContent)) === 'Knocked out');

  // Phone: touches advance the conversation and never steer.
  KEEP_INTRO = true;
  ({ page, context } = await openGame(browser, 'story-touch', { width: 390, height: 844 }, true));
  KEEP_INTRO = false;
  const client = await context.newCDPSession(page);
  await page.waitForTimeout(700);
  const touchAt = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0 }] });
  await touchAt('touchStart', 60, 300);
  const steering = await page.evaluate(() => document.getElementById('joystick').classList.contains('active'));
  await touchAt('touchEnd');
  check('touching the screen during a conversation does not start the joystick', !steering);
  for (let guard = 0; guard < 30; guard++) {
    if (await page.evaluate(() => document.getElementById('dialogue-name').textContent === 'Pip' && /Drag on the left/.test(document.getElementById('dialogue-text').textContent))) break;
    await page.waitForTimeout(350);
    await touchAt('touchStart', 195, 300); await touchAt('touchEnd');
    await touchAt('touchStart', 195, 300); await touchAt('touchEnd');
  }
  await until(page, () => /Drag on the left to run\. Tap the flame to blast\./.test(document.getElementById('dialogue-text').textContent));
  check('on a phone the last line mentions dragging and the flame button', true);
  await page.screenshot({ path: `${OUT}/story-4-phone.png` });
  const box = await page.evaluate(() => { const r = document.getElementById('dialogue-box').getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom }; });
  check('the conversation box fits a phone screen', box.left >= 0 && box.right <= 390 && box.bottom <= 844, JSON.stringify(box));
  await readOn(page).catch(() => {});
}

(async () => {
  const wanted = process.argv.slice(3);
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const chunks = { 1: chunk1, 2: chunk2, 3: chunk3, 4: chunk4, 5: chunk5 };
  for (const [number, run] of Object.entries(chunks)) {
    if (wanted.length === 0 || wanted.includes(number)) await run(browser);
  }
  await browser.close();
  console.log(results.join('\n'));
  console.log(problems.length ? '\nPROBLEMS:\n' + problems.join('\n') : '\nNo console errors, warnings, or missing files.');
})().catch((e) => { console.log(results.join('\n')); console.error('TEST SCRIPT FAILED:', e.message); process.exit(1); });
