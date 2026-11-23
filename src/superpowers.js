// superpowers.js: each hero's superpower (Flame Wave, Starburst, Big Splash, Lightning Dash). powers.js hands over a "ctx" with everything a superpower needs:
// { scene, hero, gloomlings, sparks, nearest(maxDistance), damage(gloom, amount, pushX, pushZ, kind) }.
// Every superpower is { cast(), update(dt), reset() }.
import * as THREE from '../lib/three.module.min.js';

const WAVE_SPEED = 30;    // how fast the front of the Flame Wave spreads out (units per second)
const WAVE_LIFE = 0.5;    // how long the flames last (seconds)
const BURST_SPEED = 15;   // how fast the ring of a Starburst spreads out
const BURST_LIFE = 0.5;   // how long a Starburst lasts
const FLAME_COLORS = [0xff4b1f, 0xff8a1f, 0xffc933];                // red, orange, yellow
const STAR_COLORS = [0xffffff, 0xfff2b0, 0xffd84a, 0xfff6c8];       // white and golds
const WATER_COLORS = [0xffffff, 0xbfeaff, 0x7fd0ff, 0x4fb4ff];      // white and blues
const BOLT_COLORS = [0xffffff, 0xfff59a, 0xffe14a, 0x9fd0ff];       // white, yellows and a flash of blue
const DASH_TIME = 0.2;    // how long Lightning Dash takes to zip the whole way (seconds)

const random = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const angleBetween = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));   // the short way round, from -pi to pi

// How far a point is from a line segment. A fast shot, or a dash, can never skip over a Gloomling between two frames.
export function distanceToSegment(px, pz, ax, az, bx, bz) {
  const sx = bx - ax, sz = bz - az;
  const lengthSquared = sx * sx + sz * sz;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * sx + (pz - az) * sz) / lengthSquared));
  return Math.hypot(px - (ax + sx * t), pz - (az + sz * t));
}

// Ember: Flame Wave, a cone of fire in front of her.
function createFlameWave(power, ctx) {
  const { scene, hero, gloomlings, sparks, nearest, damage } = ctx;
  const half = THREE.MathUtils.degToRad(power.angle / 2);   // half the width of the cone
  let wave = null;                                          // the Flame Wave that is spreading out right now, if any

  // Look: two flat fans on the ground, a big orange one with a smaller yellow one on top.
  const fan = new THREE.Group();
  const fans = [
    { shape: new THREE.CircleGeometry(1, 28, -half, half * 2), color: 0xff6a1f, opacity: 0.7, size: 1 },
    { shape: new THREE.CircleGeometry(1, 28, -half * 0.7, half * 1.4), color: 0xffd34a, opacity: 0.85, size: 0.82 },
  ].map(({ shape, color, opacity, size }, i) => {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(shape, material);
    mesh.rotation.x = -Math.PI / 2;   // lay it flat on the ground
    mesh.position.y = i * 0.01;
    fan.add(mesh);
    return { mesh, material, opacity, size };
  });
  fan.visible = false;
  scene.add(fan);

  function cast() {
    const target = nearest(power.length + 1);   // it aims at the nearest Gloomling, or straight ahead if none is close
    const aim = target ? Math.atan2(target.position.x - hero.position.x, target.position.z - hero.position.z) : hero.yaw;
    hero.face(aim);
    wave = { x: hero.position.x, z: hero.position.z, aim, age: 0, hit: new Set() };
    fan.visible = true;
    for (let i = 0; i < 20; i++) {   // a burst of flames at the hands
      const a = aim + random(-half, half);
      sparks.emit(wave.x + Math.sin(a) * 0.6, random(0.5, 1.2), wave.z + Math.cos(a) * 0.6, Math.sin(a) * random(3, 8), random(0.5, 2), Math.cos(a) * random(3, 8), random(0.25, 0.45), random(0.25, 0.4), pick(FLAME_COLORS));
    }
  }

  function update(dt) {
    if (!wave) return;
    wave.age += dt;
    const life = wave.age / WAVE_LIFE;
    if (life >= 1) { wave = null; fan.visible = false; return; }
    const reach = Math.min(power.length, WAVE_SPEED * wave.age);

    // Hurt every Gloomling the front of the flames has reached, once each.
    for (const g of [...gloomlings]) {
      if (!g.alive || wave.hit.has(g)) continue;
      const dx = g.position.x - wave.x;
      const dz = g.position.z - wave.z;
      const distance = Math.hypot(dx, dz) || 0.001;
      if (distance > reach + g.radius) continue;
      const slack = Math.atan(g.radius / Math.max(distance, 0.5));   // a Gloomling is a little wider than its centre point
      if (Math.abs(angleBetween(Math.atan2(dx, dz), wave.aim)) > half + slack) continue;
      wave.hit.add(g);
      damage(g, power.damage, (dx / distance) * power.push, (dz / distance) * power.push, 'big');
    }

    // Flames rising out of the ground inside the cone.
    if (life < 0.8) {
      for (let i = 0; i < 9; i++) {
        const a = wave.aim + random(-half, half) * 0.95;
        const r = Math.sqrt(Math.random()) * reach;
        sparks.emit(wave.x + Math.sin(a) * r, random(0.15, 0.7), wave.z + Math.cos(a) * r, Math.sin(a) * random(1, 4), random(1.5, 4), Math.cos(a) * random(1, 4), random(0.35, 0.6), random(0.3, 0.55), pick(FLAME_COLORS));
      }
    }

    // The flat fans on the ground grow with the front, then fade.
    fan.position.set(wave.x, 0.06, wave.z);
    fan.rotation.y = Math.atan2(-Math.cos(wave.aim), Math.sin(wave.aim));   // turns the fan to point along the aim
    for (const f of fans) {
      f.mesh.scale.set(reach * f.size, reach * f.size, 1);
      f.material.opacity = f.opacity * (1 - life) * (1 - life * 0.3);
    }
  }

  function reset() {
    wave = null;
    fan.visible = false;
  }

  return { cast, update, reset };
}

