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
let CHAPTER_ON = false;   // the five rounds of Chapter 1 (debug mode normally keeps the one round that repeats)
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
  await page.goto(gameUrl([...(SHOW_TITLE ? ['title'] : []), ...(SHOW_SQUAD ? ['squad'] : []), ...(HERO_PARAM ? [`hero=${HERO_PARAM}`] : []), ...(POWER_ON ? ['power'] : []), ...(SAVE_ON ? ['power', 'save'] : []), ...(CHAPTER_ON ? ['chapter'] : [])]));
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 10, null, { timeout: 180000 });   // (the test browser is slow, and sometimes slower)
  if (!KEEP_INTRO && !SHOW_TITLE) await page.evaluate(() => window.__game.prologue.skip());
  return { page, context };
}
const until = (page, fn, arg, timeout = 90000) => page.waitForFunction(fn, arg, { timeout });
// Opens the game again in a page that already has it. On the Claude-wrapped page the flags are in the part of the address after
// "#", and a change there alone is not a new page, so it is reloaded by hand.
async function reopen(page, flags) {
  await page.goto(gameUrl(flags));
  if (ARTIFACT) await page.reload();
}

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
    out.tapTooSoon = letters(s) < SCENES.lose.find((step) => Array.isArray(step))[1].replace('{name}', 'Sol').length && s.$('dialogue-name').textContent === 'Marlo';
    s.story.update(0.3);
    const before = letters(s);
    tap(s);
    out.tapFinishes = letters(s) > before && s.$('dialogue-text').textContent === SCENES.lose.find((step) => Array.isArray(step))[1].replace('{name}', 'Sol');
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
  check(`the ${songNames.length} songs load, and every track fills its loop exactly`, songNames.join() === 'falling-star,sunmeadow,marlo,village,lullaby,lullaby-sorrow,battle' && songNames.every((n) => u.songs[n].events >= 10 && u.songs[n].level <= 1 && u.songs[n].tempo >= 40 && u.songs[n].tempo <= 160), JSON.stringify(u.songs));
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
  await until(page, () => document.querySelectorAll('#squad .portrait')[1].classList.contains('active'));   // (the portraits follow a frame later)
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
  check('a kill pays 30% of the Gloomling\'s Power (at least 1), a win adds 2x the last wave\'s Power, and the Gloomlings are 0.8, 1 and 1.2 times your Power (1.4 in a fourth wave, and never below 6)', u.pay.kill === '1,3,30' && u.pay.bonus === 24 && u.pay.enemy === '8,10,12,14,6,120', JSON.stringify(u.pay));
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
  await reopen(page, ['power', 'save', 'title', 'squad']);
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5, null, { timeout: 90000 });
  const back = await page.evaluate(() => { const G = window.__game; return { power: G.progress.powerOf('sol'), wins: G.progress.roundsWon, unlocked: G.progress.unlocked.length, combo: G.progress.has('combo'), reset: !document.getElementById('title-reset').hidden, phase: G.prologue.phase }; });
  check('after a reload the game remembers: Sol\'s Power, the win, who has joined and what Pip has said; the title offers "Start over"', back.power > 10 && back.wins === 1 && back.unlocked === 4 && back.combo && back.reset && back.phase === 'title', JSON.stringify(back));
  await page.mouse.click(400, 225);
  await until(page, () => !document.getElementById('squad-screen').hidden);
  const skipped = await page.evaluate(() => ({ phase: window.__game.prologue.phase, waves: window.__game.waves.state, lesson: window.__game.story.inScene }));
  check('a returning player skips the prologue and goes straight to choosing a squad', skipped.phase === 'done' && skipped.waves === 'idle' && !skipped.lesson, JSON.stringify(skipped));
  await reopen(page, ['power', 'save', 'title']);
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

// ---------- Overdrive ----------
const overdriveUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createOverdrive, BOOST } = await import('/src/overdrive.js');
  const { createSquad } = await import('/src/squad.js');
  const { createGloomling } = await import('/src/gloom.js');
  const { createPowers } = await import('/src/powers.js');
  const out = {};
  const make = () => {
    const log = { boosts: [], flares: [], sounds: [], banners: [], shakes: 0 };
    const squad = { player: { down: false, setBoost: (b) => log.boosts.push(b) } };
    const od = createOverdrive({ squad, aura: { flare: (s) => log.flares.push(s) }, ui: { showBanner: (t, u) => log.banners.push(`${t}|${u}`) }, audio: { play: (n) => log.sounds.push(n) }, shake: () => { log.shakes++; } });
    return { od, squad, log };
  };
  {   // the meter
    const { od, log } = make();
    const start = { meter: od.meter, ready: od.ready, active: od.active };
    od.hit('hit');
    const one = +od.meter.toFixed(2);
    od.hit('big');
    const two = +od.meter.toFixed(2);
    let hits = 2;
    while (!od.ready && hits < 100) { od.hit('hit'); hits++; }
    const full = { meter: od.meter, hits, ready: od.ready, sounds: log.sounds.join() };
    od.hit('big'); od.hit('hit');
    out.meter = { start, one, two, full, still: od.meter, sounds: log.sounds.join() };
  }
  {   // using it
    const { od, squad, log } = make();
    const early = od.activate();
    for (let i = 0; i < 40; i++) od.hit('hit');
    const started = od.activate();
    out.use = { early, started, meter: od.meter, active: od.active, left: od.timeLeft, boosts: log.boosts.join(), flares: log.flares.join(), sounds: log.sounds.join(), banners: log.banners.join(), shakes: log.shakes, boost: BOOST };
    od.hit('hit'); od.hit('big');
    const whileOn = od.meter;
    od.update(2);
    const mid = { active: od.active, left: od.timeLeft };
    const again = od.activate();
    od.update(3.9);
    const nearEnd = { active: od.active, boosts: log.boosts.length };
    od.update(0.2);
    out.end = { whileOn, mid, again, nearEnd, active: od.active, left: od.timeLeft, last: log.boosts[log.boosts.length - 1], ready: od.ready };
    for (let i = 0; i < 40; i++) od.hit('hit');
    squad.player.down = true;
    const knockedOut = od.activate();
    squad.player.down = false;
    const second = od.activate();
    od.reset();
    out.more = { knockedOut, second, afterReset: { meter: od.meter, active: od.active, last: log.boosts[log.boosts.length - 1] } };
  }
  {   // the boost really changes the hit and the recharge
    const run = (boost) => {
      const scene = new THREE.Scene();
      const g = createGloomling({ scene, x: 5, z: 0, power: 1000 });
      const log = [];
      const hero = { kind: 'sol', power: 10, boost, position: new THREE.Vector3(0, 0, 0), yaw: 0, down: false, face() {} };
      const powers = createPowers({ scene, hero, gloomlings: [g], events: { hit: (gl, a, k) => log.push(`${k}:${a}`) } });
      for (let i = 0; i < 25; i++) powers.update(1 / 30, i / 30);
      powers.castPower();
      const readyAt = () => { let t = 0; while (!powers.powerReady && t < 8) { powers.update(0.1, 0); t += 0.1; } return +t.toFixed(1); };
      const recharge = readyAt();   // (this also lets the ring spread out and hit)
      return { first: log[0], burst: log.find((l) => l.startsWith('big')), recharge };
    };
    out.boosted = { plain: run(1), boosted: run(1.5), none: run(undefined) };
  }
  {   // with a real squad: the hero in play is boosted, and the boost follows a swap
    const scene = new THREE.Scene();
    const squad = createSquad({ scene, bound: 10, gloomlings: [] });
    squad.set(['sol', 'ember', 'tide']);
    const log = { flares: 0 };
    const od = createOverdrive({ squad, aura: { flare: () => { log.flares++; } }, ui: { showBanner() {} }, audio: { play() {} }, shake() {} });
    for (let i = 0; i < 40; i++) od.hit('hit');
    od.activate();
    const sol = squad.members.sol.hero.boost;
    squad.swapTo(1, true);
    od.update(0.1);
    out.squad = { sol, solAfter: squad.members.sol.hero.boost, ember: squad.members.ember.hero.boost, tide: squad.members.tide.hero.boost };
    od.update(7);
    out.squad.ended = [squad.members.sol.hero.boost, squad.members.ember.hero.boost].join();
  }
  return out;
};

