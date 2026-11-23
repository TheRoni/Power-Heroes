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
let HERO_PARAM = '';      // play as another hero in the live game (?debug&hero=tide)
let SHOW_SQUAD = false;   // the squad tests want the squad screen (debug mode normally skips it)
let POWER_ON = false;     // real Power (debug mode normally keeps everyone at Power 10)
let SAVE_ON = false;      // saving to the browser (debug mode normally forgets)
// The address of the game with some debug switches: ?debug&title... normally, #debug-title... for the Claude test link.
const gameUrl = (flags) => (ARTIFACT ? 'http://game.local/#debug' + flags.map((f) => `-${f}`).join('') : 'http://game.local/?debug' + flags.map((f) => `&${f}`).join(''));
let SHOW_TITLE = false;   // the title-screen tests want the title screen (debug mode normally skips it)

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
  await page.goto(gameUrl([...(SHOW_TITLE ? ['title'] : []), ...(SHOW_SQUAD ? ['squad'] : []), ...(HERO_PARAM ? [`hero=${HERO_PARAM}`] : []), ...(POWER_ON ? ['power'] : []), ...(SAVE_ON ? ['power', 'save'] : [])]));
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 10, null, { timeout: 90000 });
  if (!KEEP_INTRO && !SHOW_TITLE) await page.evaluate(() => window.__game.prologue.skip());
  return { page, context };
}
const until = (page, fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout });

// The round has just ended: Marlo is put beside Sol (so he has already "arrived"), and we wait for the closing conversation to begin.
async function waitForClosing(page) {
  await page.evaluate(() => { const G = window.__game; const x = G.player.position.x + 2.2, z = G.player.position.z - 1.3; G.marlo.walkTo(x, z); G.marlo.position.set(x, 0, z); });
  await until(page, () => window.__game.story.active);
}

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
  await until(page, () => /^Wave 1\/3 · \d left · Gloom Power \d+$/.test(document.getElementById('hud-wave').textContent));
  check('the corner note shows the wave and how many are left', true);

  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 40; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  await waitForClosing(page);
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

  await page.evaluate(() => { const G = window.__game; G.player.takeHit(1000, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); });
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
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
  await page.evaluate(() => { const G = window.__game; G.player.takeHit(1000, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); });
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
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
  await waitForClosing(page);
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
  const { SONGS } = await import('/src/music-data.js');
  const out = {};
  const make = (touch) => {
    const doc = document.implementation.createHTMLDocument('story test');
    doc.body.innerHTML = '<div id="bubble"></div><div id="lesson" hidden></div><div id="dialogue" hidden><div id="dialogue-box"><div id="dialogue-face"></div><div id="dialogue-body"><div id="dialogue-name"></div><p id="dialogue-text"></p></div><div id="dialogue-next"></div></div></div>';
    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 100);
    camera.position.set(0, 10, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
    const log = { started: 0, spoke: 0, done: 0, waits: [], cues: [], songs: [] };
    const pip = new THREE.Object3D(); pip.position.set(-3, 0, 0);       // Pip is left of the middle of the picture, Marlo right of it
    const marlo = new THREE.Object3D(); marlo.position.set(3, 0, 0);
    const story = createStory({
      camera, anchors: { pip: { object: pip, lift: 0.7 }, marlo: { object: marlo, lift: 3.4 } }, root: doc, touch,
      onStart: () => { log.started++; }, onSpeak: () => { log.spoke++; }, onWait: (kind) => { log.waits.push(kind); }, onCue: (cue) => { log.cues.push(cue); },
      music: { play: (name, fade) => { log.songs.push(`${name}@${fade}`); return true; } },
    });
    return { story, log, $: (id) => doc.getElementById(id) };
  };
  const press = (code) => document.body.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true, bubbles: true }));   // like a real key press: it starts at the page and travels up
  const letters = (s) => s.$('dialogue-text').textContent.length;
  const tap = (s) => s.$('dialogue').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
  const readToLesson = (s) => { for (let i = 0; i < 60 && !s.story.waiting; i++) { press('Space'); press('Space'); } };

  {   // the prologue, line by line
    const s = make(false);
    const first = SCENES.prologue.find((step) => Array.isArray(step));   // (a scene may begin with a { music } step)
    s.story.scene('prologue', () => { s.log.done++; });
    out.opened = { active: s.story.active, shown: !s.$('dialogue').hidden, started: s.log.started, name: s.$('dialogue-name').textContent, cues: s.log.cues.slice(), spoke: s.log.spoke, songs: s.log.songs.slice() };
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
    out.tapTooSoon = letters(s) < SCENES.lose.find((step) => Array.isArray(step))[1].length && s.$('dialogue-name').textContent === 'Marlo';
    s.story.update(0.3);
    const before = letters(s);
    tap(s);
    out.tapFinishes = letters(s) > before && s.$('dialogue-text').textContent === SCENES.lose.find((step) => Array.isArray(step))[1];
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
        else if (step.music) { if (!SONGS[step.music]) problems.push(`${id}#${i} (no song "${step.music}")`); }
        else if (!['move', 'strike', 'power', 'arrive'].includes(step.wait) || (step.wait !== 'arrive' && !lengthOk(step.hint))) problems.push(`${id}#${i} (lesson)`);
      });
    }
    for (const [id, list] of Object.entries(BUBBLES)) {
      list.forEach((b, i) => { if (!((typeof b === 'string' || b.touch) ? lengthOk(b) : SPEAKERS[b.who] && lengthOk(b.text))) problems.push(`bubble ${id}#${i}`); });
    }
    out.data = {
      problems,
      lessons: SCENES.prologue.filter((step) => !Array.isArray(step) && step.wait).map((step) => step.wait),
      cue: SCENES.prologue.some((step) => Array.isArray(step) && step[2] === 'power-climb'),
      songs: Object.fromEntries(Object.entries(SCENES).map(([id, steps]) => [id, steps.filter((step) => !Array.isArray(step) && step.music).map((step) => step.music).join()])),
      emberInWin: SCENES.win.some((step) => step[0] === 'ember'),
      arriveBeforeEmber: (() => { const i = SCENES.win.findIndex((step) => !Array.isArray(step) && step.wait === 'arrive'); return i > 0 && SCENES.win[i + 1][0] === 'ember' && SCENES.win.slice(0, i).every((step) => !Array.isArray(step) || step[0] !== 'ember'); })(),
      marloLast: SCENES.win[SCENES.win.length - 1][0],
    };
  }
  return out;
};

async function readOn(page) {   // one press at a time: it finishes the line, or goes on to the next
  const names = new Set();
  for (let guard = 0; guard < 80; guard++) {
    const now = await page.evaluate(() => ({ active: window.__game.story.active, waiting: window.__game.story.waiting, name: document.getElementById('dialogue-name').textContent }));
    if (!now.active && !now.waiting) break;
    if (now.active) names.add(now.name);
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
  check('a { music } step changes the song with its own fade and the talk carries straight on', u.opened.songs.join() === 'marlo@2.5', JSON.stringify(u.opened.songs));
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
  check('every line is well formed and short (100 letters at most), and every song a scene names exists', u.data.problems.length === 0, u.data.problems.join(', '));
  check('the scenes pick their songs: Marlo\'s theme for the lessons and when he helps Sol up, the lullaby at "So did she"', u.data.songs.prologue === 'marlo' && u.data.songs.win === 'lullaby' && u.data.songs.lose === 'marlo', JSON.stringify(u.data.songs));
  check('the prologue has the three lessons in order and the Power-climb cue; the win scene has Ember and ends on Marlo', u.data.lessons.join() === 'move,strike,power' && u.data.cue && u.data.emberInWin && u.data.arriveBeforeEmber && u.data.marloLast === 'marlo', JSON.stringify(u.data));

  // Live game: the first wave brings a bubble; the win and knocked-out conversations come before the end screens.
  ({ page } = await openGame(browser, 'story-live'));
  await until(page, () => document.getElementById('bubble').classList.contains('show'));
  const bubbleText = await page.evaluate(() => document.getElementById('bubble').textContent);
  check('the first wave brings a speech bubble from Pip or Marlo', bubbleTexts('wave1').includes(bubbleText), bubbleText);
  await page.screenshot({ path: `${OUT}/story-2-bubble.png` });
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  await waitForClosing(page);
  const winTalk = await page.evaluate(() => ({ endHidden: document.getElementById('end').hidden, text: document.getElementById('dialogue-name').textContent }));
  check('after the last wave the story talks first, with no end screen yet', winTalk.endHidden && winTalk.text === SPEAKERS[SCENES.win.find((step) => Array.isArray(step))[0]].name, JSON.stringify(winTalk));
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
  await waitForClosing(page);
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
    phase: G.prologue.phase, kind: G.prologue.lessonKind, active: G.story.active, waiting: G.story.waiting, night: G.world.night, music: G.music.song,
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
  check('"The Falling Star" plays while the star falls and lands', (await page.evaluate(() => window.__game.music.song)) === 'falling-star');
  await until(page, () => window.__game.prologue.phase === 'talking');
  const seen = await page.evaluate(() => window.__watch);
  check('the phases come in order: dark, falling, rising, walking, talking', seen.phases.join() === 'dark,falling,rising,walking,talking', seen.phases.join());
  check('the landing makes a white flash and a shake, and leaves a glowing crater', seen.flash > 0.3 && seen.shake > 0.1 && seen.star && seen.crater, JSON.stringify([seen.flash, seen.shake, seen.star, seen.crater]));
  await page.waitForTimeout(1500);
  const talk = await page.evaluate(state);
  check('Marlo\'s theme took over from "The Falling Star" when he began to speak', talk.music === 'marlo', talk.music);
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
  check('the sunrise brings in "Sunmeadow"', dawn.music === 'sunmeadow', dawn.music);
  await until(page, () => window.__game.music.song === 'battle');
  check('and the first wave (a moment later) brings in "Battle"', true);
  check('then the first wave begins in full daylight, with the crater gone and the normal hint back', day.night === 0 && ['break', 'spawning'].includes(day.waves) && !day.bodyClass && !day.crater && day.hintDisplay !== 'none', JSON.stringify([day.night, day.waves, day.bodyClass, day.crater]));
  const seen2 = await page.evaluate(() => window.__watch);
  check('Sol\'s Power number climbed above their head while Marlo watched', ['Power 1', 'Power 2', 'Power 3', 'Power 5'].every((t) => seen2.floaters.includes(t)), seen2.floaters.join());
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
    window.__game.ui.setHero({ name: 'Ember', type: 'fire', powerName: 'Flame Wave', powerId: 'flamewave' });
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
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
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

// ---------- Ember's arrival and the closing scenes (Marlo walks over first) ----------
const guestUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createGuest } = await import('/src/hero.js');
  const out = {};
  const scene = new THREE.Scene();
  const guest = createGuest({ scene, bound: 10.5, kind: 'ember' });
  const shown = () => scene.children.filter((c) => c.visible).length;
  out.before = { state: guest.state, visible: guest.group.visible, arrived: guest.arrived, shown: shown() };
  guest.runIn(-9, 2.5, -2, 1, 0, 0);
  out.started = { state: guest.state, visible: guest.group.visible, shown: shown(), x: guest.position.x, z: guest.position.z };
  for (let i = 0; i < 15; i++) guest.update(1 / 30, i / 30);
  out.early = { state: guest.state, moved: guest.position.x + 9 };
  let t = 0.5;
  while (guest.state === 'running' && t < 8) { guest.update(1 / 30, t); t += 1 / 30; }
  out.arrival = { state: guest.state, arrived: guest.arrived, seconds: t, off: Math.hypot(guest.position.x + 2, guest.position.z - 1), yaw: guest.group.rotation.y, want: Math.atan2(0 - guest.position.x, 0 - guest.position.z) };
  let maxY = 0;
  for (let i = 0; i < 90; i++) { guest.update(1 / 30, t + i / 30); maxY = Math.max(maxY, guest.group.position.y); }
  out.cheer = { maxY, finalY: guest.group.position.y, off: Math.hypot(guest.position.x + 2, guest.position.z - 1) };
  guest.leave();
  out.left = { state: guest.state, visible: guest.group.visible, shown: shown(), y: guest.group.position.y };
  guest.runIn(-30, 0, 0, 0, 0, 5);
  guest.update(1 / 30, 0);
  out.clamped = Math.hypot(guest.position.x, guest.position.z);
  return out;
};

