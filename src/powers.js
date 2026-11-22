// powers.js: a hero's automatic attack (shots that fly at the nearest Gloomling), the damage rules, and the sparks.
// The superpower itself lives in superpowers.js.
import * as THREE from '../lib/three.module.min.js';
import { HEROES } from './heroes-data.js';
import { createSuperpower } from './superpowers.js';

const FLAME_COLORS = [0xff4b1f, 0xff8a1f, 0xffc933];                     // red, orange, yellow
const POP_COLORS = [0xff7ab8, 0xffe14a, 0x5ad8ff, 0x7dff52, 0xff9a3c];   // the colour that bursts out of a defeated Gloomling

// What an automatic shot looks like. "stretch" makes it long, like a dart.
const LOOKS = {
  fireball: { outer: 0xff7a1f, core: 0xffe28a, size: 0.26, coreSize: 0.14, stretch: 1, trail: FLAME_COLORS },
  dart: { outer: 0xfff0a8, core: 0xffffff, size: 0.17, coreSize: 0.1, stretch: 2.6, trail: [0xfff2b0, 0xffffff, 0xffe27a] },
};

const random = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// How far a point is from a line segment. Used so a fast shot can never skip over a Gloomling between two frames.
function distanceToSegment(px, pz, ax, az, bx, bz) {
  const sx = bx - ax, sz = bz - az;
  const lengthSquared = sx * sx + sz * sz;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * sx + (pz - az) * sz) / lengthSquared));
  return Math.hypot(px - (ax + sx * t), pz - (az + sz * t));
}

// A pool of tiny glowing balls, used for flames, hit sparks and the colour that pops out of defeated Gloomlings.
function createSparks(scene, capacity = 240) {
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }), capacity);
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const items = [];
  for (let i = 0; i < capacity; i++) {
    items.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0, gravity: 0 });
    mesh.setMatrixAt(i, hidden);
    mesh.setColorAt(i, color.set(0xffffff));
  }
  scene.add(mesh);
  let next = 0;

  // Launches one spark. A negative "gravity" makes it fall. It shrinks away over its "life".
  function emit(x, y, z, vx, vy, vz, life, size, hex, gravity = 0) {
    Object.assign(items[next], { x, y, z, vx, vy, vz, life, maxLife: life, size, gravity });
    mesh.setColorAt(next, color.set(hex));
    mesh.instanceColor.needsUpdate = true;
    next = (next + 1) % capacity;
  }

  function update(dt) {
    let changed = false;
    for (let i = 0; i < capacity; i++) {
      const s = items[i];
      if (s.life <= 0) continue;
      changed = true;
      s.life -= dt;
      if (s.life <= 0) { mesh.setMatrixAt(i, hidden); continue; }
      s.vy += s.gravity * dt;
      s.x += s.vx * dt;
      s.y = Math.max(0.05, s.y + s.vy * dt);
      s.z += s.vz * dt;
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.setScalar(s.size * (s.life / s.maxLife));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    if (changed) mesh.instanceMatrix.needsUpdate = true;
  }

  return { emit, update, get live() { return items.filter((s) => s.life > 0).length; } };
}