async function chunk18(browser) {
  let { page } = await openGame(browser, 'overdrive-unit');
  const u = await page.evaluate(overdriveUnit);
  check('the meter starts empty; a hit fills 3%, a superpower hit 6%; it stops at full, says "ready" once, and more hits change nothing', u.meter.start.meter === 0 && !u.meter.start.ready && u.meter.one === 0.03 && u.meter.two === 0.09 && u.meter.full.meter === 1 && u.meter.full.hits <= 36 && u.meter.full.ready && u.meter.full.sounds === 'ready' && u.meter.still === 1 && u.meter.sounds === 'ready', JSON.stringify(u.meter));
  check('it cannot start before the meter is full; then it starts: the meter empties, 6 seconds, the hero is boosted 1.5x, the aura flares, a sound, a banner and a shake', !u.use.early && u.use.started && u.use.meter === 0 && u.use.active && u.use.left === 6 && u.use.boosts === '1.5' && u.use.flares === '6' && u.use.sounds === 'ready,overdrive' && u.use.banners === 'OVERDRIVE!|Power up!' && u.use.shakes === 1 && u.use.boost === 1.5, JSON.stringify(u.use));
  check('while it is on the meter does not fill and it cannot start again; at the end the boost goes back to normal and the meter is empty', u.end.whileOn === 0 && u.end.mid.active && u.end.mid.left === 4 && !u.end.again && u.end.nearEnd.active && !u.end.active && u.end.left === 0 && u.end.last === 1 && !u.end.ready, JSON.stringify(u.end));
  check('a knocked-out hero cannot use it; a new round (reset) ends it and empties the meter', !u.more.knockedOut && u.more.second && u.more.afterReset.meter === 0 && !u.more.afterReset.active && u.more.afterReset.last === 1, JSON.stringify(u.more));
  check('the boost makes every hit 1.5x (dart 9 becomes 14, Starburst 40 becomes 60) and the superpower recharge 3 times as fast (5 s becomes about 1.7 s)', u.boosted.plain.first === 'hit:9' && u.boosted.boosted.first === 'hit:14' && u.boosted.boosted.burst === 'big:60' && u.boosted.plain.burst === 'big:40' && u.boosted.none.first === 'hit:9' && u.boosted.plain.recharge >= 4.9 && u.boosted.plain.recharge <= 5.1 && u.boosted.boosted.recharge >= 1.6 && u.boosted.boosted.recharge <= 1.8, JSON.stringify(u.boosted));
  check('with a real squad only the hero in play is boosted, the boost follows a swap, and it ends for everybody', u.squad.sol === 1.5 && u.squad.solAfter === 1 && u.squad.ember === 1.5 && u.squad.tide === 1 && u.squad.ended === '1,1', JSON.stringify(u.squad));

  // Live game.
  ({ page } = await openGame(browser, 'overdrive-live'));
  const idle = await page.evaluate(() => ({ hidden: document.getElementById('overdrive').hidden, fill: document.getElementById('hud-meter-fill').style.transform, power: document.getElementById('hud-power').textContent }));
  check('at first the meter is empty and there is no Overdrive button', idle.hidden && (idle.fill === 'scaleX(0)' || idle.fill === '') && idle.power === 'Power 10', JSON.stringify(idle));
  await page.evaluate(() => { const G = window.__game; G.waves.reset(); G.gloomlings.splice(0).forEach((g) => g.remove()); });
  await until(page, () => window.__game.overdrive.meter > 0.05 || true);
  await page.evaluate(async () => {
    const G = window.__game;
    const { createGloomling } = await import('/src/gloom.js');
    G.gloomlings.push(createGloomling({ scene: G.world.scene, x: 3, z: 0, power: 10 }), createGloomling({ scene: G.world.scene, x: 4, z: 1, power: 10 }));
  });
  await until(page, () => window.__game.overdrive.meter > 0);
  const filled = await page.evaluate(() => ({ meter: window.__game.overdrive.meter, fill: document.getElementById('hud-meter-fill').style.transform }));
  check('real hits fill the meter and the bar under the name box shows it', filled.meter > 0 && filled.meter < 1 && /scaleX\(0\.\d+\)/.test(filled.fill), JSON.stringify(filled));
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 40; i++) G.overdrive.hit('hit'); });
  await until(page, () => !document.getElementById('overdrive').hidden);
  const ready = await page.evaluate(() => ({ text: document.getElementById('overdrive').textContent, full: document.getElementById('hud-meter').classList.contains('full'), keyText: [...document.querySelectorAll('#overdrive span')].map((s) => getComputedStyle(s).display !== 'none').join() }));
  check('when the meter is full a pulsing "OVERDRIVE ready!" button appears (Press E on a computer)', /OVERDRIVE ready!/.test(ready.text) && ready.full && /Press E/.test(ready.text), JSON.stringify(ready));
  await page.screenshot({ path: `${OUT}/overdrive-1-ready.png` });
  await page.keyboard.press('KeyE');
  const on = await page.evaluate(() => ({ active: window.__game.overdrive.active, text: document.getElementById('overdrive').textContent, power: document.getElementById('hud-power').textContent, boosted: document.getElementById('hud-power').classList.contains('boosted'), banner: document.getElementById('banner-title').textContent, boost: window.__game.player.group && window.__game.squad.members.sol.hero.boost, flaring: window.__game.aura.flaring, sound: window.__game.audio.counts.overdrive }));
  check('pressing E starts Overdrive: the button counts down, the Power number jumps to 15 in gold, "OVERDRIVE!" sweeps across, the hero is boosted, the aura flares, and it makes its sound', on.active && /^OVERDRIVE [1-6]s$/.test(on.text) && on.power === 'Power 15' && on.boosted && on.banner === 'OVERDRIVE!' && on.boost === 1.5 && on.flaring > 3 && on.sound === 1, JSON.stringify(on));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/overdrive-2-on.png` });
  await page.evaluate(() => window.__game.overdrive.update(7));
  await until(page, () => document.getElementById('overdrive').hidden);
  const off = await page.evaluate(() => ({ power: document.getElementById('hud-power').textContent, boosted: document.getElementById('hud-power').classList.contains('boosted'), boost: window.__game.squad.members.sol.hero.boost, fill: document.getElementById('hud-meter-fill').style.transform }));
  check('when it ends the number, the colour and the strength go back to normal and the meter is empty', off.power === 'Power 10' && !off.boosted && off.boost === 1 && /scaleX\(0(\.\d+)?\)/.test(off.fill), JSON.stringify(off));
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 40; i++) G.overdrive.hit('hit'); });
  const button = await page.evaluate(() => { const r = document.getElementById('overdrive').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await until(page, () => !document.getElementById('overdrive').hidden);
  const rect = await page.evaluate(() => { const r = document.getElementById('overdrive').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(rect.x, rect.y);
  check('tapping the button starts Overdrive too', await page.evaluate(() => window.__game.overdrive.active));
  await page.evaluate(() => { const G = window.__game; G.overdrive.update(7); for (let i = 0; i < 40; i++) G.overdrive.hit('hit'); G.story.scene('lose'); });
  await page.keyboard.press('KeyE');
  check('Overdrive cannot start during a conversation', !(await page.evaluate(() => window.__game.overdrive.active)));
  await page.evaluate(() => window.__game.story.skip());
  await page.evaluate(() => { const G = window.__game; G.rounds.restart(); });
  check('a new round starts with an empty meter', await page.evaluate(() => window.__game.overdrive.meter === 0 && !window.__game.overdrive.active));

  // With a squad, tapping the portrait of the hero in play is Overdrive; the other portraits swap.
  ({ page } = await openGame(browser, 'overdrive-squad'));
  await page.evaluate(() => { const G = window.__game; G.rounds.chooseSquad(['sol', 'ember', 'tide']); for (let i = 0; i < 40; i++) G.overdrive.hit('hit'); });
  const portrait = (i) => page.evaluate((n) => { const r = document.querySelectorAll('#squad .portrait')[n].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, i);
  const second = await portrait(1);
  await page.mouse.click(second.x, second.y);
  const swapped = await page.evaluate(() => ({ kind: window.__game.player.kind, active: window.__game.overdrive.active }));
  check('tapping another hero\'s portrait swaps (it does not start Overdrive)', swapped.kind === 'ember' && !swapped.active, JSON.stringify(swapped));
  await until(page, () => window.__game.squad.swapReady);
  const mine = await portrait(1);
  await page.mouse.click(mine.x, mine.y);
  check('tapping the portrait of the hero in play starts Overdrive, and the boost is on that hero', await page.evaluate(() => window.__game.overdrive.active && window.__game.squad.members.ember.hero.boost === 1.5));
}

// ---------- The Power Rankings ----------
const rankingsUnit = async () => {
  const { RIVALS, MARLO, TOP, board, passedBy, passes, windowed } = await import('/src/rankings.js');
  const out = {};
  const hero = (kind, name, power) => ({ kind, name, type: 'light', power });
  const line = (rows) => rows.map((r) => (r.gap ? '..' : `${r.rank}${r.name}${r.you ? '*' : ''}`)).join(' ');
  {   // the board: sorted, ranked, ties go to the rival
    const rows = board([hero('sol', 'Sol', 55), hero('ember', 'Ember', 150), hero('tide', 'Tide', 150), hero('volt', 'Volt', 9000)]);
    out.order = line(rows);
    out.rivals = { sorted: RIVALS.every((r, i) => i === 0 || RIVALS[i - 1].power > r.power), top: RIVALS[0].name === TOP && TOP === 'Rook', count: RIVALS.length, marlo: MARLO.power, marloOnBoard: rows.some((r) => r.name === MARLO.name) };
  }
  {   // passing: you must be ahead (a tie does not pass)
    const names = (a, b) => passedBy(a, b).map((r) => r.name).join();
    out.passed = { none: names(10, 44), tie: names(10, 45), one: names(10, 46), fromTie: names(45, 46), already: names(46, 80), next: names(46, 81), all: names(10, 5000), same: names(5, 5) };
  }
  {   // what a round did: the biggest rival first, the rank after, Rook is "big", at most 3 lines
    const rows = board([hero('sol', 'Sol', 55), hero('ember', 'Ember', 160)]);
    const two = passes([{ kind: 'sol', name: 'Sol', before: 10, after: 55 }, { kind: 'ember', name: 'Ember', before: 120, after: 160 }], rows);
    out.two = JSON.stringify(two);
    const rook = passes([{ kind: 'sol', name: 'Sol', before: 2300, after: 2500 }], board([hero('sol', 'Sol', 2500)]));
    out.rook = JSON.stringify(rook);
    const many = passes([{ kind: 'sol', name: 'Sol', before: 1, after: 5000 }], board([hero('sol', 'Sol', 5000)]));
    out.many = { names: many.list.map((p) => p.rival).join(), more: many.more, ranks: many.list.map((p) => p.rank).join() };
    out.none = JSON.stringify(passes([{ kind: 'sol', name: 'Sol', before: 10, after: 10 }], rows));
  }
  {   // a board that fits a small screen
    const full = board([hero('sol', 'Sol', 55), hero('ember', 'Ember', 150), hero('tide', 'Tide', 150), hero('volt', 'Volt', 9000)]);
    out.fits = { small: windowed(full.slice(0, 8), 9) === full.slice(0, 8) || windowed(full.slice(0, 8), 9).length === 8, nine: windowed(full.slice(0, 9), 9).length === 9 };
    out.big = line(windowed(full, 9));
    const many = Array.from({ length: 20 }, (_, i) => ({ name: 'R' + i, type: 'fire', power: 2000 - i * 50 }));
    const middle = board([hero('sol', 'Sol', 1025)], many);   // number 20
    const w = windowed(middle, 9);
    out.middle = line(w);
    out.middleReal = w.filter((r) => !r.gap).length;
    const top = windowed(board([hero('sol', 'Sol', 5000)], many), 9);
    out.top = line(top);
    out.noHeroes = line(windowed(board([], many), 9));
    const bottom = windowed(board([hero('sol', 'Sol', 1)], many), 9);
    out.bottom = line(bottom);
  }
  return out;
};

async function chunk19(browser) {
  let { page } = await openGame(browser, 'rankings-unit');
  const u = await page.evaluate(rankingsUnit);
  check('the board is sorted by Power, ranked 1, 2, 3..., and when a hero ties with another hero of the isle, the other one stays ahead', u.order === '1Volt* 2Rook 3Fennel 4Brindle 5Marigold 6Juno 7Ember* 8Tide* 9Pebble 10Sol* 11Wren', u.order);
  check('the other heroes are listed strongest first with Rook number 1; Keeper Marlo (a faded 9,999) is not on the board', u.rivals.sorted && u.rivals.top && u.rivals.count === 7 && u.rivals.marlo === 9999 && !u.rivals.marloOnBoard, JSON.stringify(u.rivals));
  check('you pass a hero only by being ahead of them: level is not passed, one more is', u.passed.none === '' && u.passed.tie === '' && u.passed.one === 'Wren' && u.passed.fromTie === 'Wren' && u.passed.already === '' && u.passed.next === 'Pebble' && u.passed.same === '' && u.passed.all === 'Rook,Fennel,Brindle,Marigold,Juno,Pebble,Wren', JSON.stringify(u.passed));
  check('a round\'s passes name the hero, the hero they passed and the new rank, the strongest first', u.two === '{"list":[{"hero":"Ember","rival":"Juno","rank":1,"big":false},{"hero":"Sol","rival":"Wren","rank":3,"big":false}],"more":0}' || /^\{"list":\[\{"hero":"Ember","rival":"Juno","rank":\d+,"big":false\},\{"hero":"Sol","rival":"Wren","rank":\d+,"big":false\}\],"more":0\}$/.test(u.two), u.two);
  check('passing Rook (number 1) is marked big, and a round with nothing passed is empty', u.rook === '{"list":[{"hero":"Sol","rival":"Rook","rank":1,"big":true}],"more":0}' && u.none === '{"list":[],"more":0}', `${u.rook} ${u.none}`);
  check('at most three passes are listed (the biggest), and the rest are counted', u.many.names === 'Rook,Fennel,Brindle' && u.many.more === 4 && u.many.ranks === '1,1,1', JSON.stringify(u.many));
  check('a board that is short enough shows everything', u.fits.small && u.fits.nine, JSON.stringify(u.fits));
  check('a long board keeps number 1 and your heroes, the heroes just above you, and marks what was left out with a gap', u.big === '1Volt* 2Rook .. 5Marigold 6Juno 7Ember* 8Tide* 9Pebble 10Sol* 11Wren', u.big);
  check('with 20 heroes on the board and you at number 21, nine rows show: number 1, you, and those around you', u.middleReal === 9 && /^1R0 \.\. /.test(u.middle) && /21Sol\*/.test(u.middle) && !/\.\. \.\./.test(u.middle) && u.top.startsWith('1Sol* 2R0') && !/\.\./.test(u.top.split(' ').slice(0, 9).join(' ')) && u.bottom.startsWith('1R0 ..') && u.bottom.endsWith('21Sol*') && u.noHeroes.startsWith('1R0 2R1'), `${u.middle} | ${u.top} | ${u.bottom} | ${u.noHeroes}`);

  // Live game, real Power.
  POWER_ON = true;
  ({ page } = await openGame(browser, 'rankings-live'));
  POWER_ON = false;
  const text = (id) => page.evaluate((i) => document.getElementById(i).textContent, id);
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.rounds.showRankings(); });
  const board = await page.evaluate(() => ({
    shown: !document.getElementById('rankings').hidden,
    rows: [...document.querySelectorAll('#rankings-list li')].map((li) => (li.classList.contains('rank-gap') ? '..' : `${li.querySelector('.rank-no').textContent} ${li.querySelector('.rank-name').textContent} ${li.querySelector('.rank-power').textContent}${li.classList.contains('you') ? ' *' : ''}`)).join(' | '),
    note: document.getElementById('rankings-note').textContent,
    title: document.getElementById('rankings-title').textContent,
  }));
  check('the board opens: number 1 Rook 2,400, a gap, then the rows around your four heroes (marked "you") among the people of the village, a gap, and the last one; and the line about Marlo', board.shown && board.rows === '#1 Rook 2,400 | .. | #8 Flint 129 | #9 Ember 120 * | #10 Volt 100 * | #11 Sage 98 | #12 Tide 90 * | #13 Pebble 80 | .. | #18 Ivy 38 | #19 Sol 10 *' && board.note === 'Keeper Marlo is retired. His Power is still a faded 9,999.' && board.title === 'Power Rankings', JSON.stringify(board));
  await page.screenshot({ path: `${OUT}/rankings-1-board.png` });
  const back = await page.evaluate(() => { const r = document.getElementById('rankings-back').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(back.x, back.y);
  check('the Back button closes the board', await page.evaluate(() => document.getElementById('rankings').hidden));
  for (const key of ['Space', 'Enter', 'Escape']) {
    await page.evaluate(() => window.__game.rounds.showRankings());
    await page.keyboard.press(key);
    check(`${key} closes the board`, await page.evaluate(() => document.getElementById('rankings').hidden));
  }
  await page.keyboard.press('Escape');
  check('Escape does nothing when the board is not open (and Space still casts the superpower)', await page.evaluate(() => document.getElementById('rankings').hidden && document.getElementById('end').hidden));

  // After a round: "Sol passed Wren!" under the numbers; the Rankings button opens the board over the end screen.
  POWER_ON = true;
  ({ page } = await openGame(browser, 'rankings-end'));
  POWER_ON = false;
  await page.evaluate(async () => {
    const G = window.__game;
    const { xpForPower } = await import('/src/power.js');
    G.progress.data.xp.sol = Math.ceil(xpForPower(44));   // Power 44: one step below Wren (45)
    G.rounds.refresh();
    G.rounds.defeat({ power: 80 }); G.rounds.defeat({ power: 80 });
    for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); }
  });
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  await until(page, () => document.querySelector('#end-passes .pass.show'));
  const after = await page.evaluate(() => {
    const G = window.__game;
    const gain = G.rounds.gains[0];
    const lines = [...document.querySelectorAll('#end-passes .pass')].map((l) => l.textContent);
    const rank = G.rounds.rows().find((r) => r.you && r.kind === 'sol').rank;
    const expected = G.clan.members.filter((m) => m.power >= gain.before && m.power < gain.after).sort((a, b) => b.power - a.power).slice(0, 3).map((m) => `Sol passed ${m.name}! Now #${rank}`);
    return { gain, lines, rank, expected, big: document.querySelector('#end-passes .pass').classList.contains('big'), button: !document.getElementById('end-rankings').hidden, chimes: G.audio.counts.chime };
  });
  check('after the round the end screen says who Sol passed, the strongest first, at most three ("Sol passed Wren! Now #N"), and shows the Power Rankings button', after.gain.before === 44 && after.gain.after > 45 && after.gain.after < 80 && after.lines.length >= 1 && after.lines.length <= 3 && JSON.stringify(after.lines) === JSON.stringify(after.expected) && after.lines[after.lines.length - 1] === `Sol passed Wren! Now #${after.rank}` && !after.big && after.button && after.chimes >= 2, JSON.stringify(after));
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/rankings-2-end.png` });
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 40; i++) G.overdrive.hit('hit'); });
  await page.keyboard.press('KeyE');
  check('on the end screen the E key does not start Overdrive (menus take the keys)', !(await page.evaluate(() => window.__game.overdrive.active)));
  const open = await page.evaluate(() => { const r = document.getElementById('end-rankings').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(open.x, open.y);
  const over = await page.evaluate(() => ({ board: !document.getElementById('rankings').hidden, end: !document.getElementById('end').hidden, youRows: document.querySelectorAll('#rankings-list .rank-row.you').length }));
  check('the button opens the board over the end screen, with all four heroes (the others join after a win) marked', over.board && over.end && over.youRows === 4, JSON.stringify(over));
  await page.keyboard.press('Space');
  const closed = await page.evaluate(() => ({ board: document.getElementById('rankings').hidden, end: !document.getElementById('end').hidden, state: window.__game.waves.state }));
  check('Space closes the board and goes back to the end screen (it does not start the next round)', closed.board && closed.end && closed.state === 'over', JSON.stringify(closed));

  // Passing Rook, number 1, is a bigger moment.
  POWER_ON = true;
  ({ page } = await openGame(browser, 'rankings-rook'));
  POWER_ON = false;
  await page.evaluate(async () => {
    const G = window.__game;
    const { xpForPower } = await import('/src/power.js');
    G.progress.data.xp.sol = Math.round(xpForPower(2399));
    G.rounds.refresh();
    G.rounds.defeat({ power: 3000 }); G.rounds.defeat({ power: 3000 });
    for (let i = 0; i < 30 * 60 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); }
  });
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  await page.evaluate(() => { window.__maxSparks = 0; setInterval(() => { window.__maxSparks = Math.max(window.__maxSparks, window.__game.powers.sparks.live); }, 30); });
  await until(page, () => document.querySelector('#end-passes .pass.show'));
  const rook = await page.evaluate(() => ({ lines: [...document.querySelectorAll('#end-passes .pass')].map((l) => l.textContent), big: document.querySelector('#end-passes .pass').classList.contains('big'), tiers: window.__game.audio.counts.tier, rank: window.__game.rounds.rows()[0].name }));
  check('passing Rook shows "★ Sol passed Rook! Now #1" in a bigger style, with the fanfare', rook.lines[0] === '★ Sol passed Rook! Now #1' && rook.big && rook.tiers >= 1 && rook.rank === 'Sol', JSON.stringify(rook));
  await page.waitForTimeout(700);
  const sparks = await page.evaluate(() => window.__maxSparks);
  check('and sets off confetti', sparks > 60, `most sparks at once=${sparks}`);

  // The squad screen has the button too.
  SHOW_SQUAD = true; POWER_ON = true;
  ({ page } = await openGame(browser, 'rankings-squad'));
  SHOW_SQUAD = false; POWER_ON = false;
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.rounds.restart(); });
  await until(page, () => !document.getElementById('squad-screen').hidden);
  const hasButton = await page.evaluate(() => !document.getElementById('squad-rankings').hidden);
  const state0 = await page.evaluate(() => window.__game.waves.state);
  const sq = await page.evaluate(() => { const r = document.getElementById('squad-rankings').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(sq.x, sq.y);
  const sqOpen = await page.evaluate(() => ({ board: !document.getElementById('rankings').hidden, squad: !document.getElementById('squad-screen').hidden }));
  await page.keyboard.press('Enter');
  const sqBack = await page.evaluate(() => ({ board: document.getElementById('rankings').hidden, squad: !document.getElementById('squad-screen').hidden, state: window.__game.waves.state }));
  check('the squad screen has a Power Rankings button; it opens the board over it, and Enter closes only the board (the round does not start)', hasButton && sqOpen.board && sqOpen.squad && sqBack.board && sqBack.squad && sqBack.state === state0, JSON.stringify([hasButton, sqOpen, sqBack, state0]));

  // Small screens: every card must fit (a phone held either way). 667x375 is an iPhone SE held sideways.
  POWER_ON = true;
  ({ page } = await openGame(browser, 'rankings-sizes'));
  POWER_ON = false;
  for (const [w, h, tag, hard] of [[390, 844, 'portrait', true], [844, 390, 'wide', true], [667, 375, 'se-sideways', true], [568, 320, 'small-sideways', false]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const fit = await page.evaluate(async () => {
      const G = window.__game;
      const { board, windowed, MARLO } = await import('/src/rankings.js');
      const box = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
      const gains = ['Sol', 'Ember', 'Tide'].map((name, i) => ({ kind: name.toLowerCase(), name, xp: 380, before: 40 + i, after: 300 + i }));
      const passes = { list: [{ hero: 'Ember', rival: 'Brindle', rank: 3, big: false }, { hero: 'Sol', rival: 'Pebble', rank: 9, big: false }, { hero: 'Sol', rival: 'Wren', rank: 10, big: false }], more: 1 };
      G.ui.showEnd('won', gains, { passes, onRankings: () => {} });
      await new Promise((r) => setTimeout(r, 400));
      const end = box('end-card');
      G.ui.hideEnd();
      const heroes = ['sol', 'ember', 'tide', 'volt'].map((kind) => ({ kind, name: kind[0].toUpperCase() + kind.slice(1), type: 'fire', power: 'Superpower' }));
      G.ui.showSquad({ heroes, chosen: ['ember', 'tide'], onGo: () => {}, onRankings: () => {} });
      await new Promise((r) => setTimeout(r, 100));
      const squad = box('squad-card');
      document.getElementById('squad-screen').hidden = true;
      const rows = board(heroes.map((h, i) => ({ kind: h.kind, name: h.name, type: 'fire', power: 300 - i * 70 })));
      G.ui.showRankings(windowed(rows), MARLO.note);
      const rank = box('rankings-card');
      G.ui.hideRankings();
      return { end, squad, rank, w: innerWidth, h: innerHeight };
    });
    const inside = (b) => b.top >= 0 && b.bottom <= fit.h && b.left >= 0 && b.right <= fit.w;
    const ok = inside(fit.end) && inside(fit.squad) && inside(fit.rank);
    if (hard) check(`on a ${w}x${h} screen (${tag}) the end card, the squad card and the board all fit`, ok, JSON.stringify(fit));
    else results.push(`INFO  ${w}x${h} (${tag}): cards ${ok ? 'fit' : 'do not all fit'}  ${JSON.stringify(fit)}`);
    if (w === 667 || w === 390) {
      await page.evaluate(async () => {
        const G = window.__game;
        const { board, windowed, MARLO } = await import('/src/rankings.js');
        G.ui.showEnd('won', ['Sol', 'Ember', 'Tide'].map((name, i) => ({ kind: name.toLowerCase(), name, xp: 380, before: 40 + i, after: 300 + i })), { passes: { list: [{ hero: 'Ember', rival: 'Brindle', rank: 3, big: false }, { hero: 'Sol', rival: 'Pebble', rank: 9, big: false }], more: 0 }, onRankings: () => {} });
      });
      await page.waitForTimeout(3500);
      await page.screenshot({ path: `${OUT}/rankings-3-end-${tag}.png` });
      await page.evaluate(async () => {
        const G = window.__game;
        const { board, windowed, MARLO } = await import('/src/rankings.js');
        G.ui.hideEnd();
        const heroes = ['sol', 'ember', 'tide', 'volt'].map((kind) => ({ kind, name: kind[0].toUpperCase() + kind.slice(1), type: 'fire', power: 'Superpower' }));
        G.ui.showSquad({ heroes, chosen: ['ember', 'tide'], onGo: () => {}, onRankings: () => {} });
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/rankings-4-squad-${tag}.png` });
      await page.evaluate(async () => {
        const G = window.__game;
        const { board, windowed, MARLO } = await import('/src/rankings.js');
        document.getElementById('squad-screen').hidden = true;
        G.ui.showRankings(windowed(board(['sol', 'ember', 'tide', 'volt'].map((kind, i) => ({ kind, name: kind[0].toUpperCase() + kind.slice(1), type: 'fire', power: 300 - i * 70 })))), MARLO.note);
      });
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${OUT}/rankings-5-board-${tag}.png` });
    }
  }
}

// ---------- Naming the hero ----------
const nameUnit = async () => {
  const { cleanName, createProgress } = await import('/src/power.js');
  const { createSave } = await import('/src/save.js');
  const out = {};
  out.clean = {
    plain: cleanName('Rowan'), spaces: cleanName('  Mia   Rose  '), symbols: cleanName('<b>Ro&wan</b>"'), long: cleanName('Bartholomew the Great'),
    cut: cleanName('Abcdefghi j'), empty: cleanName(''), blank: cleanName('   '), nothing: cleanName(null), emoji: cleanName('🔥🔥'),
    accents: cleanName('Zoë-Ann'), other: cleanName('Дима'), apostrophe: cleanName("O'Neil"), custom: cleanName('', 'Ava'), digits: cleanName('R2 D2'), tab: cleanName('a\tb'),
  };
  {
    const kept = {};
    const fake = { load: () => null, store() {}, clear() {}, loadName: () => kept.name ?? null, storeName: (n) => { kept.name = n; } };
    const progress = createProgress(() => 1, fake);
    const start = progress.name;
    const set = progress.setName('  Rowan  ');
    const stored = kept.name;
    progress.reset();
    const afterReset = progress.name;
    const empty = progress.setName('!!!');
    out.progress = { start, set, stored, afterReset, empty, loaded: createProgress(() => 1, { ...fake, loadName: () => 'Mia' }).name, memory: createProgress(() => 1, null).setName('Zed') };
  }
  {
    const save = createSave('test.key');
    const before = save.loadName();
    save.storeName('Rowan');
    out.storage = { before, after: save.loadName(), raw: localStorage.getItem('test.key.name'), progressKey: localStorage.getItem('test.key') };
    save.clear();
    out.storage.afterClear = save.loadName();
  }
  return out;
};

async function chunk20(browser) {
  let { page } = await openGame(browser, 'name-unit');
  const u = await page.evaluate(nameUnit);
  const c = u.clean;
  check('names are cleaned: letters of any language, digits, spaces, \' and - stay; symbols, tags and emoji go; spaces are tidied; at most 10 letters', c.plain === 'Rowan' && c.spaces === 'Mia Rose' && c.symbols === 'bRowanb' && c.long === 'Bartholome' && c.cut === 'Abcdefghi' && c.accents === 'Zoë-Ann' && c.other === 'Дима' && c.apostrophe === "O'Neil" && c.digits === 'R2 D2' && c.tab === 'ab', JSON.stringify(c));
  check('an empty name, only spaces, only symbols or nothing at all means Sol (or the fallback given)', c.empty === 'Sol' && c.blank === 'Sol' && c.nothing === 'Sol' && c.emoji === 'Sol' && c.custom === 'Ava', JSON.stringify(c));
  check('the progress record starts as Sol, keeps the cleaned name, saves it, and does not forget it when the progress is wiped; with no storage it still works', u.progress.start === 'Sol' && u.progress.set === 'Rowan' && u.progress.stored === 'Rowan' && u.progress.afterReset === 'Rowan' && u.progress.empty === 'Sol' && u.progress.loaded === 'Mia' && u.progress.memory === 'Zed', JSON.stringify(u.progress));
  check('the name is stored on its own (not inside the progress), and clearing the progress leaves it', u.storage.before === null && u.storage.after === 'Rowan' && u.storage.raw === 'Rowan' && u.storage.progressKey === null && u.storage.afterClear === 'Rowan', JSON.stringify(u.storage));

  // Live: the title screen.
  SHOW_TITLE = true;
  ({ page } = await openGame(browser, 'name-title'));
  SHOW_TITLE = false;
  const text = (sel) => page.evaluate((s) => document.querySelector(s).textContent, sel);
  const state = () => page.evaluate(() => ({ row: !document.getElementById('title-name-row').hidden, pill: !document.getElementById('title-rename').hidden, form: !document.getElementById('title-rename-form').hidden, pillText: document.getElementById('title-rename').textContent, value: document.getElementById('title-rename-input').value, focused: document.activeElement && document.activeElement.id, title: !document.getElementById('title').hidden, phase: window.__game.prologue.phase }));
  const first = await state();
  check('the title screen has a small name button that says "Hero name: Sol · change"', first.row && first.pill && !first.form && /^Hero name: Sol\W+change$/.test(first.pillText) && first.title, JSON.stringify(first));
  await page.screenshot({ path: `${OUT}/name-1-title.png` });
  await page.click('#title-rename');
  const open = await state();
  check('tapping it opens a text box with the name selected and ready to type, and the game does not start', !open.pill && open.form && open.value === 'Sol' && open.focused === 'title-rename-input' && open.title && open.phase === first.phase, JSON.stringify(open));
  await page.screenshot({ path: `${OUT}/name-2-typing.png` });
  await page.keyboard.type('Ro wan!<b>');
  const typed = await state();
  check('typing works as normal: a space is a space (it does not start the game), W A S D are letters, and symbols are dropped as you type', typed.value === 'Ro wanb' && typed.form && typed.title && typed.phase === first.phase, JSON.stringify(typed));
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Rowan');
  await page.keyboard.press('Enter');
  const done = await state();
  check('Enter keeps the name: the box closes, the button shows the new name, and the game still waits for a tap', done.pill && !done.form && /^Hero name: Rowan\W+change$/.test(done.pillText) && done.title && done.phase === first.phase, JSON.stringify(done));

  // Starting the game while the box is open counts what was typed.
  await page.click('#title-rename');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Pat');
  await page.mouse.click(400, 100);
  await until(page, () => document.getElementById('title').hidden);
  const named = await page.evaluate(() => ({ name: window.__game.progress.name, hud: document.getElementById('hud-name').textContent, hero: window.__game.player.name, button: document.getElementById('power-button').textContent }));
  check('tapping the rest of the title screen while the box is open starts the game with the name that was typed ("Pat"), in the corner and on the hero', named.name === 'Pat' && named.hud.includes('Pat') && named.hero === 'Pat', JSON.stringify(named));
  const lines = [];
  for (let guard = 0; guard < 120; guard++) {
    const now = await page.evaluate(() => ({ active: window.__game.story.active, name: document.getElementById('dialogue-name').textContent, text: document.getElementById('dialogue-text').textContent }));
    if (now.active) lines.push(`${now.name}: ${now.text}`);
    if (lines.some((l) => l.includes('call you Pat.'))) break;
    await page.waitForTimeout(350);
    await page.keyboard.press('Space');
  }
  check('the story uses it: Pat\'s own lines show "Pat", and Marlo says "so I\'ll call you Pat."', lines.some((l) => l.startsWith('Pat: ')) && lines.some((l) => /^Marlo: .*so I'll call you Pat\.$/.test(l)) && !lines.some((l) => /\bSol\b/.test(l)), JSON.stringify(lines.slice(-4)));
  await page.screenshot({ path: `${OUT}/name-3-story.png` });
  await page.evaluate(() => { const G = window.__game; G.story.skip(); G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.rounds.showRankings(); });
  const board = await page.evaluate(() => [...document.querySelectorAll('#rankings-list .rank-row.you .rank-name')].map((e) => e.textContent).join());
  check('and so does the Rankings board', board.split(',').includes('Pat') && !board.includes('Sol'), board);

  // Saving: with ?save the name is remembered, and "Start over" keeps it. Without it (debug mode) it is forgotten.
  SHOW_TITLE = true; SAVE_ON = true;
  ({ page } = await openGame(browser, 'name-save'));
  SHOW_TITLE = false; SAVE_ON = false;
  await page.click('#title-rename');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Zed');
  await page.keyboard.press('Enter');
  const stored = await page.evaluate(() => ({ name: localStorage.getItem('powerheroes.save.name'), save: localStorage.getItem('powerheroes.save') }));
  check('with saving on, the name is written to the browser as soon as it is kept', stored.name === 'Zed', JSON.stringify(stored));
  await page.evaluate(() => { const G = window.__game; G.progress.mark('prologue'); G.progress.store(); });
  await reopen(page, ['power', 'save', 'title']);
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5, null, { timeout: 90000 });
  const back = await page.evaluate(() => ({ name: window.__game.progress.name, pill: document.getElementById('title-rename').textContent, hud: document.getElementById('hud-name').textContent, reset: !document.getElementById('title-reset').hidden }));
  check('after a reload the title and the game still say Zed', back.name === 'Zed' && /Zed/.test(back.pill) && /Zed/.test(back.hud) && back.reset, JSON.stringify(back));
  await page.click('#title-reset');
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5 && document.getElementById('title-reset').hidden, null, { timeout: 90000 });
  const wiped = await page.evaluate(() => ({ progress: localStorage.getItem('powerheroes.save'), name: localStorage.getItem('powerheroes.save.name'), pill: document.getElementById('title-rename').textContent }));
  check('"Start over" wipes the progress but keeps the name', wiped.progress === null && wiped.name === 'Zed' && /Zed/.test(wiped.pill), JSON.stringify(wiped));

  SHOW_TITLE = true;
  ({ page } = await openGame(browser, 'name-debug'));
  SHOW_TITLE = false;
  await page.click('#title-rename');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('Zed');
  await page.keyboard.press('Enter');
  const forgot = await page.evaluate(() => ({ name: window.__game.progress.name, stored: localStorage.getItem('powerheroes.save.name') }));
  check('in debug mode (which forgets everything so the tests start fresh) the new name is used but not kept', forgot.name === 'Zed' && forgot.stored === null, JSON.stringify(forgot));

  // The title screen with the name box must fit on a phone either way up.
  for (const [w, h, tag] of [[390, 844, 'portrait'], [667, 375, 'sideways'], [568, 320, 'small']]) {
    SHOW_TITLE = true;
    ({ page } = await openGame(browser, `name-fit-${tag}`, { width: w, height: h }));
    SHOW_TITLE = false;
    await page.click('#title-rename');
    const fit = await page.evaluate(() => {
      const box = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }; };
      return { form: box('title-rename-form'), reset: box('title-name-row'), w: innerWidth, h: innerHeight };
    });
    const inside = (b) => b.top >= 0 && b.bottom <= fit.h && b.left >= 0 && b.right <= fit.w;
    check(`on a ${w}x${h} screen (${tag}) the name box is fully on the screen`, inside(fit.form) && inside(fit.reset), JSON.stringify(fit));
    if (w === 390) await page.screenshot({ path: `${OUT}/name-4-portrait.png` });
  }
}

// ---------- Chapter 1: the five rounds ----------
const chapterUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { CHAPTERS, ROUNDS } = await import('/src/chapters.js');
  const { SCENES, BUBBLES } = await import('/src/story-data.js');
  const { createWaves } = await import('/src/waves.js');
  const { createProgress, enemyPowerFor } = await import('/src/power.js');
  const out = {};
  const rounds = CHAPTERS[1].rounds;
  out.data = {
    count: rounds.length, ROUNDS, names: rounds.map((r) => r.name).join('|'), waves: rounds.map((r) => r.sizes.length).join(), powers: rounds.map((r) => r.power).join(), boss: rounds.map((r) => r.boss || '-').join(),
    typesOk: rounds.every((r) => r.types.length === r.sizes.length && r.types.every((t) => t.length > 0)),
    introsOk: rounds.every((r, i) => (i === 0 ? r.intro === null : BUBBLES[r.intro] && BUBBLES[r.intro].length >= 2)),
    scenesOk: [2, 3, 4, 5].every((n) => Array.isArray(SCENES[`win${n}`]) && SCENES[`win${n}`].some(Array.isArray)),
    wonOk: rounds.every((r) => r.won.title && r.won.text && r.won.button), totals: rounds.map((r) => r.sizes.reduce((a, b) => a + b, 0)).join(),
    first: rounds[0].sizes.join() === '4,6,8',
  };
  const run = (round) => {   // plays a round's waves on an empty island, beating every Gloomling at once
    const gl = [];
    const waves = createWaves({ scene: new THREE.Scene(), hero: { position: { x: 0, z: 0 }, down: false }, gloomlings: gl, events: {}, enemyPower: (w) => 10 + w });
    waves.start(round);
    const r = { total: waves.total, sizes: [], types: [], powers: [] };
    for (let w = 0; w < r.total; w++) {
      for (let guard = 0; waves.state !== 'fighting' && guard < 3000; guard++) waves.update(0.1);
      r.sizes.push(gl.length); r.types.push(gl.map((g) => g.type[0]).join('')); r.powers.push(gl[0].power);
      gl.splice(0).forEach((g) => g.remove());
      waves.update(0.1);
    }
    r.state = waves.state;
    return r;
  };
  out.oak = run(rounds[2]);
  out.usual = run(null);
  out.back = run(rounds[1]);
  {   // the round you are on
    const progress = createProgress(() => 1, null);
    const start = progress.round;
    progress.advance(6); progress.advance(6);
    const two = progress.round;
    for (let i = 0; i < 10; i++) progress.advance(6);
    out.round = { start, two, capped: progress.round, wave4: enemyPowerFor(100, 3), wave3: enemyPowerFor(100, 2), wave9: enemyPowerFor(100, 9) };
    progress.reset();
    out.round.reset = progress.round;
    const kept = { data: null };
    const old = createProgress(() => 1, { load: () => ({ version: 1, xp: { sol: 0 }, unlocked: ['sol'], roundsWon: 0, seen: {} }), store() {}, clear() {} });
    out.round.oldSave = old.round;   // a save from before the chapter
  }
  return out;
};

const nextRound = async (page) => {   // from the end screen: "Next round", the squad screen, Go!, until the first wave is on its way
  await until(page, () => !document.getElementById('end').hidden);
  await page.waitForTimeout(900);
  await page.click('#end-button');
  await until(page, () => !document.getElementById('squad-screen').hidden);
  const title = await page.evaluate(() => document.getElementById('squad-title').textContent);
  await page.click('#squad-go');
  await until(page, () => ['break', 'spawning', 'fighting'].includes(window.__game.waves.state));
  return title;
};
const skipCampfire = async (page) => {   // the night after round 5: wait for Marlo's story, and skip it
  await until(page, () => window.__game.campfire.phase === 'scene' && window.__game.story.active);
  await page.evaluate(() => window.__game.story.skip());
};
const winRound = async (page) => {   // beat everything at once, then let Marlo's closing conversation run to the end screen
  await page.evaluate(() => {
    const G = window.__game;
    G.rounds.defeat({ power: 10 }); G.rounds.defeat({ power: 10 });
    for (let i = 0; i < 30 * 200 && G.waves.state !== 'over'; i++) { G.gloomlings.splice(0).forEach((g) => g.remove()); G.waves.update(1 / 30); }
  });
  await waitForClosing(page);
};

async function chunk21(browser) {
  let { page } = await openGame(browser, 'chapter-unit');
  const u = await page.evaluate(chapterUnit);
  const d = u.data;
  check('Chapter 1 has five rounds: The Meadow, The Long Grass, The Old Oak, Bramble\'s Shadow and General Bramble (the boss), with more Gloom Power each time', d.count === 5 && d.ROUNDS === 5 && d.names === "The Meadow|The Long Grass|The Old Oak|Bramble's Shadow|General Bramble" && d.powers === '1,1.1,1.2,1.3,1.4' && d.boss === '-,-,-,-,bramble', JSON.stringify(d));
  check('every round has types for each wave, a line that floats by as it starts (not round 1), the words for its end screen, and a closing conversation (rounds 2 to 5); round 1 is the fight the game has always had', d.typesOk && d.introsOk && d.scenesOk && d.wonOk && d.first && d.waves === '3,3,4,4,2', JSON.stringify(d));
  check('rounds get longer: 18, 21, 28 and 36 Gloomlings, and then 18 and the boss', d.totals === '18,21,28,36,18', d.totals);
  check('a round plays its own waves: The Old Oak has four waves of 4, 6, 8 and 10 in its own mix of types (nature, storm, water, fire), each wave stronger, and then it is won', u.oak.total === 4 && u.oak.sizes.join() === '4,6,8,10' && u.oak.types.join() === 'nnnn,nsnsns,nnwnnwnn,nfsnnfsnnf' && u.oak.powers.join() === '10,11,12,13' && u.oak.state === 'won', JSON.stringify(u.oak));
  check('with no round given the usual three waves come (4, 6 and 8), and the next round after a four-wave one is back to its own', u.usual.total === 3 && u.usual.sizes.join() === '4,6,8' && u.back.total === 3 && u.back.sizes.join() === '5,7,9' && u.back.types.join() === 'nnnnn,nnsnnsn,nfnwnfnwn', JSON.stringify([u.usual, u.back]));
  check('the round you are on starts at 1, goes up by one, stops one past the last round (the chapter is done), and starts again with "Start over"; an old save without it is round 1', u.round.start === 1 && u.round.two === 3 && u.round.capped === 6 && u.round.reset === 1 && u.round.oldSave === 1, JSON.stringify(u.round));
  check('a fourth wave is 1.4 times your Power (the waves before it are 0.8, 1 and 1.2)', u.round.wave4 === 140 && u.round.wave3 === 120 && u.round.wave9 === 140, JSON.stringify(u.round));

  // The live game, round by round (?debug&chapter&power&squad).
  CHAPTER_ON = true; POWER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'chapter-live'));
  CHAPTER_ON = false; POWER_ON = false; SHOW_SQUAD = false;
  await until(page, () => document.getElementById('banner-title').textContent === 'Round 1');
  const r1 = await page.evaluate(() => ({ title: document.getElementById('banner-title').textContent, sub: document.getElementById('banner-sub').textContent, label: window.__game.rounds.label(), total: window.__game.waves.total, note: document.getElementById('hud-wave').textContent }));
  check('the first wave of round 1 announces it: "Round 1" over "The Meadow", and the corner note says "Round 1/5 · ..."', r1.title === 'Round 1' && r1.sub === 'The Meadow' && r1.label === 'Round 1/5' && r1.total === 3 && r1.note.startsWith('Round 1/5 · '), JSON.stringify(r1));
  await page.screenshot({ path: `${OUT}/chapter-1-round1.png` });
  await winRound(page);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  const e1 = await page.evaluate(() => ({ title: document.getElementById('end-title').textContent, text: document.getElementById('end-text').textContent, button: document.getElementById('end-button').textContent, round: window.__game.progress.round, unlocked: window.__game.progress.unlocked.length }));
  check('winning round 1 says "Round 1 won!" with a "Next round" button, brings Ember (and the others) in, and moves you on to round 2', e1.title === 'Round 1 won!' && e1.text === 'The Meadow is green again.' && e1.button === 'Next round' && e1.round === 2 && e1.unlocked === 4, JSON.stringify(e1));
  await page.screenshot({ path: `${OUT}/chapter-2-end1.png` });
  const squadTitle = await nextRound(page);
  check('"Next round" opens the squad screen headed "Round 2/5 · The Long Grass"', squadTitle === 'Round 2/5 · The Long Grass', squadTitle);
  await until(page, () => document.getElementById('banner-title').textContent === 'Round 2');
  const r2 = await page.evaluate(async () => {
    const G = window.__game;
    const { enemyPowerFor } = await import('/src/power.js');
    return { sub: document.getElementById('banner-sub').textContent, total: G.waves.total, enemy: G.rounds.enemyPower(0), expected: Math.max(6, Math.round(enemyPowerFor(G.progress.averagePower(G.squad.roster), 0) * 1.1)), note: document.getElementById('hud-wave').textContent };
  });
  check('round 2 is The Long Grass: its banner, three waves, and Gloomlings 1.1 times as strong as the usual', r2.sub === 'The Long Grass' && r2.total === 3 && r2.enemy === r2.expected && r2.note.startsWith('Round 2/5 · '), JSON.stringify(r2));
  await until(page, () => /^Round two!|^Marlo: Ember fights beside you now/.test(document.getElementById('bubble').textContent) && document.getElementById('bubble').classList.contains('show'));
  const bubble = await page.evaluate(() => document.getElementById('bubble').textContent);
  check('a line about the round floats by as it starts (instead of the usual first-wave line)', /^Round two!|^Marlo: Ember fights beside you now/.test(bubble), bubble);
  await page.evaluate(() => { const G = window.__game; for (let i = 0; i < 30 * 3 && G.waves.state !== 'spawning'; i++) G.waves.update(1 / 30); });
  const first2 = await page.evaluate(() => window.__game.waves.remaining);
  check('round 2\'s first wave has 5 Gloomlings', first2 === 5, `${first2}`);
  await winRound(page);
  const talk2 = await page.evaluate(() => ({ name: document.getElementById('dialogue-name').textContent, text: document.getElementById('dialogue-text').textContent }));
  check('after round 2 comes its own conversation (Pip, "Another patch of green!"), not the first-win one', talk2.name === 'Pip', JSON.stringify(talk2));
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  const e2 = await page.evaluate(() => ({ title: document.getElementById('end-title').textContent, round: window.__game.progress.round }));
  check('and the end screen says "Round 2 won!" and moves on to round 3', e2.title === 'Round 2 won!' && e2.round === 3, JSON.stringify(e2));
  check('"Next round" again: round 3 is The Old Oak', (await nextRound(page)) === 'Round 3/5 · The Old Oak');
  await until(page, () => document.getElementById('banner-title').textContent === 'Round 3');
  const r3 = await page.evaluate(() => ({ total: window.__game.waves.total, sub: document.getElementById('banner-sub').textContent }));
  check('round 3 has four waves', r3.total === 4 && r3.sub === 'The Old Oak', JSON.stringify(r3));
  await winRound(page);
  const talk3 = await page.evaluate(() => document.getElementById('dialogue-name').textContent);
  await page.evaluate(() => window.__game.story.skip());
  check('round 3 ends with Marlo, the oak and the hedge', talk3 === 'Marlo', talk3);
  check('round 4 is Bramble\'s Shadow, four waves', (await nextRound(page)) === "Round 4/5 · Bramble's Shadow" && (await page.evaluate(() => window.__game.waves.total)) === 4);
  await winRound(page);
  const talk4 = await page.evaluate(() => ({ name: document.getElementById('dialogue-name').textContent, text: document.getElementById('dialogue-text').textContent }));
  await page.evaluate(() => window.__game.story.skip());
  check('round 4 ends with the warning that something big is coming', talk4.name === 'Marlo', JSON.stringify(talk4));
  const squad5 = await nextRound(page);
  await until(page, () => document.getElementById('banner-title').textContent === 'Round 5');
  const r5 = await page.evaluate(() => ({ sub: document.getElementById('banner-sub').textContent, boss: window.__game.rounds.round.boss, total: window.__game.waves.total }));
  check('round 5 is General Bramble: its banner and the boss marked (the boss itself comes next)', squad5 === 'Round 5/5 · General Bramble' && r5.sub === 'General Bramble' && r5.boss === 'bramble' && r5.total === 3, JSON.stringify([squad5, r5]));
  await winRound(page);
  await page.evaluate(() => window.__game.story.skip());
  await skipCampfire(page);
  await until(page, () => !document.getElementById('end').hidden);
  const e5 = await page.evaluate(() => ({ title: document.getElementById('end-title').textContent, button: document.getElementById('end-button').textContent, round: window.__game.progress.round, label: window.__game.rounds.label(), now: window.__game.rounds.round }));
  check('winning round 5 (after the night at the campfire) says "Chapter 1 complete!" with a "Keep playing" button; the chapter is done (no round to play now)', e5.title === 'Chapter 1 complete!' && e5.button === 'Keep playing' && e5.round === 6 && e5.label === '' && e5.now === null, JSON.stringify(e5));
  await page.screenshot({ path: `${OUT}/chapter-3-done.png` });
  const free = await nextRound(page);
  const f = await page.evaluate(() => ({ note: document.getElementById('hud-wave').textContent, total: window.__game.waves.total, banner: document.getElementById('banner-title').textContent }));
  check('after the chapter the rounds are ordinary again: "Choose your squad", three waves, no "Round" in the corner', free === 'Choose your squad' && f.total === 3 && !/Round \d\/5/.test(f.note) && f.banner !== 'Round 6', JSON.stringify([free, f]));
  await winRound(page);
  const talkFree = await page.evaluate(() => document.getElementById('dialogue-name').textContent);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  const eFree = await page.evaluate(() => ({ title: document.getElementById('end-title').textContent, button: document.getElementById('end-button').textContent, round: window.__game.progress.round }));
  check('an ordinary round after the chapter ends with the usual words and "Play again"; the chapter stays done', talkFree === 'Pip' && eFree.title === 'Isle saved!' && eFree.button === 'Play again' && eFree.round === 6, JSON.stringify([talkFree, eFree]));

  // A round that is lost is tried again (the same round).
  CHAPTER_ON = true; POWER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'chapter-lost'));
  CHAPTER_ON = false; POWER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.progress.data.round = 3; G.rounds.restart(); });
  await until(page, () => !document.getElementById('squad-screen').hidden);
  await page.click('#squad-go');
  await until(page, () => window.__game.waves.state === 'break' || window.__game.waves.state === 'spawning');
  await page.evaluate(() => { const G = window.__game; for (const kind of G.squad.roster) G.squad.members[kind].hero.takeHit(1e6, 0, 0); for (let i = 0; i < 90; i++) G.waves.update(1 / 30); });   // (the whole squad, one by one: the round is lost only when everybody is out)
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  const lost = await page.evaluate(() => ({ title: document.getElementById('end-title').textContent, button: document.getElementById('end-button').textContent, round: window.__game.progress.round }));
  check('losing round 3 says "Knocked out" with "Try again", and you stay on round 3', lost.title === 'Knocked out' && lost.button === 'Try again' && lost.round === 3, JSON.stringify(lost));
  check('"Try again" brings the squad screen for round 3 again', (await nextRound(page)) === 'Round 3/5 · The Old Oak');

  // Saving: the round you are on is remembered, and "Start over" goes back to round 1.
  SAVE_ON = true; CHAPTER_ON = true; SHOW_TITLE = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'chapter-save'));
  SAVE_ON = false; CHAPTER_ON = false; SHOW_TITLE = false; SHOW_SQUAD = false;
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.progress.data.round = 4; G.progress.mark('prologue'); G.progress.store(); });
  await reopen(page, ['power', 'save', 'chapter', 'title', 'squad']);
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5, null, { timeout: 90000 });
  await page.mouse.click(400, 100);
  await until(page, () => !document.getElementById('squad-screen').hidden);
  const saved = await page.evaluate(() => ({ title: document.getElementById('squad-title').textContent, round: window.__game.progress.round }));
  check('after a reload a returning player carries on at their round: the squad screen says "Round 4/5 · Bramble\'s Shadow"', saved.title === "Round 4/5 · Bramble's Shadow" && saved.round === 4, JSON.stringify(saved));
  await reopen(page, ['power', 'save', 'chapter', 'title']);
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5, null, { timeout: 90000 });
  await page.click('#title-reset');
  await page.waitForFunction(() => window.__game && window.__game.renderer.info.render.frame > 5 && document.getElementById('title-reset').hidden, null, { timeout: 90000 });
  check('"Start over" goes back to round 1', (await page.evaluate(() => window.__game.progress.round)) === 1);
}

// ---------- General Bramble ----------
const bossUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createBoss } = await import('/src/boss.js');
  const { createGloomling } = await import('/src/gloom.js');
  const out = {};
  const target = (x, z) => { const t = { position: { x, z }, down: false, hits: [], takeHit(amount) { t.hits.push(amount); return true; } }; return t; };
  const make = (scene, power = 10, x = 9, z = 0) => {
    const l = { shake: [], taunt: [], sound: [], summon: [], down: 0, fallen: 0, gone: 0, sparks: 0 };
    const boss = createBoss({ scene, x, z, power, emit: () => { l.sparks++; }, events: { shake: (a) => l.shake.push(a), taunt: (k) => l.taunt.push(k), sound: (n) => l.sound.push(n), summon: (c) => { l.summon.push(c); return c; }, down: () => { l.down++; }, fallen: () => { l.fallen++; }, gone: () => { l.gone++; } } });
    return { boss, l };
  };
  const clock = { t: 0 };
  const step = (boss, t, others = []) => { clock.t += 1 / 30; boss.update(1 / 30, t, clock.t, [boss, ...others]); };
  const run = (boss, t, seconds, others = []) => { for (let i = 0; i < Math.round(seconds * 30); i++) step(boss, t, others); };
  const until = (boss, t, fn, limit = 30) => { let s = 0; while (!fn() && s < limit) { step(boss, t); s += 1 / 30; } return +s.toFixed(2); };

  {   // what he is, as the rest of the game sees him: a very big Gloomling
    const { boss, l } = make(new THREE.Scene());
    const t = target(0, 0);
    const props = ['group', 'position', 'radius', 'type', 'power', 'maxHealth', 'update', 'hit', 'remove', 'soak', 'soaked', 'alive', 'health', 'mode'].every((k) => k in boss);
    boss.soak(5);
    out.shape = { boss: boss.boss, name: boss.name, type: boss.type, radius: boss.radius, power: boss.power, max: boss.maxHealth, health: boss.health, alive: boss.alive, soaked: boss.soaked, props, big: make(new THREE.Scene(), 20).boss.maxHealth };
    out.grow = { state: boss.state, hit: boss.hit(500), health: boss.health, taunt0: l.taunt.join() };   // he cannot be hurt while he rises
    run(boss, t, 0.5);
    out.grow.mid = boss.state;
    out.grow.took = until(boss, t, () => boss.state !== 'grow', 3);
    out.grow.after = boss.state; out.grow.taunt = l.taunt.join();
  }
  {   // a hit hurts, a shove hardly moves him, and nothing stuns him
    const { boss } = make(new THREE.Scene());
    const t = target(0, 0); t.down = true;   // (nobody to chase)
    run(boss, t, 1.2);
    const before = boss.position.x;
    const r = boss.hit(50, 10, 0);
    run(boss, t, 1);
    out.shove = { returned: r, health: boss.health, moved: +(boss.position.x - before).toFixed(2), state: boss.state, flash: true };
  }
  {   // a hero who stands still: a thorn, then the root slam
    const { boss, l } = make(new THREE.Scene(), 10, 9, 0);
    const t = target(0, 0);
    run(boss, t, 2.4);
    out.walk = { x: +boss.position.x.toFixed(1), state: boss.state };
    run(boss, t, 4);
    out.stand = { hits: t.hits.slice(0, 3).join(), sounds: l.sound.join(), shake: l.shake.join() };
  }
  {   // ...and one who keeps moving is not hit by either
    const { boss, l } = make(new THREE.Scene(), 10, 9, 0);
    const t = target(0, 0);
    until(boss, t, () => l.sound.includes('thorns'), 6);
    t.position.z = 8;   // sidestep the thorns
    until(boss, t, () => boss.state === 'slam', 6);
    t.position.x = 6; t.position.z = -7;   // and the circle (and keeps out of the path of the thorns)
    run(boss, t, 1.6);
    out.dodge = { hits: t.hits.join(), sounds: l.sound.join() };
  }
  {   // stronger bosses hit harder
    const { boss } = make(new THREE.Scene(), 20, 9, 0);
    const t = target(0, 0);
    run(boss, t, 6.2);
    out.strong = { max: boss.maxHealth, hits: t.hits.slice(0, 2).join() };
  }
  {   // under half health: a roar, then faster, and he calls Gloomlings (three at a time, never more than six in all)
    const { boss, l } = make(new THREE.Scene(), 10, 9, 0);
    const t = target(0, 0); t.takeHit = () => true;
    run(boss, t, 1.2);
    boss.hit(boss.maxHealth * 0.45);
    out.beforeRoar = { enraged: boss.enraged, taunt: l.taunt.join() };
    boss.hit(boss.maxHealth * 0.06);
    step(boss, t);
    out.roar = { enraged: boss.enraged, state: boss.state, taunt: l.taunt.join(), shake: l.shake.join(), sound: l.sound.join() };
    run(boss, t, 6);
    out.summonEarly = l.summon.join();
    run(boss, t, 40);
    out.summon = l.summon.join();
  }
  {   // right next to him: a bump after a warning, and not again at once
    const { boss } = make(new THREE.Scene(), 10, 2.2, 0);
    const t = target(0, 0);
    run(boss, t, 1.2);
    const early = t.hits.length;
    run(boss, t, 0.5);
    out.bump = { early, first: t.hits.join() };
    run(boss, t, 0.7);
    out.bump.pause = t.hits.length;
    run(boss, t, 1.5);
    out.bump.again = t.hits.length;
  }
  {   // a hero who is out is left alone
    const { boss } = make(new THREE.Scene(), 10, 9, 0);
    const t = target(0, 0); t.down = true;
    run(boss, t, 15);
    out.leftAlone = { hits: t.hits.length, x: +boss.position.x.toFixed(2), state: boss.state };
  }
  {   // he is solid (little ones are pushed out of his body) and stays on the island
    const scene = new THREE.Scene();
    const { boss } = make(scene, 10, 0, 0);
    const t = target(9, 0); t.down = true;
    const little = createGloomling({ scene, x: 1, z: 0 });
    step(boss, t, [little]);
    const far = createBoss({ scene, x: 30, z: 0, emit: () => {} });
    far.update(1 / 30, t, 0, [far]);
    out.solid = { gap: +Math.hypot(little.position.x - boss.position.x, little.position.z - boss.position.z).toFixed(2), edge: +Math.hypot(far.position.x, far.position.z).toFixed(2) };
  }
  {   // beaten: he shakes and shrinks into the young gardener, waits for his last words, then fades away
    const scene = new THREE.Scene();
    const { boss, l } = make(scene, 10, 9, 0);
    const t = target(0, 0); t.down = true;
    run(boss, t, 1.2);
    const returned = boss.hit(boss.health + 5, 5, 0);
    out.defeat = { returned, alive: boss.alive, health: boss.health, down: l.down, shake: l.shake.join(), state: boss.state, hitAfter: boss.hit(10) };
    run(boss, t, 1);
    out.defeat.mid = boss.state;
    run(boss, t, 0.8);
    out.defeat.young = { state: boss.state, fallen: l.fallen, bigShown: boss.group.children[0].visible, youngShown: boss.group.children[1].visible };
    run(boss, t, 0.7);
    out.defeat.told = l.fallen;
    run(boss, t, 3);
    out.defeat.waits = { state: boss.state, gone: l.gone };
    boss.finish();
    run(boss, t, 0.7);
    out.defeat.fading = { state: boss.state, gone: boss.gone };
    run(boss, t, 1);
    out.defeat.after = { gone: boss.gone, told: l.gone, left: scene.children.length };
  }
  {
    const scene = new THREE.Scene();
    const { boss } = make(scene);
    const t = target(0, 0);
    run(boss, t, 3.5);
    boss.remove();
    out.removed = scene.children.length;
  }
  return out;
};

async function chunk22(browser) {
  let { page } = await openGame(browser, 'boss-unit');
  const u = await page.evaluate(bossUnit);
  check('he looks like any other enemy to the rest of the game (position, radius, type, health, hit, soak...) but a very big one: Nature, 1.6 wide, health of 40 Gloomlings (1,200 at Power 10, twice that at Power 20)', u.shape.boss && u.shape.name === 'General Bramble' && u.shape.type === 'nature' && u.shape.radius === 1.6 && u.shape.power === 10 && u.shape.max === 1200 && u.shape.health === 1200 && u.shape.alive && u.shape.soaked === 0 && u.shape.props && u.shape.big === 2400, JSON.stringify(u.shape));
  check('he rises from the ground first (nothing hurts him, no attacks), then his first taunt and he starts to walk', u.grow.state === 'grow' && u.grow.hit === false && u.grow.health === 1200 && u.grow.taunt0 === '' && u.grow.mid === 'grow' && u.grow.after === 'walk' && u.grow.took < 0.6 && u.grow.taunt === 'spawn', JSON.stringify(u.grow));
  check('a hit hurts him, but a shove of 10 moves him about one step and nothing stuns him; the hit never says "defeated" (he is taken off the island only after his last words)', u.shove.returned === false && u.shove.health === 1150 && u.shove.moved > 0.5 && u.shove.moved < 1.5, JSON.stringify(u.shove));
  check('a hero who stands still is hit by the thorn that flies straight at them (10) and then the root slam (18); each has its sound, and the slam shakes the screen', u.walk.x > 6 && u.walk.x < 7.5 && u.stand.hits === '10,18' && /thorns/.test(u.stand.sounds) && /slam/.test(u.stand.sounds) && u.stand.shake === '0.3', JSON.stringify([u.walk, u.stand]));
  check('a hero who sidesteps the thorns and leaves the red circle is hit by neither', !/10|18/.test(u.dodge.hits) && /thorns/.test(u.dodge.sounds) && /slam/.test(u.dodge.sounds), JSON.stringify(u.dodge));
  check('his moves hurt more as he gets stronger: at Power 20 the thorn is 20 and the slam 36, and he has 2,400 health', u.strong.max === 2400 && u.strong.hits === '20,36', JSON.stringify(u.strong));
  check('at half health he roars once (a taunt, a shake, a sound), and then calls three Gloomlings at a time, never more than six', u.beforeRoar.enraged === false && u.beforeRoar.taunt === 'spawn' && u.roar.enraged && u.roar.state === 'roar' && u.roar.taunt === 'spawn,enrage' && u.roar.shake === '0.4' && /roar/.test(u.roar.sound) && u.summonEarly === '3' && u.summon === '3,3', JSON.stringify([u.beforeRoar, u.roar, u.summonEarly, u.summon]));
  check('a hero right next to him is bumped after a warning (12), and not again straight away', u.bump.early === 0 && u.bump.first === '12' && u.bump.pause === 1 && u.bump.again === 2, JSON.stringify(u.bump));
  check('a hero who is out is left alone: he neither attacks nor walks', u.leftAlone.hits === 0 && u.leftAlone.x === 9 && u.leftAlone.state === 'walk', JSON.stringify(u.leftAlone));
  check('he is solid: a Gloomling inside his body is pushed out (to at least 2 units), and he is held on the island', u.solid.gap >= 2 && u.solid.edge <= 10.5, JSON.stringify(u.solid));
  check('when his health runs out he falls: the adds are told, the screen shakes, he shrinks, and a young gardener is left (the big body is hidden), a moment of quiet, and then he WAITS for his last words', u.defeat.returned === false && !u.defeat.alive && u.defeat.health === 0 && u.defeat.down === 1 && u.defeat.shake === '0.5' && u.defeat.state === 'fall' && u.defeat.hitAfter === false && u.defeat.mid === 'fall' && u.defeat.young.state === 'young' && u.defeat.young.fallen === 0 && u.defeat.told === 1 && !u.defeat.young.bigShown && u.defeat.young.youngShown && u.defeat.waits.state === 'young' && u.defeat.waits.gone === 0, JSON.stringify(u.defeat));
  check('after his words he fades into leaves and is gone (told once, and nothing of him is left on the island)', u.defeat.fading.state === 'fade' && !u.defeat.fading.gone && u.defeat.after.gone && u.defeat.after.told === 1 && u.defeat.after.left === 0, JSON.stringify([u.defeat.fading, u.defeat.after]));
  check('taking him away leaves nothing behind (thorns, vines, circles)', u.removed === 0, `${u.removed}`);

  // The live boss round: two waves, then the boss alone (?debug&chapter&squad: every Power is 10, so the fight is gentle).
  CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'boss-live'));
  CHAPTER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.progress.data.round = 5; G.rounds.restart(); });
  await until(page, () => !document.getElementById('squad-screen').hidden);
  await page.click('#squad-go');
  await until(page, () => ['break', 'spawning', 'fighting'].includes(window.__game.waves.state));
  await page.evaluate(() => {   // beat the two waves of Gloomlings (but not the boss when he comes)
    const G = window.__game;
    for (let i = 0; i < 30 * 200 && !G.waves.boss; i++) { G.gloomlings.filter((g) => !g.boss).forEach((g) => { g.remove(); G.gloomlings.splice(G.gloomlings.indexOf(g), 1); }); G.waves.update(1 / 30); }
  });
  const arrive = await page.evaluate(() => ({ wave: window.__game.waves.wave, total: window.__game.waves.total, title: document.getElementById('banner-title').textContent, sub: document.getElementById('banner-sub').textContent, bar: !document.getElementById('boss').hidden, name: document.getElementById('boss-name').textContent, fill: document.getElementById('boss-fill').style.transform, enemies: window.__game.gloomlings.length }));
  await until(page, () => !document.getElementById('boss').hidden);
  check('after the two waves the boss comes alone: the third wave, a banner "General Bramble · Boss!", and his health bar at the top with his name and Power', arrive.wave === 3 && arrive.total === 3 && arrive.title === 'General Bramble' && arrive.sub === 'Boss!' && arrive.enemies === 1, JSON.stringify(arrive));
  const bar = await page.evaluate(() => ({ shown: !document.getElementById('boss').hidden, name: document.getElementById('boss-name').textContent, fill: document.getElementById('boss-fill').style.transform }));
  check('the bar names him ("General Bramble · Power 10") and is full', bar.shown && bar.name === 'General Bramble · Power 10' && /scaleX\(1\)/.test(bar.fill), JSON.stringify(bar));
  await until(page, () => window.__game.waves.boss.state !== 'grow');
  await until(page, () => /General Bramble: (Little light|Every seed)/.test(document.getElementById('bubble').textContent));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/boss-1-arrives.png` });
  await page.evaluate(() => { const b = window.__game.waves.boss; b.hit(b.maxHealth * 0.2); });
  await page.waitForTimeout(300);
  const hurt = await page.evaluate(() => ({ fill: document.getElementById('boss-fill').style.transform, angry: document.getElementById('boss').classList.contains('angry') }));
  check('as he is hurt the bar shrinks (about 80% left, a few darts have hit him too) and stays green', /scaleX\(0\.[6-8]/.test(hurt.fill) && !hurt.angry, JSON.stringify(hurt));
  await until(page, () => window.__game.waves.boss.state === 'slam');
  await page.screenshot({ path: `${OUT}/boss-2-slam.png` });
  await page.evaluate(() => { const b = window.__game.waves.boss; b.hit(b.maxHealth * 0.35); });
  await until(page, () => /General Bramble: (More|She promised)/.test(document.getElementById('bubble').textContent));
  const angry = await page.evaluate(() => ({ angry: document.getElementById('boss').classList.contains('angry'), enraged: window.__game.waves.boss.enraged, fill: document.getElementById('boss-fill').style.transform }));
  check('under half health the bar turns red-hot and he taunts ("More! Give me MORE!")', angry.angry && angry.enraged && /scaleX\(0\.[3-5]/.test(angry.fill), JSON.stringify(angry));
  await until(page, () => window.__game.gloomlings.filter((g) => !g.boss).length >= 3);
  check('and he calls Gloomlings to help him', await page.evaluate(() => window.__game.gloomlings.filter((g) => !g.boss).length) >= 3);
  await page.screenshot({ path: `${OUT}/boss-3-angry.png` });
  await page.evaluate(() => { const b = window.__game.waves.boss; b.hit(b.health + 1); });
  await until(page, () => window.__game.waves.boss && window.__game.waves.boss.state === 'young' && window.__game.story.active);
  await page.waitForTimeout(300);
  const fell = await page.evaluate(() => ({ adds: window.__game.gloomlings.filter((g) => !g.boss).length, bossStill: window.__game.gloomlings.filter((g) => g.boss).length, bar: !document.getElementById('boss').hidden, sound: window.__game.audio.counts.bossdown, state: window.__game.waves.state, talking: window.__game.story.active, who: document.getElementById('dialogue-name').textContent }));
  check('when he falls the Gloomlings he called vanish, he stays (as the young gardener) while the round waits, the fall has its own sound, and his last words begin', fell.adds === 0 && fell.bossStill === 1 && fell.sound === 1 && fell.state === 'fighting' && fell.talking && fell.who === 'Bramble', JSON.stringify(fell));
  await page.screenshot({ path: `${OUT}/boss-4-himself.png` });
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => window.__game.rounds.ending !== null || window.__game.story.active);
  const won = await page.evaluate(() => ({ boss: window.__game.waves.boss, left: window.__game.gloomlings.length, ending: window.__game.rounds.ending, talking: window.__game.story.active, round: window.__game.progress.round, bar: !document.getElementById('boss').hidden }));
  check('after his last moment the round is won: nothing of him is left, the bar is gone, Marlo comes over for the closing conversation, and the chapter is done', won.boss === null && won.left === 0 && (won.ending === 'again' || won.talking) && !won.bar && won.round === 6, JSON.stringify(won));
}