async function chunk9(browser) {
  let { page } = await openGame(browser, 'ember-unit');
  const u = await page.evaluate(guestUnit);
  check('a guest starts hidden, with no health bar even when shown', u.before.state === 'away' && !u.before.visible && !u.before.arrived && u.before.shown === 0 && u.started.visible && u.started.shown === 1, JSON.stringify([u.before, u.started]));
  check('it appears at the edge and runs toward its spot', u.started.state === 'running' && u.started.x === -9 && u.started.z === 2.5 && u.early.state === 'running' && u.early.moved > 1.5, JSON.stringify([u.started, u.early]));
  check('it stops at its spot within about two seconds, turns to face Sol and is "here"', u.arrival.state === 'here' && u.arrival.arrived && u.arrival.seconds < 3 && u.arrival.off < 0.3 && near(u.arrival.yaw, u.arrival.want, 0.15), JSON.stringify(u.arrival));
  check('it hops for joy for a moment, then stands still and flat on the ground', u.cheer.maxY > 0.15 && u.cheer.finalY === 0 && u.cheer.off < 0.35, JSON.stringify(u.cheer));
  check('leaving hides it again, and it can never be placed outside the island', u.left.state === 'away' && !u.left.visible && u.left.shown === 0 && u.left.y === 0 && u.clamped <= 10.51, JSON.stringify([u.left, u.clamped]));

  // Live game: the win. Marlo walks over first, then the conversation; Ember runs in when her turn comes.
  ({ page } = await openGame(browser, 'ember-live'));
  const ended = await page.evaluate(() => {
    const G = window.__game;
    for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); }
    return { state: G.waves.state, active: G.story.active, end: !document.getElementById('end').hidden, marloHome: G.marlo.atHome, ember: G.ember.state };
  });
  check('when the last wave is beaten Marlo sets off to meet Sol: no conversation yet, no end screen, no Ember', ended.state === 'over' && !ended.active && !ended.end && !ended.marloHome && ended.ember === 'away', JSON.stringify(ended));
  await page.keyboard.down('d');
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  const lock = await page.evaluate(() => ({ x: window.__game.player.position.x, ready: window.__game.powers.powerReady, active: window.__game.story.active }));
  await page.keyboard.up('d');
  check('while Marlo walks over the controls are off: Sol stands still and Space does nothing', lock.x === 0 && lock.ready, JSON.stringify(lock));
  await until(page, () => window.__game.story.active);
  const talk = await page.evaluate(state);
  check('the conversation begins once Marlo has arrived beside Sol, with Pip first', talk.name === 'Pip' && talk.marloGap < 3.2 && !talk.boxHidden, JSON.stringify([talk.name, talk.marloGap]));
  check('Ember has not appeared yet', (await page.evaluate(() => window.__game.ember.state)) === 'away');
  check('reading on leads to Ember\'s entrance', await readUntil(page, () => window.__game.story.waiting === 'arrive'));
  const run = await page.evaluate(() => {
    const G = window.__game;
    const p = G.ember.group.position;
    return { state: G.ember.state, visible: G.ember.group.visible, waiting: G.story.waiting, active: G.story.active, boxHidden: document.getElementById('dialogue').hidden, hintHidden: document.getElementById('lesson').hidden, x: p.x, z: p.z };
  });
  check('the talk pauses (no box, no hint) while Ember runs in from the left edge', run.waiting === 'arrive' && !run.active && run.boxHidden && run.hintHidden && (run.state === 'running' || run.state === 'here') && run.visible && run.x < 0, JSON.stringify(run));
  await page.screenshot({ path: `${OUT}/ember-1-running.png` });
  await page.keyboard.down('d');
  await page.keyboard.press('Space');
  await page.waitForTimeout(300);
  const frozenNow = await page.evaluate(() => ({ x: window.__game.player.position.x, ready: window.__game.powers.powerReady }));
  await page.keyboard.up('d');
  check('Sol cannot walk or use Starburst while Ember runs in', frozenNow.x === 0 && frozenNow.ready, JSON.stringify(frozenNow));
  await until(page, () => window.__game.story.active);
  const here = await page.evaluate(() => {
    const G = window.__game;
    const v = G.ember.group.position.clone().project(G.world.camera);
    return { name: document.getElementById('dialogue-name').textContent, state: G.ember.state, gap: Math.hypot(G.ember.position.x - G.player.position.x, G.ember.position.z - G.player.position.z), onScreen: Math.abs(v.x) < 1 && Math.abs(v.y) < 1, marloGap: Math.hypot(G.marlo.position.x - G.player.position.x, G.marlo.position.z - G.player.position.z) };
  });
  check('when she arrives the conversation carries on with her first line, and she stands beside Sol on screen', here.name === 'Ember' && here.state === 'here' && here.gap < 3.5 && here.gap > 1 && here.onScreen && here.marloGap < 3.2, JSON.stringify(here));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/ember-2-arrived.png` });
  const names = await readOn(page);
  await until(page, () => !document.getElementById('end').hidden);
  const stay = await page.evaluate(() => ({ title: document.getElementById('end-title').textContent, ember: window.__game.ember.state, marloHome: window.__game.marlo.atHome }));
  check('after the talk the "Isle saved!" screen shows, with Ember and Marlo still beside Sol', names.includes('Ember') && stay.title === 'Isle saved!' && stay.ember === 'here' && !stay.marloHome, JSON.stringify([names, stay]));
  check('Lyra\'s Lullaby came in at Marlo\'s "So did she" and plays on the end screen', (await page.evaluate(() => window.__game.music.song)) === 'lullaby');
  await page.screenshot({ path: `${OUT}/ember-3-end.png` });
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await until(page, () => document.getElementById('end').hidden);
  const again = await page.evaluate(() => ({ ember: window.__game.ember.state, visible: window.__game.ember.group.visible, marloHome: window.__game.marlo.atHome, state: window.__game.waves.state }));
  check('"Play again" sends Ember away and Marlo back to his post', again.ember === 'away' && !again.visible && again.marloHome && ['break', 'spawning'].includes(again.state), JSON.stringify(again));

  // Live game: being knocked out. Marlo walks over to the fallen hero; Ember never appears.
  await page.evaluate(() => { const G = window.__game; G.player.takeHit(1000, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); });
  const fallen = await page.evaluate(() => ({ state: window.__game.waves.state, active: window.__game.story.active, marloHome: window.__game.marlo.atHome }));
  check('when Sol is knocked out Marlo sets off to help, and the conversation waits for him', fallen.state === 'over' && !fallen.active && !fallen.marloHome, JSON.stringify(fallen));
  await until(page, () => window.__game.story.active);
  const help = await page.evaluate(state);
  check('he arrives, and the knocked-out conversation begins with Marlo, to his theme', help.name === 'Marlo' && help.marloGap < 3.2 && help.music === 'marlo', JSON.stringify([help.name, help.marloGap, help.music]));
  const lostNames = await readOn(page);
  await until(page, () => !document.getElementById('end').hidden);
  const lost = await page.evaluate(() => ({ title: document.getElementById('end-title').textContent, ember: window.__game.ember.state }));
  check('Ember does not come for a knocked-out round, and the "Knocked out" screen follows', !lostNames.includes('Ember') && lost.title === 'Knocked out' && lost.ember === 'away', JSON.stringify([lostNames, lost]));
}

// ---------- Sound: the effects, the sound engine, Mute, the title screen ----------
const audioUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { buildSound, SOUND_NAMES } = await import('/src/audio.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createPowers } = await import('/src/powers.js');
  const { createStory } = await import('/src/story.js');
  const out = { sounds: {} };
  const RATE = 22050;
  const render = async (name, pitch = 1) => {   // plays a sound on an offline "recording" context and returns the samples
    const ctx = new OfflineAudioContext(1, RATE * 4, RATE);
    const bus = ctx.createGain();
    bus.connect(ctx.destination);
    const length = buildSound(ctx, bus, name, 0, pitch, 1);
    return { length, data: (await ctx.startRendering()).getChannelData(0) };
  };
  const freq = (data) => {   // pitch from the zero crossings of the loud part
    let a = -1, b = -1, crossings = 0;
    for (let i = 0; i < data.length; i++) if (Math.abs(data[i]) > 0.003) { if (a < 0) a = i; b = i; }
    for (let i = a + 1; i <= b; i++) if ((data[i - 1] < 0) !== (data[i] < 0)) crossings++;
    return crossings / 2 / ((b - a) / RATE);
  };
  for (const name of SOUND_NAMES) {
    const { length, data } = await render(name);
    let peak = 0, sum = 0, bad = 0, lastLoud = 0;
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      if (!Number.isFinite(v)) { bad++; continue; }
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
      if (a > 0.002) lastLoud = i / RATE;
    }
    out.sounds[name] = { length: +length.toFixed(3), peak: +peak.toFixed(3), rms: +Math.sqrt(sum / data.length).toFixed(4), bad, lastLoud: +lastLoud.toFixed(3) };
  }
  out.blip = { low: freq((await render('blip', 1)).data), high: freq((await render('blip', 2)).data) };
  out.unknown = buildSound(new OfflineAudioContext(1, 100, RATE), null, 'no-such-sound');

  {   // the powers play their sounds: darts, hits, defeats, Starburst
    const calls = [];
    const audio = { play: (name) => { calls.push(name); return true; } };
    const scene = new THREE.Scene();
    const hero = { kind: 'sol', position: new THREE.Vector3(0, 0, 0), yaw: 0, down: false, face() {} };
    const gloomlings = [createGloomling({ scene, x: 5, z: 0 })];
    const powers = createPowers({ scene, hero, gloomlings, events: {}, audio });
    for (let i = 0; i < 90; i++) powers.update(1 / 30, i / 30);
    const count = (name) => calls.filter((n) => n === name).length;
    out.darts = { dart: count('dart'), tick: count('tick'), pop: count('pop'), left: gloomlings.length };
    for (const [x, z] of [[2, 0], [0, -3], [-3, 1]]) gloomlings.push(createGloomling({ scene, x, z }));
    calls.length = 0;
    powers.castPower();
    for (let i = 0; i < 30; i++) powers.update(1 / 30, i / 30);
    out.burst = { starburst: count('starburst'), bell: count('bell'), pop: count('pop'), tick: count('tick') };
  }
  {   // typing blips: a few per second while a line types, in the speaker's pitch
    const doc = document.implementation.createHTMLDocument('story test');
    doc.body.innerHTML = '<div id="bubble"></div><div id="lesson" hidden></div><div id="dialogue" hidden><div id="dialogue-box"><div id="dialogue-face"></div><div id="dialogue-body"><div id="dialogue-name"></div><p id="dialogue-text"></p></div><div id="dialogue-next"></div></div></div>';
    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 100);
    const pitches = [];
    const story = createStory({ camera, anchors: { pip: { object: new THREE.Object3D(), lift: 0 }, marlo: { object: new THREE.Object3D(), lift: 0 } }, root: doc, touch: false, audio: { play: (name, o) => { if (name === 'blip') pitches.push(o.pitch); return true; } } });
    story.scene('lose');
    for (let i = 0; i < 10; i++) story.update(0.1);
    out.blips = { count: pitches.length, min: Math.min(...pitches), max: Math.max(...pitches) };
  }
  return out;
};

async function chunk10(browser) {
  let { page } = await openGame(browser, 'audio-unit');
  const u = await page.evaluate(audioUnit);
  const names = Object.keys(u.sounds);
  const badSounds = names.filter((n) => { const s = u.sounds[n]; return s.bad > 0 || s.peak < 0.004 || s.peak > 0.85 || s.rms < 0.0003 || s.length < 0.01 || s.length > 2.6 || s.lastLoud > s.length + 0.1; });
  check(`all ${names.length} sound effects play when rendered offline: audible, no bad numbers, never clipping, the right length`, names.length >= 20 && badSounds.length === 0, badSounds.map((n) => `${n} ${JSON.stringify(u.sounds[n])}`).join(' | '));
  check('the big sounds (landing boom, Starburst) are louder than the small ones (dart, typing blip), but nothing comes close to clipping', u.sounds.boom.peak > 4 * u.sounds.dart.peak && u.sounds.starburst.peak > 2 * u.sounds.blip.peak && Math.max(...names.map((n) => u.sounds[n].peak)) < 0.6, JSON.stringify([u.sounds.boom.peak, u.sounds.dart.peak, u.sounds.starburst.peak, u.sounds.blip.peak]));
  check('a higher "pitch" makes a higher sound (typing blips: low voice about 510 Hz, double pitch about twice that)', near(u.blip.low, 510, 70) && near(u.blip.high / u.blip.low, 2, 0.25), JSON.stringify(u.blip));
  check('an unknown sound name is ignored', u.unknown === 0);
  check('darts, light hits and defeats make their sounds', u.darts.dart >= 3 && u.darts.tick >= 3 && u.darts.pop === 1 && u.darts.left === 0, JSON.stringify(u.darts));
  check('Starburst makes its own sound, a bell for each Gloomling it hits, and a pop for each one it defeats', u.burst.starburst === 1 && u.burst.bell >= 3 && u.burst.pop >= 3, JSON.stringify(u.burst));
  check('typing makes a blip for every few letters, in the speaker\'s own pitch (Marlo is low)', u.blips.count >= 8 && u.blips.count <= 14 && u.blips.max < 0.7 && u.blips.min > 0.4, JSON.stringify(u.blips));

  // Live game: the first tap starts the sound engine; Mute.
  ({ page } = await openGame(browser, 'audio-live'));
  const idle = await page.evaluate(() => { const A = window.__game.audio; return { state: A.state, noContext: A.context === null, played: A.play('click'), shown: !document.getElementById('mute').hidden }; });
  check('before the first tap there is no sound engine, nothing plays, and the Mute button is there', idle.state === 'idle' && idle.noContext && idle.played === false && idle.shown, JSON.stringify(idle));
  await page.mouse.click(790, 440);
  await until(page, () => window.__game.audio.state === 'running');
  check('the first click starts the sound engine', true);
  const gap = await page.evaluate(async () => { const A = window.__game.audio; const a = A.play('click'); const b = A.play('click'); await new Promise((r) => setTimeout(r, 150)); return { a, b, c: A.play('click') }; });
  check('sounds play once the engine runs, and one sound cannot repeat faster than its minimum gap', gap.a && !gap.b && gap.c, JSON.stringify(gap));
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(250);
  const muted = await page.evaluate(() => { const A = window.__game.audio; const b = document.getElementById('mute'); return { muted: A.muted, cls: b.className, pressed: b.getAttribute('aria-pressed'), label: b.getAttribute('aria-label'), stored: localStorage.getItem('powerheroes.muted'), played: A.play('bell'), volume: A.master.gain.value }; });
  check('M mutes: the button changes, nothing plays, the master volume goes to zero, and the choice is saved', muted.muted && /off/.test(muted.cls) && muted.pressed === 'true' && /Unmute/.test(muted.label) && muted.stored === '1' && muted.played === false && muted.volume < 0.02, JSON.stringify(muted));
  await page.reload();
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5, null, { timeout: 90000 });
  const kept = await page.evaluate(() => ({ muted: window.__game.audio.muted, cls: document.getElementById('mute').className }));
  check('the muted choice survives a reload, and the button shows it from the start', kept.muted && /off/.test(kept.cls), JSON.stringify(kept));
  await page.click('#mute');
  await until(page, () => window.__game.audio.state === 'running');
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => { const A = window.__game.audio; return { muted: A.muted, cls: document.getElementById('mute').className, stored: localStorage.getItem('powerheroes.muted'), volume: A.master ? A.master.gain.value : -1, state: A.state }; });
  check('clicking the Mute button turns the sound back on (it also counts as the first tap)', !back.muted && !/off/.test(back.cls) && back.stored === '0' && back.volume > 0.5 && back.state === 'running', JSON.stringify(back));

  // The sounds are hooked in where things happen.
  await page.evaluate(() => window.__game.prologue.skip());
  await until(page, () => window.__game.audio.counts.wave >= 1 && window.__game.audio.counts.spawn >= 1);
  check('a wave starting plays the wave horn and each Gloomling arriving plays a puff', true);
  await until(page, () => window.__game.audio.counts.dart >= 1 && window.__game.audio.counts.pop >= 1);
  check('in the live fight the darts fly and the first defeat pops', true);
  const bumped = await page.evaluate(() => { const G = window.__game; const before = G.audio.counts.bump || 0; for (let i = 0; i < 10 && (G.audio.counts.bump || 0) === before; i++) { G.player.takeHit(5, 3, 0); G.player.update(0.5, { x: 0, z: 0 }, 0); } return (G.audio.counts.bump || 0) - before; });
  check('being bumped plays a thump', bumped === 1, `bump +${bumped}`);
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  const won = await page.evaluate(() => ({ cleared: window.__game.audio.counts.cleared, win: window.__game.audio.counts.win }));
  check('each cleared wave plays its chime and the win plays the winning notes', won.cleared >= 3 && won.win === 1, JSON.stringify(won));
  await page.evaluate(() => window.__game.story.skip());
  await page.evaluate(() => { const G = window.__game; G.powers.castPower(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 80; i++) G.powers.update(0.1, 0); });
  await until(page, () => window.__game.audio.counts.ready >= 1);
  check('when Starburst has recharged the button gives a little tick', true);

  // The title screen.
  SHOW_TITLE = true;
  ({ page } = await openGame(browser, 'title-live'));
  SHOW_TITLE = false;
  const t0 = await page.evaluate(() => { const G = window.__game; return { hidden: document.getElementById('title').hidden, phase: G.prologue.phase, audio: G.audio.state, night: G.world.night, sol: G.player.group.visible, name: document.getElementById('title-name').textContent, skip: !document.getElementById('skip').hidden }; });
  check('the game opens on the title screen: night, Sol off stage, no sound engine yet, the story waiting', !t0.hidden && t0.phase === 'title' && t0.audio === 'idle' && t0.night === 1 && !t0.sol && !t0.skip && t0.name === 'Power Heroes', JSON.stringify(t0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/audio-1-title.png` });
  await page.keyboard.down('d');
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  const waiting = await page.evaluate(() => ({ phase: window.__game.prologue.phase, hidden: document.getElementById('title').hidden, x: window.__game.player.position.x }));
  check('other keys do not begin the story, and Sol cannot walk off', waiting.phase === 'title' && !waiting.hidden && waiting.x === 0, JSON.stringify(waiting));
  await page.keyboard.press('Space');
  await until(page, () => window.__game.prologue.phase === 'dark' || window.__game.prologue.phase === 'falling');
  const begun = await page.evaluate(() => ({ hidden: document.getElementById('title').hidden, ready: window.__game.powers.powerReady, banner: document.getElementById('banner-title').textContent, skip: !document.getElementById('skip').hidden }));
  check('Space begins: the title goes, the story starts with its banner and Skip button, and Space did not fire Starburst', begun.hidden && begun.ready && begun.banner === 'Prologue' && begun.skip, JSON.stringify(begun));
  await until(page, () => window.__game.audio.state === 'running');
  check('and the sound engine is running', true);
  await until(page, () => window.__game.audio.counts.whoosh >= 1);
  check('the falling star whooshes', true);
  await until(page, () => window.__game.audio.counts.boom >= 1);
  check('the landing booms', true);

  // The title screen on a phone: a tap begins; the Mute button works with a finger and never steers.
  SHOW_TITLE = true;
  let context;
  ({ page, context } = await openGame(browser, 'title-phone', { width: 390, height: 844 }, true));
  SHOW_TITLE = false;
  const phoneTitle = await page.evaluate(() => { const r = document.getElementById('title-name').getBoundingClientRect(); const m = document.getElementById('mute').getBoundingClientRect(); const tap = [...document.querySelectorAll('#title-tap span')].find((s) => getComputedStyle(s).display !== 'none'); return { left: r.left, right: r.right, mute: { left: m.left, right: m.right, top: m.top, bottom: m.bottom }, tap: tap && tap.textContent }; });
  check('on a phone the title fits the screen and says "Tap to begin"; the Mute button is inside the screen', phoneTitle.left >= 0 && phoneTitle.right <= 390 && phoneTitle.mute.right <= 390 && phoneTitle.mute.top >= 0 && phoneTitle.tap === 'Tap to begin', JSON.stringify(phoneTitle));
  await page.screenshot({ path: `${OUT}/audio-2-title-phone.png` });
  const client = await context.newCDPSession(page);
  const touchAt = (type, x, y) => client.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0 }] });
  await touchAt('touchStart', 195, 420);
  const joyOnTitle = await page.evaluate(() => document.getElementById('joystick').classList.contains('active'));
  await touchAt('touchEnd');
  await until(page, () => window.__game.prologue.phase !== 'title');
  await until(page, () => window.__game.audio.state === 'running');
  check('a tap on the title begins the story and starts the sound (and does not start the joystick)', !joyOnTitle);
  const mute = await page.evaluate(() => { const m = document.getElementById('mute').getBoundingClientRect(); return { x: m.x + m.width / 2, y: m.y + m.height / 2 }; });
  await touchAt('touchStart', mute.x, mute.y);
  const joyOnMute = await page.evaluate(() => document.getElementById('joystick').classList.contains('active'));
  await touchAt('touchEnd');
  await page.waitForTimeout(300);
  const touched = await page.evaluate(() => ({ muted: window.__game.audio.muted }));
  check('a finger on the Mute button mutes, and does not steer', touched.muted && !joyOnMute, JSON.stringify([touched, joyOnMute]));
}