// "hero" is the hero (kind, position, yaw, down, face). "gloomlings" is the live list of enemies (defeated ones are
// taken out of it). "events" are optional: hit(gloom, amount, kind) for number pop-ups, defeat(gloom), cast() when
// the superpower goes off.
export function createPowers({ scene, hero, gloomlings, events = {} }) {
  const data = HEROES[hero.kind];
  const sparks = createSparks(scene);
  const shots = [];
  const look = LOOKS[data.attack.look];
  let fireTimer = 0;   // time until the next automatic shot
  let powerLeft = 0;   // time until the superpower is ready again

  const shotShape = new THREE.SphereGeometry(1, 12, 8);
  const outerMaterial = new THREE.MeshBasicMaterial({ color: look.outer });
  const coreMaterial = new THREE.MeshBasicMaterial({ color: look.core });

  // The nearest living Gloomling within "maxDistance" of the hero, or null.
  function nearest(maxDistance) {
    let best = null;
    let bestDistance = maxDistance;
    for (const g of gloomlings) {
      if (!g.alive) continue;
      const d = Math.hypot(g.position.x - hero.position.x, g.position.z - hero.position.z);
      if (d < bestDistance) { best = g; bestDistance = d; }
    }
    return best;
  }

  // Hurts a Gloomling: pop-up number, sparks, and if it falls, a burst of colour. Returns true if it was defeated.
  function damage(gloom, amount, pushX, pushZ, kind) {
    const defeated = gloom.hit(amount, pushX, pushZ);
    const p = gloom.position;
    if (events.hit) events.hit(gloom, amount, kind);
    for (let i = 0; i < 5; i++) sparks.emit(p.x, 0.8, p.z, random(-3, 3), random(1, 4), random(-3, 3), 0.3, 0.12, 0xffe9a0, -9);
    if (defeated) {
      for (let i = 0; i < 16; i++) sparks.emit(p.x, 0.6, p.z, random(-3.5, 3.5), random(2, 6), random(-3.5, 3.5), random(0.5, 0.9), random(0.14, 0.24), pick(POP_COLORS), -12);
      const index = gloomlings.indexOf(gloom);
      if (index >= 0) gloomlings.splice(index, 1);
      gloom.remove();
      if (events.defeat) events.defeat(gloom);
    }
    return defeated;
  }

  const superpower = createSuperpower(data.power, { scene, hero, gloomlings, sparks, nearest, damage });

  function shoot(target) {
    const dx = target.position.x - hero.position.x;
    const dz = target.position.z - hero.position.z;
    const length = Math.hypot(dx, dz) || 1;
    const shot = new THREE.Group();
    const outer = new THREE.Mesh(shotShape, outerMaterial);
    outer.scale.set(look.size, look.size, look.size * look.stretch);
    const inner = new THREE.Mesh(shotShape, coreMaterial);
    inner.scale.set(look.coreSize, look.coreSize, look.coreSize * look.stretch);
    shot.add(outer, inner);
    shot.rotation.y = Math.atan2(dx, dz);   // a dart points the way it flies
    shot.position.set(hero.position.x + (dx / length) * 0.6, 1.0, hero.position.z + (dz / length) * 0.6);
    scene.add(shot);
    shots.push({ shot, dx: dx / length, dz: dz / length, travelled: 0 });
  }

  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      const before = { x: s.shot.position.x, z: s.shot.position.z };
      const step = data.attack.speed * dt;
      s.shot.position.x += s.dx * step;
      s.shot.position.z += s.dz * step;
      s.travelled += step;
      sparks.emit(s.shot.position.x, 1.0, s.shot.position.z, random(-0.6, 0.6), random(0.2, 1), random(-0.6, 0.6), 0.25, 0.16, pick(look.trail));
      let done = s.travelled > data.attack.range + 2;
      for (const g of gloomlings) {
        if (!g.alive) continue;
        if (distanceToSegment(g.position.x, g.position.z, before.x, before.z, s.shot.position.x, s.shot.position.z) < g.radius + 0.25) {
          damage(g, data.attack.damage, s.dx * 0.3, s.dz * 0.3, 'hit');
          done = true;
          break;
        }
      }
      if (done) { scene.remove(s.shot); shots.splice(i, 1); }
    }
  }

  // The superpower. Returns true if it went off (it is refused while recharging or when the hero is knocked out).
  function castPower() {
    if (powerLeft > 0 || hero.down) return false;
    powerLeft = data.power.cooldown;
    superpower.cast();
    if (events.cast) events.cast();
    return true;
  }

  // Called every frame. Fires automatically when a Gloomling is in range.
  function update(dt) {
    powerLeft = Math.max(0, powerLeft - dt);
    fireTimer -= dt;
    if (fireTimer <= 0) {
      const target = hero.down ? null : nearest(data.attack.range);
      if (target) { shoot(target); fireTimer = data.attack.cooldown; }
      else fireTimer = 0;   // stay ready, so the first shot is instant when an enemy comes into range
    }
    updateShots(dt);
    superpower.update(dt);
    sparks.update(dt);
  }

  // Clears everything for a fresh start.
  function reset() {
    for (const s of shots) scene.remove(s.shot);
    shots.length = 0;
    superpower.reset();
    powerLeft = 0;
    fireTimer = 0;
  }

  return {
    update, castPower, reset, sparks,
    get powerProgress() { return 1 - powerLeft / data.power.cooldown; },   // 0 = just used, 1 = ready
    get powerReady() { return powerLeft <= 0; },
    get shotCount() { return shots.length; },
  };
}