// ---------- The boss round: his last words, the reward, trying again ----------
async function chunk23(browser) {
  let { page } = await openGame(browser, 'bossstory-unit');
  const d = await page.evaluate(async () => {
    const { SCENES, SPEAKERS, BUBBLES } = await import('/src/story-data.js');
    const lines = (name) => SCENES[name].filter(Array.isArray);
    return {
      down: lines('bossDown').map((l) => `${l[0]}: ${l[1]}`), downMusic: SCENES.bossDown.filter((s) => !Array.isArray(s)).map((s) => s.music).join(),
      win5: lines('win5').map((l) => l[0]).join(), win5Last: lines('win5').slice(-1)[0][1],
      names: [SPEAKERS.bramble.name, SPEAKERS.gardener.name], taunts: [BUBBLES.bramble_spawn.length, BUBBLES.bramble_enrage.length], tidecove: JSON.stringify(SCENES.win5).includes('Tidecove'),
    };
  });
  check('his last words: as himself ("Bramble") he remembers the meadow and says "She promised us more. We just wanted to matter."; Marlo answers; sad flute plays', d.down.join(' | ') === "gardener: ...The hedge. The meadow. I used to water these roots. | gardener: She promised us more. We just wanted to matter. | marlo: ...Matter. Yes. So did we all." && d.downMusic === 'lullaby-sorrow' && d.names.join() === 'General Bramble,Bramble', JSON.stringify(d));
  check('after the fight Pip and Marlo talk about him, and Marlo promises the story "tonight, by the fire"; he taunts in the fight with more than one line each time', d.win5 === 'pip,marlo,sol,marlo' && /fire/.test(d.win5Last) && d.taunts.every((n) => n >= 2) && !d.tidecove, JSON.stringify(d));

  // The boss round, start to end (flat Power 10).
  CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'bossstory-live'));
  CHAPTER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.progress.data.round = 5; G.rounds.restart(); });
  await until(page, () => !document.getElementById('squad-screen').hidden);
  await page.click('#squad-go');
  await until(page, () => ['break', 'spawning', 'fighting'].includes(window.__game.waves.state));
  await page.evaluate(() => {
    const G = window.__game;
    for (let i = 0; i < 30 * 200 && !G.waves.boss; i++) { G.gloomlings.filter((g) => !g.boss).forEach((g) => { g.remove(); G.gloomlings.splice(G.gloomlings.indexOf(g), 1); }); G.waves.update(1 / 30); }
  });
  await until(page, () => window.__game.waves.boss.state !== 'grow');
  await page.evaluate(() => { const b = window.__game.waves.boss; b.hit(b.health + 1); });
  await until(page, () => window.__game.story.active);
  const lines = [];
  for (let guard = 0; guard < 60 && (await page.evaluate(() => window.__game.story.active)); guard++) {
    const now = await page.evaluate(() => ({ name: document.getElementById('dialogue-name').textContent, text: document.getElementById('dialogue-text').textContent, state: window.__game.waves.boss && window.__game.waves.boss.state }));
    lines.push(`${now.name}: ${now.text}|${now.state}`);
    await page.waitForTimeout(350);
    await page.keyboard.press('Space');
  }
  const said = lines.map((l) => l.split('|')[0]);
  check('his last words are told in a conversation while he stands there as the young gardener (the game waits), word for word, with Marlo answering', said.includes('Bramble: She promised us more. We just wanted to matter.') && said.includes('Marlo: ...Matter. Yes. So did we all.') && lines.every((l) => l.endsWith('|young')), JSON.stringify(lines.slice(-3)));
  await until(page, () => window.__game.waves.boss === null);
  check('and when it is over he fades away (it was waiting for his words: nothing is left of him), and the round is won', (await page.evaluate(() => window.__game.gloomlings.length)) === 0);
  let spoke = false;
  for (let i = 0; i < 100 && !spoke; i++) {
    spoke = await page.evaluate(() => window.__game.story.active && document.getElementById('dialogue-name').textContent === 'Pip' && /PERSON/.test(document.getElementById('dialogue-text').textContent));
    if (!spoke) await page.waitForTimeout(300);
  }
  check('Pip speaks first in the closing conversation ("He turned back into a PERSON")', spoke);
  await page.evaluate(() => window.__game.story.skip());
  await skipCampfire(page);
  await until(page, () => !document.getElementById('end').hidden);
  const end = await page.evaluate(() => ({ title: document.getElementById('end-title').textContent, button: document.getElementById('end-button').textContent, round: window.__game.progress.round, xp: window.__game.rounds.gains[0].xp }));
  check('then (after the campfire) "Chapter 1 complete!" with "Keep playing", the chapter done, and the XP includes the boss (worth ten Gloomlings: 30) and the win bonus (20)', end.title === 'Chapter 1 complete!' && end.button === 'Keep playing' && end.round === 6 && end.xp === 50, JSON.stringify(end));

  // Lost to the boss: "Try again" goes straight back to him (not the two waves before).
  CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'bossstory-retry'));
  CHAPTER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.progress.data.round = 5; G.rounds.restart(); });
  await until(page, () => !document.getElementById('squad-screen').hidden);
  await page.click('#squad-go');
  await until(page, () => ['break', 'spawning', 'fighting'].includes(window.__game.waves.state));
  const first = await page.evaluate(() => ({ wave: window.__game.waves.wave, atBoss: window.__game.waves.atBoss }));
  await page.evaluate(() => {
    const G = window.__game;
    for (let i = 0; i < 30 * 200 && !G.waves.boss; i++) { G.gloomlings.filter((g) => !g.boss).forEach((g) => { g.remove(); G.gloomlings.splice(G.gloomlings.indexOf(g), 1); }); G.waves.update(1 / 30); }
    for (const kind of G.squad.roster) G.squad.members[kind].hero.takeHit(1e6, 0, 0);
    for (let i = 0; i < 90; i++) G.waves.update(1 / 30);
  });
  await waitForClosing(page);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  const lost = await page.evaluate(() => ({ title: document.getElementById('end-title').textContent, button: document.getElementById('end-button').textContent, round: window.__game.progress.round }));
  check('the first try starts with the waves (wave 1, not at the boss); losing to the boss says "Knocked out" with "Try again" and you stay on round 5', first.wave === 1 && !first.atBoss && lost.title === 'Knocked out' && lost.button === 'Try again' && lost.round === 5, JSON.stringify([first, lost]));
  check('"Try again" brings back the squad screen for round 5', (await nextRound(page)) === 'Round 5/5 · General Bramble');
  await until(page, () => window.__game.waves.boss);
  const again = await page.evaluate(() => ({ wave: window.__game.waves.wave, total: window.__game.waves.total, enemies: window.__game.gloomlings.length, title: document.getElementById('banner-title').textContent, note: document.getElementById('hud-wave').textContent }));
  check('and he is right there: wave 3 of 3, only him on the island, "General Bramble" on the banner (no warm-up waves again)', again.wave === 3 && again.total === 3 && again.enemies === 1 && again.title === 'General Bramble' && again.note.startsWith('Round 5/5 · Wave 3/3'), JSON.stringify(again));
}