// ---------- Music: the flute, the songs, the song player ----------
const musicUnit = async () => {
  const { SONGS, parseNotes } = await import('/src/music-data.js');
  const { scheduleSong, makeEcho } = await import('/src/music.js');
  const out = {};
  const RATE = 22050;
  const strip = (r) => r.events.map((e) => `${e.beat}:${e.beats}:${e.notes.join('+')}`).join(' ');
  out.parse = {
    names: strip(parseNotes('D5:2 r:1 F#5:0.5 Bb4:1.5 x:1 D3+A3:2')),
    total: parseNotes('D5:2 r:1 F#5:0.5 Bb4:1.5 x:1 D3+A3:2').total,
    major: strip(parseNotes('5:1 3^:2 7v:1', { key: 'D4', mode: 'major' })),
    minor: strip(parseNotes('6:1 7:1 3:1', { key: 'D4', mode: 'minor' })),
    bars: strip(parseNotes('D5:1 | E5:1 | F#5:1')),
  };
  try { parseNotes('H5:1'); out.badName = false; } catch (error) { out.badName = true; }
  try { parseNotes('D5:0'); out.badLength = false; } catch (error) { out.badLength = true; }
  out.lullaby = (() => { const flute = (n) => SONGS[n].events.filter((e) => e.voice === 'flute'); const w = flute('lullaby'), s = flute('lullaby-sorrow'); return { warm: w.map((e) => e.notes[0]).join(), warmLast: w[w.length - 1], warmCount: w.length, sad: s.map((e) => e.notes[0]).join(), sadLastBeat: s[s.length - 1].beat, sadSpb: 60 / SONGS['lullaby-sorrow'].tempo, warmSpb: 60 / SONGS.lullaby.tempo }; })();
  out.songs = Object.fromEntries(Object.entries(SONGS).map(([name, s]) => [name, { events: s.events.length, voices: [...new Set(s.events.map((e) => e.voice))].join(), seconds: +(s.length * 60 / s.tempo).toFixed(1), level: s.level, tempo: s.tempo }]));

  const render = async (name, seconds, only = null, fromBeat = 0) => {   // plays a song on an offline "recording" context
    const ctx = new OfflineAudioContext(1, Math.ceil(RATE * seconds), RATE);
    const bus = ctx.createGain();
    bus.connect(ctx.destination);
    const echo = makeEcho(ctx, bus);
    const spb = 60 / SONGS[name].tempo;
    scheduleSong(ctx, bus, echo, name, -fromBeat * spb, fromBeat, fromBeat + seconds / spb, only);
    return (await ctx.startRendering()).getChannelData(0);
  };
  const strongest = (data, from, to, f) => {   // which pitch near f is loudest? (cents above or below f)
    let best = 0, bestMag = -1;
    for (let k = -100; k <= 100; k += 10) {
      const w = 2 * Math.PI * f * 2 ** (k / 1200) / RATE;
      let re = 0, im = 0;
      for (let i = from; i < to; i++) { re += data[i] * Math.cos(w * i); im += data[i] * Math.sin(w * i); }
      if (re * re + im * im > bestMag) { bestMag = re * re + im * im; best = k; }
    }
    return best;
  };
  out.mix = {};
  out.pitch = {};
  for (const [name, song] of Object.entries(SONGS)) {
    const seconds = Math.min(12, song.length * 60 / song.tempo);
    const data = await render(name, seconds);
    let peak = 0, sum = 0, bad = 0;
    for (const v of data) { if (!Number.isFinite(v)) { bad++; continue; } peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    out.mix[name] = { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / data.length).toFixed(4), bad, seconds };
    // every long flute note in the song is played at the right pitch
    const flute = await render(name, seconds, ['flute']);
    const spb = 60 / song.tempo;
    let checked = 0, worst = 0, firstOnset = null, silent = true;
    for (const e of song.events) {
      if (e.voice !== 'flute') continue;
      const start = e.beat * spb;
      if (start + e.beats * spb > seconds - 0.2) continue;
      if (firstOnset === null) { firstOnset = e.beat; const before = Math.max(0, Math.floor((start - 0.05) * RATE)); for (let i = 0; i < before; i++) if (Math.abs(flute[i]) > 0.002) silent = false; }
      if (e.beats * spb < 0.45) continue;
      const from = Math.floor((start + e.beats * spb * 0.35) * RATE);
      const to = Math.floor((start + e.beats * spb * 0.85) * RATE);
      const cents = strongest(flute, from, to, 440 * 2 ** ((e.notes[0] - 69) / 12));
      worst = Math.max(worst, Math.abs(cents));
      checked++;
    }
    out.pitch[name] = { checked, worst, firstOnset, silentBeforeFirst: silent };
  }
  // the loop: the first note of the second lap sounds again at the right pitch
  {
    const name = 'sunmeadow';
    const song = SONGS[name];
    const lap = song.length * 60 / song.tempo;
    const data = await render(name, 2.2, ['flute'], song.length);   // starts at the beginning of lap two
    out.loop = strongest(data, Math.floor(0.05 * RATE), Math.floor(0.2 * RATE), 440 * 2 ** ((74 - 69) / 12));
    out.lapSeconds = lap;
  }
  return out;
};

async function chunk11(browser) {
  let { page } = await openGame(browser, 'music-unit');
  const u = await page.evaluate(musicUnit);
  check('notes are read correctly: names, sharps and flats, chords, rests, drum hits, bar lines', u.parse.names === '0:2:74 3:0.5:78 3.5:1.5:70 5:1:0 6:2:50+57' && u.parse.total === 8 && u.parse.bars === '0:1:74 1:1:76 2:1:78', JSON.stringify(u.parse));
  check('scale degrees follow the key and the mode (D major: A, high F#, low C#; D minor: B-flat, C, F)', u.parse.major === '0:1:69 1:2:78 3:1:61' && u.parse.minor === '0:1:70 1:1:72 2:1:65', JSON.stringify([u.parse.major, u.parse.minor]));
  check('a bad note name or a zero length is refused', u.badName && u.badLength);
  const songNames = Object.keys(u.songs);
  check(`the ${songNames.length} songs load, and every track fills its loop exactly`, songNames.join() === 'falling-star,sunmeadow,marlo,lullaby,lullaby-sorrow,battle' && songNames.every((n) => u.songs[n].events >= 10 && u.songs[n].level <= 1 && u.songs[n].tempo >= 40 && u.songs[n].tempo <= 160), JSON.stringify(u.songs));
  check('each song has a flute (the lullabies are the flute alone) and the others add instruments', songNames.every((n) => /flute/.test(u.songs[n].voices)) && songNames.filter((n) => !/lullaby/.test(n)).every((n) => u.songs[n].voices.split(',').length >= 3) && songNames.filter((n) => /lullaby/.test(n)).every((n) => u.songs[n].voices === 'flute'), JSON.stringify(Object.fromEntries(songNames.map((n) => [n, u.songs[n].voices]))));
  check('Lyra\'s Lullaby: verse one (A4, high F#5, E5, D5, C#5, B4 ...) ends OPEN on the fifth (A4), then four bars of silence', u.lullaby.warm === '69,78,76,74,73,71,69,71,69,78,79,78,76,74,73,69' && u.lullaby.warmLast.notes[0] === 69 && u.lullaby.warmLast.beat === 21 && u.lullaby.warmLast.beats === 3 && u.songs.lullaby.seconds === 36 * u.lullaby.warmSpb, JSON.stringify(u.lullaby));
  check('the lullaby in sorrow is the same tune in the minor (F instead of F#, B-flat instead of B), slower, and stops in mid-phrase', u.lullaby.sad === '69,77,76,74,72,70,69,70,69,77,79' && u.lullaby.sadSpb > u.lullaby.warmSpb && u.lullaby.sadLastBeat === 15 && u.songs['lullaby-sorrow'].seconds > 45, JSON.stringify([u.lullaby.sad, u.lullaby.sadLastBeat, u.songs['lullaby-sorrow'].seconds]));
  check('rendered offline, every song is audible, finite, and well under clipping', songNames.every((n) => u.mix[n].bad === 0 && u.mix[n].peak > 0.03 && u.mix[n].peak < 0.3 && u.mix[n].rms > 0.01 && u.mix[n].rms < 0.06), JSON.stringify(u.mix));
  check('every long flute note is at its written pitch (within 20 cents), and the flute is silent before its first note', songNames.every((n) => u.pitch[n].checked >= 3 && u.pitch[n].worst <= 20 && u.pitch[n].silentBeforeFirst), JSON.stringify(u.pitch));
  check('a song loops: the second lap starts again on the first note', Math.abs(u.loop) <= 20, `off by ${u.loop} cents`);

  // Live game: which song plays follows what happens.
  SHOW_TITLE = true;
  ({ page } = await openGame(browser, 'music-live'));
  SHOW_TITLE = false;
  const idle = await page.evaluate(() => ({ wanted: window.__game.music.song, playing: window.__game.music.playing }));
  check('on the title screen no song is chosen yet', idle.wanted === null && idle.playing === null, JSON.stringify(idle));
  await page.keyboard.press('Space');
  await until(page, () => window.__game.music.playing === 'falling-star');
  check('the first tap starts the story and "The Falling Star" (as soon as the sound engine runs)', true);
  const count = (ms) => page.evaluate(async (wait) => { const ctx = window.__game.audio.context; let n = 0; const make = ctx.createOscillator.bind(ctx); ctx.createOscillator = () => { n++; return make(); }; await new Promise((r) => setTimeout(r, wait)); ctx.createOscillator = make; return n; }, ms);
  const sounding = await count(2500);
  check('while a song plays its notes keep being scheduled a little ahead', sounding > 4, `${sounding} instruments made in 2.5 s`);
  const heard = await page.evaluate(async () => {   // listen to what really leaves the game's volume control while the song plays
    const A = window.__game.audio;
    const tap = A.context.createAnalyser();
    tap.fftSize = 2048;
    A.master.connect(tap);
    const data = new Float32Array(2048);
    let peak = 0, sum = 0, n = 0;
    for (let i = 0; i < 25; i++) {
      await new Promise((r) => setTimeout(r, 120));
      tap.getFloatTimeDomainData(data);
      for (const v of data) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; }
    }
    A.master.disconnect(tap);
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) };
  });
  check('the real audio output of the playing game is audible but nowhere near clipping', heard.peak > 0.005 && heard.peak < 0.6 && heard.rms > 0.001, JSON.stringify(heard));
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(400);
  const hushed = await count(2500);
  check('while muted no new notes are made (it saves the battery)', hushed === 0, `${hushed} instruments`);
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(400);
  const back = await count(2500);
  check('unmuting picks the music up again', back > 4, `${back} instruments`);
  await page.evaluate(() => window.__game.prologue.skip());
  await until(page, () => window.__game.music.song === 'battle');
  await until(page, () => window.__game.music.playing === 'battle');
  check('the first wave brings in "Battle" (the old song fades out)', true);
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  const won = await page.evaluate(() => window.__game.music.song);
  check('winning brings back "Sunmeadow"', won === 'sunmeadow', won);
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await until(page, () => window.__game.music.song === 'battle');
  check('"Play again" brings "Battle" back with the first wave', true);
  const same = await page.evaluate(() => { const M = window.__game.music; M.play('battle'); return M.song; });
  check('asking for the song that is already playing changes nothing, and an unknown song is ignored', same === 'battle' && (await page.evaluate(() => { const M = window.__game.music; M.play('no-such-song'); return M.song; })) === 'battle');
}

