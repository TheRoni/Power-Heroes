// hero.js: Ember, the first hero. She is built from simple shapes, moved by the player's input, and can be hurt.
import * as THREE from '../lib/three.module.min.js';
import { EMBER } from './heroes-data.js';
import { createFloatingBar } from './ui.js';

// Feel settings: change these numbers to change how Ember moves.
const MAX_SPEED = 7;       // top running speed, in game units per second
const SPEED_UP = 14;       // how quickly she reaches full speed (higher = snappier)
const SLOW_DOWN = 9;       // how quickly she stops when you let go (lower = a longer slide)
const TURN_SPEED = 16;     // how quickly she turns to face where she is going
const HOP_HEIGHT = 0.17;   // how high each running step bounces her

const STILL = { x: 0, z: 0 };   // "no push", used while she is knocked out
const lambert = (color) => new THREE.MeshLambertMaterial({ color });
const part = (geometry, material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
};

// Her flame-shaped hair, one row per flame:
// [x, y, z, width, height, tilt forward/back, tilt sideways, colour number]
const FLAMES = [
  [0, 1.62, 0.02, 0.19, 0.62, 0, 0, 1],
  [0.2, 1.6, 0.05, 0.14, 0.46, 0, -0.5, 0],
  [-0.2, 1.6, 0.05, 0.14, 0.46, 0, 0.5, 0],
  [0, 1.58, -0.22, 0.17, 0.55, -0.55, 0, 0],
  [0.24, 1.52, -0.14, 0.14, 0.42, -0.3, -0.7, 1],
  [-0.24, 1.52, -0.14, 0.14, 0.42, -0.3, 0.7, 1],
  [0, 1.64, 0.2, 0.12, 0.3, 0.5, 0, 2],
  [0.33, 1.4, -0.02, 0.1, 0.34, 0, -1.1, 0],
  [-0.33, 1.4, -0.02, 0.1, 0.34, 0, 1.1, 0],
];
const FLAME_COLORS = [0xff4b1f, 0xff8a1f, 0xffc933];   // red, orange, yellow