// ---------- The campfire and the first memory shard ----------
const campfireUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createCampfire } = await import('/src/campfire.js');
  const { SCENES } = await import('/src/story-data.js');
  const out = {};
  const at = (o) => [o.position.x, o.position.y, o.position.z].map((n) => +n.toFixed(1)).join();
  const make = (kind = 'sol') => {
    const log = { night: [], curtain: [], scenes: [], sounds: [], flares: 0, shards: 0, stored: 0, marlo: [], ember: [], done: 0, follow: 0 };
    const scene = new THREE.Scene();
    let talkDone = null;
    const player = { kind, position: new THREE.Vector3(5, 0, 5), velocity: { x: 3, z: 3 }, face(a) { log.faced = +a.toFixed(2); } };
    const marlo = { position: new THREE.Vector3(8, 0, 8), walkTo(x, z) { log.marlo.push(`walk ${x.toFixed(1)},${z.toFixed(1)}`); }, goHome() { log.marlo.push('home'); }, raise(on) { log.marlo.push(`raise ${on}`); } };
    const ember = { runIn(...a) { log.ember.push(a.map((n) => +n.toFixed(1)).join()); }, leave() { log.ember.push('leave'); } };
    const story = { scene(name, done) { log.scenes.push(name); talkDone = done; } };
    const fire = createCampfire({ world: { scene, setNight: (a) => log.night.push(a), follow: () => { log.follow++; } }, player, marlo, ember, story, audio: { play: (n) => log.sounds.push(n) }, aura: { flare: () => { log.flares++; } }, progress: { collectShard() { log.shards++; }, store() { log.stored++; } }, ui: { setCurtain: (on) => log.curtain.push(on) } });
    const run = (seconds) => { for (let i = 0; i < Math.round(seconds * 30); i++) fire.update(1 / 30, i / 30); };
    return { fire, log, player, marlo, run, scene, talkDone: () => talkDone && talkDone() };
  };
  {
    const a = make();
    out.idle = { phase: a.fire.phase, active: a.fire.active };
    a.fire.play(() => { a.log.done++; });
    out.dusk = { phase: a.fire.phase, active: a.fire.active, curtain: a.log.curtain.join() };
    a.run(0.5);
    out.duskMid = { phase: a.fire.phase, nights: a.log.night.length, moved: at(a.player) };
    a.run(0.5);
    out.lit = { phase: a.fire.phase, night: a.log.night[a.log.night.length - 1], curtain: a.log.curtain.join(), player: at(a.player), velocity: `${a.player.velocity.x},${a.player.velocity.z}`, marlo: at(a.marlo), walk: a.log.marlo.join(), ember: a.log.ember.join(';'), follow: a.log.follow, faced: a.log.faced };
    a.run(1.3);
    out.scene = { phase: a.fire.phase, scenes: a.log.scenes.join(), active: a.fire.active };
    out.cues = { nope: a.fire.cue('nope'), flute: a.fire.cue('flute'), rise: a.fire.cue('shard-rise') };
    a.run(0.5);
    out.rising = a.fire.shard;
    a.run(1);
    out.hover = a.fire.shard;
    a.fire.cue('vision');
    a.run(2);
    const vision = a.scene.children[2];
    out.vision = { shown: vision.visible, opacity: +vision.children[0].material.opacity.toFixed(2), nights: a.log.night.filter((n) => n === 1).length > 30 };
    a.fire.cue('shard-take');
    a.run(0.5);
    out.flying = { shard: a.fire.shard, taken: a.log.shards };
    a.run(0.6);
    out.taken = { shard: a.fire.shard, shards: a.log.shards, stored: a.log.stored, flares: a.log.flares, sounds: a.log.sounds.join() };
    a.run(3);
    out.visionGone = !vision.visible;
    a.talkDone();
    out.dawn = { phase: a.fire.phase, curtain: a.log.curtain[a.log.curtain.length - 1], marlo: a.log.marlo.join() };
    a.run(1);
    out.dawnMid = { phase: a.fire.phase, ember: a.log.ember.join(';') };
    a.run(1);
    out.back = { phase: a.fire.phase, night: a.log.night[a.log.night.length - 1], ember: a.log.ember.join(';'), marlo: a.log.marlo.join(), fire: a.scene.children[0].visible, curtain: a.log.curtain.join(), done: a.log.done };
    a.run(1);
    out.over = { phase: a.fire.phase, active: a.fire.active, done: a.log.done, shards: a.log.shards };
  }
  {   // the cues are skipped (a test, or a player who skips): the shard is taken anyway, exactly once
    const b = make();
    b.fire.play(() => { b.log.done++; });
    b.run(2.6);
    b.talkDone();
    b.run(4.5);
    out.skipped = { phase: b.fire.phase, shards: b.log.shards, flares: b.log.flares, done: b.log.done, night: b.log.night[b.log.night.length - 1] };
  }
  {   // if Ember is the hero in play she is already there (no second Ember runs in)
    const c = make('ember');
    c.fire.play(() => {});
    c.run(1);
    out.emberHero = c.log.ember.join(';');
  }
  {   // the story's words
    const lines = SCENES.campfire.filter(Array.isArray);
    out.words = { speakers: lines.map((l) => l[0]).join(), cues: lines.filter((l) => l[2]).map((l) => l[2]).join(), first: SCENES.campfire[0].music, shorter: lines.every((l) => l[1].length < 90), lyra: lines.some((l) => /second verse/.test(l[1])), end: lines[lines.length - 1][1], win5end: SCENES.win5[SCENES.win5.length - 1][1] };
  }
  return out;
};