// ---------- Squad heroes: Tide and Volt ----------
const squadUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { HEROES, GLOOMLING } = await import('/src/heroes-data.js');
  const { buildHeroModel } = await import('/src/hero-models.js');
  const { createHero } = await import('/src/hero.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createPowers } = await import('/src/powers.js');
  const out = {};
  out.data = Object.fromEntries(['tide', 'volt'].map((k) => [k, { name: HEROES[k].name, type: HEROES[k].type, health: HEROES[k].health, look: HEROES[k].attack.look, power: HEROES[k].power.id, cooldown: HEROES[k].power.cooldown }]));
  out.models = {};
  for (const kind of ['tide', 'volt']) {
    const model = buildHeroModel(kind);
    let parts = 0;
    model.body.traverse(() => { parts++; });
    let bad = 0;
    for (const [run, fall] of [[0, 0], [1, 0], [0.5, 1]]) { for (let i = 0; i < 20; i++) model.animate(i / 10, run, fall); }
    model.body.traverse((o) => { if (o.isMesh && [o.position.x, o.position.y, o.position.z, o.scale.x].some((v) => !Number.isFinite(v))) bad++; });
    const scene = new THREE.Scene();
    const hero = createHero({ scene, bound: 10.2, kind });
    for (let i = 0; i < 20; i++) hero.update(1 / 30, { x: 1, z: 0 }, i / 30);
    out.models[kind] = { parts, feet: model.feet.length, arms: model.arms.length, bad, moved: hero.position.x > 1, name: hero.name, type: hero.type };
  }
  const fakeHero = (kind, x = 0, z = 0, yaw = 0) => ({ kind, position: new THREE.Vector3(x, 0, z), yaw, down: false, faced: 0, face(a) { this.faced++; this.yaw = a; }, takeHit() { return false; } });
  const setup = (kind, positions) => {
    const scene = new THREE.Scene();
    const hero = fakeHero(kind);
    const gloomlings = positions.map(([x, z]) => createGloomling({ scene, x, z }));
    const log = { hits: [], kinds: [], defeats: 0 };
    const powers = createPowers({ scene, hero, gloomlings, events: { hit: (g, a, k) => { log.hits.push(a); log.kinds.push(k); }, defeat: () => { log.defeats++; } } });
    return { hero, gloomlings, powers, log };
  };
  const run = (s, seconds, moving = false) => {   // "moving": the Gloomlings walk and slide too
    for (let i = 0; i < Math.round(seconds * 30); i++) {
      s.powers.update(1 / 30, i / 30);
      if (moving) for (const g of [...s.gloomlings]) g.update(1 / 30, s.hero, i / 30, s.gloomlings);
    }
  };
  for (const kind of ['tide', 'volt']) {   // each hero's automatic shots
    const s = setup(kind, [[5, 0]]);
    run(s, 2);
    out[`${kind}Shots`] = { hits: s.log.hits.length, each: s.log.hits[0], kinds: [...new Set(s.log.kinds)].join() };
  }
  {   // Big Splash: pushes far, soaks, does only a little damage
    const s = setup('tide', [[2, 0], [0, -4], [4.8, 0], [9, 0]]);
    s.powers.autoFire = false;   // only the splash, so every number is its own
    const [A, B, C, D] = s.gloomlings;
    const before = s.gloomlings.map((g) => ({ x: g.position.x, z: g.position.z }));
    s.powers.castPower();
    run(s, 0.5, true);
    const pushed = (g, i) => Math.hypot(g.position.x - before[i].x, g.position.z - before[i].z);
    out.splash = { alive: s.gloomlings.map((g) => g.alive).join(), soaked: s.gloomlings.map((g) => +g.soaked.toFixed(1)).join(), health: s.gloomlings.map((g) => g.health).join(), pushA: pushed(A, 0), pushB: pushed(B, 1), big: s.log.kinds.filter((k) => k === 'big').length, power: s.powers.powerReady };
    run(s, 6.5, true);
    out.dry = s.gloomlings.map((g) => g.soaked).join();
  }
  {   // Lightning Dash: zips forward, shocks what is near the path, once each, and aims at the nearest Gloomling
    const s = setup('volt', [[0, 3], [1, 5], [3, 3], [0, 9], [0, -3.5]]);
    s.powers.autoFire = false;
    s.powers.castPower();
    run(s, 0.1);
    const midway = s.hero.position.z;
    run(s, 0.5);
    const alive = s.gloomlings.map((g) => g.alive);
    out.dash = { z: s.hero.position.z, x: s.hero.position.x, midway, hitCount: s.log.kinds.filter((k) => k === 'big').length, defeated: s.log.defeats, alive: alive.join(), faced: s.hero.faced, ready: s.powers.powerReady };
    const t = setup('volt', [[4, 0.2]]);
    t.powers.autoFire = false;
    t.powers.castPower();
    run(t, 0.6);
    out.aimed = { x: t.hero.position.x, z: t.hero.position.z };
  }
  {   // a Gloomling's soak runs out by itself
    const g = createGloomling({ scene: new THREE.Scene(), x: 0, z: 0 });
    g.soak(2);
    out.soak = [g.soaked];
    for (let i = 0; i < 90; i++) g.update(1 / 30, { position: new THREE.Vector3(20, 0, 20), down: false, takeHit() {} }, i / 30, [g]);
    out.soak.push(g.soaked);
  }
  return out;
};

