// hero.js: a hero. The look comes from hero-models.js and the numbers from heroes-data.js.
// This file moves the hero, animates the running, and keeps track of health.
import * as THREE from '../lib/three.module.min.js';
import { HEROES } from './heroes-data.js';
import { buildHeroModel } from './hero-models.js';
import { createFloatingBar } from './ui.js';
import { strength } from './power.js';

// Feel settings: change these numbers to change how heroes move.
const MAX_SPEED = 7;       // top running speed, in game units per second
const SPEED_UP = 14;       // how quickly a hero reaches full speed (higher = snappier)
const SLOW_DOWN = 9;       // how quickly a hero stops when you let go (lower = a longer slide)
const TURN_SPEED = 16;     // how quickly a hero turns to face where they are going
const HOP_HEIGHT = 0.17;   // how high each running step bounces

const STILL = { x: 0, z: 0 };   // "no push", used while knocked out

// "kind" is which hero (a key in heroes-data.js). "scene" is where the hero is added. "bound" is how far from
// the middle of the island they may walk. onHurt(amount) is called when hit. onDown() is called when knocked out.
// showBar = false makes a hero with no health bar (a guest). "shared" ({ position, velocity }) makes the hero stand where
// the rest of a squad stands, so swapping heroes needs no moving about.
export function createHero({ scene, bound, kind = 'sol', onHurt, onDown, showBar = true, shared = null }) {
  const data = HEROES[kind];
  const model = buildHeroModel(kind);
  const group = new THREE.Group();   // this part moves and turns
  if (shared) Object.defineProperty(group, 'position', { value: shared.position });
  const body = model.body;           // this part leans, hops and squashes inside it
  group.add(body);
  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  const bar = createFloatingBar(1.1, 0x8dff52);   // the health bar, floating over the hero's head
  scene.add(group, bar.group);

  const velocity = shared ? shared.velocity : { x: 0, z: 0 };   // how fast the hero is moving right now (the camera reads this too)
  let yaw = 0;                       // which way the hero faces
  let stride = 0;                    // where the hero is in the running step
  let power = 10;                    // the hero's Power (see power.js): health and damage are multiplied by Power / 10
  const maxHealth = () => Math.round(data.health * strength(power));
  let health = maxHealth();
  let invulnerable = 0;              // seconds of protection left after a hit
  let flash = 0;                     // white flash when hit
  let down = false;                  // knocked out
  let fall = 0;                      // 0 = standing, 1 = lying down

  // Called every frame. "input" is the direction from input.js; "dt" is the time since the last frame.
  function update(dt, input, time) {
    invulnerable = Math.max(0, invulnerable - dt);
    flash = Math.max(0, flash - dt * 5);
    fall = Math.min(1, Math.max(0, fall + (down ? dt * 4 : -dt * 4)));
    const move = down ? STILL : input;   // a knocked-out hero ignores the controls

    // 1. Speed up toward the direction being pushed, or slow down when the push stops.
    const pushing = Math.hypot(move.x, move.z) > 0.01;
    const k = 1 - Math.exp(-(pushing ? SPEED_UP : SLOW_DOWN) * dt);
    velocity.x += (move.x * MAX_SPEED - velocity.x) * k;
    velocity.z += (move.z * MAX_SPEED - velocity.z) * k;

    // 2. Move, and stay on the island. At the edge the hero slides along it instead of sticking.
    const p = group.position;
    p.x += velocity.x * dt;
    p.z += velocity.z * dt;
    const distance = Math.hypot(p.x, p.z);
    if (distance > bound) {
      const nx = p.x / distance, nz = p.z / distance;
      p.x = nx * bound;
      p.z = nz * bound;
      const outward = velocity.x * nx + velocity.z * nz;
      if (outward > 0) { velocity.x -= outward * nx; velocity.z -= outward * nz; }
    }

    // 3. Turn to face the direction being pushed (taking the short way round).
    if (pushing) {
      const target = Math.atan2(move.x, move.z);
      const difference = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
      yaw += difference * (1 - Math.exp(-TURN_SPEED * dt));
    }
    group.rotation.y = yaw;

    // 4. Animate. "run" is 0 when standing still and 1 at full speed.
    const speed = Math.hypot(velocity.x, velocity.z);
    const run = Math.min(speed / MAX_SPEED, 1);
    stride += dt * (2 + speed * 1.6);
    const hop = Math.abs(Math.sin(stride));
    const stretch = (hop - 0.5) * 0.1 * run + Math.sin(time * 2.4) * 0.015 * (1 - run);   // taller in the air, squashed on landing, breathing when still
    body.position.y = hop * HOP_HEIGHT * run * (1 - fall);
    body.scale.set(1 - stretch * 0.5, 1 + stretch, 1 - stretch * 0.5);
    body.rotation.x = run * 0.2 - fall * 1.5;   // leans forward when running, tips over backwards when knocked out

    model.feet.forEach((foot, i) => {
      const s = stride + i * Math.PI;
      foot.position.z = 0.04 + Math.sin(s) * 0.2 * run;
      foot.position.y = 0.14 + Math.max(0, Math.cos(s)) * 0.12 * run;
    });
    model.arms.forEach((arm, i) => { arm.rotation.x = (i === 0 ? 1 : -1) * Math.sin(stride) * 0.9 * run; });
    model.animate(time, run, fall);   // the parts only this hero has: flames, cape, motes of light

    for (const material of model.materials) material.emissive.setScalar(flash * 0.8);
    bar.group.position.set(p.x, 2.6, p.z);
    bar.set(health / maxHealth());
  }

  // Gloomlings call this when they bump the hero. "fromX, fromZ" is where the hit came from.
  // Returns true if the hit landed (the hero is protected for a moment after each hit).
  function takeHit(amount, fromX, fromZ) {
    if (down || invulnerable > 0) return false;
    health = Math.max(0, health - amount);
    invulnerable = data.invulnerable;
    flash = 1;
    const dx = group.position.x - fromX;
    const dz = group.position.z - fromZ;
    const away = Math.hypot(dx, dz) || 1;
    velocity.x += (dx / away) * 5;   // a small shove away from whatever hit
    velocity.z += (dz / away) * 5;
    if (onHurt) onHurt(amount);
    if (health <= 0) {
      down = true;
      if (onDown) onDown();
    }
    return true;
  }

  // Turns the hero to face a direction (used when a superpower aims at a Gloomling).
  function face(angle) {
    yaw = angle;
  }

  // Hides or shows the hero and their health bar (used while the story has them off stage).
  function setVisible(visible) {
    group.visible = visible;
    bar.group.visible = visible && showBar;
  }

  // Starts over: full health, standing up, back in the middle.
  function reset() {
    health = maxHealth();
    down = false;
    fall = 0;
    invulnerable = 0;
    flash = 0;
    group.position.set(0, 0, 0);
    velocity.x = 0;
    velocity.z = 0;
  }

  return {
    kind, name: data.name, type: data.type,
    group, position: group.position, velocity, update, takeHit, reset, face, setVisible,
    get health() { return health; },
    get maxHealth() { return maxHealth(); },
    get power() { return power; },
    // A new Power changes the health the hero can have; the share of health they have left stays the same.
    setPower(next) { const share = health / maxHealth(); power = next; health = Math.round(maxHealth() * share); },
    get down() { return down; },
    get yaw() { return yaw; },
  };
}

