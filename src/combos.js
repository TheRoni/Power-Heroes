// combos.js: power reactions. Two powers that meet can do something neither does alone.
// The first one: SHOCK CHAIN. A Storm hit on a soaked Gloomling (Big Splash soaks) jumps from wet Gloomling to wet Gloomling.
import { QUIET } from './audio.js';

const BOLT_COLORS = [0xffffff, 0xfff59a, 0xffe14a, 0x9fd0ff];   // white, yellows and a flash of blue
const CHAIN_RANGE = 4;     // a bolt can jump this far to the next wet Gloomling
const CHAIN_MAX = 3;       // and at most this many Gloomlings are shocked
const CHAIN_SHARE = 0.6;   // each one takes this share of the hit that started the chain...
const CHAIN_MIN = 6;       // ...but at least this much

const random = (min, max) => min + Math.random() * (max - min);

// "damage(gloom, amount, pushX, pushZ, kind)" hurts a Gloomling (powers.js). "sparks" is the pool of sparks. When a combo
// goes off, events.combo(name, count, gloom) says which one and how many Gloomlings it reached.
export function createCombos({ gloomlings, sparks, damage, audio = QUIET, events = {} }) {
  // A bolt of lightning from one spot to another: sparks that jitter along the line.
  function bolt(ax, az, bx, bz) {
    const length = Math.hypot(bx - ax, bz - az) || 1;
    const sideX = -(bz - az) / length;
    const sideZ = (bx - ax) / length;
    const steps = Math.max(6, Math.round(length * 3));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wobble = random(-0.35, 0.35);
      sparks.emit(ax + (bx - ax) * t + sideX * wobble, random(0.4, 1.3), az + (bz - az) * t + sideZ * wobble, random(-0.5, 0.5), random(0, 1), random(-0.5, 0.5), random(0.25, 0.45), random(0.14, 0.26), BOLT_COLORS[i % BOLT_COLORS.length]);
    }
  }

  // Called after every hit. "attacker" is the hero's type, "gloom" the Gloomling that was hit, "base" the damage before
  // types, and "kind" what sort of hit it was (a hit from a chain never starts another chain).
  function onHit(attacker, gloom, base, kind) {
    if (kind === 'chain' || attacker !== 'storm' || !(gloom.soaked > 0)) return;
    const reached = new Set([gloom]);
    let fromX = gloom.position.x;
    let fromZ = gloom.position.z;
    let count = 0;
    while (count < CHAIN_MAX) {   // the bolt jumps to the nearest wet Gloomling, then on to the next
      let next = null;
      let nearest = CHAIN_RANGE;
      for (const g of gloomlings) {
        if (reached.has(g) || !g.alive || !(g.soaked > 0)) continue;
        const d = Math.hypot(g.position.x - fromX, g.position.z - fromZ);
        if (d < nearest) { next = g; nearest = d; }
      }
      if (!next) break;
      reached.add(next);
      count++;
      bolt(fromX, fromZ, next.position.x, next.position.z);
      const away = Math.hypot(next.position.x - fromX, next.position.z - fromZ) || 1;
      const push = 1.2;   // a small shove, which also stuns for a moment
      const x = next.position.x;
      const z = next.position.z;
      damage(next, Math.max(CHAIN_MIN, Math.round(base * CHAIN_SHARE)), ((x - fromX) / away) * push, ((z - fromZ) / away) * push, 'chain');
      fromX = x;
      fromZ = z;
    }
    if (count > 0) {
      audio.play('shock');
      if (events.combo) events.combo('Shock Chain', count, gloom);
    }
  }

  return { onHit };
}