async function chunk12(browser) {
  let { page } = await openGame(browser, 'squad-unit');
  const u = await page.evaluate(squadUnit);
  check('Tide is Water with Big Splash and Volt is Storm with Lightning Dash, each with its own attack look', JSON.stringify(u.data) === JSON.stringify({ tide: { name: 'Tide', type: 'water', health: 100, look: 'bubble', power: 'bigsplash', cooldown: 6 }, volt: { name: 'Volt', type: 'storm', health: 100, look: 'zap', power: 'lightningdash', cooldown: 4.5 } }), JSON.stringify(u.data));
  check('both new heroes are built from many parts with arms and feet, animate without bad numbers, and run like any hero', ['tide', 'volt'].every((k) => u.models[k].parts > 30 && u.models[k].feet === 2 && u.models[k].arms === 2 && u.models[k].bad === 0 && u.models[k].moved) && u.models.tide.name === 'Tide' && u.models.volt.type === 'storm', JSON.stringify(u.models));
  check('Tide throws water bubbles (9 damage) and Volt fires quick bolts (8 damage) at Gloomlings in range', u.tideShots.hits >= 2 && u.tideShots.each === 9 && u.voltShots.hits >= 3 && u.voltShots.each === 8 && u.tideShots.kinds === 'hit' && u.voltShots.kinds === 'hit', JSON.stringify([u.tideShots, u.voltShots]));
  check('Big Splash reaches 5 units (not 9), shoves hard, soaks for 6 s and does only a little damage, so everyone is still standing', u.splash.alive === 'true,true,true,true' && u.splash.soaked.split(',').slice(0, 3).every((v) => +v > 4.5) && +u.splash.soaked.split(',')[3] === 0 && u.splash.health.split(',').slice(0, 3).every((v) => +v === 18) && u.splash.pushA > 2 && u.splash.pushB > 3.5 && u.splash.big === 3 && !u.splash.power, JSON.stringify(u.splash));
  check('the soak wears off by itself', u.dry === '0,0,0,0' && u.soak[0] === 2 && u.soak[1] === 0, JSON.stringify([u.dry, u.soak]));
  check('Lightning Dash zips about 7 units straight ahead in a fifth of a second, and keeps going only that far', near(u.dash.z, 7, 0.2) && near(u.dash.x, 0, 0.2) && u.dash.midway > 2 && u.dash.midway < 7 && u.dash.faced >= 1 && !u.dash.ready, JSON.stringify(u.dash));
  check('it shocks the two Gloomlings on the path (40 damage, once each), and not the ones beside, beyond or behind', u.dash.hitCount === 2 && u.dash.defeated === 2 && u.dash.alive === 'true,true,true', JSON.stringify(u.dash));
  check('Lightning Dash aims at the nearest Gloomling', u.aimed.x > 6 && Math.abs(u.aimed.z) < 1.5, JSON.stringify(u.aimed));

  // Live game: play as Tide or Volt (?debug&hero=...). The button, the name and the icon follow the hero.
  for (const [kind, label, icon, other] of [['tide', 'Big Splash', '.icon-drop', '.icon-bolt'], ['volt', 'Lightning Dash', '.icon-bolt', '.icon-drop']]) {
    HERO_PARAM = kind;
    ({ page } = await openGame(browser, `squad-${kind}`));
    HERO_PARAM = '';
    const ui = await page.evaluate(([icon, other]) => {
      const shown = (sel) => getComputedStyle(document.querySelector(`#power-button ${sel}`)).display !== 'none';
      return { kind: window.__game.player.kind, name: document.getElementById('hud-name').textContent, label: document.getElementById('power-label').textContent, icon: shown(icon), other: shown(other), flame: shown('.icon-flame'), star: shown('.icon-star'), bg: getComputedStyle(document.getElementById('power-button')).backgroundImage.slice(0, 40) };
    }, [icon, other]);
    check(`playing as ${kind}: the corner shows the name, the button says "${label}", and only its own icon shows`, ui.kind === kind && ui.name.toLowerCase() === kind && ui.label === label && ui.icon && !ui.other && !ui.flame && !ui.star, JSON.stringify(ui));
    await page.evaluate(() => { const G = window.__game; G.player.position.set(0, 0, 0); });
    await until(page, () => window.__game.gloomlings.length >= 3);
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/squad-${kind}-power.png` });
    const used = await page.evaluate(() => ({ ready: window.__game.powers.powerReady, casts: window.__game.audio.counts[window.__game.player.kind === 'tide' ? 'bigsplash' : 'lightningdash'] }));
    check(`the ${label} button works in the live game and plays its sound`, !used.ready && used.casts === 1, JSON.stringify(used));
  }
}

// ---------- The squad: three heroes, swapping, the squad screen ----------
const squadCoreUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createSquad } = await import('/src/squad.js');
  const { createGloomling } = await import('/src/gloom.js');
  const out = {};
  const make = () => {
    const scene = new THREE.Scene();
    const gloomlings = [];
    const log = { hurt: [], down: [], swaps: [], hits: 0 };
    const squad = createSquad({ scene, bound: 10.2, gloomlings, events: { hit: () => { log.hits++; } }, onHurt: (a, k) => log.hurt.push(k), onDown: (k) => log.down.push(k), onSwap: (k, s) => log.swaps.push(`${k}@${s}`) });
    return { scene, gloomlings, log, squad };
  };
  const idle = { x: 0, z: 0 };
  const vis = (squad) => Object.fromEntries(Object.entries(squad.members).map(([k, m]) => [k, m.hero.group.visible]));
  {   // choosing a squad
    const { squad, log } = make();
    squad.set(['sol', 'ember', 'tide', 'volt']);
    out.roster = { roster: squad.roster.join(), slot: squad.slot, kind: squad.player.kind, name: squad.player.name, health: squad.player.health, down: squad.player.down, visible: JSON.stringify(vis(squad)), swaps: log.swaps.join() };
    squad.set(['volt', 'nobody', 'tide']);
    out.roster2 = { roster: squad.roster.join(), kind: squad.player.kind };
    squad.set(['sol']);
    out.solo = { roster: squad.roster.join(), toOther: squad.swapTo(1), toSelf: squad.swapTo(0), status: squad.status.length };
  }
  {   // one place for everybody, swapping, cooldown
    const { squad, log } = make();
    squad.set(['sol', 'ember', 'tide']);
    const p = squad.player;
    for (let i = 0; i < 10; i++) p.update(1 / 30, { x: 1, z: 0 }, i / 30);
    const x = p.position.x;
    out.shared = { moved: x > 0.5, sameObject: squad.members.ember.hero.group.position === p.position && squad.members.tide.hero.group.position === p.position, sameVelocity: p.velocity === squad.members.volt?.hero?.velocity || true };
    const yawBefore = p.yaw;
    const first = squad.swapTo(1);
    out.swap = { first, kind: p.kind, name: p.name, x: squad.members.ember.hero.group.position.x - x, yaw: p.yaw - yawBefore, visible: JSON.stringify(vis(squad)), ready: squad.swapReady, cooldown: squad.cooldown, again: squad.swapTo(2), self: squad.swapTo(1), swaps: log.swaps.join() };
    p.update(1.6, idle, 0);
    out.swapLater = { ready: squad.swapReady, second: squad.swapTo(2), kind: p.kind, visible: JSON.stringify(vis(squad)) };
    out.noSuchSlot = squad.swapTo(7);
  }
  {   // each hero keeps their own health and their own recharge, also on the bench
    const { squad } = make();
    squad.set(['sol', 'ember', 'tide']);
    const p = squad.player, w = squad.powers;
    p.takeHit(8, 5, 0);
    const solHealth = p.health;
    const cast = w.castPower();
    const solReadyAfterCast = w.powerReady;
    squad.swapTo(1);
    const emberFresh = { health: p.health, ready: w.powerReady };
    w.castPower();
    p.update(1.6, idle, 0);
    squad.swapTo(0);
    const solBack = { health: p.health, ready: w.powerReady, progress: +w.powerProgress.toFixed(2) };
    w.update(5.2, 0);
    out.own = { solHealth, cast, solReadyAfterCast, emberFresh, solBack, benchRecharged: w.powerReady, members: Object.fromEntries(Object.entries(squad.members).map(([k, m]) => [k, m.powers.powerReady])) };
  }
  {   // only the hero in play shoots, and the sparks are shared
    const { squad, gloomlings, scene } = make();
    squad.set(['sol', 'ember', 'tide']);
    gloomlings.push(createGloomling({ scene, x: 5, z: 0 }));
    for (let i = 0; i < 25; i++) squad.powers.update(1 / 30, i / 30);
    const shots = Object.fromEntries(Object.entries(squad.members).map(([k, m]) => [k, m.powers.shotCount]));
    squad.powers.autoFire = false;
    const g2 = createGloomling({ scene, x: 5, z: 1 });
    gloomlings.push(g2);
    const before = squad.powers.shotCount;
    for (let i = 0; i < 40; i++) squad.powers.update(1 / 30, i / 30);
    out.shooting = { shots, sol: shots.sol > 0, others: shots.ember + shots.tide, quiet: squad.powers.shotCount <= before, shared: squad.members.sol.powers.sparks === squad.members.tide.powers.sparks && squad.powers.sparks === squad.members.sol.powers.sparks };
  }
  {   // knocked out: the next hero steps in; when everyone is out the round is lost
    const { squad, log } = make();
    squad.set(['sol', 'ember', 'tide']);
    const p = squad.player;
    p.takeHit(1000, 1, 0);
    const waiting = { down: p.down, kind: p.kind, hurt: log.hurt.join(), out: log.down.join(), canSwapToOut: squad.swapTo(0) };
    p.update(0.3, idle, 0);
    const stillWaiting = p.kind;
    p.update(0.5, idle, 0);
    out.knock = { waiting, stillWaiting, kind: p.kind, slot: squad.slot, visible: JSON.stringify(vis(squad)), swaps: log.swaps.join(), backToSol: squad.swapTo(0, true), status: squad.status.map((s) => `${s.kind}:${s.down ? 'out' : 'in'}`).join() };
    p.update(2, idle, 0);
    p.takeHit(1000, 1, 0);
    p.update(0.8, idle, 0);
    const third = { kind: p.kind, down: p.down };
    p.takeHit(1000, 1, 0);
    p.update(0.8, idle, 0);
    out.allOut = { third, down: p.down, kind: p.kind, slot: squad.slot, lastSwaps: log.swaps.slice(-2).join() };
    squad.set(['sol', 'ember', 'tide']);
    out.reset = { down: p.down, health: p.health, slot: squad.slot, healths: squad.status.map((s) => s.health).join() };
  }
  {   // the status the portraits read
    const { squad } = make();
    squad.set(['tide', 'volt']);
    const s = squad.status;
    out.status = s.map((e) => `${e.kind}:${e.active}:${e.down}:${e.ready}:${e.health}`).join(' ');
  }
  return out;
};

async function chunk13(browser) {
  let { page } = await openGame(browser, 'squad-core');
  const u = await page.evaluate(squadCoreUnit);
  check('choosing a squad: up to three, unknown names ignored, the first is in play and the only one to be seen', u.roster.roster === 'sol,ember,tide' && u.roster.slot === 0 && u.roster.kind === 'sol' && u.roster.health === 100 && !u.roster.down && u.roster.visible === '{"sol":true,"ember":false,"tide":false,"volt":false}' && u.roster.swaps === 'sol@0' && u.roster2.roster === 'volt,tide' && u.roster2.kind === 'volt', JSON.stringify([u.roster, u.roster2]));
  check('a squad of one has nobody to swap to', u.solo.roster === 'sol' && !u.solo.toOther && !u.solo.toSelf && u.solo.status === 1, JSON.stringify(u.solo));
  check('the whole squad stands in one place: swapping puts the new hero exactly where the old one was, facing the same way', u.shared.moved && u.shared.sameObject && u.swap.first && u.swap.kind === 'ember' && u.swap.name === 'Ember' && u.swap.x === 0 && Math.abs(u.swap.yaw) < 1e-9, JSON.stringify([u.shared, u.swap]));
  check('after a swap only the new hero is seen, the choice is announced, and a swap cooldown starts (no swapping to yourself, or to a place that is not there)', u.swap.visible === '{"sol":false,"ember":true,"tide":false,"volt":false}' && !u.swap.ready && u.swap.cooldown === 1 && !u.swap.again && !u.swap.self && !u.noSuchSlot && u.swap.swaps === 'sol@0,ember@1', JSON.stringify(u.swap));
  check('the cooldown ends after 1.5 s and then another swap is allowed', u.swapLater.ready && u.swapLater.second && u.swapLater.kind === 'tide' && u.swapLater.visible === '{"sol":false,"ember":false,"tide":true,"volt":false}', JSON.stringify(u.swapLater));
  check('every hero keeps their own health and their own power recharge: a benched hero\'s power recharges while they wait', u.own.solHealth === 92 && u.own.cast && !u.own.solReadyAfterCast && u.own.emberFresh.health === 100 && u.own.emberFresh.ready && u.own.solBack.health === 92 && !u.own.solBack.ready && u.own.solBack.progress < 1 && u.own.benchRecharged && Object.values(u.own.members).filter(Boolean).length === 4, JSON.stringify(u.own));
  check('only the hero in play shoots; the shots stop when the darts are switched off; everyone shares one pool of sparks', u.shooting.sol && u.shooting.others === 0 && u.shooting.quiet && u.shooting.shared, JSON.stringify(u.shooting));
  check('a knocked-out hero lies there for a moment, then the next hero steps in (the knocked-out one cannot be swapped back)', u.knock.waiting.kind === 'sol' && !u.knock.waiting.down && u.knock.waiting.out === 'sol' && u.knock.waiting.hurt === 'sol' && !u.knock.waiting.canSwapToOut && u.knock.stillWaiting === 'sol' && u.knock.kind === 'ember' && u.knock.slot === 1 && u.knock.visible === '{"sol":false,"ember":true,"tide":false,"volt":false}' && u.knock.swaps === 'sol@0,ember@1' && u.knock.status === 'sol:out,ember:in,tide:in', JSON.stringify(u.knock));
  check('the round is lost only when the whole squad is out; a fresh start brings everybody back to full health', !u.allOut.third.down && u.allOut.third.kind === 'tide' && u.allOut.down && u.reset.down === false && u.reset.health === 100 && u.reset.slot === 0 && u.reset.healths === '1,1,1', JSON.stringify([u.allOut, u.reset]));
  check('the portraits read each hero\'s health, who is in play, who is out and whose power is ready', u.status === 'tide:true:false:true:1 volt:false:false:true:1', u.status);

  // Live game: before anyone joins you play alone; after the first win the squad screen comes with "Play again".
  SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'squad-live'));
  SHOW_SQUAD = false;
  const alone = await page.evaluate(() => ({ roster: window.__game.squad.roster.join(), portraits: !document.getElementById('squad').hidden, screen: !document.getElementById('squad-screen').hidden }));
  check('at first you play alone: no portraits, no squad screen', alone.roster === 'sol' && !alone.portraits && !alone.screen, JSON.stringify(alone));
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); } });
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await until(page, () => !document.getElementById('squad-screen').hidden);
  const pick = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#squad-heroes .card')].map((c) => `${c.dataset.kind}${c.classList.contains('on') ? '+' : '-'}${c.classList.contains('locked') ? 'L' : ''}`).join(), help: document.getElementById('squad-help').textContent, go: !document.getElementById('squad-go').disabled, endHidden: document.getElementById('end').hidden, state: window.__game.waves.state }));
  check('after the first win, "Play again" opens the squad screen (the others have joined): Sol is fixed, two more are pre-picked, and no round has started', pick.cards === 'sol+L,ember+,tide+,volt-' && pick.help === 'Ready!' && pick.go && pick.endHidden && pick.state === 'over', JSON.stringify(pick));
  await page.screenshot({ path: `${OUT}/squad-1-screen.png` });
  const card = (kind) => page.evaluate((k) => { const r = document.querySelector(`#squad-heroes .card[data-kind="${k}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, kind);
  const tap = async (kind) => { const c = await card(kind); await page.mouse.click(c.x, c.y); };
  await tap('tide');
  await tap('sol');
  const fewer = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#squad-heroes .card')].map((c) => `${c.dataset.kind}${c.classList.contains('on') ? '+' : '-'}`).join(), help: document.getElementById('squad-help').textContent, go: !document.getElementById('squad-go').disabled }));
  check('tapping a picked hero takes them off (Pick 1 more, Go! waits); tapping Sol does nothing', fewer.cards === 'sol+,ember+,tide-,volt-' && fewer.help === 'Sol always comes. Pick 1 more.' && !fewer.go, JSON.stringify(fewer));
  await tap('volt');
  await tap('tide');
  const full = await page.evaluate(() => ({ cards: [...document.querySelectorAll('#squad-heroes .card')].map((c) => `${c.dataset.kind}${c.classList.contains('on') ? '+' : '-'}`).join(), go: !document.getElementById('squad-go').disabled }));
  check('a fourth hero cannot be added (three is the most)', full.cards === 'sol+,ember+,tide-,volt+' && full.go, JSON.stringify(full));
  await page.click('#squad-go');
  await until(page, () => ['break', 'spawning'].includes(window.__game.waves.state));
  const go = await page.evaluate(() => ({ screen: !document.getElementById('squad-screen').hidden, roster: window.__game.squad.roster.join(), portraits: [...document.querySelectorAll('#squad .portrait')].map((b) => `${b.querySelector('.portrait-letter').textContent}${b.classList.contains('active') ? '*' : ''}`).join(), name: document.getElementById('hud-name').textContent, label: document.getElementById('power-label').textContent, shown: !document.getElementById('squad').hidden }));
  check('Go! starts the round with Sol, Ember and Volt: three portraits (Sol in play), the corner and the button show Sol', !go.screen && go.roster === 'sol,ember,volt' && go.portraits === 'S*,E,V' && go.shown && go.name === 'Sol' && go.label === 'Starburst', JSON.stringify(go));

  // Swapping with the keys and the portraits.
  await page.keyboard.press('Digit2');
  const swapped = await page.evaluate(() => ({ kind: window.__game.player.kind, name: document.getElementById('hud-name').textContent, label: document.getElementById('power-label').textContent, flame: getComputedStyle(document.querySelector('#power-button .icon-flame')).display !== 'none', active: [...document.querySelectorAll('#squad .portrait')].map((b) => b.classList.contains('active') ? 'A' : '-').join(''), swaps: window.__game.audio.counts.swap }));
  check('pressing 2 swaps to Ember: the name, the Flame Wave button and its flame icon, the portraits, and a swap sound', swapped.kind === 'ember' && swapped.name === 'Ember' && swapped.label === 'Flame Wave' && swapped.flame && swapped.active === '-A-' && swapped.swaps === 1, JSON.stringify(swapped));
  await page.screenshot({ path: `${OUT}/squad-2-in-play.png` });
  await page.keyboard.press('Digit1');
  const tooSoon = await page.evaluate(() => ({ kind: window.__game.player.kind, cool: [...document.querySelectorAll('#squad .portrait')].some((b) => b.classList.contains('cool')) }));
  check('swapping again at once is refused, and the portraits dim while it cools down', tooSoon.kind === 'ember' && tooSoon.cool, JSON.stringify(tooSoon));
  await until(page, () => window.__game.squad.swapReady);   // (game time runs slower than the clock in the test browser)
  await page.keyboard.press('Digit1');
  check('after the cooldown pressing 1 swaps back to Sol', (await page.evaluate(() => window.__game.player.kind)) === 'sol');
  await until(page, () => window.__game.squad.swapReady);
  const portrait = await page.evaluate(() => { const r = document.querySelectorAll('#squad .portrait')[2].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(portrait.x, portrait.y);
  const byTap = await page.evaluate(() => ({ kind: window.__game.player.kind, label: document.getElementById('power-label').textContent, bolt: getComputedStyle(document.querySelector('#power-button .icon-bolt')).display !== 'none' }));
  check('tapping the third portrait swaps to Volt (the button becomes Lightning Dash with its bolt)', byTap.kind === 'volt' && byTap.label === 'Lightning Dash' && byTap.bolt, JSON.stringify(byTap));
  const noMove = await page.evaluate(() => document.getElementById('joystick').classList.contains('active'));
  check('tapping a portrait does not start the joystick', !noMove);

  // Knocked out: the next hero steps in; when all three are out the round is lost.
  await page.evaluate(() => { const G = window.__game; G.player.takeHit(1000, 0, 0); });
  await until(page, () => window.__game.player.kind !== 'volt');
  const next = await page.evaluate(() => ({ kind: window.__game.player.kind, down: [...document.querySelectorAll('#squad .portrait')].map((b) => b.classList.contains('down') ? 'D' : '-').join(''), name: document.getElementById('hud-name').textContent, lost: window.__game.waves.state }));
  check('when Volt is knocked out the next hero steps in on their own, Volt\'s portrait goes grey, and the round goes on', next.kind === 'sol' && next.down === '--D' && next.name === 'Sol' && next.lost !== 'over', JSON.stringify(next));
  await page.keyboard.press('Digit3');
  check('a knocked-out hero cannot be swapped back in', (await page.evaluate(() => window.__game.player.kind)) === 'sol');
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 6 && !G.player.down; i++) { G.player.takeHit(1000, 0, 0); G.player.update(1.7, { x: 0, z: 0 }, 0); } for (let i = 0; i < 90; i++) G.waves.update(1 / 30); });
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  check('when all three are out the round is lost: "Knocked out"', (await page.evaluate(() => document.getElementById('end-title').textContent)) === 'Knocked out');
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await until(page, () => !document.getElementById('squad-screen').hidden);
  const again = await page.evaluate(() => [...document.querySelectorAll('#squad-heroes .card')].map((c) => `${c.dataset.kind}${c.classList.contains('on') ? '+' : '-'}`).join());
  check('"Try again" opens the squad screen with the last squad already picked', again === 'sol+,ember+,tide-,volt+', again);
  await page.keyboard.press('Enter');
  await until(page, () => ['break', 'spawning'].includes(window.__game.waves.state));
  const fresh = await page.evaluate(() => ({ kind: window.__game.player.kind, healths: window.__game.squad.status.map((s) => s.health).join(), roster: window.__game.squad.roster.join() }));
  check('Enter on the squad screen is "Go!": everybody is back to full health with Sol in play', fresh.kind === 'sol' && fresh.healths === '1,1,1' && fresh.roster === 'sol,ember,volt', JSON.stringify(fresh));

  // A phone: the portraits and the squad screen fit.
  ({ page } = await openGame(browser, 'squad-phone', { width: 390, height: 844 }, true));
  await page.evaluate(() => { const G = window.__game; G.squad.set(['sol', 'ember', 'tide']); window.__game.ui.setSquad(G.squad.roster.map((k) => ({ name: k, type: 'fire' }))); });
  const phone = await page.evaluate(() => { const r = (id) => { const b = document.querySelector(id).getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; }; return { squad: r('#squad'), button: r('#power-button'), skip: r('#mute') }; });
  check('on a phone the three portraits fit the screen, above the power button and clear of it', phone.squad.right <= 390 && phone.squad.left >= 0 && phone.squad.bottom <= phone.button.top && phone.squad.top > phone.skip.bottom, JSON.stringify(phone));
  await page.evaluate(() => window.__game.ui.showSquad({ heroes: ['sol', 'ember', 'tide', 'volt'].map((k) => ({ kind: k, name: k[0].toUpperCase() + k.slice(1), type: 'fire', power: 'Power' })), chosen: ['ember', 'tide'], onGo: () => {} }));
  await page.screenshot({ path: `${OUT}/squad-3-phone.png` });
  const fits = await page.evaluate(() => { const b = document.getElementById('squad-card').getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; });
  check('the squad screen fits a phone', fits.left >= 0 && fits.right <= 390 && fits.top >= 0 && fits.bottom <= 844, JSON.stringify(fits));
}

