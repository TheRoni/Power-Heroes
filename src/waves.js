// waves.js: the wave director. It decides when Gloomlings appear, announces each wave, and ends the round.
import { createGloomling } from './gloom.js';
import { WAVES } from './heroes-data.js';

const SPAWN_RADIUS = 10.8;   // Gloomlings appear on the rim of the island
const START_DELAY = 0.6;     // a short pause before the first wave
const WIN_DELAY = 1.2;       // after the last Gloomling falls: a moment to enjoy it before the win screen
const LOSE_DELAY = 1.5;      // after Ember is knocked out: a moment before the knocked-out screen

// "gloomlings" is the live list shared with main.js and powers.js. New Gloomlings are added to it here.
// events (all optional): wave(number, total) when a wave starts, spawn(gloom), cleared(number), end('won' or 'lost').
export function createWaves({ scene, hero, gloomlings, events = {} }) {
  const total = WAVES.sizes.length;
  const everyone = WAVES.sizes.reduce((sum, size) => sum + size, 0);
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
    const gloom = createGloomling({ scene, x: best.x, z: best.z });
    gloomlings.push(gloom);
    spawned++;
    if (events.spawn) events.spawn(gloom);
  }

  function beginWave() {
    state = 'spawning';
    toSpawn = WAVES.sizes[wave];
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
  }

  // Starts a fresh round from wave 1.
  function start() {
    reset();
    state = 'break';
    timer = START_DELAY;
  }

  return {
    start, reset, update,
    get state() { return state; },
    get wave() { return wave + 1; },                           // the current wave, counting from 1 (the coming one during a break)
    get total() { return total; },
    get remaining() { return toSpawn + gloomlings.length; },   // Gloomlings still to beat in this wave
    get progress() { return Math.max(0, (spawned - gloomlings.length) / everyone); },   // 0 to 1: how much of the whole round is beaten
  };
}
