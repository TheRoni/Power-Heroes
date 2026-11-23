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

let KEEP_INTRO = false;   // the prologue tests want the opening; every other test skips it

const OPEN = [];   // every game page opened so far: older ones are closed when a new one opens, so they stop using the (slow) software graphics

async function openGame(browser, label, viewport = { width: 800, height: 450 }, hasTouch = false, extra = {}) {
  await Promise.all(OPEN.splice(0).map((old) => old.close().catch(() => {})));
  const context = await browser.newContext({ viewport, hasTouch, isMobile: hasTouch, deviceScaleFactor: 1, ...extra });
  OPEN.push(context);
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
    if ((m.type() === 'error' || m.type() === 'warning') && !m.text().includes('GPU stall') && !m.text().includes('willReadFrequently')) problems.push(`[${label}] console ${m.type()}: ${m.text()}`);
  });
  await page.goto('http://game.local/' + (ARTIFACT ? '#debug' : '?debug'));
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 10, null, { timeout: 90000 });
  if (!KEEP_INTRO) await page.evaluate(() => window.__game.prologue.skip());
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
    return G.gloomlings.reduce((sum, m) => sum + Math.hypot(m.position.x - G.player.position.x, m.position.z - G.player.position.z), 0) / G.gloomlings.length;
  };
  const start = await page.evaluate(meanDistance);
  await until(page, (from) => {
    const G = window.__game;
    return G.gloomlings.reduce((sum, m) => sum + Math.hypot(m.position.x - G.player.position.x, m.position.z - G.player.position.z), 0) / G.gloomlings.length < from - 3;
  }, start);
  check('they run toward Ember', true);
  await until(page, () => window.__game.gloomlings.some((m) => m.mode === 'windup'));
  const healthAtWarning = await page.evaluate(() => window.__game.player.health);
  await page.screenshot({ path: `${OUT}/stage2-1-windup.png` });
  check('the first warning comes before any damage', healthAtWarning === 100, `health=${healthAtWarning}`);
  await until(page, () => document.querySelector('.floater.hurt'));
  const after = await page.evaluate(() => ({ health: window.__game.player.health, fill: document.getElementById('hud-fill').style.transform }));
  check('a bump takes health in steps of 8', after.health <= 92 && (100 - after.health) % 8 === 0, `health=${after.health}`);
  check('a red damage number pops up', true);
  await until(page, () => document.getElementById('hud-fill').style.transform !== 'scaleX(1)');
  check('the corner health bar shrinks', true);
  const onIsland = await page.evaluate(() => window.__game.gloomlings.every((m) => Math.hypot(m.position.x, m.position.z) <= 11.21));
  check('Gloomlings stay on the island', onIsland);

  // Live game: knocked out.
  ({ page } = await openGame(browser, 'chunk1-down'));
  await page.evaluate(() => { const G = window.__game; G.waves.reset(); G.player.takeHit(1000, 0, 0); });
  const downNow = await page.evaluate(() => ({ down: window.__game.player.down, health: window.__game.player.health }));
  check('Ember is knocked out at 0 health', downNow.down && downNow.health === 0);
  await page.keyboard.down('d');
  await page.waitForTimeout(600);
  const stillX = await page.evaluate(() => window.__game.player.velocity.x);
  await page.keyboard.up('d');
  check('the controls do nothing while she is out', Math.abs(stillX) < 0.01, `vx=${stillX.toFixed(3)}`);
}


// ---------- Chunk 2: fireballs, Flame Wave, button ----------
const chunk2Unit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createPowers } = await import('/src/powers.js');
  const out = {};
  const makeEmber = (x = 0, z = 0, yaw = 0) => ({ kind: 'ember', position: new THREE.Vector3(x, 0, z), yaw, down: false, faced: null, face(a) { this.yaw = a; this.faced = a; } });
  const setup = (positions, emberAt = [0, 0, 0]) => {
    const scene = new THREE.Scene();
    const ember = makeEmber(...emberAt);
    const gloomlings = positions.map(([x, z]) => createGloomling({ scene, x, z }));
    const log = { hits: [], kinds: [], defeats: 0, casts: 0 };
    const powers = createPowers({ scene, hero: ember, gloomlings, events: { hit: (g, a, k) => { log.hits.push(a); log.kinds.push(k); }, defeat: () => { log.defeats++; }, cast: () => { log.casts++; } } });
    return { scene, ember, gloomlings, powers, log };
  };
  const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) s.powers.update(1 / 30, i / 30); };

  { const s = setup([[5, 0]]); run(s, 2.5); out.fire = { hits: s.log.hits.length, each: s.log.hits[0], defeats: s.log.defeats, left: s.gloomlings.length, balls: s.powers.shotCount }; }
  { const s = setup([[8, 0]]); run(s, 2); out.outOfRange = { hits: s.log.hits.length, health: s.gloomlings[0].health }; }
  { const s = setup([[3, 0], [6, 0]]); run(s, 0.5); out.nearest = { near: s.gloomlings[0].health, far: s.gloomlings[1].health }; }
  { const s = setup([[3, 0]]); s.ember.down = true; run(s, 1.5); out.downNoFire = s.log.hits.length; }
  {
    const s = setup([[0, 3], [0, 7], [3, 3], [4, 2], [0, -3.5], [-2, 5]]);
    const [A, B, C, D, E, F] = s.gloomlings;
    s.powers.castPower();
    run(s, 1.2);
    out.cone = { A: A.alive, B: B.alive, C: C.alive, D: D.alive, E: E.alive, F: F.alive, bigHits: s.log.kinds.filter((k) => k === 'big').length, casts: s.log.casts };
  }
  {
    const s = setup([]);
    out.cd = { first: s.powers.castPower(), second: s.powers.castPower(), progressStart: s.powers.powerProgress, readyStart: s.powers.powerReady };
    run(s, 2.5); out.cd.halfway = s.powers.powerProgress;
    run(s, 2.6); out.cd.ready = s.powers.powerReady; out.cd.third = s.powers.castPower();
    run(s, 5.2); s.ember.down = true; out.cd.whileDown = s.powers.castPower();
  }
  { const s = setup([[0, 4]], [0, 0, Math.PI]); s.powers.castPower(); out.aim = { faced: s.ember.faced }; run(s, 0.6); out.aim.defeats = s.log.defeats; }
  { const s = setup([], [0, 0, 1.0]); s.powers.castPower(); out.straight = s.ember.faced; }
  {
    const calls = [];
    const fake = { position: { x: 0, z: 3 }, radius: 0.5, alive: true, hit(d, px, pz) { calls.push({ d, px, pz }); return false; }, remove() {} };
    const scene = new THREE.Scene();
    const powers = createPowers({ scene, hero: makeEmber(0, 0, 0), gloomlings: [fake], events: {} });
    powers.castPower();
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
  check('the Flame Wave button starts out glowing (ready)', await page.evaluate(() => document.getElementById('power-button').classList.contains('ready')));
  await page.keyboard.press('Space');
  await until(page, () => !document.getElementById('power-button').classList.contains('ready'));
  const sweep = await page.evaluate(() => ({ p: window.__game.powers.powerProgress, left: parseFloat(document.getElementById('power-button').style.getPropertyValue('--left')) }));
  check('Space fires it, and the button shows the recharge sweep', sweep.p < 0.3 && sweep.left > 0.6, `progress=${sweep.p.toFixed(2)}, sweep=${sweep.left}`);
  await until(page, () => document.getElementById('power-button').classList.contains('ready'), null, 180000);
  check('the button glows again when the wave is ready', true);
  await page.click('#power-button');
  check('clicking the button fires it too', (await page.evaluate(() => window.__game.powers.powerProgress)) < 0.3);
  await until(page, () => document.querySelector('.floater.hit, .floater.big'));
  check('damage numbers pop up over hit Gloomlings', true);
  await until(page, () => window.__game.waves.progress > 0 || window.__game.player.down);
  check('Gloomlings get defeated in the live game', await page.evaluate(() => window.__game.waves.progress > 0));

  // Screenshot in the middle of a Flame Wave.
  ({ page } = await openGame(browser, 'chunk2-shot'));
  await until(page, () => { const G = window.__game; return G.gloomlings.filter((m) => Math.hypot(m.position.x - G.player.position.x, m.position.z - G.player.position.z) < 5.5).length >= 2; });
  await page.keyboard.press('Space');
  await page.waitForTimeout(120);
  await page.screenshot({ path: `${OUT}/stage2-2-wave.png` });

  // Phone: tapping the button fires the wave without touching the joystick.
  ({ page, context } = await openGame(browser, 'chunk2-touch', { width: 390, height: 844 }, true));
  const client = await context.newCDPSession(page);
  const geometry = await page.evaluate(() => {
    const b = document.getElementById('power-button').getBoundingClientRect();
    const h = document.getElementById('hint').getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, half: window.innerWidth / 2, overlap: !(h.right < b.left || h.left > b.right || h.bottom < b.top || h.top > b.bottom), inside: b.right <= window.innerWidth && b.bottom <= window.innerHeight };
  });
  check('the button is on the right half and on screen', geometry.x > geometry.half && geometry.inside);
  check('the hint text does not overlap the button', !geometry.overlap);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: geometry.x, y: geometry.y, id: 0 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const tap = await page.evaluate(() => ({ p: window.__game.powers.powerProgress, stick: document.getElementById('joystick').classList.contains('active'), move: window.__game.input.move.x }));
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
    const waves = createWaves({ scene, hero: ember, gloomlings, events: { wave: (n, t) => log.waves.push(`${n}/${t}`), spawn: () => { log.spawns++; }, cleared: (n) => log.cleared.push(n), end: (k) => log.end.push(k) } });
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
    return { win, early: { hidden: document.getElementById('end').hidden, ready: G.powers.powerReady } };
  });
  check('beating wave 3 shows "Isle saved!" and a Play again button', !win.hidden && win.title === 'Isle saved!' && win.button === 'Play again' && win.state === 'over', JSON.stringify(win));
  check('a key press in the first moment is ignored (no accidental skip)', !early.hidden && early.ready);
  await page.screenshot({ path: `${OUT}/stage2-3-win.png` });
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await until(page, () => document.getElementById('end').hidden);
  const again = await page.evaluate(() => ({ state: window.__game.waves.state, health: window.__game.player.health, ready: window.__game.powers.powerReady, wave: window.__game.waves.wave, count: window.__game.gloomlings.length }));
  check('Space on the win screen starts a fresh round (and does not fire the wave)', again.health === 100 && again.ready && again.wave === 1 && again.count === 0 && ['break', 'spawning'].includes(again.state), JSON.stringify(again));

  await page.evaluate(() => { const G = window.__game; G.player.takeHit(1000, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); G.story.skip(); });
  const lose = await page.evaluate(() => ({ hidden: document.getElementById('end').hidden, title: document.getElementById('end-title').textContent, button: document.getElementById('end-button').textContent }));
  check('being knocked out shows "Knocked out" and a Try again button', !lose.hidden && lose.title === 'Knocked out' && lose.button === 'Try again', JSON.stringify(lose));
  await page.screenshot({ path: `${OUT}/stage2-3-lose.png` });
  await page.waitForTimeout(900);
  await page.click('#end-button');
  await until(page, () => document.getElementById('end').hidden);
  const retry = await page.evaluate(() => ({ health: window.__game.player.health, down: window.__game.player.down, wave: window.__game.waves.wave }));
  check('clicking Try again gives Ember full health and wave 1', retry.health === 100 && !retry.down && retry.wave === 1, JSON.stringify(retry));

  // Phone: the end screen fits, and touches on it never steer.
  ({ page, context } = await openGame(browser, 'chunk3-touch', { width: 390, height: 844 }, true));
  const client = await context.newCDPSession(page);
  await page.evaluate(() => { const G = window.__game; G.player.takeHit(1000, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); G.story.skip(); });
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
  check('tapping Try again on a phone restarts the round', await page.evaluate(() => window.__game.player.health === 100 && !document.getElementById('joystick').classList.contains('active')));
}