// ---------- Types: the circle, SUPER! and weak, typed Gloomlings ----------
const typesUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { effectiveness, TYPE_COLORS, STRONG, WEAK } = await import('/src/types.js');
  const { WAVES, GLOOMLING } = await import('/src/heroes-data.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createPowers } = await import('/src/powers.js');
  const { createWaves } = await import('/src/waves.js');
  const out = {};
  const all = ['fire', 'nature', 'storm', 'water', 'light', 'shadow', null];
  out.table = Object.fromEntries(all.map((a) => [a, all.map((d) => effectiveness(a, d).label[0]).join('')]));   // s = super, w = weak, n = normal
  out.numbers = { strong: STRONG, weak: WEAK, fireNature: effectiveness('fire', 'nature').multiplier, natureFire: effectiveness('nature', 'fire').multiplier, lightShadow: effectiveness('light', 'shadow').multiplier, shadowLight: effectiveness('shadow', 'light').multiplier };
  out.colors = Object.keys(TYPE_COLORS).join();
  const fakeHero = (kind) => ({ kind, position: new THREE.Vector3(0, 0, 0), yaw: 0, down: false, face() {}, takeHit() { return false; } });
  const hitOnce = (kind, type) => {   // the first dart of a hero against a Gloomling of a type
    const scene = new THREE.Scene();
    const g = createGloomling({ scene, x: 5, z: 0, type });
    const log = [];
    const powers = createPowers({ scene, hero: fakeHero(kind), gloomlings: [g], events: { hit: (gl, amount, k, label) => log.push([amount, label]) } });
    for (let i = 0; i < 40 && log.length === 0; i++) powers.update(1 / 30, i / 30);
    return log[0].join(':');
  };
  out.darts = { emberNature: hitOnce('ember', 'nature'), emberWater: hitOnce('ember', 'water'), emberStorm: hitOnce('ember', 'storm'), emberNone: hitOnce('ember', null), tideFire: hitOnce('tide', 'fire'), voltWater: hitOnce('volt', 'water'), voltNature: hitOnce('volt', 'nature'), solFire: hitOnce('sol', 'fire') };
  {   // a superpower is multiplied too: Flame Wave on a nature Gloomling, Big Splash on a fire one
    const scene = new THREE.Scene();
    const a = createGloomling({ scene, x: 3, z: 0, type: 'nature' });
    const log = [];
    const powers = createPowers({ scene, hero: fakeHero('ember'), gloomlings: [a], events: { hit: (g, amount, k, label) => log.push(`${amount}:${k}:${label}`) } });
    powers.autoFire = false;
    powers.castPower();
    for (let i = 0; i < 30; i++) powers.update(1 / 30, i / 30);
    const b = createGloomling({ scene, x: 3, z: 0, type: 'fire' });
    const log2 = [];
    const powers2 = createPowers({ scene, hero: fakeHero('tide'), gloomlings: [b], events: { hit: (g, amount, k, label) => log2.push(`${amount}:${k}:${label}`) } });
    powers2.autoFire = false;
    powers2.castPower();
    for (let i = 0; i < 30; i++) powers2.update(1 / 30, i / 30);
    out.powers = { flame: log.join(), splash: log2.join(), natureHealth: a.alive ? a.health : 'dead', fireHealth: b.health, soaked: b.soaked > 4 };
  }
  {   // Gloomlings: each type has its own body colour; a training dummy stays pale blue
    const bodyColour = (type, passive = false) => { const g = createGloomling({ scene: new THREE.Scene(), x: 0, z: 0, type, passive }); let hex = null; g.group.traverse((o) => { if (hex === null && o.isMesh && o.material.isMeshLambertMaterial) hex = o.material.color.getHex(); }); return hex; };
    const colours = ['fire', 'water', 'storm', 'nature'].map((t) => bodyColour(t));
    out.look = { colours, distinct: new Set([...colours, bodyColour(null)]).size, dummy: bodyColour(null, true), typed: createGloomling({ scene: new THREE.Scene(), x: 0, z: 0, type: 'storm' }).type, plain: createGloomling({ scene: new THREE.Scene(), x: 0, z: 0 }).type };
  }
  {   // waves: each wave comes in its own mix of types
    const scene = new THREE.Scene();
    const gloomlings = [];
    const seen = [[], [], []];
    let wave = 0;
    const waves = createWaves({ scene, hero: { position: new THREE.Vector3(0, 0, 0), down: false }, gloomlings, events: { wave: (n) => { wave = n - 1; }, spawn: (g) => { seen[wave].push(g.type); } } });
    waves.start();
    for (let i = 0; i < 30 * 60 && waves.state !== 'won' && waves.state !== 'over'; i++) { gloomlings.splice(0).forEach((g) => g.remove()); waves.update(1 / 30); }
    out.waves = { counts: seen.map((s) => s.length).join(), sets: seen.map((s) => [...new Set(s)].sort().join('+')), first: seen.map((s) => s.slice(0, 4).join()), configured: JSON.stringify(WAVES.types) };
  }
  return out;
};

async function chunk14(browser) {
  let { page } = await openGame(browser, 'types-unit');
  const u = await page.evaluate(typesUnit);
  const order = ['fire', 'nature', 'storm', 'water', 'light', 'shadow', 'null'];
  check('the type circle: Fire beats Nature, Nature beats Storm, Storm beats Water, Water beats Fire (and each is weak to the one that beats it); Light and Shadow beat each other; nothing else matters', JSON.stringify(u.table) === JSON.stringify({ fire: 'nsnwnnn', nature: 'wnsnnnn', storm: 'nwnsnnn', water: 'snwnnnn', light: 'nnnnnsn', shadow: 'nnnnsnn', null: 'nnnnnnn' }), JSON.stringify(u.table));
  check('super is 1.5 times, weak is 0.67 times, and Light/Shadow work both ways', u.numbers.strong === 1.5 && u.numbers.weak === 0.67 && u.numbers.fireNature === 1.5 && u.numbers.natureFire === 0.67 && u.numbers.lightShadow === 1.5 && u.numbers.shadowLight === 1.5 && u.colors === 'light,fire,water,storm,nature,shadow', JSON.stringify([u.numbers, u.colors]));
  check('a dart does 1.5x against a type you beat (10 becomes 15), 0.67x against one that beats you (10 becomes 7), the normal amount otherwise; Sol (Light) always does the normal 9', u.darts.emberNature === '15:super' && u.darts.emberWater === '7:weak' && u.darts.emberStorm === '10:normal' && u.darts.emberNone === '10:normal' && u.darts.tideFire === '14:super' && u.darts.voltWater === '12:super' && u.darts.voltNature === '5:weak' && u.darts.solFire === '9:normal', JSON.stringify(u.darts));
  check('superpowers are multiplied too (Flame Wave 45 becomes 68 on Nature, Big Splash 12 becomes 18 on Fire and still soaks)', u.powers.flame === '68:big:super' && u.powers.splash === '18:big:super' && u.powers.fireHealth === 12 && u.powers.soaked, JSON.stringify(u.powers));
  check('each type has its own body colour, all different from the plain one, and the training dummy stays pale blue', u.look.distinct === 5 && u.look.dummy === 0x6f86b8 && u.look.typed === 'storm' && u.look.plain === null, JSON.stringify(u.look));
  check('waves come in their own mix of types (wave 1: Nature and Fire; wave 2 adds Storm; wave 3 has all four), still 4, 6 and 8 Gloomlings', u.waves.counts === '4,6,8' && u.waves.sets.join(' | ') === 'fire+nature | fire+nature+storm | fire+nature+storm+water' && u.waves.first[0] === 'nature,fire,nature,fire', JSON.stringify(u.waves));

  // Live game: playing as Ember against a Nature and a Water Gloomling (?debug&hero=ember).
  HERO_PARAM = 'ember';
  ({ page } = await openGame(browser, 'types-live'));
  HERO_PARAM = '';
  const dot = await page.evaluate(() => getComputedStyle(document.getElementById('hud-hero')).getPropertyValue('--c'));
  check('the corner name has a dot in the hero\'s type colour (Ember is Fire)', dot.trim() === '#ff6a2c', dot);
  const shown = await page.evaluate(async () => {
    const G = window.__game;
    const { createGloomling } = await import('/src/gloom.js');
    G.waves.reset();
    G.gloomlings.splice(0).forEach((g) => g.remove());
    const supers = new Set(), weaks = new Set();
    const timer = setInterval(() => {   // the pop-ups only live for a second, so look often
      document.querySelectorAll('.floater.super').forEach((e) => supers.add(e.textContent));
      document.querySelectorAll('.floater.weak').forEach((e) => weaks.add(e.textContent));
    }, 40);
    G.gloomlings.push(createGloomling({ scene: G.world.scene, x: 4, z: 0, type: 'nature' }));
    await new Promise((r) => setTimeout(r, 3000));
    G.gloomlings.splice(0).forEach((g) => g.remove());
    G.gloomlings.push(createGloomling({ scene: G.world.scene, x: 4, z: 0, type: 'water' }));
    await new Promise((r) => setTimeout(r, 3000));
    clearInterval(timer);
    return { supers: [...supers], weaks: [...weaks], counts: { super: G.audio.counts.super, weak: G.audio.counts.weak } };
  });
  check('hitting a Nature Gloomling as Ember pops a big "SUPER!" (with a sound), and hitting a Water one pops a small "weak"', shown.supers.join() === 'SUPER!' && shown.weaks.join() === 'weak' && shown.counts.super >= 1 && shown.counts.weak >= 1, JSON.stringify(shown));
  await page.screenshot({ path: `${OUT}/types-1-weak.png` });
}

// ---------- Combos: Shock Chain ----------
const comboUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createPowers } = await import('/src/powers.js');
  const out = {};
  const fakeHero = (kind) => ({ kind, position: new THREE.Vector3(0, 0, 0), yaw: 0, down: false, face() {}, takeHit() { return false; } });
  // A setup: gloomlings given as [x, z, soakedSeconds, health?]. The hero starts at the middle.
  const setup = (kind, spots) => {
    const scene = new THREE.Scene();
    const gloomlings = spots.map(([x, z, soak, health]) => { const g = createGloomling({ scene, x, z }); if (soak) g.soak(soak); if (health) g.hit(30 - health, 0, 0); return g; });
    const log = { combos: [], hits: [], sounds: [] };
    const audio = { play: (name) => { log.sounds.push(name); return true; } };
    const powers = createPowers({ scene, hero: fakeHero(kind), gloomlings, audio, events: { hit: (g, a, k, l) => log.hits.push(`${k}:${a}`), combo: (name, count, g) => log.combos.push(`${name}:${count}`) } });
    return { gloomlings, powers, log };
  };
  const run = (s, seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) s.powers.update(1 / 30, i / 30); };
  const healths = (s) => s.gloomlings.map((g) => g.health).join();
  {   // Volt's first dart hits A; the chain hops to the nearest wet Gloomling, then the next (3 at most); dry or far ones are skipped
    const s = setup('volt', [[4, 0, 5], [6, 0, 5], [8, 0, 5], [9.5, 0, 5], [5, 3, 0], [20, 0, 5], [4, -3.5, 5]]);
    s.powers.castPower && null;
    run(s, 0.45);   // exactly one dart lands
    out.chain = { combos: s.log.combos.join(), healths: healths(s), hits: s.log.hits.join(), shock: s.log.sounds.filter((n) => n === 'shock').length, a: s.gloomlings[0].health };
  }
  {   // not Storm: no chain
    const s = setup('ember', [[4, 0, 5], [6, 0, 5]]);
    run(s, 0.45);
    out.notStorm = { combos: s.log.combos.join(), healths: healths(s) };
  }
  {   // not soaked: no chain
    const s = setup('volt', [[4, 0, 0], [6, 0, 5]]);
    run(s, 0.45);
    out.dry = { combos: s.log.combos.join(), healths: healths(s) };
  }
  {   // nobody else wet nearby: a hit is only a hit
    const s = setup('volt', [[4, 0, 5], [12, 0, 5], [4, 3.5, 0]]);
    run(s, 0.45);
    out.alone = { combos: s.log.combos.join(), healths: healths(s) };
  }
  {   // the one that was hit can be defeated and the chain still goes on from where it stood
    const s = setup('volt', [[4, 0, 5, 5], [6, 0, 5]]);
    run(s, 0.45);
    out.defeated = { combos: s.log.combos.join(), left: s.gloomlings.map((g) => g.health).join() };
  }
  {   // a chain never starts another chain (the log has one combo, not several), and Lightning Dash through wet Gloomlings works
    const s = setup('volt', [[0, 3, 5], [0.5, 5, 5], [2.5, 5, 5], [0, 6.5, 5]]);
    s.powers.autoFire = false;
    s.powers.castPower();
    run(s, 0.5);
    out.dash = { combos: s.log.combos.length, chain: s.log.hits.filter((h) => h.startsWith('chain')).length, big: s.log.hits.filter((h) => h.startsWith('big')).length, left: s.gloomlings.length };
  }
  {   // Tide's own hits do not chain, even on soaked Gloomlings
    const s = setup('tide', [[4, 0, 5], [6, 0, 5]]);
    run(s, 0.8);
    out.tide = { combos: s.log.combos.length };
  }
  return out;
};

async function chunk15(browser) {
  let { page } = await openGame(browser, 'combo-unit');
  const u = await page.evaluate(comboUnit);
  check('Shock Chain: a Storm hit on a soaked Gloomling jumps to the nearest wet Gloomling, then the next, three at most (6 damage each); a dry one, one too far away and the first one\'s own damage are right', u.chain.combos === 'Shock Chain:3' && u.chain.healths === '22,24,24,24,30,30,30' && u.chain.shock === 1 && u.chain.hits.startsWith('hit:8'), JSON.stringify(u.chain));
  check('nothing happens if the attacker is not Storm, the Gloomling is dry, or no other wet Gloomling is close', u.notStorm.combos === '' && u.dry.combos === '' && u.alone.combos === '' && u.notStorm.healths === '20,30' && u.dry.healths === '22,30' && u.alone.healths === '22,30,30', JSON.stringify([u.notStorm, u.dry, u.alone]));
  check('the Gloomling that was hit can be defeated and the chain still goes on', u.defeated.combos === 'Shock Chain:1' && u.defeated.left === '24', JSON.stringify(u.defeated));
  check('a hit from a chain never starts another chain (at most three chain hits per Shock Chain), Lightning Dash through wet Gloomlings clears them without endless chains, and Tide\'s own hits do not chain', u.dash.big >= 2 && u.dash.combos >= 1 && u.dash.combos <= 4 && u.dash.chain <= 3 * u.dash.combos && u.dash.left === 0 && u.tide.combos === 0, JSON.stringify([u.dash, u.tide]));

  // Live game: play as Volt against wet Gloomlings (?debug&hero=volt).
  HERO_PARAM = 'volt';
  ({ page } = await openGame(browser, 'combo-live'));
  HERO_PARAM = '';
  const live = await page.evaluate(async () => {
    const G = window.__game;
    const { createGloomling } = await import('/src/gloom.js');
    G.waves.reset();
    G.gloomlings.splice(0).forEach((g) => g.remove());
    const wet = [[4, 0], [5.5, 1], [7, 0]].map(([x, z]) => { const g = createGloomling({ scene: G.world.scene, x, z }); g.soak(30); return g; });
    G.gloomlings.push(...wet);
    const seen = { banner: '', combos: new Set(), bubbles: new Set() };
    const timer = setInterval(() => {
      if (document.getElementById('banner').classList.contains('show')) seen.banner = document.getElementById('banner-title').textContent;
      document.querySelectorAll('.floater.combo').forEach((e) => seen.combos.add(e.textContent));
      if (document.getElementById('bubble').classList.contains('show')) seen.bubbles.add(document.getElementById('bubble').textContent);
    }, 40);
    await new Promise((r) => setTimeout(r, 3500));
    clearInterval(timer);
    const again = G.gloomlings.length;
    return { banner: seen.banner, sub: document.getElementById('banner-sub').textContent, combos: [...seen.combos], bubbles: [...seen.bubbles], alive: again, shocks: G.audio.counts.shock };
  });
  check('the first Shock Chain gets its name on a banner ("A new combo!") and a word from Pip, and it makes its crackle', live.banner === 'Shock Chain!' && live.sub === 'A new combo!' && live.bubbles.includes('Wet plus lightning? That is a Shock Chain!') && live.shocks >= 1, JSON.stringify(live));
  await page.screenshot({ path: `${OUT}/combo-1-chain.png` });
  const second = await page.evaluate(async () => {
    const G = window.__game;
    const { createGloomling } = await import('/src/gloom.js');
    G.gloomlings.splice(0).forEach((g) => g.remove());
    G.gloomlings.push(...[[4, 0], [5.5, 1]].map(([x, z]) => { const g = createGloomling({ scene: G.world.scene, x, z }); g.soak(30); return g; }));
    const seen = new Set();
    const timer = setInterval(() => document.querySelectorAll('.floater.combo').forEach((e) => seen.add(e.textContent)), 40);
    await new Promise((r) => setTimeout(r, 3000));
    clearInterval(timer);
    return [...seen];
  });
  check('after that, each Shock Chain just pops its name over the Gloomling it started on', second.join() === 'Shock Chain!', second.join());
}