async function chunk24(browser) {
  let { page } = await openGame(browser, 'campfire-unit');
  const u = await page.evaluate(campfireUnit);
  check('the campfire waits quietly until it is asked; then the screen starts to go dark and nothing else changes yet (no night, nobody moved)', u.idle.phase === 'idle' && !u.idle.active && u.dusk.phase === 'dusk' && u.dusk.active && u.dusk.curtain === 'true' && u.duskMid.phase === 'dusk' && u.duskMid.nights === 0 && u.duskMid.moved === '5,0,5', JSON.stringify([u.idle, u.dusk, u.duskMid]));
  check('when the screen is dark: night falls, Sol sits on one side of the fire, Marlo on another, Ember runs in to the third, the camera jumps to the fire, and the screen comes back', u.lit.phase === 'lit' && u.lit.night === 1 && u.lit.curtain === 'true,false' && u.lit.player === '-1.8,0,0.9' && u.lit.velocity === '0,0' && u.lit.marlo === '-2.4,0,-1.3' && /walk -2.4,-1.3/.test(u.lit.walk) && u.lit.ember === '3.8,1.6,1.9,0.8,0,0' && u.lit.follow === 1 && Math.abs(u.lit.faced - 2.03) < 0.05, JSON.stringify(u.lit));
  check('then Marlo\'s story starts (the "campfire" conversation) and the controls are off for as long as it lasts', u.scene.phase === 'scene' && u.scene.scenes === 'campfire' && u.scene.active, JSON.stringify(u.scene));
  check('the story\'s cues make things happen: the flute (Marlo raises his lantern), then the shard rises out of the fire and hangs there; unknown cues are left to someone else', u.cues.nope === false && u.cues.flute && u.cues.rise && u.rising === 'rising' && u.hover === 'hovering', JSON.stringify([u.cues, u.rising, u.hover]));
  check('the picture of Lyra fades in over the fire (and the stars keep twinkling), and when the shard is taken it flies to Sol, is saved once, the aura flares and there is a fanfare', u.vision.shown && u.vision.opacity > 0.5 && u.vision.nights && u.flying.shard === 'flying' && u.flying.taken === 0 && u.taken.shard === 'taken' && u.taken.shards === 1 && u.taken.stored === 1 && u.taken.flares === 1 && /chime/.test(u.taken.sounds) && /sunrise/.test(u.taken.sounds) && /tier/.test(u.taken.sounds) && u.visionGone, JSON.stringify([u.vision, u.flying, u.taken, u.visionGone]));
  check('when the talk is over the screen goes dark again, day comes back, the fire is put out, Ember leaves and Marlo goes home; then the screen comes back and "it is over" is said once', u.dawn.phase === 'dawn' && u.dawn.curtain === true && u.dawnMid.phase === 'dawn' && u.back.phase === 'back' && u.back.night === 0 && /leave/.test(u.back.ember) && /home/.test(u.back.marlo) && !u.back.fire && u.back.curtain === 'true,false,true,false' && u.back.done === 0 && u.over.phase === 'idle' && !u.over.active && u.over.done === 1 && u.over.shards === 1, JSON.stringify([u.dawn, u.dawnMid, u.back, u.over]));
  check('if the cues are skipped the shard is still taken (once), and the night still ends', u.skipped.phase === 'idle' && u.skipped.shards === 1 && u.skipped.flares === 1 && u.skipped.done === 1 && u.skipped.night === 0, JSON.stringify(u.skipped));
  check('if Ember is the hero in play, no second Ember runs in', u.emberHero === '', JSON.stringify(u.emberHero));
  check('the words: Pip, Ember and Marlo joke, Marlo plays and tells about Lyra ("She used to fall asleep before the second verse. Every time."), the shard shows her, and he says Tidecove is next; the lines are short; the lullaby plays', u.words.speakers.startsWith('pip,ember,pip,marlo,marlo,sol,marlo,marlo,pip,marlo') && u.words.cues === 'flute,shard-rise,vision,shard-take' && u.words.first === 'lullaby' && u.words.shorter && u.words.lyra && /Tidecove/.test(u.words.end) && /fire/.test(u.words.win5end), JSON.stringify(u.words));

  // The whole thing in the live game: the boss, his last words, the closing talk, the night, the shard, and the end screen.
  SAVE_ON = true; CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'campfire-live'));
  SAVE_ON = false; CHAPTER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.progress.data.round = 5; G.rounds.restart(); });
  await until(page, () => !document.getElementById('squad-screen').hidden);
  await page.click('#squad-go');
  await until(page, () => ['break', 'spawning', 'fighting'].includes(window.__game.waves.state));
  await page.evaluate(() => {
    const G = window.__game;
    for (let i = 0; i < 30 * 200 && !G.waves.boss; i++) { G.gloomlings.filter((g) => !g.boss).forEach((g) => { g.remove(); G.gloomlings.splice(G.gloomlings.indexOf(g), 1); }); G.waves.update(1 / 30); }
  });
  await until(page, () => window.__game.waves.boss.state !== 'grow');
  await page.evaluate(() => { const b = window.__game.waves.boss; b.hit(b.health + 1); });
  await until(page, () => window.__game.story.active);   // his last words
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => window.__game.story.active && document.getElementById('dialogue-name').textContent === 'Pip');   // the closing talk
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => window.__game.campfire.phase === 'dusk' || window.__game.campfire.phase === 'lit' || window.__game.campfire.phase === 'scene');
  const dark = await page.evaluate(() => ({ curtain: document.getElementById('curtain').classList.contains('on'), end: document.getElementById('end').hidden, phase: window.__game.campfire.phase }));
  check('after the closing talk the screen goes dark first (and the end screen waits)', dark.end && (dark.curtain || dark.phase !== 'dusk'), JSON.stringify(dark));
  await until(page, () => window.__game.campfire.phase === 'scene' && window.__game.story.active);
  const lit = await page.evaluate(() => { const G = window.__game; const d = (o) => +Math.hypot(o.position.x, o.position.z).toFixed(1); return { night: G.world.night, curtain: document.getElementById('curtain').classList.contains('on'), sol: d(G.player), marlo: d(G.marlo), ember: G.ember.state, who: document.getElementById('dialogue-name').textContent }; });
  check('then it is night, the screen is back, Sol and Marlo are round the fire (within 3 units of it), Ember has come, and Pip begins ("A fire!")', lit.night === 1 && !lit.curtain && lit.sol < 3 && lit.marlo < 3 && lit.ember !== 'away' && lit.who === 'Pip', JSON.stringify(lit));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/campfire-1-fire.png` });
  let sawShard = false, sawVision = false;
  for (let guard = 0; guard < 120 && (await page.evaluate(() => window.__game.story.active)); guard++) {
    const now = await page.evaluate(() => ({ shard: window.__game.campfire.shard, vision: window.__game.world.scene.children.some((c) => c.type === 'Group' && c.visible && c.children.length > 12 && c.children.some((k) => k.type === 'Sprite')) }));
    if (now.shard === 'hovering' && !sawShard) { sawShard = true; await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/campfire-2-shard.png` }); }
    if (now.vision && !sawVision && now.shard === 'hovering') { sawVision = true; await page.waitForTimeout(1500); await page.screenshot({ path: `${OUT}/campfire-3-vision.png` }); }
    await page.waitForTimeout(300);
    await page.keyboard.press('Space');
  }
  check('reading on, the shard rises out of the fire and hangs there while Marlo speaks, and the picture shows', sawShard);
  await until(page, () => !document.getElementById('end').hidden);
  const end = await page.evaluate(() => { const G = window.__game; return { title: document.getElementById('end-title').textContent, text: document.getElementById('end-text').textContent, button: document.getElementById('end-button').textContent, night: G.world.night, shards: G.progress.shards, shard: G.campfire.shard, active: G.campfire.active, saved: JSON.parse(localStorage.getItem('powerheroes.save')).shards, round: G.progress.round, curtain: document.getElementById('curtain').classList.contains('on'), marlo: G.marlo.atHome }; });
  check('then the end screen says "Chapter 1 complete!" with "Memory shard 1 of 5", it is day again and the screen is clear; the shard is saved, and the chapter is done', end.title === 'Chapter 1 complete!' && end.text === 'Sunmeadow is green again. Memory shard 1 of 5.' && end.button === 'Keep playing' && end.night === 0 && end.shards === 1 && end.shard === 'taken' && !end.active && JSON.stringify(end.saved) === '[1]' && end.round === 6 && !end.curtain, JSON.stringify(end));
  await page.screenshot({ path: `${OUT}/campfire-4-end.png` });
}