// A ring that bursts out around the hero in every direction (no aiming needed). Sol's Starburst (light) and Tide's
// Big Splash (water, which also soaks) are both rings; "look" says what colours they are.
const RINGS = {
  starburst: { disc: 0xfff0b0, ring: 0xffffff, column: 0xfff6c8, colors: STAR_COLORS, gravity: 0 },
  bigsplash: { disc: 0x9fe0ff, ring: 0xe8f9ff, column: 0xbfeaff, colors: WATER_COLORS, gravity: -6 },
};

function createRing(power, ctx) {
  const { scene, hero, gloomlings, sparks, damage } = ctx;
  const look = RINGS[power.id];
  let burst = null;   // the ring that is spreading out right now, if any

  // Look: a pale disc and a bright ring on the ground, plus a column of light where the hero stands.
  const flat = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: look.disc, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 64), new THREE.MeshBasicMaterial({ color: look.ring, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
  disc.rotation.x = -Math.PI / 2;
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  flat.add(disc, ring);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.45, 7, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: look.column, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
  );
  flat.visible = false;
  column.visible = false;
  scene.add(flat, column);

  function cast() {
    burst = { x: hero.position.x, z: hero.position.z, age: 0, hit: new Set() };
    flat.visible = true;
    column.visible = true;
    for (let i = 0; i < 36; i++) {   // rays of light (or spray) shooting outward
      const a = (i / 36) * Math.PI * 2;
      const speed = random(7, 11);
      sparks.emit(burst.x + Math.sin(a) * 0.5, random(0.3, 0.9), burst.z + Math.cos(a) * 0.5, Math.sin(a) * speed, random(0.5, 2.5), Math.cos(a) * speed, random(0.35, 0.55), random(0.18, 0.3), pick(look.colors), look.gravity);
    }
  }

  function update(dt) {
    if (!burst) return;
    burst.age += dt;
    const life = burst.age / BURST_LIFE;
    if (life >= 1) { burst = null; flat.visible = false; column.visible = false; return; }
    const reach = Math.min(power.radius, BURST_SPEED * burst.age);

    // Hurt every Gloomling the ring has reached, once each, and shove it outward (and soak it, for a Big Splash).
    for (const g of [...gloomlings]) {
      if (!g.alive || burst.hit.has(g)) continue;
      const dx = g.position.x - burst.x;
      const dz = g.position.z - burst.z;
      const distance = Math.hypot(dx, dz) || 0.001;
      if (distance > reach + g.radius) continue;
      burst.hit.add(g);
      damage(g, power.damage, (dx / distance) * power.push, (dz / distance) * power.push, 'big');
      if (power.soak && g.alive) g.soak(power.soak);
    }

    // Little stars (or droplets) rising out of the ground inside the ring.
    if (life < 0.7) {
      for (let i = 0; i < 3; i++) {
        const a = random(0, Math.PI * 2);
        const r = Math.sqrt(Math.random()) * reach;
        sparks.emit(burst.x + Math.sin(a) * r, 0.2, burst.z + Math.cos(a) * r, 0, random(1.5, 3.5), 0, random(0.4, 0.7), random(0.12, 0.2), pick(look.colors), look.gravity);
      }
    }

    flat.position.set(burst.x, 0.06, burst.z);
    flat.scale.setScalar(Math.max(reach, 0.01));
    disc.material.opacity = 0.5 * (1 - life);
    ring.material.opacity = 0.95 * (1 - life * life);
    column.position.set(burst.x, 3.5, burst.z);
    column.scale.set(0.6 + life, 1, 0.6 + life);
    column.material.opacity = 0.55 * (1 - life) * (1 - life);
  }

  function reset() {
    burst = null;
    flat.visible = false;
    column.visible = false;
  }

  return { cast, update, reset };
}