// ---------- Chunk 4: screen shake, freeze-frame, returning colour, confetti ----------
async function chunk4(browser) {
  let { page } = await openGame(browser, 'chunk4');
  const veil0 = await page.evaluate(() => parseFloat(document.getElementById('tint').style.opacity));
  check('the island starts washed-out (grey veil about 0.6)', near(veil0, 0.6, 0.03), `opacity=${veil0}`);
  await page.screenshot({ path: `${OUT}/stage2-4-washed-out.png` });

  await page.evaluate(() => { const G = window.__game; G.waves.reset(); G.player.takeHit(8, 5, 0); });
  const shaken = await page.evaluate(() => window.__game.fx.shake);
  check('Ember being hit shakes the screen', shaken > 0.04, `shake=${shaken.toFixed(2)}`);
  await until(page, () => window.__game.fx.shake === 0);
  check('the shake fades away by itself', true);

  await page.evaluate(async () => {
    const G = window.__game;
    G.waves.reset();
    const { createGloomling } = await import('/src/gloom.js');
    for (const [x, z] of [[0, 3], [1.5, 3.5], [-1.5, 3.5]]) G.gloomlings.push(createGloomling({ scene: G.world.scene, x, z }));
    G.player.position.set(0, 0, 0);
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
    G.player.velocity.x = 7;
    window.__x0 = G.player.position.x;
    window.__f0 = G.renderer.info.render.frame;
    G.fx.freeze = 0.5;
  });
  await until(page, () => window.__game.renderer.info.render.frame > window.__f0 + 1);
  const held = await page.evaluate(() => Math.abs(window.__game.player.position.x - window.__x0));
  check('during a freeze-frame nothing moves', held < 1e-9, `moved ${held}`);
  await until(page, () => Math.abs(window.__game.player.position.x - window.__x0) > 0.01);
  check('and then the game carries on', true);

  ({ page } = await openGame(browser, 'chunk4-calm', undefined, false, { reducedMotion: 'reduce' }));
  await page.evaluate(() => { const G = window.__game; G.waves.reset(); G.player.takeHit(8, 5, 0); });
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


// ---------- Story: conversations, lessons, bubbles (Pip and Marlo) ----------
const storyUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createStory } = await import('/src/story.js');
  const { SCENES, BUBBLES, SPEAKERS } = await import('/src/story-data.js');
  const out = {};
  const make = (touch) => {
    const doc = document.implementation.createHTMLDocument('story test');
    doc.body.innerHTML = '<div id="bubble"></div><div id="lesson" hidden></div><div id="dialogue" hidden><div id="dialogue-box"><div id="dialogue-face"></div><div id="dialogue-body"><div id="dialogue-name"></div><p id="dialogue-text"></p></div><div id="dialogue-next"></div></div></div>';
    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 100);
    camera.position.set(0, 10, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const log = { started: 0, spoke: 0, done: 0, waits: [], cues: [] };
    const pip = new THREE.Object3D(); pip.position.set(-3, 0, 0);       // Pip is left of the middle of the picture, Marlo right of it
    const marlo = new THREE.Object3D(); marlo.position.set(3, 0, 0);
    const story = createStory({
      camera, anchors: { pip: { object: pip, lift: 0.7 }, marlo: { object: marlo, lift: 3.4 } }, root: doc, touch,
      onStart: () => { log.started++; }, onSpeak: () => { log.spoke++; }, onWait: (kind) => { log.waits.push(kind); }, onCue: (cue) => { log.cues.push(cue); },
    });
    return { story, log, $: (id) => doc.getElementById(id) };
  };
  const press = (code) => document.body.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true }));   // like a real key press: it starts at the page and travels up
  const letters = (s) => s.$('dialogue-text').textContent.length;
  const tap = (s) => s.$('dialogue').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  const readToLesson = (s) => { for (let i = 0; i < 60 && !s.story.waiting; i++) { press('Space'); press('Space'); } };

  {   // the prologue, line by line
    const s = make(false);
    const first = SCENES.prologue[0];
    s.story.scene('prologue', () => { s.log.done++; });
    out.opened = { active: s.story.active, shown: !s.$('dialogue').hidden, started: s.log.started, name: s.$('dialogue-name').textContent, cues: s.log.cues.slice(), spoke: s.log.spoke };
    s.story.update(0.1);
    out.typingEarly = letters(s);
    press('Space');
    out.lockHeld = letters(s) < first[1].length;
    s.story.update(0.3);
    out.typingLater = letters(s);
    press('Space');
    out.finished = s.$('dialogue-text').textContent === first[1] && s.$('dialogue-next').classList.contains('on');
    press('Space');
    out.nextLine = { name: s.$('dialogue-name').textContent, letters: letters(s) };
    readToLesson(s);
    out.wait1 = { waiting: s.story.waiting, active: s.story.active, inScene: s.story.inScene, hidden: s.$('dialogue').hidden, hint: s.$('lesson').textContent, shown: !s.$('lesson').hidden, waits: s.log.waits.slice() };
    out.refusedInLesson = s.story.say('wave1') === false;
    let ws = 0;
    const probe = (e) => { if (e.code === 'KeyW') ws++; };
    window.addEventListener('keydown', probe); press('KeyW'); window.removeEventListener('keydown', probe);
    out.keysFreeInLesson = ws === 1;
    const startedBefore = s.log.started;
    s.story.resume();
    out.resumed = { active: s.story.active, waiting: s.story.waiting, lessonHidden: s.$('lesson').hidden, started: s.log.started - startedBefore, name: s.$('dialogue-name').textContent, letters: letters(s) };
    press('Space');
    out.lockAfterLesson = letters(s) === 0;
    s.story.update(0.3);
    s.story.resume();   // not in a lesson: nothing happens
    out.resumeIdle = { started: s.log.started - startedBefore, active: s.story.active };
    for (let i = 0; i < 80 && s.story.inScene; i++) {
      if (s.story.waiting) s.story.resume(); else { press('Space'); press('Space'); }
      s.story.update(0.3);
    }
    out.ended = { active: s.story.active, waiting: s.story.waiting, hidden: s.$('dialogue').hidden, lessonHidden: s.$('lesson').hidden, done: s.log.done, waits: s.log.waits.slice() };
  }
  for (const [touch, key] of [[true, 'phone'], [false, 'computer']]) {   // a lesson's hint can differ on a phone and a computer
    const s = make(touch);
    s.story.scene('prologue');
    s.story.update(0.3);
    readToLesson(s);
    out[key] = s.$('lesson').textContent;
    s.story.skip();
    out[key + 'Skip'] = { waiting: s.story.waiting, lessonHidden: s.$('lesson').hidden, active: s.story.active, inScene: s.story.inScene };
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
    out.tapTooSoon = letters(s) < SCENES.lose[0][1].length && s.$('dialogue-name').textContent === 'Marlo';
    s.story.update(0.3);
    const before = letters(s);
    tap(s);
    out.tapFinishes = letters(s) > before && s.$('dialogue-text').textContent === SCENES.lose[0][1];
  }
  {   // bubbles: Pip's are plain, Marlo's are named, and each floats by its own speaker
    const s = make(false);
    const textOf = (b) => (typeof b === 'string' ? b : `${SPEAKERS[b.who].name}: ${b.text}`);
    const valid = (text) => BUBBLES.wave1.some((b) => textOf(b) === text);
    const bubbleX = () => +/translate\(([\d.-]+)px/.exec(s.$('bubble').style.transform)[1];
    out.said = s.story.say('wave1');
    const text = s.$('bubble').textContent;
    out.bubble = { valid: valid(text), visible: s.$('bubble').classList.contains('show'), spokeRight: s.log.spoke === (text.startsWith('Marlo: ') ? 0 : 1) };
    s.story.update(1); s.story.update(1); s.story.update(1.5);
    out.bubbleGone = !s.$('bubble').classList.contains('show');
    let repeats = 0, previous = '', pipX = null, marloX = null;
    for (let i = 0; i < 80; i++) {
      s.story.say('wave1');
      const t = s.$('bubble').textContent;
      if (t === previous) repeats++;
      previous = t;
      s.story.update(0.01);
      if (t.startsWith('Marlo: ')) marloX = bubbleX(); else pipX = bubbleX();
    }
    out.repeats = repeats;
    out.anchored = { pipX, marloX };
    s.story.scene('lose');
    out.duringScene = s.story.say('wave1');
    s.story.skip();
    out.unknown = s.story.say('nonsense');
  }
  {   // the words themselves: every step is well formed and short
    const problems = [];
    const lengthOk = (text) => (typeof text === 'string' ? [text] : [text.touch, text.keys]).every((t) => typeof t === 'string' && t.length > 0 && t.length <= 100);
    for (const [id, steps] of Object.entries(SCENES)) {
      steps.forEach((step, i) => {
        if (Array.isArray(step)) { if (!SPEAKERS[step[0]] || !lengthOk(step[1])) problems.push(`${id}#${i}`); }
        else if (!['move', 'strike', 'power'].includes(step.wait) || !lengthOk(step.hint)) problems.push(`${id}#${i} (lesson)`);
      });
    }
    for (const [id, list] of Object.entries(BUBBLES)) {
      list.forEach((b, i) => { if (!(typeof b === 'string' ? lengthOk(b) : SPEAKERS[b.who] && lengthOk(b.text))) problems.push(`bubble ${id}#${i}`); });
    }
    out.data = {
      problems,
      lessons: SCENES.prologue.filter((step) => !Array.isArray(step)).map((step) => step.wait),
      cue: SCENES.prologue.some((step) => Array.isArray(step) && step[2] === 'power-climb'),
      emberInWin: SCENES.win.some((step) => step[0] === 'ember'),
      marloLast: SCENES.win[SCENES.win.length - 1][0],
    };
  }
  return out;
};

