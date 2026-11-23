// squad.js: the squad. Every hero is made once and waits, hidden; a squad of up to three is chosen from them.
// One hero is in play and the others wait on the bench. You can swap at any moment (a short cooldown stops spamming),
// and every hero keeps their own health and their own power recharge, even on the bench.
// The rest of the game talks to "player" and "powers" as if they were one hero and one set of powers: they always
// mean whoever is in play. A knocked-out hero sits out and the next one steps in; when everyone is out the round is lost.
import * as THREE from '../lib/three.module.min.js';
import { createHero } from './hero.js';
import { createPowers } from './powers.js';
import { HEROES } from './heroes-data.js';
import { TYPE_COLORS } from './types.js';
import { QUIET } from './audio.js';

const SWAP_COOLDOWN = 1.5;   // seconds before the next swap is allowed
const TAG_IN_DELAY = 0.6;    // seconds a knocked-out hero lies there before the next one steps in
const MAX_SQUAD = 3;

// "kinds" are the heroes to make (keys of heroes-data.js). "events" and "audio" are handed to every hero's powers.
// onHurt(amount, kind) and onDown(kind) say when the hero in play is bumped or knocked out. onSwap(kind, slot) says
// who is in play now. "gloomlings" is the list of living Gloomlings.
export function createSquad({ scene, bound, kinds = Object.keys(HEROES), gloomlings, events = {}, audio = QUIET, onHurt, onDown, onSwap }) {
  const shared = { position: new THREE.Vector3(), velocity: { x: 0, z: 0 } };   // one place and one speed for the whole squad
  const members = {};    // kind -> { kind, hero, powers }
  let roster = [];       // the kinds in the squad, in order
  let slot = 0;          // which place in the roster is in play
  let cooldown = 0;      // seconds until the next swap is allowed
  let fallen = 0;        // seconds until the next hero steps in for a knocked-out one (0 = nobody is waiting)
  let visible = true;
  let darts = true;      // the automatic shots (a lesson can switch them off)
  let sparks = null;     // one pool of sparks for everybody

  for (const kind of kinds) {
    const hero = createHero({
      scene, bound, kind, shared,
      onHurt: (amount) => { if (onHurt) onHurt(amount, kind); },
      onDown: () => {
        if (onDown) onDown(kind);
        if (roster.some((k) => !members[k].hero.down)) fallen = TAG_IN_DELAY;   // someone is left: they step in soon
      },
    });
    const powers = createPowers({ scene, hero, gloomlings, events, audio, sparks: sparks || undefined });   // the first one makes the pool, the others share it
    sparks = sparks || powers.sparks;
    hero.setVisible(false);
    members[kind] = { kind, hero, powers };
  }
  const all = Object.values(members);
  const current = () => members[roster[slot]];

  // Only the hero in play shoots, and only they are seen.
  function show(announce = true) {
    for (const m of all) {
      m.hero.setVisible(visible && m === current());
      m.powers.autoFire = darts && m === current();
    }
    if (announce && onSwap) onSwap(current().kind, slot);
  }

  // A puff in the hero's colour where they step in.
  function puff(kind) {
    const color = TYPE_COLORS[HEROES[kind].type].hex;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      sparks.emit(shared.position.x + Math.sin(a) * 0.4, 0.6, shared.position.z + Math.cos(a) * 0.4, Math.sin(a) * 4, 1 + Math.random() * 2, Math.cos(a) * 4, 0.5, 0.2, color, -3);
    }
  }

  // Swap to another place in the roster. Refused if it is the hero already in play, a knocked-out hero, or too soon.
  function swapTo(index, force = false) {
    const next = members[roster[index]];
    if (!next || index === slot || next.hero.down || (!force && cooldown > 0)) return false;
    next.hero.face(current().hero.yaw);
    slot = index;
    cooldown = SWAP_COOLDOWN;
    fallen = 0;
    show();
    puff(next.kind);
    audio.play('swap');
    return true;
  }

  // Everybody back to full health, in the middle, with the first hero in play.
  function reset() {
    for (const m of all) { m.hero.reset(); m.powers.reset(); }
    slot = 0;
    cooldown = 0;
    fallen = 0;
    show();
  }

  // Chooses the squad: up to three kinds, the first one is in play.
  function set(list) {
    roster = list.filter((kind) => members[kind]).slice(0, MAX_SQUAD);
    reset();
  }

  // The hero in play, as the rest of the game sees them.
  const player = {
    get position() { return shared.position; },
    get velocity() { return shared.velocity; },
    get group() { return current().hero.group; },
    get kind() { return current().kind; },
    get name() { return current().hero.name; },
    get type() { return current().hero.type; },
    get health() { return current().hero.health; },
    get maxHealth() { return current().hero.maxHealth; },
    get yaw() { return current().hero.yaw; },
    get down() { return roster.every((k) => members[k].hero.down); },   // the round is lost only when the whole squad is out
    update(dt, move, time) {
      cooldown = Math.max(0, cooldown - dt);
      if (fallen > 0) {
        fallen -= dt;
        if (fallen <= 0) {
          const next = roster.findIndex((k, i) => i !== slot && !members[k].hero.down);
          if (next >= 0) swapTo(next, true);
        }
      }
      current().hero.update(dt, move, time);
    },
    takeHit: (amount, fromX, fromZ) => current().hero.takeHit(amount, fromX, fromZ),
    face: (angle) => current().hero.face(angle),
    setVisible(on) { visible = on; current().hero.setVisible(on); },
    reset,
  };

  // Everybody's shots and superpowers keep going (and recharge) all the time; the buttons show the hero in play.
  const powers = {
    sparks,
    update(dt, time) { for (const m of all) m.powers.update(dt, time); },
    castPower: () => current().powers.castPower(),
    reset() { for (const m of all) m.powers.reset(); },
    get powerProgress() { return current().powers.powerProgress; },
    get powerReady() { return current().powers.powerReady; },
    get shotCount() { return all.reduce((sum, m) => sum + m.powers.shotCount, 0); },
    get autoFire() { return darts; },
    set autoFire(on) { darts = on; show(false); },
  };

  return {
    player, powers, set, swapTo, members,
    get roster() { return [...roster]; },
    get slot() { return slot; },
    get swapReady() { return cooldown <= 0; },
    get cooldown() { return cooldown / SWAP_COOLDOWN; },   // 1 right after a swap, down to 0
    // For the portraits: who is in the squad, how healthy, and who is out.
    get status() { return roster.map((kind, i) => ({ kind, health: members[kind].hero.health / members[kind].hero.maxHealth, down: members[kind].hero.down, active: i === slot, ready: members[kind].powers.powerReady })); },
  };
}