// ---------- Power: the maths, saving, stats, XP, the corner number ----------
const powerUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const P = await import('/src/power.js');
  const { createSave } = await import('/src/save.js');
  const { createHero } = await import('/src/hero.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createPowers } = await import('/src/powers.js');
  const { createWaves } = await import('/src/waves.js');
  const { createStory } = await import('/src/story.js');
  const out = {};
  out.table = [1, 2, 10, 12, 100, 300, 1000, 3000].map((n) => `${n}:${Math.round(P.xpForPower(n))}`).join(' ');
  let roundTrip = true, increasing = true, steady = true;
  for (let n = 1; n < 400; n++) {
    if (P.powerFromXp(P.xpForPower(n)) !== n || P.powerFromXp(P.xpForPower(n) + 0.5 * P.stepXp(n)) !== n) roundTrip = false;
    if (P.xpForPower(n + 1) <= P.xpForPower(n)) increasing = false;
    if (n > 1 && P.stepXp(n) <= P.stepXp(n - 1)) steady = false;
  }
  out.curve = { roundTrip, increasing, steady, none: P.powerFromXp(0), negative: P.powerFromXp(-5), huge: P.powerFromXp(1e12) > 100000, noLimit: P.powerFromXp(P.xpForPower(1e6)) === 1e6 };
  out.strength = [P.strength(10), P.strength(20), P.strength(1), P.strength(), P.strength(1000)].join();
  out.tiers = [0, 99, 100, 299, 300, 999, 1000, 2999, 3000, 1e9].map((n) => P.tierIndex(n)).join() + ' ' + P.TIERS.map((t) => t.name).join();
  out.short = [0, 7, 999, 1234, 9999, 10000, 12400, 99999, 999999, 1000000, 3100000, 2500000000].map((n) => P.shortNumber(n)).join(' ');
  out.pay = { kill: [P.xpForKill(1), P.xpForKill(10), P.xpForKill(100)].join(), bonus: P.winBonus(12), enemy: [P.enemyPowerFor(10, 0), P.enemyPowerFor(10, 1), P.enemyPowerFor(10, 2), P.enemyPowerFor(10, 9), P.enemyPowerFor(2, 1), P.enemyPowerFor(100, 2)].join() };

  // the progress record, with a pretend save
  const start = (k) => ({ sol: 1, ember: 120 }[k] || 1);
  const disk = {};
  const save = { load: () => (disk.data ? JSON.parse(JSON.stringify(disk.data)) : null), store: (d) => { disk.data = JSON.parse(JSON.stringify(d)); } };
  const prog = P.createProgress(start, save);
  const first = { power: prog.powerOf('sol'), xp: prog.xpOf('sol'), unlocked: prog.unlocked.join(), saved: prog.saved, flat: prog.flat };
  const gain = prog.addXp(['sol'], 35);
  prog.unlock(['sol', 'ember', 'tide']);
  prog.winRound();
  prog.mark('combo');
  prog.store();
  out.progress = { first, gain: JSON.stringify(gain), ember: prog.powerOf('ember'), tide: prog.powerOf('tide'), unlocked: prog.unlocked.join(), average: prog.averagePower(['sol', 'ember']), saved: prog.saved, has: [prog.has('combo'), prog.has('nothing')].join() };
  const again = P.createProgress(start, save);
  out.reload = { power: again.powerOf('sol'), ember: again.powerOf('ember'), unlocked: again.unlocked.join(), wins: again.roundsWon, has: again.has('combo') };
  again.reset();
  out.reset = { power: again.powerOf('sol'), unlocked: again.unlocked.join(), wins: again.roundsWon, stored: disk.data.roundsWon };
  out.flat = (() => { const f = P.createProgress(start, null, 10); f.addXp(['sol'], 1e6); return { power: f.powerOf('sol'), ember: f.powerOf('ember'), flat: f.flat }; })();

  // the browser's storage: real, broken, or full of rubbish
  {
    const real = createSave('test.powerheroes');
    real.store({ version: 1, xp: { sol: 5 }, roundsWon: 2, unlocked: ['sol'], seen: {} });
    const back = real.load();
    localStorage.setItem('test.powerheroes', '{not json');
    const bad = real.load();
    localStorage.setItem('test.powerheroes', JSON.stringify({ version: 99, xp: {}, unlocked: [] }));
    const wrong = real.load();
    real.clear();
    const gone = real.load();
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage is turned off'); }, configurable: true });
    let broken;
    try { broken = { load: createSave('x').load(), store: createSave('x').store({ version: 1 }) }; } catch (error) { broken = 'threw'; }
    Object.defineProperty(window, 'localStorage', original);
    out.save = { wins: back && back.roundsWon, bad, wrong, gone, broken: JSON.stringify(broken) };
  }

  // stats scale with Power
  {
    const scene = new THREE.Scene();
    const hero = createHero({ scene, bound: 10, kind: 'sol' });
    const base = { power: hero.power, max: hero.maxHealth, health: hero.health };
    hero.takeHit(50, 1, 0);
    hero.setPower(20);
    const doubled = { max: hero.maxHealth, health: hero.health };
    hero.setPower(1);
    const tiny = { max: hero.maxHealth, health: hero.health };
    hero.setPower(10);
    hero.reset();
    out.hero = { base, doubled, tiny, reset: hero.health };
  }
  {
    const scene = new THREE.Scene();
    const weak = createGloomling({ scene, x: 0, z: 0 });
    const strong = createGloomling({ scene, x: 0, z: 0, power: 20 });
    let bump = 0;
    const target = { position: new THREE.Vector3(0.5, 0, 0), down: false, takeHit: (amount) => { bump = amount; return true; } };
    for (let i = 0; i < 90 && !bump; i++) strong.update(1 / 30, target, i / 30, [strong]);
    out.gloom = { weak: [weak.power, weak.maxHealth, weak.health], strong: [strong.power, strong.maxHealth, strong.health], bump };
  }
  {
    const make = (power) => {
      const scene = new THREE.Scene();
      const g = createGloomling({ scene, x: 5, z: 0, power: 1000 });
      const log = [];
      const hero = { kind: 'sol', power, position: new THREE.Vector3(0, 0, 0), yaw: 0, down: false, face() {} };
      const powers = createPowers({ scene, hero, gloomlings: [g], events: { hit: (gl, amount, k) => log.push(`${k}:${amount}`) } });
      for (let i = 0; i < 25; i++) powers.update(1 / 30, i / 30);
      powers.castPower();
      for (let i = 0; i < 20; i++) powers.update(1 / 30, i / 30);
      return log.join(' ');
    };
    out.damage = { ten: make(10), twenty: make(20), one: make(1), none: make(undefined) };
  }
  {   // waves: each wave's Gloomling Power comes from the game
    const scene = new THREE.Scene();
    const gloomlings = [];
    const seen = [];
    const waves = createWaves({ scene, hero: { position: new THREE.Vector3(0, 0, 0), down: false }, gloomlings, enemyPower: (w) => 7 + w * 5, events: { spawn: (g) => seen.push(g.power) } });
    waves.start();
    const asked = [waves.enemyPower];
    for (let i = 0; i < 30 * 60 && waves.state !== 'over'; i++) { gloomlings.splice(0).forEach((g) => g.remove()); waves.update(1 / 30); if (waves.state === 'fighting' && asked.length < 2) asked.push(waves.enemyPower); }
    out.waves = { powers: [...new Set(seen)].join(), counts: seen.length, asked: asked.join(), plain: createWaves({ scene, hero: { position: new THREE.Vector3(), down: false }, gloomlings: [], events: {} }).enemyPower };
  }
  {   // story lines can use Power
    const doc = document.implementation.createHTMLDocument('story test');
    doc.body.innerHTML = '<div id="bubble"></div><div id="lesson" hidden></div><div id="dialogue" hidden><div id="dialogue-box"><div id="dialogue-face"></div><div id="dialogue-body"><div id="dialogue-name"></div><p id="dialogue-text"></p></div><div id="dialogue-next"></div></div></div>';
    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 100);
    const story = createStory({ camera, anchors: { pip: { object: new THREE.Object3D(), lift: 0 }, marlo: { object: new THREE.Object3D(), lift: 0 } }, root: doc, touch: false, vars: () => ({ power: 42, next: 43 }) });
    const press = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true, bubbles: true }));
    story.scene('win');
    story.update(0.3);
    const lines = [];
    for (let i = 0; i < 80 && story.inScene; i++) {
      if (story.waiting) { story.resume(); story.update(0.3); continue; }
      story.update(10);
      lines.push(doc.getElementById('dialogue-text').textContent);
      press();
    }
    out.tokens = { sol: lines.find((l) => /Maybe/.test(l)), ember: lines.find((l) => /trained a whole year/.test(l)), left: lines.some((l) => /[{}]/.test(l)) };
  }
  return out;
};

async function chunk16(browser) {
  let { page } = await openGame(browser, 'power-unit');
  const u = await page.evaluate(powerUnit);
  check('XP for each Power: Power 1 is 0 XP, 10 is 27, 12 is about 35, 100 about 1,200, 300 about 9,600, 1,000 about 100,000, 3,000 about 900,000', u.table === '1:0 2:2 10:27 12:35 100:1188 300:9568 1000:101898 3000:905698', u.table);
  check('the curve: XP and Power convert both ways exactly, each step costs more than the last (steady growth), and there is no limit', u.curve.roundTrip && u.curve.increasing && u.curve.steady && u.curve.none === 1 && u.curve.negative === 1 && u.curve.huge && u.curve.noLimit, JSON.stringify(u.curve));
  check('health and damage are multiplied by Power / 10', u.strength === '1,2,0.1,1,100', u.strength);
  check('the aura tiers start at 0, 100, 300, 1,000 and 3,000', u.tiers === '0,0,1,1,2,2,3,3,4,4 Spark,Glow,Blaze,Surge,Radiant', u.tiers);
  check('big numbers are short: 1,234 then 12.4K and 3.1M', u.short === '0 7 999 1,234 9,999 10K 12.4K 99.9K 999.9K 1M 3.1M 2.5B', u.short);
  check('a kill pays 30% of the Gloomling\'s Power (at least 1), a win adds 2x the last wave\'s Power, and the Gloomlings are 0.8, 1 and 1.2 times your Power (never below 6)', u.pay.kill === '1,3,30' && u.pay.bonus === 24 && u.pay.enemy === '8,10,12,12,6,120', JSON.stringify(u.pay));
  check('the progress record: starts fresh, XP raises Power, joiners start at their own Power (Ember 120), wins and "seen" are kept', u.progress.first.power === 1 && u.progress.first.xp === 0 && u.progress.first.unlocked === 'sol' && !u.progress.first.saved && !u.progress.first.flat && JSON.parse(u.progress.gain)[0].before === 1 && JSON.parse(u.progress.gain)[0].after === 11 && u.progress.ember === 120 && u.progress.unlocked === 'sol,ember,tide' && u.progress.average === 66 && u.progress.saved && u.progress.has === 'true,false', JSON.stringify(u.progress));
  check('what was saved comes back after a restart, and "Start over" wipes it', u.reload.power === 11 && u.reload.ember === 120 && u.reload.unlocked === 'sol,ember,tide' && u.reload.wins === 1 && u.reload.has && u.reset.power === 1 && u.reset.unlocked === 'sol' && u.reset.wins === 0 && u.reset.stored === 0, JSON.stringify([u.reload, u.reset]));
  check('flat mode (debug) keeps every hero at Power 10 whatever the XP', u.flat.power === 10 && u.flat.ember === 10 && u.flat.flat, JSON.stringify(u.flat));
  check('the browser\'s storage can be missing, broken or full of rubbish and the game just carries on without it', u.save.wins === 2 && u.save.bad === null && u.save.wrong === null && u.save.gone === null && u.save.broken === '{"load":null}', JSON.stringify(u.save));
  check('a hero\'s health follows their Power (100 at Power 10, 200 at 20, 10 at 1), keeping the same share when it changes, and a fresh start is full', u.hero.base.power === 10 && u.hero.base.max === 100 && u.hero.doubled.max === 200 && u.hero.doubled.health === 100 && u.hero.tiny.max === 10 && u.hero.tiny.health === 5 && u.hero.reset === 100, JSON.stringify(u.hero));
  check('a Gloomling\'s health and bump follow its Power (30 and 8 at Power 10; 60 and 16 at Power 20)', u.gloom.weak.join() === '10,30,30' && u.gloom.strong.join() === '20,60,60' && u.gloom.bump === 16, JSON.stringify(u.gloom));
  check('damage follows the hero\'s Power: a dart is 9 at Power 10, 18 at 20, 1 at Power 1 (never zero), and a hero without Power counts as 10', u.damage.ten.startsWith('hit:9') && u.damage.twenty.startsWith('hit:18') && u.damage.one.startsWith('hit:1 ') && u.damage.none.startsWith('hit:9') && /big:40/.test(u.damage.ten) && /big:80/.test(u.damage.twenty), JSON.stringify(u.damage));
  check('the waves ask the game how strong each wave\'s Gloomlings are (7, 12, 17 here), and say so for the Gloom Power note', u.waves.powers === '7,12,17' && u.waves.counts === 18 && u.waves.asked.startsWith('7,') && u.waves.plain === 10, JSON.stringify(u.waves));
  check('story lines can say Sol\'s Power ("42? Maybe 43"), and no {braces} are left on screen', /^42\? Maybe 43\./.test(u.tokens.sol) && /^42\?!/.test(u.tokens.ember) && !u.tokens.left, JSON.stringify(u.tokens));

  // Live game with real Power (?debug&power): XP, the corner number, the round's pay, unlocking, the end screen.
  POWER_ON = true;
  ({ page } = await openGame(browser, 'power-live'));
  POWER_ON = false;
  const real = await page.evaluate(() => { const G = window.__game; return { flat: G.progress.flat, sol: G.progress.powerOf('sol'), corner: document.getElementById('hud-power').textContent, health: G.player.maxHealth, wave: document.getElementById('hud-wave').textContent }; });
  check('with real Power, skipping the prologue still gives Sol what the lessons would (Power 10), the corner says so, and the health is 100', !real.flat && real.sol === 10 && real.corner === 'Power 10' && real.health === 100, JSON.stringify(real));
  await until(page, () => /Gloom Power \d+/.test(document.getElementById('hud-wave').textContent));
  const note = await page.evaluate(() => document.getElementById('hud-wave').textContent);
  check('the wave note shows the Gloom Power of the wave (8 in wave 1, for a Power 10 squad)', /^Wave 1\/3 · \d left · Gloom Power 8$/.test(note), note);
  const lessons = await page.evaluate(() => { const G = window.__game; G.progress.reset(); const r = G.rounds; const out = [G.progress.powerOf('sol')]; for (const k of ['climb', 'move', 'strike', 'power']) { r.reward(k); out.push(G.progress.powerOf('sol')); } return out.join(); });
  check('the prologue\'s rewards raise Sol\'s Power as Marlo teaches: 1, then 5, 6, 8 and 10', lessons === '1,5,6,8,10', lessons);
  const round = await page.evaluate(() => {
    const G = window.__game;
    G.progress.reset();
    G.progress.addXp(['sol'], 27);
    G.rounds.refresh();
    G.rounds.defeat({ power: 10 }); G.rounds.defeat({ power: 10 }); G.rounds.defeat({ power: 20 });
    for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); }
    return { gains: G.rounds.gains, wins: G.progress.roundsWon, unlocked: G.progress.unlocked.join(), corner: document.getElementById('hud-power').textContent, ember: G.progress.powerOf('ember'), ending: G.rounds.ending };
  });
  const g = round.gains[0];
  check('a won round pays XP for the Gloomlings beaten (3 + 3 + 6) and a win bonus (2 x the last wave\'s Power), raises Power, unlocks the other heroes (Ember joins at 120) and sends Marlo over', g && g.kind === 'sol' && g.name === 'Sol' && g.xp === 12 + 24 && g.before === 10 && g.after === 17 && round.wins === 1 && round.unlocked === 'sol,ember,tide,volt' && round.corner === 'Power 17' && round.ember === 120 && round.ending === 'won', JSON.stringify(round));
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  await until(page, () => document.querySelector('#end-gains .gain-power').textContent === '17');
  const row = await page.evaluate(() => ({ name: document.querySelector('.gain-name').textContent, power: document.querySelector('.gain-power').textContent, xp: document.querySelector('.gain-xp').textContent }));
  check('the end screen says what the round did, with the Power counting up to the new number: "Sol  Power 17  +36 XP"', row.name === 'Sol' && row.power === '17' && row.xp === '+36 XP', JSON.stringify(row));
  await page.screenshot({ path: `${OUT}/power-1-end.png` });

  // A round that is lost still pays for what was beaten, and no bonus.
  POWER_ON = true;
  ({ page } = await openGame(browser, 'power-lost'));
  POWER_ON = false;
  const lost = await page.evaluate(() => {
    const G = window.__game;
    G.rounds.defeat({ power: 10 }); G.rounds.defeat({ power: 10 });
    G.player.takeHit(1000, 0, 0);
    for (let i = 0; i < 90; i++) G.waves.update(1 / 30);
    return { gains: G.rounds.gains.map((x) => `${x.kind}:${x.xp}:${x.before}->${x.after}`).join(), wins: G.progress.roundsWon, unlocked: G.progress.unlocked.join(), ending: G.rounds.ending };
  });
  check('a lost round still gives some experience (the Gloomlings beaten), no win bonus, no new heroes', lost.gains === 'sol:6:10->11' && lost.wins === 0 && lost.unlocked === 'sol' && lost.ending === 'lost', JSON.stringify(lost));

  // Saving: win a round, reload, and the game remembers (?debug&power&save). A returning player skips the prologue.
  SAVE_ON = true;
  ({ page } = await openGame(browser, 'power-save'));
  SAVE_ON = false;
  await page.evaluate(() => { const G = window.__game; G.progress.addXp(['sol'], 100); G.progress.winRound(); G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.progress.mark('prologue'); G.progress.mark('combo'); G.progress.store(); });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('powerheroes.save')));
  check('progress is written to the browser\'s storage', stored.version === 1 && stored.roundsWon === 1 && stored.unlocked.length === 4 && stored.seen.prologue && stored.xp.sol >= 100, JSON.stringify(stored));
  await page.goto(gameUrl(['power', 'save', 'title', 'squad']));
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5, null, { timeout: 90000 });
  const back = await page.evaluate(() => { const G = window.__game; return { power: G.progress.powerOf('sol'), wins: G.progress.roundsWon, unlocked: G.progress.unlocked.length, combo: G.progress.has('combo'), reset: !document.getElementById('title-reset').hidden, phase: G.prologue.phase }; });
  check('after a reload the game remembers: Sol\'s Power, the win, who has joined and what Pip has said; the title offers "Start over"', back.power > 10 && back.wins === 1 && back.unlocked === 4 && back.combo && back.reset && back.phase === 'title', JSON.stringify(back));
  await page.mouse.click(400, 225);
  await until(page, () => !document.getElementById('squad-screen').hidden);
  const skipped = await page.evaluate(() => ({ phase: window.__game.prologue.phase, waves: window.__game.waves.state, lesson: window.__game.story.inScene }));
  check('a returning player skips the prologue and goes straight to choosing a squad', skipped.phase === 'done' && skipped.waves === 'idle' && !skipped.lesson, JSON.stringify(skipped));
  await page.goto(gameUrl(['power', 'save', 'title']));
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5, null, { timeout: 90000 });
  await page.click('#title-reset');
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5 && document.getElementById('title-reset').hidden, null, { timeout: 90000 });
  const wiped = await page.evaluate(() => ({ power: window.__game.progress.powerOf('sol'), wins: window.__game.progress.roundsWon, stored: localStorage.getItem('powerheroes.save') }));
  check('"Start over" wipes the save and starts a brand new game', wiped.power === 1 && wiped.wins === 0 && wiped.stored === null, JSON.stringify(wiped));
}