// "scene" is where she is added. "bound" is how far from the middle of the island she may walk.
// onHurt(amount) is called when she is hit. onDown() is called when she is knocked out.
export function createHero({ scene, bound, onHurt, onDown }) {
  const group = new THREE.Group();   // this part moves and turns
  const body = new THREE.Group();    // this part leans, hops and squashes inside it
  group.add(body);

  const skin = lambert(0xffd3b0), jacket = lambert(0xe8452c), gold = lambert(0xffb42e);
  const boot = lambert(0x6b2d1f), ink = lambert(0x2b1a1a), white = lambert(0xffffff), blush = lambert(0xff9a8a);
  const flashMaterials = [skin, jacket, gold, boot, ink, white, blush];   // these glow white for a moment when she is hit
  const ball = new THREE.SphereGeometry(1, 14, 10);   // one round shape, stretched into eyes, cheeks, boots and hands

  // Torso, belt and head.
  body.add(part(new THREE.CapsuleGeometry(0.3, 0.28, 6, 14), jacket, 0, 0.62, 0));
  const belt = part(new THREE.TorusGeometry(0.3, 0.045, 8, 24), gold, 0, 0.5, 0);
  belt.rotation.x = Math.PI / 2;
  body.add(belt, part(new THREE.SphereGeometry(0.4, 20, 16), skin, 0, 1.3, 0));

  // Face: eyes with a shine, rosy cheeks, and a smile.
  for (const side of [-1, 1]) {
    const eye = part(ball, ink, side * 0.15, 1.3, 0.372);
    eye.scale.set(0.065, 0.095, 0.04);
    const shine = part(ball, white, side * 0.17, 1.34, 0.41);
    shine.scale.setScalar(0.025);
    const cheek = part(ball, blush, side * 0.25, 1.2, 0.3);
    cheek.scale.set(0.07, 0.045, 0.02);
    body.add(eye, shine, cheek);
  }
  const smile = part(new THREE.TorusGeometry(0.08, 0.014, 6, 14, Math.PI), ink, 0, 1.2, 0.375);
  smile.rotation.z = Math.PI;   // flips the arc so it curves up
  body.add(smile);

  // Scarf: a collar, plus a tail that streams out behind her when she runs.
  const collar = part(new THREE.TorusGeometry(0.3, 0.075, 8, 20), gold, 0, 1.0, 0);
  collar.rotation.x = Math.PI / 2;
  const tail = new THREE.Group();
  tail.position.set(0, 1.0, -0.28);
  tail.add(part(new THREE.BoxGeometry(0.2, 0.05, 0.55), gold, 0, 0, -0.27));
  body.add(collar, tail);

  // Arms (left, then right) swing from the shoulders. Feet (left, then right) swing from the hips.
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.34, 0.9, 0);
    arm.rotation.z = side * 0.3;
    const hand = part(ball, skin, 0, -0.36, 0);
    hand.scale.setScalar(0.09);
    arm.add(part(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), jacket, 0, -0.17, 0), hand);
    body.add(arm);
    return arm;
  });
  const feet = [-1, 1].map((side) => {
    const foot = part(ball, boot, side * 0.14, 0.14, 0.04);
    foot.scale.set(0.15, 0.12, 0.21);
    body.add(foot);
    return foot;
  });

  // Flame hair. Each flame pivots from its base so it can flicker.
  const flameMaterials = FLAME_COLORS.map((color) => new THREE.MeshBasicMaterial({ color }));
  const flames = FLAMES.map(([x, y, z, width, height, tiltX, tiltZ, colour], i) => {
    const shape = new THREE.ConeGeometry(width, height, 6).translate(0, height / 2, 0);
    const flame = part(shape, flameMaterials[colour], x, y, z);
    body.add(flame);
    return { flame, tiltX, tiltZ, phase: i * 1.7 };
  });

  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  const bar = createFloatingBar(1.1, 0x8dff52);   // her health bar, floating over her head
  scene.add(group, bar.group);

  const velocity = { x: 0, z: 0 };   // how fast she is moving right now (the camera reads this too)
  let yaw = 0;                       // which way she faces
  let stride = 0;                    // where she is in her running step
  let health = EMBER.health;
  let invulnerable = 0;              // seconds of protection left after a hit
  let flash = 0;                     // white flash when hit
  let down = false;                  // knocked out
  let fall = 0;                      // 0 = standing, 1 = lying down

  // Called every frame. "input" is the direction from input.js; "dt" is the time since the last frame.
  function update(dt, input, time) {
    invulnerable = Math.max(0, invulnerable - dt);
    flash = Math.max(0, flash - dt * 5);
    fall = Math.min(1, Math.max(0, fall + (down ? dt * 4 : -dt * 4)));
    const move = down ? STILL : input;   // a knocked-out Ember ignores the controls

    // 1. Speed up toward the direction being pushed, or slow down when the push stops.
    const pushing = Math.hypot(move.x, move.z) > 0.01;
    const k = 1 - Math.exp(-(pushing ? SPEED_UP : SLOW_DOWN) * dt);
    velocity.x += (move.x * MAX_SPEED - velocity.x) * k;
    velocity.z += (move.z * MAX_SPEED - velocity.z) * k;

    // 2. Move, and stay on the island. At the edge she slides along it instead of sticking.
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

    feet.forEach((foot, i) => {
      const s = stride + i * Math.PI;
      foot.position.z = 0.04 + Math.sin(s) * 0.2 * run;
      foot.position.y = 0.14 + Math.max(0, Math.cos(s)) * 0.12 * run;
    });
    arms.forEach((arm, i) => { arm.rotation.x = (i === 0 ? 1 : -1) * Math.sin(stride) * 0.9 * run; });
    for (const f of flames) {
      f.flame.scale.y = (1 + Math.sin(time * 9 + f.phase) * 0.12) * (1 - fall * 0.75);   // flames shrink when she is out
      f.flame.rotation.x = f.tiltX - run * 0.4;   // flames stream backwards as she runs
      f.flame.rotation.z = f.tiltZ + Math.sin(time * 6 + f.phase) * 0.06;
    }
    tail.rotation.x = -0.45 + run * 1.1 + Math.sin(time * 14) * 0.08 * run;
    tail.rotation.y = Math.sin(time * 9) * 0.25 * run;

    for (const material of flashMaterials) material.emissive.setScalar(flash * 0.8);
    bar.group.position.set(p.x, 2.6, p.z);
    bar.set(health / EMBER.health);
  }

  // Gloomlings call this when they bump her. "fromX, fromZ" is where the hit came from.
  // Returns true if the hit landed (she is protected for a moment after each hit).
  function takeHit(amount, fromX, fromZ) {
    if (down || invulnerable > 0) return false;
    health = Math.max(0, health - amount);
    invulnerable = EMBER.invulnerable;
    flash = 1;
    const dx = group.position.x - fromX;
    const dz = group.position.z - fromZ;
    const away = Math.hypot(dx, dz) || 1;
    velocity.x += (dx / away) * 5;   // a small shove away from whatever hit her
    velocity.z += (dz / away) * 5;
    if (onHurt) onHurt(amount);
    if (health <= 0) {
      down = true;
      if (onDown) onDown();
    }
    return true;
  }

  // Starts over: full health, standing up, back in the middle.
  function reset() {
    health = EMBER.health;
    down = false;
    fall = 0;
    invulnerable = 0;
    flash = 0;
    group.position.set(0, 0, 0);
    velocity.x = 0;
    velocity.z = 0;
  }

  return {
    group, position: group.position, velocity, update, takeHit, reset,
    get health() { return health; },
    get maxHealth() { return EMBER.health; },
    get down() { return down; },
    get yaw() { return yaw; },
  };
}