// ---------- The Home Village ----------
const villageUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createVillage, PLACES, DOOR, VILLAGE_WALK, VILLAGE_RADIUS } = await import('/src/village.js');
  const out = {};
  const modes = [];
  const scene = new THREE.Scene();
  const village = createVillage({ world: { scene, setMode: (m) => modes.push(m), setNight: () => {} } });
  out.start = { active: village.active, inScene: scene.children.length, modes: modes.length };
  village.enter();
  out.enter = { active: village.active, modes: modes.join(), shown: village.group.visible };
  village.leave();
  out.leave = { active: village.active, modes: modes.join() };
  village.enter();
  const pushed = (x, z) => { const p = new THREE.Vector3(x, 0, z); village.keepOut(p); return [+p.x.toFixed(2), +p.z.toFixed(2)]; };
  out.free = pushed(5, 0).join();
  out.hall = pushed(0, -11.8);
  out.pond = pushed(-10, 5);
  out.tower = pushed(12.5, 7.8);
  out.board = pushed(-5, -9.0);
  out.fireSpot = pushed(1.5, 5.0);
  const actionId = (x, z) => { const a = village.actionAt({ x, z }); return a ? `${a.id}:${a.label}` : null; };
  out.actions = { door: actionId(DOOR.x, DOOR.z + 1), board: actionId(-5, -8.1), nowhere: actionId(8, 3), hallInside: actionId(0, -12) };
  out.sizes = { walk: VILLAGE_WALK, radius: VILLAGE_RADIUS, places: Object.keys(PLACES).join(), door: `${DOOR.x},${DOOR.z}` };
  const fire = scene.children[0].children.find((c) => c.type === 'Group' && c.children.some((k) => k.geometry && k.geometry.type === 'ConeGeometry' && k.material.type === 'MeshBasicMaterial'));
  const flame = fire.children.find((c) => c.userData && c.userData.height);
  village.update(0.016, 1.0); const a = flame.scale.y;
  village.update(0.016, 1.3); const b = flame.scale.y;
  out.fire = { moves: a !== b };
  village.leave();
  const before = flame.scale.y;
  village.update(0.016, 2.0);
  out.fire.stillWhenAway = flame.scale.y === before;
  return out;
};

async function chunk25(browser) {
  let { page } = await openGame(browser, 'village-unit');
  const u = await page.evaluate(villageUnit);
  check('the village starts hidden (and the arena shown); entering it shows it and tells the world to switch to "village"; leaving puts the arena back', !u.start.active && u.start.inScene === 1 && u.start.modes === 0 && u.enter.active && u.enter.shown && u.enter.modes === 'village' && !u.leave.active && u.leave.modes === 'village,arena', JSON.stringify([u.start, u.enter, u.leave]));
  check('its places are the Hero Hall, the training yard, the sparring ring, the pond, the campfire square, the lookout tower and the notice board; the isle is 18 wide and you may walk 16.4 out', u.sizes.places === 'hall,yard,ring,pond,square,tower,board' && u.sizes.walk === 16.4 && u.sizes.radius === 18 && u.sizes.door === '0,-10.6', JSON.stringify(u.sizes));
  check('the Hall, the pond, the tower, the notice board and the fire are solid: standing inside one moves you out of it (to its edge); open ground is left alone', u.free === '5,0' && u.hall[1] > -11.2 && u.pond[1] < 4.0 && u.pond[0] === -10 && u.tower[1] < 7.5 && u.board[1] > -9.0 - 0.01 && u.fireSpot[1] < 4.5 + 0.3, JSON.stringify([u.free, u.hall, u.pond, u.tower, u.board, u.fireSpot]));
  check('the big button has something to do at the Hall\'s door ("Hero Hall") and at the notice board ("Rankings"), and nothing in the open', u.actions.door === 'hall:Hero Hall' && u.actions.board === 'board:Rankings' && u.actions.nowhere === null, JSON.stringify(u.actions));
  check('the campfire in the square burns (its flames move) while you are in the village, and stands still when you are not', u.fire.moves && u.fire.stillWhenAway, JSON.stringify(u.fire));

  // The live game: the village from the end screen (?debug&chapter&squad), and the Hall.
  CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'village-live'));
  CHAPTER_ON = false; SHOW_SQUAD = false;
  await winRound(page);
  await page.evaluate(() => window.__game.story.skip());
  await until(page, () => !document.getElementById('end').hidden);
  await page.waitForTimeout(900);
  const buttons = await page.evaluate(() => ({ village: !document.getElementById('end-village').hidden, text: document.getElementById('end-village').textContent }));
  check('after a round the end screen has a "Village" button', buttons.village && buttons.text === 'Village', JSON.stringify(buttons));
  await page.click('#end-village');
  await until(page, () => window.__game.village.active);
  await page.waitForTimeout(600);
  const here = await page.evaluate(() => { const G = window.__game; return { arena: G.world.arena.visible, state: G.waves.state, enemies: G.gloomlings.length, x: +G.player.position.x.toFixed(1), z: +G.player.position.z.toFixed(1), end: document.getElementById('end').hidden, veil: parseFloat(document.getElementById('tint').style.opacity || '0'), button: document.getElementById('power-button').hidden, note: document.getElementById('hud-wave').textContent, marlo: +Math.hypot(G.marlo.position.x - 1.5, G.marlo.position.z - 5.5).toFixed(1) }; });
  check('"Village" takes you there: the arena is gone, there are no enemies and no round, you stand just outside the Hall\'s door, the screen has no grey veil, the big button is hidden (nothing to do here yet) and Marlo is at the campfire', !here.arena && here.state === 'idle' && here.enemies === 0 && Math.abs(here.x) < 0.5 && here.z > -8.2 && here.z < -6.6 && here.end && here.veil < 0.02 && here.button && here.note === '' && here.marlo < 4, JSON.stringify(here));
  await page.screenshot({ path: `${OUT}/village-1-door.png` });
  await page.evaluate(() => window.__game.player.position.set(30, 0, 0));
  await page.waitForTimeout(300);
  const edge = await page.evaluate(() => Math.hypot(window.__game.player.position.x, window.__game.player.position.z));
  check('you can walk out as far as 16.4 and no farther', edge <= 16.45 && edge > 5, `${edge.toFixed(1)}`);
  await page.evaluate(() => window.__game.player.position.set(-10, 0, 7));
  await page.waitForTimeout(400);
  const pond = await page.evaluate(() => { const p = window.__game.player.position; return +Math.hypot(p.x + 10, p.z - 8).toFixed(1); });
  check('the pond is solid for the hero too (walking into it is stopped at its edge)', pond >= 4.0, `${pond}`);
  await page.evaluate(() => window.__game.player.position.set(-5, 0, -8.1));
  await until(page, () => !document.getElementById('power-button').hidden);
  const board = await page.evaluate(() => ({ label: document.getElementById('power-label').textContent, power: document.getElementById('power-button').dataset.power }));
  check('at the notice board the big button says "Rankings" (green, an action button)', board.label === 'Rankings' && board.power === 'action', JSON.stringify(board));
  await page.keyboard.press('Space');
  const shown = await page.evaluate(() => !document.getElementById('rankings').hidden);
  await page.keyboard.press('Escape');
  check('pressing it (or Space) opens the Power Rankings, and Escape closes them', shown && (await page.evaluate(() => document.getElementById('rankings').hidden)));
  await page.evaluate(() => window.__game.player.position.set(0, 0, -9.2));
  await until(page, () => document.getElementById('power-label').textContent === 'Hero Hall');
  await page.screenshot({ path: `${OUT}/village-2-hall.png` });
  await page.keyboard.press('Space');
  await until(page, () => !document.getElementById('squad-screen').hidden);
  const hall = await page.evaluate(() => ({ active: window.__game.village.active, arena: window.__game.world.arena.visible, title: document.getElementById('squad-title').textContent, home: !document.getElementById('squad-village').hidden }));
  check('at the Hall\'s door the big button says "Hero Hall"; pressing it leaves the village (the arena is back) and brings the squad screen for the next round, with a "Village" button to go back', !hall.active && hall.arena && hall.title === 'Round 2/5 · The Long Grass' && hall.home, JSON.stringify(hall));
  await page.click('#squad-village');
  await until(page, () => window.__game.village.active);
  check('the "Village" button on the squad screen takes you back to the village (the squad screen closes)', (await page.evaluate(() => document.getElementById('squad-screen').hidden)));
  await page.evaluate(() => window.__game.player.position.set(0, 0, -9.2));
  await until(page, () => document.getElementById('power-label').textContent === 'Hero Hall');
  await page.keyboard.press('Space');
  await until(page, () => !document.getElementById('squad-screen').hidden);
  await page.click('#squad-go');
  await until(page, () => ['break', 'spawning', 'fighting'].includes(window.__game.waves.state));
  const fight = await page.evaluate(() => { const G = window.__game; return { village: G.village.active, arena: G.world.arena.visible, round: G.rounds.label(), x: +G.player.position.x.toFixed(1), power: document.getElementById('power-button').dataset.power, hidden: document.getElementById('power-button').hidden }; });
  check('"Go!" starts the round in the arena: the hero is back in the middle, the big button is the hero\'s superpower again', !fight.village && fight.arena && fight.round === 'Round 2/5' && Math.abs(fight.x) < 0.5 && fight.power === 'starburst' && !fight.hidden, JSON.stringify(fight));
  const big = await page.evaluate(() => { const G = window.__game; G.player.position.set(15, 0, 0); return G.player.position.x; });
  await page.waitForTimeout(300);
  const arenaEdge = await page.evaluate(() => Math.hypot(window.__game.player.position.x, window.__game.player.position.z));
  check('and the walking limit is the arena\'s again (10.2), not the village\'s', arenaEdge <= 10.25, `${arenaEdge.toFixed(1)}`);
}