// A guest is a hero the game steers, not the player. It is hidden until it runs in, stops by someone, turns to face
// them and hops for joy. It has no health bar and cannot be hurt. Ember runs in like this at the end of Chapter 1.
const CHEER_TIME = 1.4;   // seconds of hopping after arriving

export function createGuest({ scene, bound, kind }) {
  const hero = createHero({ scene, bound, kind, showBar: false });
  const push = { x: 0, z: 0 };   // the "controls" the game presses for it
  let state = 'away';            // away (hidden), running, or here
  let goal = null;               // where it runs to
  let look = null;               // what it turns to face on arrival
  let cheer = 0;                 // seconds of hopping left
  hero.setVisible(false);

  // Appears at (fromX, fromZ), runs to (toX, toZ), then turns toward (lookX, lookZ).
  function runIn(fromX, fromZ, toX, toZ, lookX, lookZ) {
    hero.position.set(fromX, 0, fromZ);
    hero.face(Math.atan2(toX - fromX, toZ - fromZ));
    goal = { x: toX, z: toZ };
    look = { x: lookX, z: lookZ };
    state = 'running';
    hero.setVisible(true);
  }

  function leave() {
    hero.setVisible(false);
    hero.reset();
    state = 'away';
    goal = null;
    cheer = 0;
    hero.group.position.y = 0;
  }

  // Called every frame with the time that passed and the clock.
  function update(dt, time) {
    const p = hero.position;
    if (state === 'running') {
      const dx = goal.x - p.x;
      const dz = goal.z - p.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.25) {   // arrived: stand, face them, and cheer
        state = 'here';
        push.x = push.z = 0;
        hero.face(Math.atan2(look.x - p.x, look.z - p.z));
        cheer = CHEER_TIME;
      } else {
        const pace = Math.min(1, distance / 1.5);   // eases off near the end, so it does not overshoot
        push.x = (dx / distance) * pace;
        push.z = (dz / distance) * pace;
      }
    }
    hero.update(dt, push, time);
    cheer = Math.max(0, cheer - dt);
    hero.group.position.y = cheer > 0 ? Math.abs(Math.sin((CHEER_TIME - cheer) * 9)) * 0.3 : 0;
  }

  return {
    group: hero.group, position: hero.position, runIn, leave, update,
    get state() { return state; },
    get arrived() { return state === 'here'; },
  };
}