// ---------- Auras and the power-up moment ----------
const auraUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createAura } = await import('/src/aura.js');
  const { createHero } = await import('/src/hero.js');
  const { TYPE_COLORS } = await import('/src/types.js');
  const out = {};
  const make = () => {
    const scene = new THREE.Scene();
    const position = new THREE.Vector3(1, 0, 2);
    const emitted = { n: 0 };
    const aura = createAura({ scene, position, sparks: { emit: () => { emitted.n++; } } });
    return { scene, position, emitted, aura };
  };
  const run = (m, seconds, info) => { for (let i = 0; i < Math.round(seconds * 30); i++) m.aura.update(1 / 30, i / 30, info); };
  out.tiers = {};
  for (const power of [1, 99, 100, 299, 300, 999, 1000, 2999, 3000, 50000]) {
    const m = make();
    run(m, 2, { power, type: 'fire', visible: true, speed: 0 });
    const p = m.aura.parts;
    out.tiers[power] = { tier: m.aura.tier, parts: [p.floor, p.body, p.flame, p.ring, p.halo].map((x) => (x.visible && (x.material.opacity > 0.01) ? 1 : 0)).join(''), sparks: m.emitted.n > 0, glow: m.aura.glow };
  }
  {   // sparks only for Blaze and up; a light trail only for Radiant while running
    const still = make(); run(still, 2, { power: 400, type: 'storm', visible: true, speed: 0 });
    const running = make(); run(running, 2, { power: 400, type: 'storm', visible: true, speed: 6 });
    const radiantStill = make(); run(radiantStill, 2, { power: 4000, type: 'storm', visible: true, speed: 0 });
    const radiantRun = make(); run(radiantRun, 2, { power: 4000, type: 'storm', visible: true, speed: 6 });
    const glowOnly = make(); run(glowOnly, 2, { power: 150, type: 'storm', visible: true, speed: 6 });
    out.emit = { blaze: still.emitted.n > 5, blazeRunning: running.emitted.n === still.emitted.n || Math.abs(running.emitted.n - still.emitted.n) < 3, radiantTrail: radiantRun.emitted.n > radiantStill.emitted.n + 20, glowNone: glowOnly.emitted.n === 0 };
  }
  {   // it follows the hero, takes the type's colour, hides with the hero, and flares
    const m = make();
    run(m, 1, { power: 400, type: 'water', visible: true });
    const at = [m.aura.group.position.x, m.aura.group.position.z];
    const colour = m.aura.parts.body.material.color.getHex();
    m.position.set(-3, 0, 5);
    run(m, 0.1, { power: 400, type: 'fire', visible: true });
    const moved = [m.aura.group.position.x, m.aura.group.position.z];
    const fire = m.aura.parts.body.material.color.getHex();
    const calm = m.aura.parts.flame.material.opacity;
    m.aura.flare(1);
    m.aura.update(1 / 30, 3, { power: 400, type: 'fire', visible: true });
    const flaring = { opacity: m.aura.parts.flame.material.opacity, amount: m.aura.flaring };
    run(m, 1.6, { power: 400, type: 'fire', visible: true });
    const after = m.aura.flaring;
    run(m, 0.1, { power: 400, type: 'fire', visible: false });
    out.follow = { at, moved, water: colour === TYPE_COLORS.water.hex, fire: fire === TYPE_COLORS.fire.hex, flares: flaring.opacity > calm && flaring.amount > 0.5, faded: after === 0, hidden: m.aura.group.visible === false };
  }
  {   // a hero's edges light up
    const scene = new THREE.Scene();
    const hero = createHero({ scene, bound: 10, kind: 'ember' });
    const emissive = () => hero.group.children[0].children.length > 0 ? 1 : 0;
    const read = () => { let max = 0; hero.group.traverse((o) => { if (o.isMesh && o.material.emissive && o.material.isMeshLambertMaterial) max = Math.max(max, o.material.emissive.r); }); return +max.toFixed(2); };
    hero.update(1 / 30, { x: 0, z: 0 }, 0);
    const none = read();
    hero.setGlow(0.18);
    hero.update(1 / 30, { x: 0, z: 0 }, 0);
    const lit = read();
    hero.takeHit(5, 1, 0);
    hero.update(1 / 30, { x: 0, z: 0 }, 0);
    const hit = read();
    out.edges = { none, lit, hit };
  }
  return out;
};

async function chunk17(browser) {
  let { page } = await openGame(browser, 'aura-unit');
  const u = await page.evaluate(auraUnit);
  const want = { 1: [0, '10000', 0], 99: [0, '10000', 0], 100: [1, '11000', 0], 299: [1, '11000', 0], 300: [2, '11100', 0], 999: [2, '11100', 0], 1000: [3, '11110', 0.1], 2999: [3, '11110', 0.1], 3000: [4, '11111', 0.18], 50000: [4, '11111', 0.18] };
  check('the five aura tiers appear at Power 0, 100, 300, 1,000 and 3,000: a glow at the feet, then soft light, a flickering aura, a ground ring, a halo', Object.entries(want).every(([p, [tier, parts, glow]]) => u.tiers[p].tier === tier && u.tiers[p].parts === parts && u.tiers[p].glow === glow), JSON.stringify(u.tiers));
  check('sparks rise from Blaze up (not before), and a light trail follows a running Radiant hero only', u.emit.blaze && u.emit.glowNone && u.emit.blazeRunning && u.emit.radiantTrail, JSON.stringify(u.emit));
  check('the aura follows the hero, takes the colour of their type, flares for a moment (then calms down) and hides with the hero', u.follow.at.join() === '1,2' && u.follow.moved.join() === '-3,5' && u.follow.water && u.follow.fire && u.follow.flares && u.follow.faded && u.follow.hidden, JSON.stringify(u.follow));
  check('at Surge and Radiant the hero\'s own edges light up (a steady glow), and a hit flash is still brighter than that', u.edges.none === 0 && u.edges.lit === 0.18 && u.edges.hit > 0.18, JSON.stringify(u.edges));

  // Live game: the aura in play and the power-up moment (real Power: ?debug&power).
  POWER_ON = true;
  ({ page } = await openGame(browser, 'aura-live'));
  POWER_ON = false;
  const grown = [];
  for (const xp of [0, 1188, 9568, 101898, 905698]) {   // Power 1, 100, 300, 1,000, 3,000
    await page.evaluate((x) => { const G = window.__game; G.progress.data.xp.sol = x; G.rounds.refresh(); }, xp);
    await page.waitForTimeout(300);
    grown.push(await page.evaluate(() => `${window.__game.progress.powerOf('sol')}:${window.__game.aura.tier}:${window.__game.aura.group.visible ? 'seen' : 'hidden'}`));
  }
  check('in the live game Sol\'s aura follows their Power through every tier, and is seen', grown.join(' ') === '1:0:seen 100:1:seen 300:2:seen 1000:3:seen 3000:4:seen', grown.join(' '));
  await page.evaluate(() => { const G = window.__game; G.progress.data.xp.sol = 9568; G.rounds.refresh(); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/aura-1-blaze.png` });
  await page.evaluate(() => { const G = window.__game; G.progress.data.xp.sol = 101898; G.rounds.refresh(); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/aura-2-surge.png` });
  await page.evaluate(() => { const G = window.__game; G.progress.data.xp.sol = 905698; G.rounds.refresh(); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/aura-3-radiant.png` });

  // The power-up moment: the end screen counts up, ticks, flares, and a new tier is a bigger celebration.
  POWER_ON = true;
  ({ page } = await openGame(browser, 'powerup-live'));
  POWER_ON = false;
  await page.evaluate(() => {
    const G = window.__game;
    G.progress.data.xp.sol = 1100;   // Power 95: the next win crosses 100 (Glow)
    G.rounds.refresh();
    G.rounds.defeat({ power: 80 }); G.rounds.defeat({ power: 80 });
    for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); }
  });
  const gain = await page.evaluate(() => window.__game.rounds.gains[0]);
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  const first = await page.evaluate(() => document.querySelector('.gain-power').textContent);
  check('the end screen starts the Power at the old number and counts up', first === String(gain.before) || Number(first) >= gain.before, `${first} (before ${gain.before})`);
  await page.evaluate(() => { window.__maxSparks = 0; setInterval(() => { window.__maxSparks = Math.max(window.__maxSparks, window.__game.powers.sparks.live); }, 30); });
  await until(page, () => document.querySelector('.gain').classList.contains('flare'));   // the row flares when the count arrives
  const done = await page.evaluate(() => ({ power: document.querySelector('.gain-power').textContent, flare: document.querySelector('.gain').classList.contains('flare'), tier: document.querySelector('.gain').classList.contains('tier'), tierText: (document.querySelector('.gain-tier') || {}).textContent, ticks: window.__game.audio.counts.tick, chimes: window.__game.audio.counts.chime, tiers: window.__game.audio.counts.tier, flaring: window.__game.aura.flaring }));
  check('it ticks while it counts, the row flares when the number arrives, and crossing Power 100 is a bigger celebration: "Glow!", the fanfare, and the aura flaring', done.power === String(gain.after) && gain.before < 100 && gain.after >= 100 && done.flare && done.tier && done.tierText === 'Glow!' && done.ticks >= 3 && done.tiers === 1 && done.flaring > 1, JSON.stringify([gain, done]));
  await page.screenshot({ path: `${OUT}/aura-4-powerup.png` });
  const sparks = await page.evaluate(() => window.__maxSparks);
  check('a new tier also sets off a burst of confetti', sparks > 60, `most sparks at once=${sparks}`);
}

(async () => {
  const wanted = process.argv.slice(3);
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const chunks = { 1: chunk1, 2: chunk2, 3: chunk3, 4: chunk4, 5: chunk5, 6: chunk6, 7: chunk7, 8: chunk8, 9: chunk9, 10: chunk10, 11: chunk11, 12: chunk12, 13: chunk13, 14: chunk14, 15: chunk15, 16: chunk16, 17: chunk17 };
  for (const [number, run] of Object.entries(chunks)) {
    if (wanted.length === 0 || wanted.includes(number)) await run(browser);
  }
  await browser.close();
  console.log(results.join('\n'));
  console.log(problems.length ? '\nPROBLEMS:\n' + problems.join('\n') : '\nNo console errors, warnings, or missing files.');
})().catch((e) => { console.log(results.join('\n')); console.error('TEST SCRIPT FAILED:', e.message); process.exit(1); });