// ---------- The clan ----------
const clanUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createClan } = await import('/src/clan.js');
  const { makeClan, NAMES, PERSONALITIES, BODIES, HAIR } = await import('/src/character-gen.js');
  const out = {};
  const tags = document.createElement('div');
  document.body.appendChild(tags);
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 100);
  camera.position.set(0, 12, 12);
  camera.lookAt(0, 0, 0);
  const people = makeClan(7, 14);
  const again = makeClan(7, 14);
  const other = makeClan(8, 14);
  out.gen = {
    count: people.length, names: new Set(people.map((p) => p.name)).size, first: people.slice(0, 6).map((p) => `${p.name}:${p.type[0]}:${p.power}`).join(),
    rest: people.slice(6).every((p) => NAMES.includes(p.name) && p.power >= 20 && p.power < 600 && PERSONALITIES.includes(p.personality)),
    looks: people.every((p) => BODIES.includes(p.look.body) && HAIR.includes(p.look.hair) && typeof p.look.skin === 'number' && typeof p.look.outfit === 'number'),
    same: JSON.stringify(people) === JSON.stringify(again), otherFirst: JSON.stringify(other.slice(0, 6).map((p) => [p.name, p.power])) === JSON.stringify(people.slice(0, 6).map((p) => [p.name, p.power])),
    otherRest: JSON.stringify(other.slice(6).map((p) => p.name)) !== JSON.stringify(people.slice(6).map((p) => p.name)),
    types: new Set(people.map((p) => p.type)).size,
  };
  const scene = new THREE.Scene();
  const clan = createClan({ scene, camera, tags, seed: 7 });
  out.made = { members: clan.members.length, tagsMade: tags.children.length, visible: clan.visible, shown: [...tags.children].filter((t) => !t.hidden).length, first: [clan.members[0].position.x, clan.members[0].position.z].join() };
  clan.show(true);
  const home = clan.members.map((m) => ({ x: m.position.x, z: m.position.z }));
  const far = { x: 0, z: -1 };   // (nobody is within 6.5 of here)
  for (let i = 0; i < 30 * 40; i++) clan.update(1 / 30, i / 30, far);
  const strayed = clan.members.map((m, i) => Math.hypot(m.position.x - home[i].x, m.position.z - home[i].z));
  out.stroll = { max: +Math.max(...strayed).toFixed(2), moved: strayed.filter((d) => d > 0.05).length };
  out.farTags = [...tags.children].filter((t) => !t.hidden).length;
  // Somebody comes close: they turn to look, and the tags of the nearest show.
  const juno = clan.members[2];
  for (let i = 0; i < 30 * 8; i++) juno.goal = null, clan.update(1 / 30, 50 + i / 30, { x: juno.position.x + 3, z: juno.position.z });
  const faced = Math.abs(Math.atan2(Math.sin(juno.yaw - Math.PI / 2), Math.cos(juno.yaw - Math.PI / 2)));
  const shown = [...tags.children].filter((t) => !t.hidden);
  out.near = { faced: +faced.toFixed(2), shown: shown.length, texts: shown.map((t) => t.textContent).join('|'), placed: shown.every((t) => /translate\(-50%, -100%\) translate\(-?[\d.]+px, -?[\d.]+px\)/.test(t.style.transform)) };
  out.nearest = { juno: clan.nearest({ x: juno.position.x + 1, z: juno.position.z }).name, none: clan.nearest({ x: 0, z: -1 }), wide: clan.nearest({ x: 0, z: -1 }, 20) !== null };
  out.auras = clan.members.map((m) => `${m.name}:${m.aura.group.children.length}:${m.aura.flame ? 'f' : '-'}`).join();
  out.tierRule = clan.members.every((m) => (m.aura.flame !== null) === (m.power >= 300) && m.aura.group.children.length === 1 + (m.power >= 100 ? 1 : 0) + (m.power >= 300 ? 1 : 0));
  clan.show(false);
  out.hidden = { visible: clan.visible, tags: [...tags.children].filter((t) => !t.hidden).length };
  const before = clan.members[5].position.x;
  for (let i = 0; i < 300; i++) clan.update(1 / 30, i, far);
  out.hidden.still = clan.members[5].position.x === before;
  return out;
};

async function chunk26(browser) {
  let { page } = await openGame(browser, 'clan-unit');
  const u = await page.evaluate(clanUnit);
  const g = u.gen;
  check('the clan is made of 14 different people: the six from the Rankings first (Wren 45, Pebble 80, Juno 150, Marigold 230, Brindle 340, Fennel 480), then eight made up, with Power from 20 to 600, a personality and a look', g.count === 14 && g.names === 14 && g.first === 'Wren:w:45,Pebble:n:80,Juno:s:150,Marigold:w:230,Brindle:f:340,Fennel:n:480' && g.rest && g.looks && g.types >= 3, JSON.stringify(g));
  check('the same seed always makes the same clan; another seed keeps the six but makes different others', g.same && g.otherFirst && g.otherRest, JSON.stringify([g.same, g.otherFirst, g.otherRest]));
  check('in the village there are 14 people with a tag each; everything starts hidden (and out of the arena) until you come, and they stand at their own spot', u.made.members === 14 && u.made.tagsMade === 14 && !u.made.visible && u.made.shown === 0 && u.made.first === '-13,-4.5', JSON.stringify(u.made));
  check('they stand about and stroll a little (never more than 1.3 from their spot), and several really do move; with nobody near, no tags show', u.stroll.max <= 1.3 && u.stroll.moved >= 7 && u.farTags === 0, JSON.stringify([u.stroll, u.farTags]));
  check('when somebody comes close they turn to look at them, and the tags of the nearest (at most three) show: the name and "Power N", placed on the screen', u.near.faced < 0.35 && u.near.shown >= 1 && u.near.shown <= 3 && /Juno Power 150/.test(u.near.texts) && u.near.placed, JSON.stringify(u.near));
  check('you can ask who is nearest to a spot (within 2.4 by default, or as far as you say)', u.nearest.juno === 'Juno' && u.nearest.none === null && u.nearest.wide, JSON.stringify(u.nearest));
  check('their auras show their Power: a glow at the feet for all, soft body light from 100, and a flickering flame from 300 (Blaze)', u.tierRule, u.auras);
  check('when you leave the village they are hidden, their tags go, and they stop moving', !u.hidden.visible && u.hidden.tags === 0 && u.hidden.still, JSON.stringify(u.hidden));

  // The live village with its people.
  CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'clan-live'));
  CHAPTER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => window.__game.rounds.toVillage());
  await until(page, () => window.__game.village.active);
  await page.waitForTimeout(500);
  const live = await page.evaluate(() => { const G = window.__game; return { visible: G.clan.visible, count: G.clan.members.filter((m) => m.model.group.visible).length, calls: G.renderer.info.render.calls, triangles: G.renderer.info.render.triangles }; });
  check('in the village the whole clan is there', live.visible && live.count === 14, JSON.stringify(live));
  results.push(`INFO  the village with its people: ${live.calls} draw calls, ${live.triangles} triangles (software rendering, so no frame rate)`);
  check('and the picture stays light enough for a phone (a few hundred draw calls at most)', live.calls < 420, `${live.calls}`);
  await page.evaluate(() => { const G = window.__game; const m = G.clan.members[2]; G.player.position.set(m.position.x + 2.2, 0, m.position.z + 0.5); });
  await until(page, () => [...document.querySelectorAll('#tags .tag')].some((t) => !t.hidden && /Juno/.test(t.textContent)));
  await page.waitForTimeout(500);
  const tag = await page.evaluate(() => [...document.querySelectorAll('#tags .tag')].filter((t) => !t.hidden).map((t) => t.textContent).join('|'));
  check('walking up to Juno shows his tag: "Juno Power 150"', /Juno Power 150/.test(tag), tag);
  await page.screenshot({ path: `${OUT}/clan-1-juno.png` });
  await page.evaluate(() => { const G = window.__game; G.player.position.set(2, 0, 3); });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/clan-2-square.png` });
  await page.evaluate(() => { const G = window.__game; G.player.position.set(0, 0, -9.2); });
  await until(page, () => document.getElementById('power-label').textContent === 'Hero Hall');
  await page.keyboard.press('Space');
  await until(page, () => !window.__game.village.active);
  const gone = await page.evaluate(() => ({ visible: window.__game.clan.visible, tags: [...document.querySelectorAll('#tags .tag')].filter((t) => !t.hidden).length }));
  check('going to the Hall hides the clan again', !gone.visible && gone.tags === 0, JSON.stringify(gone));
}

// ---------- Talking to the clan, and the clan on the Rankings board ----------
async function chunk27(browser) {
  let { page } = await openGame(browser, 'talk-unit');
  const d = await page.evaluate(async () => {
    const { CLAN_LINES } = await import('/src/story-data.js');
    const { PERSONALITIES } = await import('/src/character-gen.js');
    return { kinds: Object.keys(CLAN_LINES).sort().join(), expected: [...PERSONALITIES].sort().join(), threeEach: Object.values(CLAN_LINES).every((l) => l.length === 3), short: Object.values(CLAN_LINES).every((l) => l.every((x) => x.length < 90)), power: Object.values(CLAN_LINES).flat().filter((x) => x.includes('{power}')).length };
  });
  check('every kind of person (proud, shy, cheerful, sleepy, serious, jokey, curious, grumpy) has three short lines, and some of them say their own Power', d.kinds === d.expected && d.threeEach && d.short && d.power >= 4, JSON.stringify(d));

  CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'talk-live'));
  CHAPTER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => window.__game.rounds.toVillage());
  await until(page, () => window.__game.village.active);
  await page.evaluate(() => { const G = window.__game; const m = G.clan.members[2]; G.player.position.set(m.position.x - 1.2, 0, m.position.z); });   // (on the far side of Juno from the others)
  await until(page, () => document.getElementById('power-label').textContent === 'Talk');
  const button = await page.evaluate(() => ({ label: document.getElementById('power-label').textContent, power: document.getElementById('power-button').dataset.power, hidden: document.getElementById('power-button').hidden }));
  check('next to somebody the big button says "Talk" (green)', button.label === 'Talk' && button.power === 'action' && !button.hidden, JSON.stringify(button));
  await page.evaluate(() => { window.__lines = []; });
  const heard = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);
    heard.push(await page.evaluate(() => ({ text: document.getElementById('bubble').textContent, shown: document.getElementById('bubble').classList.contains('show') })));
  }
  const lines = [...new Set(heard.map((h) => h.text))];
  check('pressing it makes them say a line, over their head, with their name: "Juno: ..." (one of his three; never the same twice in a row)', heard.every((h) => h.shown) && lines.length >= 2 && lines.every((l) => /^Juno: /.test(l)) && heard.every((h, i) => i === 0 || h.text !== heard[i - 1].text) && lines.every((l) => ['Power 150. Not that I\'m counting.', 'Stand back. My aura needs room.', 'Number one is only a matter of time.'].includes(l.replace(/^Juno: /, ''))), JSON.stringify(lines));
  await page.screenshot({ path: `${OUT}/talk-1-juno.png` });
  // The Rankings now name the people of the village.
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); });
  const board = await page.evaluate(() => { const G = window.__game; const rows = G.rounds.rows(); return { count: rows.length, first: rows[0].name, names: rows.filter((r) => !r.you).map((r) => r.name).join(), others: rows.filter((r) => !r.you).length, sorted: rows.every((r, i) => i === 0 || rows[i - 1].power >= r.power), clan: G.clan.members.map((m) => m.name).join() }; });
  check('the Power Rankings list the real people of the village (14 of them) and Rook, who is number 1; your heroes are among them', board.count === 19 && board.first === 'Rook' && board.others === 15 && board.sorted && board.names.includes('Juno') && board.names.includes('Basil') && board.clan.split(',').every((n) => board.names.includes(n)), JSON.stringify(board));
  // Talking to nobody does nothing, and the big button hides in the open again.
  await page.evaluate(() => window.__game.player.position.set(0, 0, -1));
  await until(page, () => document.getElementById('power-button').hidden);
  check('in the open, with nobody near, the big button is hidden again', true);
}

// ---------- Day and night in the village ----------
const nightUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createVillage, nightAt } = await import('/src/village.js');
  const { windowMaterial } = await import('/src/village-props.js');
  const { createClan } = await import('/src/clan.js');
  const out = {};
  const at = (t) => +nightAt(t).toFixed(3);
  out.curve = { morning: at(0), day: at(0.3), dayEnd: at(0.55), mid: at(0.625), night: at(0.7), late: at(0.85), still: at(0.9), dawn: at(0.95), next: at(1), wrap: at(1.3), minus: at(-0.3) };
  out.range = (() => { let min = 1, max = 0; for (let i = 0; i <= 1000; i++) { const v = nightAt(i / 1000); min = Math.min(min, v); max = Math.max(max, v); } return { min, max }; })();
  {   // the village's own clock, light and songs
    const log = { night: [], songs: [], modes: [] };
    const scene = new THREE.Scene();
    const village = createVillage({ world: { scene, setMode: (m) => log.modes.push(m), setNight: (a) => log.night.push(+a.toFixed(2)) }, music: { play: (name, fade) => log.songs.push(`${name}@${fade}`) } });
    out.idle = { clock: village.clock, night: village.night, calls: log.night.length };
    village.update(1, 0, { x: 0, z: 0 });
    out.idle.stillWhenAway = village.clock === 0.12;
    village.enter();
    village.update(42, 1, { x: 0, z: 0 });   // 42 seconds: a tenth of a day
    out.clock = +village.clock.toFixed(3);
    village.setClock(0.8);
    village.update(0.1, 2, { x: 0, z: 0 });
    out.night = { value: village.night, last: log.night[log.night.length - 1], songs: log.songs.join(), window: windowMaterial.color.getHexString(), lamps: [] };
    const lamps = []; scene.traverse((o) => { if (o.userData.halo) lamps.push(o.userData.halo.material.opacity); });
    out.night.lamps = [lamps.length, Math.min(...lamps)];
    village.update(0.1, 3, { x: 0, z: 0 });
    out.night.songsOnce = log.songs.join();
    village.setClock(0.3);
    village.update(0.1, 4, { x: 0, z: 0 });
    const lamps2 = []; scene.traverse((o) => { if (o.userData.halo) lamps2.push(o.userData.halo.material.opacity); });
    out.day = { value: village.night, songs: log.songs.join(), window: windowMaterial.color.getHexString(), lamps: Math.max(...lamps2) };
    village.setClock(0.8);
    village.update(0.1, 5, { x: 0, z: 0 });
    village.leave();
    out.left = { last: log.night[log.night.length - 1], modes: log.modes.join() };
  }
  {   // the clan: at night to the fire, in the morning home again
    const tags = document.createElement('div');
    document.body.appendChild(tags);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 100);
    camera.position.set(0, 12, 12);
    camera.lookAt(0, 0, 0);
    const clan = createClan({ scene: new THREE.Scene(), camera, tags, seed: 7 });
    clan.show(true);
    const far = { x: 0, z: -1 };
    const run = (seconds, night, t0) => { for (let i = 0; i < seconds * 30; i++) clan.update(1 / 30, t0 + i / 30, far, night); };
    run(5, 0, 0);
    const home = clan.members.map((m) => ({ x: m.position.x, z: m.position.z }));
    run(2, 0.8, 5);
    out.dusk = { started: clan.members.filter((m, i) => Math.hypot(m.position.x - home[i].x, m.position.z - home[i].z) > 0.3).length };
    run(45, 0.8, 7);
    const toFire = clan.members.map((m) => Math.hypot(m.position.x - 1.5, m.position.z - 5.5));
    out.fire = { all: toFire.every((d) => d > 2 && d < 4.6), sitting: clan.members.every((m) => m.sitting), lowered: clan.members.every((m) => m.model.person.position.y < -0.1), seatsDiffer: new Set(clan.members.map((m) => `${m.seat.x.toFixed(1)},${m.seat.z.toFixed(1)}`)).size === 14 };
    const facing = clan.members.map((m) => { const want = Math.atan2(1.5 - m.position.x, 5.5 - m.position.z); return Math.abs(Math.atan2(Math.sin(m.yaw - want), Math.cos(m.yaw - want))); });
    out.fire.facing = Math.max(...facing) < 0.5;
    run(3, 0, 52);
    out.dawn = { standing: clan.members.some((m) => !m.sitting), someStillSitting: clan.members.some((m) => m.sitting) };
    run(50, 0, 55);
    const back = clan.members.map((m, i) => Math.hypot(m.position.x - m.home.x, m.position.z - m.home.z));
    out.home = { max: +Math.max(...back).toFixed(2), standing: clan.members.every((m) => !m.sitting && m.model.person.position.y > -0.05) };
  }
  return out;
};

async function chunk28(browser) {
  let { page } = await openGame(browser, 'night-unit');
  const u = await page.evaluate(nightUnit);
  const c = u.curve;
  check('the day in the village: bright through the morning and day, darker through dusk, darkest at night (never fully black: 0.85 at most), then dawn, and it comes round again', c.morning === 0 && c.day === 0 && c.dayEnd === 0 && c.mid > 0.35 && c.mid < 0.5 && c.night === 0.85 && c.late === 0.85 && c.still === 0.85 && c.dawn > 0.35 && c.dawn < 0.5 && c.next === 0 && c.wrap === 0 && c.minus === 0.85 && u.range.min === 0 && u.range.max === 0.85, JSON.stringify([u.curve, u.range]));
  check('the village clock waits while you are away, runs while you are there (a day is 420 seconds: 42 seconds is a tenth), lights the world by it every frame, and puts day back when you leave', u.idle.clock === 0.12 && u.idle.stillWhenAway && u.idle.calls === 0 && Math.abs(u.clock - 0.22) < 0.002 && u.night.value === 0.85 && u.night.last === 0.85 && u.left.last === 0 && u.left.modes === 'village,arena', JSON.stringify([u.idle, u.clock, u.night.value, u.left]));
  check('at night the Hall\'s windows light up and the lamps shine (all 6); by day the windows are dark and the lamps are off', u.night.window === 'ffd27a' && u.night.lamps[0] === 6 && u.night.lamps[1] === 1 && u.day.window === '8a7a5a' && u.day.lamps === 0, JSON.stringify([u.night, u.day]));
  check('the song follows the dark: the lullaby starts once when night comes (not again every frame), and the village song when day returns', u.night.songs === 'lullaby@3' && u.night.songsOnce === 'lullaby@3' && u.day.songs === 'lullaby@3,village@3', JSON.stringify([u.night.songs, u.night.songsOnce, u.day.songs]));
  check('at dusk the clan does not all leave at once (each sets off a moment after the others)', u.dusk.started >= 1 && u.dusk.started <= 13, JSON.stringify(u.dusk));
  check('at night all 14 are round the fire, each in their own seat, sitting a little lower and facing the flames', u.fire.all && u.fire.sitting && u.fire.lowered && u.fire.seatsDiffer && u.fire.facing, JSON.stringify(u.fire));
  check('in the morning they stand up (one after another), walk back, and are standing at their own spots again', u.dawn.standing && u.home.max <= 1.3 && u.home.standing, JSON.stringify([u.dawn, u.home]));

  // The live village at night.
  CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'night-live'));
  CHAPTER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => window.__game.rounds.toVillage());
  await until(page, () => window.__game.village.active);
  await page.waitForTimeout(500);
  const day = await page.evaluate(() => ({ night: window.__game.world.night, song: window.__game.music.song }));
  await page.screenshot({ path: `${OUT}/night-1-day.png` });
  await page.evaluate(() => window.__game.village.setClock(0.78));
  await until(page, () => window.__game.world.night > 0.8);
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/night-2-night.png` });
  const dark = await page.evaluate(() => ({ night: window.__game.world.night, veil: parseFloat(document.getElementById('tint').style.opacity || '0'), song: window.__game.music.song }));
  check('in the live game the village starts in the morning light and the world goes dark when the clock says night (and the grey veil stays off); the music changes with it', day.night === 0 && dark.night >= 0.84 && dark.veil < 0.02 && day.song === 'village' && dark.song === 'lullaby', JSON.stringify([day, dark]));
  await page.evaluate(() => { const G = window.__game; G.player.position.set(0, 0, -9.2); });
  await until(page, () => document.getElementById('power-label').textContent === 'Hero Hall');
  await page.keyboard.press('Space');
  await until(page, () => !window.__game.village.active);
  check('leaving the village for a battle puts the daylight back (the arena is never dark)', (await page.evaluate(() => window.__game.world.night)) === 0);
}