async function readOn(page) {   // one press at a time: it finishes the line, or goes on to the next
  const names = new Set();
  for (let guard = 0; guard < 80; guard++) {
    const now = await page.evaluate(() => ({ active: window.__game.story.active, name: document.getElementById('dialogue-name').textContent }));
    if (!now.active) break;
    names.add(now.name);
    await page.waitForTimeout(350);
    await page.keyboard.press('Space');
  }
  return [...names];
}

async function readUntil(page, done) {   // reads on (one press at a time) until the page says "done"
  for (let guard = 0; guard < 100; guard++) {
    if (await page.evaluate(done)) return true;
    await page.waitForTimeout(350);
    await page.keyboard.press('Space');
  }
  return false;
}

async function chunk5(browser) {
  const { SCENES, BUBBLES, SPEAKERS } = await import(`file://${ROOT}/src/story-data.js`);
  const bubbleTexts = (key) => BUBBLES[key].map((b) => (typeof b === 'string' ? b : `${SPEAKERS[b.who].name}: ${b.text}`));
  let { page } = await openGame(browser, 'story-unit');
  const u = await page.evaluate(storyUnit);
  check('a conversation opens with the first speaker, the controls are let go and the cue fires', u.opened.active && u.opened.shown && u.opened.started === 1 && u.opened.name === 'Marlo' && u.opened.cues.join() === 'power-climb' && u.opened.spoke === 0, JSON.stringify(u.opened));
  check('the words appear letter by letter', u.typingEarly > 0 && u.typingEarly < 12 && u.typingLater > u.typingEarly, `${u.typingEarly} then ${u.typingLater}`);
  check('a press in the first moment is ignored (tap lock)', u.lockHeld);
  check('the first press finishes the line, the next goes on', u.finished && u.nextLine.name === 'Sol' && u.nextLine.letters === 0, JSON.stringify(u.nextLine));
  check('a lesson hands the game back: the box hides, a hint shows, the game is told which lesson', u.wait1.waiting === 'move' && !u.wait1.active && u.wait1.inScene && u.wait1.hidden && u.wait1.shown && u.wait1.waits.join() === 'move' && u.wait1.hint.length > 10, JSON.stringify(u.wait1));
  check('during a lesson bubbles are refused and the movement keys reach the game', u.refusedInLesson && u.keysFreeInLesson);
  check('when the lesson is done the conversation comes back, the controls are let go, and the tap lock applies again', u.resumed.active && u.resumed.waiting === null && u.resumed.lessonHidden && u.resumed.started === 1 && u.resumed.name === 'Marlo' && u.lockAfterLesson, JSON.stringify(u.resumed));
  check('resuming when no lesson is on does nothing', u.resumeIdle.started === 1 && u.resumeIdle.active);
  check('the scene ends after its last line: box and hint hidden, "done" runs once, all three lessons were announced in order', !u.ended.active && u.ended.waiting === null && u.ended.hidden && u.ended.lessonHidden && u.ended.done === 1 && u.ended.waits.join() === 'move,strike,power', JSON.stringify(u.ended));
  check('a phone is told about the thumb controls, a computer about the keys', /Drag on the left/.test(u.phone) && /W A S D/.test(u.computer), `${u.phone} | ${u.computer}`);
  check('skipping during a lesson ends everything cleanly', !u.phoneSkip.inScene && u.phoneSkip.lessonHidden && !u.computerSkip.inScene && u.computerSkip.lessonHidden);
  check('during a conversation Space and movement keys never reach the game', u.swallowed.spaces === 0 && u.swallowed.ws === 0 && u.passed.spaces === 1 && u.passed.ws === 1, JSON.stringify([u.swallowed, u.passed]));
  check('a tap too soon is ignored, a later one finishes the line', u.tapTooSoon && u.tapFinishes);
  check('bubbles show a line from the right set (Marlo\'s are named), and fade after about 3 s', u.said && u.bubble.valid && u.bubble.visible && u.bubble.spokeRight && u.bubbleGone, JSON.stringify(u.bubble));
  check('Pip speaks only for his own bubbles, and each bubble floats by its speaker', u.anchored.pipX !== null && u.anchored.marloX !== null && u.anchored.pipX < 400 && u.anchored.marloX > 400, JSON.stringify(u.anchored));
  check('a bubble never repeats the line before it', u.repeats === 0, `repeats=${u.repeats}`);
  check('bubbles are refused during a conversation and for unknown names', u.duringScene === false && u.unknown === false);
  check('every line is well formed and short (100 letters at most)', u.data.problems.length === 0, u.data.problems.join(', '));
  check('the prologue has the three lessons in order and the Power-climb cue; the win scene has Ember and ends on Marlo', u.data.lessons.join() === 'move,strike,power' && u.data.cue && u.data.emberInWin && u.data.marloLast === 'marlo', JSON.stringify(u.data));

  // Live game: the first wave brings a bubble; the win and knocked-out conversations come before the end screens.
  ({ page } = await openGame(browser, 'story-live'));
  await until(page, () => document.getElementById('bubble').classList.contains('show'));
  const bubbleText = await page.evaluate(() => document.getElementById('bubble').textContent);
  check('the first wave brings a speech bubble from Pip or Marlo', bubbleTexts('wave1').includes(bubbleText), bubbleText);
  await page.screenshot({ path: `${OUT}/story-2-bubble.png` });
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  await until(page, () => window.__game.story.active);
  const winTalk = await page.evaluate(() => ({ endHidden: document.getElementById('end').hidden, text: document.getElementById('dialogue-name').textContent }));
  check('after the last wave the story talks first, with no end screen yet', winTalk.endHidden && winTalk.text === SPEAKERS[SCENES.win[0][0]].name, JSON.stringify(winTalk));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/story-3-win.png` });
  const winNames = await readOn(page);
  check('the win conversation has Pip, Marlo, Sol and Ember in it', ['Pip', 'Marlo', 'Sol', 'Ember'].every((n) => winNames.includes(n)), winNames.join());
  await until(page, () => !document.getElementById('end').hidden);
  check('then the "Isle saved!" screen appears', (await page.evaluate(() => document.getElementById('end-title').textContent)) === 'Isle saved!');
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await until(page, () => document.getElementById('end').hidden);
  const again = await page.evaluate(() => ({ active: window.__game.story.active, state: window.__game.waves.state, prologue: window.__game.prologue.phase }));
  check('playing again skips the prologue and starts straight away', !again.active && ['break', 'spawning'].includes(again.state) && again.prologue === 'done', JSON.stringify(again));

  await page.evaluate(() => { const G = window.__game; G.player.takeHit(1000, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); });
  await until(page, () => window.__game.story.active);
  check('being knocked out brings a short conversation too (Marlo helps Sol up), with no end screen yet', await page.evaluate(() => document.getElementById('end').hidden && document.getElementById('dialogue-name').textContent === 'Marlo'));
  await readOn(page);
  await until(page, () => !document.getElementById('end').hidden);
  check('then the "Knocked out" screen appears', (await page.evaluate(() => document.getElementById('end-title').textContent)) === 'Knocked out');
}


// ---------- Prologue: the falling star, Marlo, three lessons, the sunrise ----------
const prologueUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createSky } = await import('/src/sky.js');
  const out = {};
  const hero = (counter) => ({ position: new THREE.Vector3(0, 0, 0), down: false, takeHit: () => { counter.n++; return true; } });
  const run = (g, h, crowd, seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) g.update(1 / 30, h, i / 30, crowd); };
  const away = (g, x) => Math.hypot(g.position.x - x, g.position.z);
  {   // a training Gloomling: it never moves, never bumps, and a hit does not shove it
    const scene = new THREE.Scene();
    const bumps = { n: 0 };
    const h = hero(bumps);
    const dummy = createGloomling({ scene, x: 0.4, z: 0, passive: true });
    run(dummy, h, [dummy], 5);
    out.still = { bumps: bumps.n, moved: away(dummy, 0.4), mode: dummy.mode };
    const before = dummy.health;
    const finished = dummy.hit(3, 4, 0);
    run(dummy, h, [dummy], 1);
    out.struck = { lost: before - dummy.health, moved: away(dummy, 0.4), alive: dummy.alive, finished };
    out.killed = dummy.hit(1000, 0, 0) && !dummy.alive;
  }
  {   // a normal Gloomling still bumps and still gets shoved
    const scene = new THREE.Scene();
    const bumps = { n: 0 };
    const h = hero(bumps);
    const normal = createGloomling({ scene, x: 3, z: 0 });
    run(normal, h, [normal], 5);
    out.normalBumps = bumps.n;
    const other = createGloomling({ scene, x: 4, z: 0 });
    other.hit(1, 3, 0);
    other.update(0.1, { position: new THREE.Vector3(0, 0, 0), down: true, takeHit: () => true }, 0, [other]);
    out.normalShoved = other.position.x - 4;
  }
  {   // the sky: bright by day, dark and starry by night
    const sky = createSky();
    sky.resize(800, 450);
    const canvas = sky.texture.image;
    const light = (x, y) => { const d = canvas.getContext('2d').getImageData(x, y, 1, 1).data; return d[0] + d[1] + d[2]; };
    sky.set(0, 0);
    const day = light(5, 2);
    sky.set(1, 0);
    const night = light(5, 2);
    let stars = 0;
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 0; i < data.length; i += 4) if (data[i] + data[i + 1] + data[i + 2] > 450) stars++;
    out.sky = { day, night, stars, width: canvas.width, height: canvas.height };
  }
  return out;
};

const watch = () => {   // runs inside the page: remembers every phase, the strongest white flash and every number that popped up
  const G = window.__game;
  const w = window.__watch = { phases: [], flash: 0, floaters: [], star: false, crater: false, shake: 0 };
  const flash = document.getElementById('flash');
  (function loop() {
    const p = G.prologue.phase;
    if (w.phases[w.phases.length - 1] !== p) w.phases.push(p);
    w.flash = Math.max(w.flash, +getComputedStyle(flash).opacity);
    w.star = w.star || G.prologue.starVisible;
    w.crater = w.crater || G.prologue.craterVisible;
    w.shake = Math.max(w.shake, G.fx.shake);
    for (const f of document.querySelectorAll('.floater')) if (!w.floaters.includes(f.textContent)) w.floaters.push(f.textContent);
    requestAnimationFrame(loop);
  })();
};

const state = () => {   // a snapshot of the prologue, from inside the page
  const G = window.__game;
  const lesson = document.getElementById('lesson');
  const rect = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; };
  return {
    phase: G.prologue.phase, kind: G.prologue.lessonKind, active: G.story.active, waiting: G.story.waiting, night: G.world.night,
    name: document.getElementById('dialogue-name').textContent, boxHidden: document.getElementById('dialogue').hidden,
    hint: lesson.textContent, hintShown: !lesson.hidden, ring: G.prologue.ringVisible, crater: G.prologue.craterVisible, star: G.prologue.starVisible,
    gloom: G.gloomlings.length, autoFire: G.powers.autoFire, shots: G.powers.shotCount, ready: G.powers.powerReady, waves: G.waves.state,
    health: G.player.health, maxHealth: G.player.maxHealth, visible: G.player.group.visible, scale: G.player.group.scale.x,
    px: G.player.position.x, pz: G.player.position.z, marloAtHome: G.marlo.atHome, marloGap: Math.hypot(G.marlo.position.x - G.player.position.x, G.marlo.position.z - G.player.position.z),
    pipGap: Math.hypot(G.pip.group.position.x - G.marlo.position.x, G.pip.group.position.z - G.marlo.position.z), pipHeight: G.pip.group.position.y,
    bodyClass: document.body.classList.contains('prologue'), skipShown: !document.getElementById('skip').hidden,
    bannerTitle: document.getElementById('banner-title').textContent, bannerSub: document.getElementById('banner-sub').textContent,
    hintDisplay: getComputedStyle(document.getElementById('hint')).display,
    healths: G.gloomlings.map((g) => g.health), alive: G.gloomlings.filter((g) => g.alive).length,
    lessonRect: rect('lesson'), skipRect: rect('skip'), boxRect: rect('dialogue-box'), hudRect: rect('hud-hero'),
  };
};

async function chunk8(browser) {
  let { page } = await openGame(browser, 'prologue-unit');
  const u = await page.evaluate(prologueUnit);
  check('a training Gloomling never moves, never bumps, and a hit hurts it without shoving it', u.still.bumps === 0 && u.still.moved < 0.001 && u.struck.moved < 0.001 && u.struck.lost === 3 && u.struck.alive && !u.struck.finished && u.killed, JSON.stringify([u.still, u.struck]));
  check('a normal Gloomling still bumps and still gets shoved', u.normalBumps > 0 && u.normalShoved > 1, JSON.stringify([u.normalBumps, u.normalShoved]));
  check('the sky is bright by day, deep blue by night, and the night has stars', u.sky.day > 450 && u.sky.night < 150 && u.sky.stars > 20, JSON.stringify(u.sky));
  const lights = await page.evaluate(() => {
    const W = window.__game.world;
    const hemi = W.scene.children.find((c) => c.isHemisphereLight);
    const sun = W.scene.children.find((c) => c.isDirectionalLight);
    const read = () => [+hemi.intensity.toFixed(2), +sun.intensity.toFixed(2), W.night];
    const out = { start: read() };
    W.setNight(1, 0); out.night = read(); const nightBg = W.scene.background.image.getContext('2d').getImageData(5, 2, 1, 1).data[2];
    W.setNight(0.5, 0); out.half = read();
    W.setNight(0, 0); out.day = read(); out.nightBg = nightBg; out.dayBg = W.scene.background.image.getContext('2d').getImageData(5, 2, 1, 1).data[2];
    return out;
  });
  check('night dims the lights and darkens the sky; day brings them all back', lights.day[0] === 1.5 && lights.day[1] === 2.2 && lights.night[0] < 0.7 && lights.night[1] < 0.7 && lights.half[0] < 1.5 && lights.half[0] > lights.night[0] && lights.night[2] === 1 && lights.day[2] === 0 && lights.dayBg > lights.nightBg, JSON.stringify(lights));

  // Turning the phone (or resizing the window) at night and by day: the sky picture is made again at the new size.
  ({ page } = await openGame(browser, 'prologue-resize'));
  const sizes = [];
  for (const [night, width, height] of [[0, 500, 900], [1, 900, 500], [1, 390, 844], [0, 800, 450]]) {
    await page.evaluate((n) => window.__game.world.setNight(n, 0), night);
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(700);
    sizes.push(await page.evaluate(() => { const c = window.__game.world.scene.background.image; return [c.width, c.height]; }));
  }
  check('when the screen changes shape the sky is repainted at the new size, by day and at night (no graphics errors)', sizes.every(([w, h], i) => w === Math.ceil([500, 900, 390, 800][i] / 3) && h === Math.ceil([900, 500, 844, 450][i] / 3)), JSON.stringify(sizes));

  // Live game: the whole prologue, played like a person would.
  KEEP_INTRO = true;
  ({ page } = await openGame(browser, 'prologue-live'));
  KEEP_INTRO = false;
  await page.evaluate(watch);
  const open = await page.evaluate(state);
  check('the game opens at night in the prologue, with Sol off stage, a Skip button and the title', open.phase === 'dark' && open.night === 1 && !open.visible && open.waves === 'idle' && open.bodyClass && open.skipShown && open.bannerTitle === 'Prologue' && open.bannerSub === 'The Falling Star' && open.hintDisplay === 'none', JSON.stringify(open));
  await page.keyboard.down('d');
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  const held = await page.evaluate(state);
  await page.keyboard.up('d');
  check('the controls are off during the cinematic: Sol cannot walk and Space does nothing', held.px === 0 && held.ready && held.phase !== 'done', JSON.stringify([held.px, held.ready, held.phase]));
  await until(page, () => window.__game.prologue.starVisible);
  await page.screenshot({ path: `${OUT}/prologue-1-star.png` });
  check('a star falls out of the night sky', true);
  await until(page, () => window.__game.prologue.phase === 'rising');
  await page.screenshot({ path: `${OUT}/prologue-2-landing.png` });
  await until(page, () => window.__game.prologue.phase === 'talking');
  const seen = await page.evaluate(() => window.__watch);
  check('the phases come in order: dark, falling, rising, walking, talking', seen.phases.join() === 'dark,falling,rising,walking,talking', seen.phases.join());
  check('the landing makes a white flash and a shake, and leaves a glowing crater', seen.flash > 0.3 && seen.shake > 0.1 && seen.star && seen.crater, JSON.stringify([seen.flash, seen.shake, seen.star, seen.crater]));
  await page.waitForTimeout(1500);
  const talk = await page.evaluate(state);
  check('Marlo has walked over to Sol and starts to speak, with Pip floating by his shoulder', talk.active && talk.name === 'Marlo' && talk.marloGap < 3.2 && talk.pipGap < 3.2 && talk.pipHeight > 3, JSON.stringify([talk.name, talk.marloGap, talk.pipGap, talk.pipHeight]));
  check('Sol is back at full size, standing in the crater', talk.visible && near(talk.scale, 1, 0.001) && talk.crater && talk.night === 1, JSON.stringify([talk.visible, talk.scale, talk.crater]));
  await page.screenshot({ path: `${OUT}/prologue-3-marlo.png` });

  // Lesson one: walk into the ring.
  check('reading on leads to lesson one', await readUntil(page, () => window.__game.story.waiting === 'move'));
  const l1 = await page.evaluate(state);
  check('lesson one: the conversation steps aside, the hint names the keys, and a glowing ring appears', l1.kind === 'move' && !l1.active && l1.boxHidden && l1.hintShown && /W A S D/.test(l1.hint) && l1.ring && l1.gloom === 0, JSON.stringify([l1.kind, l1.hint, l1.ring]));
  await page.screenshot({ path: `${OUT}/prologue-4-lesson-walk.png` });
  await page.keyboard.down('d');   // right first, then down: the ring is to the right and a little toward the viewer
  await until(page, () => window.__game.player.position.x > 3.8);
  await page.keyboard.up('d');
  await page.keyboard.down('s');
  await until(page, () => window.__game.story.active);
  await page.keyboard.up('s');
  const l1done = await page.evaluate(state);
  check('walking into the ring ends the lesson, and Marlo carries on', l1done.active && l1done.kind === null && !l1done.ring && !l1done.hintShown && l1done.name === 'Marlo' && Math.hypot(l1done.px - 4.2, l1done.pz - 2.2) < 1.6, JSON.stringify([l1done.px, l1done.pz, l1done.name]));

  // Lesson two: the darts fire by themselves.
  check('reading on leads to lesson two', await readUntil(page, () => window.__game.story.waiting === 'strike'));
  const l2 = await page.evaluate(state);
  check('lesson two: one training Gloomling appears, close enough for the darts', l2.kind === 'strike' && l2.gloom === 1 && l2.autoFire && l2.hintShown && /darts/.test(l2.hint) && Math.hypot(l2.px - 4.2, l2.pz - 2.2) < 1.6, JSON.stringify([l2.gloom, l2.hint]));
  await until(page, () => window.__game.story.active);
  const l2done = await page.evaluate(state);
  check('the darts fire by themselves and bring it down; it never hurt Sol', l2done.gloom === 0 && l2done.kind === null && l2done.health === l2done.maxHealth && l2done.name !== '', JSON.stringify([l2done.gloom, l2done.health]));

  // Lesson three: Starburst.
  check('reading on leads to lesson three', await readUntil(page, () => window.__game.story.waiting === 'power'));
  const l3 = await page.evaluate(state);
  await page.waitForTimeout(1200);
  const l3rest = await page.evaluate(state);
  check('lesson three: three training Gloomlings stand around Sol, and the darts rest so only Starburst can reach them', l3.kind === 'power' && l3.gloom === 3 && !l3.autoFire && l3rest.alive === 3 && l3rest.shots === 0 && l3rest.healths.join() === l3.healths.join() && /Space/.test(l3.hint), JSON.stringify([l3.gloom, l3.autoFire, l3rest.healths, l3rest.shots]));
  await page.screenshot({ path: `${OUT}/prologue-5-lesson-power.png` });
  await page.keyboard.press('Space');
  await until(page, () => window.__game.story.active);
  const l3done = await page.evaluate(state);
  check('Starburst hits them and ends the lesson; the darts wake up again and the dummies are gone', l3done.gloom === 0 && l3done.autoFire && l3done.kind === null && l3done.name === 'Pip', JSON.stringify([l3done.gloom, l3done.autoFire, l3done.name]));

  // The sunrise.
  check('reading on leads to the sunrise', await readUntil(page, () => window.__game.prologue.phase === 'dawn'));
  const dawn = await page.evaluate(state);
  check('after the last line the sun comes up under the title "Sunmeadow, Chapter 1"; Marlo heads home; no wave yet', dawn.bannerTitle === 'Sunmeadow' && dawn.bannerSub === 'Chapter 1' && dawn.marloAtHome && dawn.waves === 'idle' && dawn.night < 1 && !dawn.skipShown, JSON.stringify([dawn.bannerTitle, dawn.marloAtHome, dawn.waves, dawn.night]));
  await page.screenshot({ path: `${OUT}/prologue-6-dawn.png` });
  await until(page, () => window.__game.prologue.phase === 'done');
  const day = await page.evaluate(state);
  check('then the first wave begins in full daylight, with the crater gone and the normal hint back', day.night === 0 && ['break', 'spawning'].includes(day.waves) && !day.bodyClass && !day.crater && day.hintDisplay !== 'none', JSON.stringify([day.night, day.waves, day.bodyClass, day.crater]));
  const seen2 = await page.evaluate(() => window.__watch);
  check('Sol\'s Power number climbed above their head while Marlo watched', ['Power 1', 'Power 2', 'Power 4', 'Power 7'].every((t) => seen2.floaters.includes(t)), seen2.floaters.join());
  await page.screenshot({ path: `${OUT}/prologue-7-day.png` });

  // Skip intro, mid-cinematic.
  KEEP_INTRO = true;
  ({ page } = await openGame(browser, 'prologue-skip'));
  KEEP_INTRO = false;
  await until(page, () => window.__game.prologue.phase === 'falling');
  await page.click('#skip');
  const sk = await page.evaluate(state);
  check('"Skip intro" jumps to daylight: Sol is on the island, the star is gone, Marlo is at his post and the first wave begins', sk.phase === 'done' && sk.night === 0 && sk.visible && near(sk.scale, 1, 0.001) && !sk.star && !sk.crater && sk.marloAtHome && ['break', 'spawning'].includes(sk.waves) && !sk.bodyClass && !sk.skipShown && sk.bannerTitle === 'Sunmeadow', JSON.stringify(sk));

  // Skip intro, in the middle of a lesson.
  KEEP_INTRO = true;
  ({ page } = await openGame(browser, 'prologue-lesson-skip'));
  KEEP_INTRO = false;
  await until(page, () => window.__game.prologue.phase === 'talking');
  await readUntil(page, () => window.__game.story.waiting === 'move');
  await page.evaluate(() => window.__game.player.position.set(4.2, 0, 2.2));
  check('(setting up) the darts handle lesson two while we wait, then lesson three begins', await readUntil(page, () => window.__game.story.waiting === 'power'));
  const mid = await page.evaluate(state);
  await page.click('#skip');
  const ls = await page.evaluate(state);
  check('skipping in the middle of the last lesson clears the dummies, brings the darts back and hides the hint', mid.kind === 'power' && mid.gloom === 3 && !mid.autoFire && ls.phase === 'done' && ls.gloom === 0 && ls.autoFire && !ls.hintShown && !ls.active && ls.kind === null && ['break', 'spawning'].includes(ls.waves), JSON.stringify([mid.kind, mid.gloom, mid.autoFire, ls.phase, ls.gloom, ls.autoFire]));

  // People who ask for less motion get a gentle glow instead of a flash, and no shaking.
  KEEP_INTRO = true;
  ({ page } = await openGame(browser, 'prologue-calm', undefined, false, { reducedMotion: 'reduce' }));
  KEEP_INTRO = false;
  await page.evaluate(watch);
  await until(page, () => window.__game.prologue.phase === 'walking');
  const calm = await page.evaluate(() => window.__watch);
  check('with "reduce motion" the landing is a soft glow (not a full white flash) and does not shake the screen', calm.flash > 0.1 && calm.flash <= 0.4 && calm.shake === 0, JSON.stringify([calm.flash, calm.shake]));
  await page.click('#skip');

  // Phone: touches, the hint and the Skip button.
  KEEP_INTRO = true;
  let context;
  ({ page, context } = await openGame(browser, 'prologue-phone', { width: 390, height: 844 }, true));
  KEEP_INTRO = false;
  const client = await context.newCDPSession(page);
  const touchAt = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0 }] });
  await until(page, () => window.__game.prologue.phase === 'talking');
  await touchAt('touchStart', 60, 300);
  const steering = await page.evaluate(() => document.getElementById('joystick').classList.contains('active'));
  await touchAt('touchEnd');
  check('touching the screen during the first conversation does not start the joystick', !steering);
  for (let guard = 0; guard < 60; guard++) {
    if (await page.evaluate(() => window.__game.story.waiting === 'move')) break;
    await page.waitForTimeout(350);
    await touchAt('touchStart', 195, 300); await touchAt('touchEnd');
  }
  const ph = await page.evaluate(state);
  check('on a phone lesson one tells you to drag, and the hint fits the screen without covering the Skip button', ph.waiting === 'move' && /Drag on the left/.test(ph.hint) && ph.lessonRect.left >= 0 && ph.lessonRect.right <= 390 && ph.lessonRect.top > ph.skipRect.bottom, JSON.stringify([ph.hint, ph.lessonRect, ph.skipRect]));
  check('the Skip button sits inside the screen and clear of the health bar', ph.skipRect.right <= 390 && ph.skipRect.left >= 0 && (ph.skipRect.left >= ph.hudRect.right || ph.skipRect.top >= ph.hudRect.bottom), JSON.stringify([ph.skipRect, ph.hudRect]));
  await page.screenshot({ path: `${OUT}/prologue-8-phone.png` });
  await touchAt('touchStart', (ph.skipRect.left + ph.skipRect.right) / 2, (ph.skipRect.top + ph.skipRect.bottom) / 2);
  const joystickOnSkip = await page.evaluate(() => document.getElementById('joystick').classList.contains('active'));
  await touchAt('touchEnd');
  await page.waitForTimeout(300);
  const after = await page.evaluate(state);
  check('a finger on the Skip button skips the prologue and does not steer', !joystickOnSkip && after.phase === 'done' && after.night === 0, JSON.stringify([joystickOnSkip, after.phase]));
}


// ---------- Heroes: Sol, light darts, Starburst, the general hero code ----------
const chunk6Unit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createHero } = await import('/src/hero.js');
  const { createPowers } = await import('/src/powers.js');
  const out = {};
  for (const kind of ['sol', 'ember']) {
    const scene = new THREE.Scene();
    let hurt = 0;
    const h = createHero({ scene, bound: 10.2, kind, onHurt: () => { hurt++; } });
    for (let i = 0; i < 20; i++) h.update(1 / 30, { x: 1, z: 0 }, i / 30);
    out[kind] = { name: h.name, type: h.type, health: h.health, max: h.maxHealth, moved: h.position.x > 1, hit: h.takeHit(8, 99, 0), after: h.health, hurt, objects: scene.children.length };
  }
  const makeSol = (x = 0, z = 0, yaw = 0) => ({ kind: 'sol', position: new THREE.Vector3(x, 0, z), yaw, down: false, faced: 0, face(a) { this.faced++; this.yaw = a; } });
  const setup = (positions, at = [0, 0, 0]) => {
    const scene = new THREE.Scene();
    const hero = makeSol(...at);
    const gloomlings = positions.map(([x, z]) => createGloomling({ scene, x, z }));
    const log = { hits: [], kinds: [], defeats: 0, casts: 0 };
    const powers = createPowers({ scene, hero, gloomlings, events: { hit: (g, a, k) => { log.hits.push(a); log.kinds.push(k); }, defeat: () => { log.defeats++; }, cast: () => { log.casts++; } } });
    return { scene, hero, gloomlings, powers, log };
  };
  const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) s.powers.update(1 / 30, i / 30); };

  { const s = setup([[5, 0]]); run(s, 2.5); out.darts = { hits: s.log.hits.length, each: s.log.hits[0], defeats: s.log.defeats, left: s.gloomlings.length, shots: s.powers.shotCount }; }
  {
    const s = setup([[2, 0], [0, -4], [3, 3], [4.6, 0], [6, 0], [0, 5.2]]);
    const [A, B, C, D, E, F] = s.gloomlings;
    s.powers.castPower();
    run(s, 1.2);
    out.ring = { A: A.alive, B: B.alive, C: C.alive, D: D.alive, E: E.alive, F: F.alive, big: s.log.kinds.filter((k) => k === 'big').length, casts: s.log.casts, faced: s.hero.faced };
  }
  {
    const calls = [];
    const fake = (x, z) => ({ position: { x, z }, radius: 0.5, alive: true, hit(d, px, pz) { calls.push({ d, px, pz }); return false; }, remove() {} });
    const powers = createPowers({ scene: new THREE.Scene(), hero: makeSol(), gloomlings: [fake(3, 0), fake(0, -2)], events: {} });
    powers.castPower();
    for (let i = 0; i < 20; i++) powers.update(1 / 30, i / 30);
    out.push = calls.filter((c) => c.d === 40);
    out.dartPush = calls.find((c) => c.d === 9);
  }
  {
    const s = setup([]);
    out.cd = { first: s.powers.castPower(), second: s.powers.castPower(), start: s.powers.powerProgress };
    run(s, 2.5); out.cd.half = s.powers.powerProgress;
    run(s, 2.6); out.cd.ready = s.powers.powerReady; out.cd.third = s.powers.castPower();
    run(s, 5.2); s.hero.down = true; out.cd.whileDown = s.powers.castPower();
  }
  return out;
};

async function chunk6(browser) {
  let { page } = await openGame(browser, 'heroes-unit');
  const u = await page.evaluate(chunk6Unit);
  check('Sol is a Light hero and Ember a Fire hero, each with 100 health', u.sol.name === 'Sol' && u.sol.type === 'light' && u.ember.name === 'Ember' && u.ember.type === 'fire' && u.sol.max === 100 && u.ember.max === 100, JSON.stringify([u.sol.name, u.sol.type, u.ember.name, u.ember.type]));
  check('both heroes can run, be hit once, and report it', u.sol.moved && u.ember.moved && u.sol.hit && u.ember.hit && u.sol.after === 92 && u.ember.after === 92 && u.sol.hurt === 1 && u.ember.hurt === 1);
  check('each hero adds its own parts to the scene (body and health bar)', u.sol.objects === 2 && u.ember.objects === 2, `${u.sol.objects}, ${u.ember.objects}`);
  check('Sol\'s light darts hit for 9, and 4 of them defeat a Gloomling', u.darts.hits === 4 && u.darts.each === 9 && u.darts.defeats === 1 && u.darts.left === 0 && u.darts.shots === 0, JSON.stringify(u.darts));
  check('Starburst hits everything inside the ring, in front and behind', !u.ring.A && !u.ring.B && !u.ring.C && !u.ring.D, JSON.stringify(u.ring));
  check('Starburst leaves what is outside the ring alone', u.ring.E && u.ring.F && u.ring.big === 4 && u.ring.casts === 1, JSON.stringify(u.ring));
  check('Starburst needs no aiming: Sol does not turn', u.ring.faced === 0);
  check('Starburst shoves each Gloomling 2.5 units straight away from Sol, once', u.push.length === 2 && u.push.some((c) => near(c.px, 2.5, 0.01) && near(c.pz, 0, 0.01)) && u.push.some((c) => near(c.px, 0, 0.01) && near(c.pz, -2.5, 0.01)), JSON.stringify(u.push));
  check('a dart only taps (0.3 units, no stun)', u.dartPush && near(Math.hypot(u.dartPush.px, u.dartPush.pz), 0.3, 0.01));
  check('Starburst recharges in 5 s, refuses a second cast, and does nothing when Sol is down', u.cd.first && !u.cd.second && near(u.cd.start, 0, 0.01) && near(u.cd.half, 0.5, 0.04) && u.cd.ready && u.cd.third && !u.cd.whileDown, JSON.stringify(u.cd));

  // Live game: the player is Sol.
  ({ page } = await openGame(browser, 'heroes-live'));
  const live = await page.evaluate(() => {
    const b = document.getElementById('power-button');
    const shown = (sel) => getComputedStyle(b.querySelector(sel)).display !== 'none';
    return { kind: window.__game.player.kind, name: document.getElementById('hud-name').textContent, label: document.getElementById('power-label').textContent, power: b.dataset.power, star: shown('.icon-star'), flame: shown('.icon-flame') };
  });
  check('the game is played as Sol: the corner says Sol and the button says Starburst with a star', live.kind === 'sol' && live.name === 'Sol' && live.label === 'Starburst' && live.power === 'starburst' && live.star && !live.flame, JSON.stringify(live));
  await page.screenshot({ path: `${OUT}/stage4-1-sol.png` });
  await page.evaluate(async () => {
    const G = window.__game;
    G.waves.reset();
    const { createGloomling } = await import('/src/gloom.js');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      G.gloomlings.push(createGloomling({ scene: G.world.scene, x: Math.cos(a) * 3.2, z: Math.sin(a) * 3.2 }));
    }
  });
  await page.keyboard.press('Space');
  await page.waitForTimeout(130);
  await page.screenshot({ path: `${OUT}/stage4-1-starburst.png` });
  await until(page, () => window.__game.gloomlings.length === 0);
  check('Starburst in the live game clears six Gloomlings circling Sol', true);

  // The button changes with the hero (Ember's flame is still there for later).
  ({ page } = await openGame(browser, 'heroes-ui'));
  const swapped = await page.evaluate(() => {
    const b = document.getElementById('power-button');
    window.__game.ui.setHero({ name: 'Ember', powerName: 'Flame Wave', powerId: 'flamewave' });
    const shown = (sel) => getComputedStyle(b.querySelector(sel)).display !== 'none';
    return { name: document.getElementById('hud-name').textContent, label: document.getElementById('power-label').textContent, flame: shown('.icon-flame'), star: shown('.icon-star') };
  });
  check('the corner name, button label and icon follow the hero (Ember gets her flame back)', swapped.name === 'Ember' && swapped.label === 'Flame Wave' && swapped.flame && !swapped.star, JSON.stringify(swapped));
}


// ---------- Marlo: the mentor ----------
const marloUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createMarlo } = await import('/src/marlo.js');
  const out = {};
  const make = () => { let sparks = 0; const marlo = createMarlo({ scene: new THREE.Scene(), emit: () => { sparks++; } }); return { marlo, sparks: () => sparks }; };
  const run = (m, seconds, hero = null) => { for (let i = 0; i < Math.round(seconds * 30); i++) m.update(1 / 30, i / 30, hero); };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  { const { marlo } = make(); let parts = 0; marlo.group.traverse(() => { parts++; }); out.built = { parts, home: dist(marlo.position, { x: -5.4, z: -8.6 }), atHome: marlo.atHome, lantern: marlo.lantern }; }
  { const { marlo } = make(); const start = { x: marlo.position.x, z: marlo.position.z }; marlo.walkTo(3, -2); run(marlo, 1); out.walk1 = dist(marlo.position, start); out.arrivedEarly = marlo.arrived; run(marlo, 6); out.arrived = { arrived: marlo.arrived, off: dist(marlo.position, { x: 3, z: -2 }), atHome: marlo.atHome }; }
  { const { marlo } = make(); const hero = { x: -4.4, z: -8.6 }; run(marlo, 3, hero); out.aside = { apart: dist(marlo.position, hero), edge: Math.hypot(marlo.position.x, marlo.position.z) }; }
  { const { marlo } = make(); marlo.walkTo(0, 0); run(marlo, 6); run(marlo, 2, { x: 1, z: 0 }); out.stays = dist(marlo.position, { x: 0, z: 0 }); }
  { const { marlo } = make(); const hero = { x: marlo.position.x + 4, z: marlo.position.z }; run(marlo, 2, hero); out.facing = marlo.yaw; }
  { const { marlo, sparks } = make(); marlo.raise(true); run(marlo, 2); out.lanternUp = marlo.lantern; const before = sparks(); run(marlo, 3); out.sparks = sparks() - before; marlo.raise(false); run(marlo, 2.5); out.lanternDown = marlo.lantern; }
  { const { marlo } = make(); marlo.walkTo(30, 30); run(marlo, 14); out.edge = Math.hypot(marlo.position.x, marlo.position.z); }
  { const { marlo } = make(); marlo.walkTo(2, 2); run(marlo, 8); marlo.goHome(); run(marlo, 8); out.home = { atHome: marlo.atHome, off: dist(marlo.position, { x: -5.4, z: -8.6 }) }; }
  return out;
};

async function chunk7(browser) {
  let { page } = await openGame(browser, 'marlo-unit');
  const u = await page.evaluate(marloUnit);
  check('Marlo is built from many parts and waits at his post, lantern lowered', u.built.parts > 30 && u.built.home < 0.01 && u.built.atHome && u.built.lantern === 0, JSON.stringify(u.built));
  check('Marlo walks at 2.4 units a second and stops where he is sent', near(u.walk1, 2.4, 0.15) && !u.arrivedEarly && u.arrived.arrived && u.arrived.off < 0.16 && !u.arrived.atHome, JSON.stringify([u.walk1, u.arrived]));
  check('at his post he shuffles aside when a hero comes close', u.aside.apart >= 2.4 && u.aside.edge <= 11.2001, JSON.stringify(u.aside));
  check('sent somewhere, he stays put even with a hero beside him', u.stays < 0.2, `moved ${u.stays.toFixed(2)}`);
  check('standing, he turns to face the hero', near(u.facing, Math.PI / 2, 0.06), `yaw=${u.facing.toFixed(2)}`);
  check('his lantern rises and falls smoothly, and throws warm sparks while raised', u.lanternUp > 0.9 && u.lanternDown < 0.1 && u.sparks > 5, JSON.stringify([u.lanternUp, u.lanternDown, u.sparks]));
  check('he never walks off the island', u.edge <= 11.2001, `distance=${u.edge.toFixed(2)}`);
  check('goHome() sends him back to his post', u.home.atHome && u.home.off < 0.16, JSON.stringify(u.home));

  // Live game: Marlo watches the fight, lantern up; Pip hovers by him in a conversation.
  ({ page } = await openGame(browser, 'marlo-live'));
  const first = await page.evaluate(() => { const G = window.__game; return { at: Math.hypot(G.marlo.position.x + 5.4, G.marlo.position.z + 8.6) }; });
  check('in the live game Marlo is at his post', first.at < 0.5, `off by ${first.at.toFixed(2)}`);
  await until(page, () => window.__game.marlo.lantern > 0.8);
  check('he raises his lantern when the fight starts', true);
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } G.story.skip(); });
  await until(page, () => window.__game.marlo.lantern < 0.2);
  check('and lowers it when the fight is won', true);
  await page.evaluate(() => { const G = window.__game; G.waves.reset(); G.marlo.walkTo(G.player.position.x + 2.2, G.player.position.z - 1.3); });
  await until(page, () => window.__game.marlo.arrived);
  await page.screenshot({ path: `${OUT}/stage4-2-marlo.png` });
  await page.evaluate(() => window.__game.story.scene('lose'));
  await until(page, () => { const G = window.__game; return Math.hypot(G.pip.group.position.x - G.marlo.position.x, G.pip.group.position.z - G.marlo.position.z) < 3.2 && G.pip.group.position.y > 3; });
  check('in a conversation Pip floats by Marlo, above his shoulder', true);
  await page.screenshot({ path: `${OUT}/stage4-2-pip-marlo.png` });
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => { const G = window.__game; return Math.hypot(G.pip.group.position.x - G.player.position.x, G.pip.group.position.z - G.player.position.z) < 3.2 && G.pip.group.position.y < 3.1; });
  check('after it, Pip goes back to the hero', true);
}

(async () => {
  const wanted = process.argv.slice(3);
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const chunks = { 1: chunk1, 2: chunk2, 3: chunk3, 4: chunk4, 5: chunk5, 6: chunk6, 7: chunk7, 8: chunk8 };
  for (const [number, run] of Object.entries(chunks)) {
    if (wanted.length === 0 || wanted.includes(number)) await run(browser);
  }
  await browser.close();
  console.log(results.join('\n'));
  console.log(problems.length ? '\nPROBLEMS:\n' + problems.join('\n') : '\nNo console errors, warnings, or missing files.');
})().catch((e) => { console.log(results.join('\n')); console.error('TEST SCRIPT FAILED:', e.message); process.exit(1); });