// Volt: Lightning Dash. Volt zips forward in a flash and shocks everything within reach of the path.
function createDash(power, ctx) {
  const { scene, hero, gloomlings, sparks, nearest, damage } = ctx;
  let dash = null;   // the dash that is happening right now, if any

  // Look: a glowing streak on the ground along the path.
  const group = new THREE.Group();
  const streak = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xfff08a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  streak.rotation.x = -Math.PI / 2;
  group.add(streak);
  group.visible = false;
  scene.add(group);

  function cast() {
    const target = nearest(power.length + 2);   // it aims at the nearest Gloomling, or straight ahead if none is close
    const aim = target ? Math.atan2(target.position.x - hero.position.x, target.position.z - hero.position.z) : hero.yaw;
    hero.face(aim);
    dash = { fromX: hero.position.x, fromZ: hero.position.z, aim, age: 0, travelled: 0, hit: new Set() };
    group.visible = true;
  }

  function update(dt) {
    if (!dash) return;
    dash.age += dt;
    const dx = Math.sin(dash.aim);
    const dz = Math.cos(dash.aim);
    const step = Math.min(power.length - dash.travelled, (power.length / DASH_TIME) * dt);   // zips a little further each frame
    hero.position.x += dx * step;
    hero.position.z += dz * step;
    dash.travelled += step;
    const x = hero.position.x;
    const z = hero.position.z;

    // Shock everything near the path so far, once each.
    for (const g of [...gloomlings]) {
      if (!g.alive || dash.hit.has(g)) continue;
      if (distanceToSegment(g.position.x, g.position.z, dash.fromX, dash.fromZ, x, z) > power.width / 2 + g.radius) continue;
      dash.hit.add(g);
      damage(g, power.damage, dx * power.push, dz * power.push, 'big');
    }

    // Crackling lightning along the way.
    if (step > 0) {
      for (let i = 0; i < 5; i++) {
        sparks.emit(x - dx * random(0, 1.2) + random(-0.5, 0.5), random(0.3, 1.3), z - dz * random(0, 1.2) + random(-0.5, 0.5), random(-1, 1), random(0, 2), random(-1, 1), random(0.2, 0.4), random(0.12, 0.24), pick(BOLT_COLORS));
      }
    }
    const length = Math.max(0.5, dash.travelled);
    group.position.set(dash.fromX + dx * length / 2, 0.07, dash.fromZ + dz * length / 2);
    group.rotation.y = dash.aim;
    streak.scale.set(power.width * 0.7, length, 1);
    const fade = Math.max(0, 1 - Math.max(0, dash.age - DASH_TIME) / 0.3);
    streak.material.opacity = 0.75 * fade;
    if (dash.travelled >= power.length - 1e-6 && fade === 0) { dash = null; group.visible = false; }
  }

  function reset() {
    dash = null;
    group.visible = false;
  }

  return { cast, update, reset };
}

// "power" is the superpower's numbers from heroes-data.js.
export function createSuperpower(power, ctx) {
  if (power.id === 'flamewave') return createFlameWave(power, ctx);
  if (power.id === 'starburst' || power.id === 'bigsplash') return createRing(power, ctx);
  if (power.id === 'lightningdash') return createDash(power, ctx);
  throw new Error(`Unknown superpower: ${power.id}`);
}