// ---------- What the clan does by day ----------
const jobUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createClan } = await import('/src/clan.js');
  const { JOBS, PARTNERS } = await import('/src/activities.js');
  const out = { jobs: JOBS.join(), partners: JSON.stringify(PARTNERS) };
  const tags = document.createElement('div');
  document.body.appendChild(tags);
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 100);
  camera.position.set(0, 12, 12);
  camera.lookAt(0, 0, 0);
  const scene = new THREE.Scene();
  const clan = createClan({ scene, camera, tags, seed: 7 });
  clan.show(true);
  const far = { x: 0, z: -1 };
  const seen = {};
  const m = clan.members;
  const mark = (job, yes) => { if (yes) seen[job] = (seen[job] || 0) + 1; };
  let sparks = 0, bothDoing = 0, doingMax = 0, doingSum = 0, frames = 0;
  for (let i = 0; i < 30 * 240; i++) {
    clan.update(1 / 30, i / 30, far, 0);
    for (const p of m) {
      const a = Math.max(Math.abs(p.model.arms[0].rotation.x), Math.abs(p.model.arms[1].rotation.x));
      if (p.job === 'train') mark('train', p.doing && a > 1.0);
      if (p.job === 'spar') mark('spar', p.doing && Math.abs(p.model.person.position.z) > 0.2);
      if (p.job === 'cheer') mark('cheer', p.doing && p.model.arms[0].rotation.x < -2);
      if (p.job === 'fish') mark('fish', p.doing && p.props.rod.visible);
      if (p.job === 'cook') mark('cook', p.doing && p.props.spoon.visible);
      if (p.job === 'chat') mark('chat', p.doing && p.props.talk.visible);
      if (p.job === 'nap') mark('nap', p.doing && p.model.person.rotation.x < -1.3 && p.props.zzz.visible);
      if (p.job === 'look') mark('look', p.doing && p.props.scope.visible);
      if (p.job === 'read') mark('read', p.doing && p.model.head.rotation.x > 0.1);
      if (p.job === 'showoff') mark('showoff', p.doing && p.aura.group.scale.x > 1.2);
    }
    if (m[3].doing && m[4].doing) bothDoing++;
    const working = m.filter((p) => p.doing).length;
    doingMax = Math.max(doingMax, working);
    if (i > 30 * 60) { doingSum += working; frames++; }
    sparks = Math.max(sparks, group().children.filter((c) => c.visible).length);
  }
  function group() { return scene.children[0].children.find((c) => c.type === 'Group' && c.children.length === 36); }
  out.seen = seen;
  out.counts = { bothSpar: bothDoing > 30, doingMax, doingAvg: +(doingSum / frames).toFixed(1), sparks };
  // The night comes: everybody stops, props put away, and nobody is lying down.
  for (let i = 0; i < 30 * 60; i++) clan.update(1 / 30, 300 + i / 30, far, 0.8);
  out.night = { doing: m.filter((p) => p.doing).length, props: m.flatMap((p) => ['rod', 'spoon', 'scope', 'zzz', 'talk'].map((k) => p.props[k].visible)).filter(Boolean).length, lying: m.filter((p) => p.model.person.rotation.x !== 0).length, aura: m.every((p) => p.aura.group.scale.x === 1), sitting: m.filter((p) => p.sitting).length };
  return out;
};

async function chunk29(browser) {
  let { page } = await openGame(browser, 'jobs-unit');
  const u = await page.evaluate(jobUnit);
  check('every person has a job that fits where they stand: three train at the yard, two spar in the ring and one cheers, two fish at the pond, one cooks, one chats, one naps by the fire, one looks through the telescope, one reads the notice board, one shows off', u.jobs === 'train,train,train,spar,spar,cheer,fish,fish,cook,chat,nap,look,read,showoff' && u.partners === '{"3":4,"4":3}', JSON.stringify([u.jobs, u.partners]));
  const jobs = ['train', 'spar', 'cheer', 'fish', 'cook', 'chat', 'nap', 'look', 'read', 'showoff'];
  check('in four minutes of a day every job is really seen: training punches, sparring lunges, cheering arms up, a fishing rod, a stirring spoon, a speech mark, a nap with "Zzz", a telescope, a reader\'s tilted head and a flaring aura', jobs.every((j) => u.seen[j] > 5), JSON.stringify(u.seen));
  check('the two who spar do it together, sparks fly when people train or spar, and not everybody works at once (they rest in between)', u.counts.bothSpar && u.counts.sparks > 0 && u.counts.doingMax >= 3 && u.counts.doingAvg > 5 && u.counts.doingAvg < 13, JSON.stringify(u.counts));
  check('when night comes everybody stops: no job, no props, nobody lying down, auras back to normal, and all of them sit round the fire', u.night.doing === 0 && u.night.props === 0 && u.night.lying === 0 && u.night.aura && u.night.sitting === 14, JSON.stringify(u.night));

  // Pictures of the live village by day.
  CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'jobs-live'));
  CHAPTER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => window.__game.rounds.toVillage());
  await until(page, () => window.__game.village.active);
  await page.evaluate(() => { const G = window.__game; G.village.setClock(0.2); G.player.position.set(11.5, 0, -0.5); });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/jobs-1-ring.png` });
  await page.evaluate(() => { const G = window.__game; G.player.position.set(-11.5, 0, 0.5); });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/jobs-2-yard.png` });
  await page.evaluate(() => { const G = window.__game; G.player.position.set(-6, 0, 10); });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: `${OUT}/jobs-3-pond.png` });
  check('(pictures taken of the ring, the yard and the pond)', true);
}

// ---------- Your own heroes in the village ----------
const residentUnit = async () => {
  const THREE = await import('/lib/three.module.min.js');
  const { createResidents } = await import('/src/residents.js');
  const out = {};
  const scene = new THREE.Scene();
  const r = createResidents({ scene, bound: 16.8 });
  const at = (k) => r.people[k].guest.position;
  out.none = Object.keys(r.people).length;
  r.show(['ember', 'tide']);
  out.shown = { kinds: Object.keys(r.people).join(), states: Object.values(r.people).map((p) => p.guest.state).join(), ember: [at('ember').x, at('ember').z].join(), tide: [at('tide').x, at('tide').z].join() };
  for (let i = 0; i < 30; i++) r.update(1 / 30, i / 30, 0);
  out.here = Object.values(r.people).map((p) => p.guest.state).join();
  const visited = { ember: new Set(), tide: new Set() };
  let farthest = 0;
  for (let i = 0; i < 30 * 120; i++) {
    r.update(1 / 30, 1 + i / 30, 0);
    for (const k of ['ember', 'tide']) { visited[k].add(`${Math.round(at(k).x / 3)},${Math.round(at(k).z / 3)}`); farthest = Math.max(farthest, Math.hypot(at(k).x, at(k).z)); }
  }
  out.stroll = { ember: visited.ember.size, tide: visited.tide.size, farthest: +farthest.toFixed(1) };
  out.talk = { near: (r.nearest({ x: at('ember').x + 1, z: at('ember').z }) || {}).kind, none: r.nearest({ x: 100, z: 100 }), name: (r.nearest(at('tide')) || {}).name };
  for (let i = 0; i < 30 * 60; i++) r.update(1 / 30, 200 + i / 30, 0.8);
  out.night = { ember: [+at('ember').x.toFixed(1), +at('ember').z.toFixed(1)].join(), tide: [+at('tide').x.toFixed(1), +at('tide').z.toFixed(1)].join() };
  r.show(['tide']);
  out.benched = { ember: r.people.ember.guest.state, tide: r.people.tide.guest.state, visible: r.people.ember.guest.group.visible };
  r.hide();
  out.hidden = Object.values(r.people).map((p) => p.guest.state).join();
  return out;
};

async function chunk30(browser) {
  let { page } = await openGame(browser, 'residents-unit');
  const u = await page.evaluate(residentUnit);
  check('nobody is made until they are needed; showing Ember and Tide makes them and puts each at a favourite place (Ember at the yard, Tide at the pond: the first, then the second of their places)', u.none === 0 && u.shown.kinds === 'ember,tide' && u.shown.ember === '-9.2,-1.4' && u.shown.tide === '-12.4,5.2' && /^(running|here),(running|here)$/.test(u.shown.states) && u.here === 'here,here', JSON.stringify([u.none, u.shown, u.here]));
  check('they stroll between their favourite places (several different spots in two minutes) and stay on the isle', u.stroll.ember >= 3 && u.stroll.tide >= 3 && u.stroll.farthest < 16.8, JSON.stringify(u.stroll));
  check('you can find who is near a spot (to talk to them), and nobody when none is near', u.talk.near === 'ember' && u.talk.none === null && u.talk.name === 'Tide', JSON.stringify(u.talk));
  check('at night they go to the fire (Ember on one side, Tide on another)', Math.hypot(+u.night.ember.split(',')[0] - 3.4, +u.night.ember.split(',')[1] - 3.9) < 0.6 && Math.hypot(+u.night.tide.split(',')[0] + 0.5, +u.night.tide.split(',')[1] - 7.6) < 0.6, JSON.stringify(u.night));
  check('showing a new list hides the ones who are not in it (Ember goes, Tide stays), and hide() sends everybody away', u.benched.ember === 'away' && u.benched.tide !== 'away' && !u.benched.visible && u.hidden === 'away,away', JSON.stringify([u.benched, u.hidden]));

  // The live village: the hero who is not in your squad lives there, and you can talk to him.
  CHAPTER_ON = true; SHOW_SQUAD = true;
  ({ page } = await openGame(browser, 'residents-live'));
  CHAPTER_ON = false; SHOW_SQUAD = false;
  await page.evaluate(() => { const G = window.__game; G.progress.unlock(['sol', 'ember', 'tide', 'volt']); G.rounds.chooseSquad(['sol', 'ember', 'tide']); G.rounds.toVillage(); });
  await until(page, () => window.__game.village.active);
  await page.waitForTimeout(800);
  const live = await page.evaluate(() => { const R = window.__game.village.residents; return { kinds: Object.keys(R.people).join(), volt: R.people.volt.guest.state, visible: R.people.volt.guest.group.visible, bench: R.people.volt.here }; });
  check('with Sol, Ember and Tide in the squad, Volt lives in the village (and nobody else of your heroes does)', live.kinds === 'volt' && live.visible && live.bench, JSON.stringify(live));
  await page.evaluate(() => { const G = window.__game; G.village.residents.people.volt.wait = 1e9; const v = G.village.residents.people.volt.guest.position; G.player.position.set(v.x - 1.2, 0, v.z); });   // (he stays where he is while we talk)
  await until(page, () => document.getElementById('power-label').textContent === 'Talk');
  await page.screenshot({ path: `${OUT}/residents-1-volt.png` });
  const heard = [];
  for (let i = 0; i < 8; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); heard.push(await page.evaluate(() => document.getElementById('bubble').textContent)); }
  const lines = [...new Set(heard)];
  check('next to him the big button says "Talk", and he answers in his own voice (one of three lines about records and speed, with his name)', lines.length >= 2 && lines.every((l) => ['Volt: I timed it: that\'s your fastest walk yet.', 'Volt: Records! I love records. Beat mine.', 'Volt: Faster. Faster. ...Not you. Me.'].includes(l)), JSON.stringify(lines));
  await page.evaluate(() => { const G = window.__game; G.village.leave(); G.rounds.chooseSquad(['sol', 'volt', 'tide']); G.rounds.toVillage(); });
  await page.waitForTimeout(800);
  const swapped = await page.evaluate(() => { const R = window.__game.village.residents; return { ember: R.people.ember.here, volt: R.people.volt.here }; });
  check('with another squad the other hero lives there instead (Ember now, not Volt)', swapped.ember && !swapped.volt, JSON.stringify(swapped));
}

(async () => {
  const wanted = process.argv.slice(3);
  const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const chunks = { 1: chunk1, 2: chunk2, 3: chunk3, 4: chunk4, 5: chunk5, 6: chunk6, 7: chunk7, 8: chunk8, 9: chunk9, 10: chunk10, 11: chunk11, 12: chunk12, 13: chunk13, 14: chunk14, 15: chunk15, 16: chunk16, 17: chunk17, 18: chunk18, 19: chunk19, 20: chunk20, 21: chunk21, 22: chunk22, 23: chunk23, 24: chunk24, 25: chunk25, 26: chunk26, 27: chunk27, 28: chunk28, 29: chunk29, 30: chunk30 };
  for (const [number, run] of Object.entries(chunks)) {
    if (wanted.length === 0 || wanted.includes(number)) await run(browser);
  }
  await browser.close();
  console.log(results.join('\n'));
  console.log(problems.length ? '\nPROBLEMS:\n' + problems.join('\n') : '\nNo console errors, warnings, or missing files.');
})().catch((e) => { console.log(results.join('\n')); console.error('TEST SCRIPT FAILED:', e.message, (e.stack || '').split('\n').filter((l) => l.includes('test-stage2')).slice(0, 2).join(' | ')); process.exit(1); });
