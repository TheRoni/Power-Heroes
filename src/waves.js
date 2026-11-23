// waves.js: the wave director. It decides when Gloomlings appear, announces each wave, and ends the round.
import { createGloomling } from './gloom.js';
import { createBoss } from './boss.js';
import { WAVES } from './heroes-data.js';

const SPAWN_RADIUS = 10.8;   // Gloomlings appear on the rim of the island
const START_DELAY = 0.6;     // a short pause before the first wave
const WIN_DELAY = 1.2;       // after the last Gloomling falls: a moment to enjoy it before the win screen
const LOSE_DELAY = 1.5;      // after Ember is knocked out: a moment before the knocked-out screen
const BOSS_SHARE = 6;        // for the colour coming back, the boss counts as this many Gloomlings

// "gloomlings" is the live list shared with main.js and powers.js. New Gloomlings are added to it here.
// events (all optional): wave(number, total) when a wave starts, spawn(gloom), cleared(number), end('won' or 'lost').
// start(round) can bring its own waves: { sizes, types } as in heroes-data.js (chapters.js has a few); the usual ones if not.
// A round with a "boss" ends with one more wave: the boss alone (boss.js). wave(number, total, { boss }) tells when he comes.
// "emit" makes sparks; bossEvents (all optional) are boss.js's own: shake, taunt, sound, down(boss), fallen(boss), gone(boss).
// enemyPower(waveIndex) says how strong that wave's Gloomlings are (their Power); it defaults to 10.
export function createWaves({ scene, hero, gloomlings, events = {}, enemyPower = () => 10, emit = () => {}, bossEvents = {} }) {
  const wavesOf = (round) => round.sizes.length + (round.boss ? 1 : 0);
  const countOf = (round) => round.sizes.reduce((sum, size) => sum + size, 0) + (round.boss ? BOSS_SHARE : 0);
  let plan = WAVES;     // the waves of this round: how many Gloomlings in each, and their types
  let total = wavesOf(plan);
  let everyone = countOf(plan);
  let boss = null;      // the boss of this round, once he has come
  let state = 'idle';   // idle, break (waiting), spawning, fighting, won / lost (the short pause), over (end screen showing)
  let wave = 0;         // which wave we are on (0 is the first)
  let timer = 0;        // time left in a break or a pause
  let toSpawn = 0;      // Gloomlings of this wave that have not appeared yet
  let spawnTimer = 0;
  let spawned = 0;      // Gloomlings that have appeared since the start
  let ending = '';      // 'won' or 'lost', announced when the pause is over

  // Puts one Gloomling on the rim, away from the hero so it never appears on top of them.
  function spawnOne() {
    let best = null;
    for (let tries = 0; tries < 6; tries++) {
      const angle = Math.random() * Math.PI * 2;
      const x = Math.cos(angle) * SPAWN_RADIUS;
      const z = Math.sin(angle) * SPAWN_RADIUS;
      const away = Math.hypot(x - hero.position.x, z - hero.position.z);
      if (!best || away > best.away) best = { x, z, away };
      if (away > 7) break;
    }
    const kinds = plan.types[wave];   // this wave's types, taken in turn
    const gloom = createGloomling({ scene, x: best.x, z: best.z, type: kinds[(plan.sizes[wave] - toSpawn) % kinds.length], power: enemyPower(wave) });
    gloomlings.push(gloom);
    spawned++;
    if (events.spawn) events.spawn(gloom);
  }

  // The boss calls Gloomlings round him.
  function summonAdds(count, x, z) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random();
      const gloom = createGloomling({ scene, x: x + Math.sin(angle) * 3.2, z: z + Math.cos(angle) * 3.2, type: 'nature', power: enemyPower(Math.max(0, plan.sizes.length - 1)) });
      gloomlings.push(gloom);
      if (events.spawn) events.spawn(gloom);
    }
    return count;
  }

  // The boss rises to one side of the hero (so he is in the picture, tall as he is). He stays on the list of enemies until he has
  // faded away, so the round does not end before his last words; when he falls, the Gloomlings he called vanish.
  function beginBoss() {
    state = 'fighting';
    toSpawn = 0;
    let x = hero.position.x + (hero.position.x > 0 ? -5.5 : 5.5);
    let z = hero.position.z;
    const out = Math.hypot(x, z);
    if (out > 9.5) { x *= 9.5 / out; z *= 9.5 / out; }
    boss = createBoss({
      scene, kind: plan.boss, x, z, power: enemyPower(wave), emit,
      events: {
        ...bossEvents,
        summon: summonAdds,
        down: (b) => {
          for (let i = gloomlings.length - 1; i >= 0; i--) {
            const g = gloomlings[i];
            if (g === b) continue;
            for (let k = 0; k < 4; k++) emit(g.position.x, 0.6, g.position.z, (Math.random() - 0.5) * 5, 1 + Math.random() * 3, (Math.random() - 0.5) * 5, 0.6, 0.18, 0x8a5ad8, -6);
            g.remove();
            gloomlings.splice(i, 1);
          }
          if (bossEvents.down) bossEvents.down(b);
        },
        fallen: (b) => { if (bossEvents.fallen) bossEvents.fallen(b); else b.finish(); },   // (nobody to talk: he fades at once)
        gone: (b) => {
          const i = gloomlings.indexOf(b);
          if (i >= 0) gloomlings.splice(i, 1);
          if (bossEvents.gone) bossEvents.gone(b);
        },
      },
    });
    gloomlings.push(boss);
    if (events.wave) events.wave(wave + 1, total, { boss });
  }

  function beginWave() {
    if (plan.boss && wave === plan.sizes.length) { beginBoss(); return; }
    state = 'spawning';
    toSpawn = plan.sizes[wave];
    spawnTimer = 0;
    if (events.wave) events.wave(wave + 1, total);
  }

  function finishWave() {
    if (events.cleared) events.cleared(wave + 1);
    if (wave + 1 >= total) {
      state = 'won';
      ending = 'won';
      timer = WIN_DELAY;
    } else {
      wave++;
      state = 'break';
      timer = WAVES.breakTime;
    }
  }

  // Called every frame.
  function update(dt) {
    if (state === 'idle' || state === 'over') return;
    if (state === 'won' || state === 'lost') {
      timer -= dt;
      if (timer <= 0) {
        state = 'over';
        if (events.end) events.end(ending);
      }
      return;
    }
    if (hero.down) {
      state = 'lost';
      ending = 'lost';
      timer = LOSE_DELAY;
      return;
    }
    if (state === 'break') {
      timer -= dt;
      if (timer <= 0) beginWave();
    } else if (state === 'spawning') {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnOne();
        toSpawn--;
        spawnTimer = WAVES.spawnGap;
        if (toSpawn === 0) state = 'fighting';
      }
    }
    if (state === 'fighting' && gloomlings.length === 0) finishWave();
  }

  // Removes every Gloomling and goes back to the beginning (but does not start).
  function reset() {
    for (const gloom of gloomlings) gloom.remove();
    gloomlings.length = 0;
    state = 'idle';
    wave = 0;
    toSpawn = 0;
    spawned = 0;
    boss = null;
  }

  // Starts a fresh round from wave 1 (with the waves of "round", if one is given), or, after a defeat by the boss, at the boss.
  function start(round = null, atBoss = false) {
    plan = round ? { sizes: round.sizes, types: round.types, boss: round.boss } : WAVES;
    total = wavesOf(plan);
    everyone = countOf(plan);
    reset();
    if (atBoss && plan.boss) wave = plan.sizes.length;
    state = 'break';
    timer = START_DELAY;
  }

  return {
    start, reset, update,
    get state() { return state; },
    get wave() { return wave + 1; },                           // the current wave, counting from 1 (the coming one during a break)
    get total() { return total; },
    get enemyPower() { return enemyPower(wave); },   // the Gloomling Power of the wave now (or about to) be fought
    get remaining() { return toSpawn + gloomlings.length; },   // Gloomlings still to beat in this wave
    get atBoss() { return Boolean(plan.boss) && wave === plan.sizes.length && state !== 'idle'; },   // the boss wave is on (or was when the round was lost)
    get boss() { return boss && !boss.gone ? boss : null; },   // the boss, while he is on the island
    get progress() {   // 0 to 1: how much of the whole round is beaten (the boss counts for his health taken)
      const left = gloomlings.filter((g) => !g.boss).length;
      return Math.min(1, Math.max(0, (spawned - left + (boss ? (1 - boss.health / boss.maxHealth) * BOSS_SHARE : 0)) / everyone));
    },
  };
}
