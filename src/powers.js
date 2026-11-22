// powers.js: Ember's attacks: the automatic fireball and the Flame Wave superpower, plus the sparks they throw.
import * as THREE from '../lib/three.module.min.js';
import { EMBER } from './heroes-data.js';

const WAVE_SPEED = 30;   // how fast the front of the Flame Wave spreads out (units per second)
const WAVE_LIFE = 0.5;   // how long the flames last (seconds)
const FLAME_COLORS = [0xff4b1f, 0xff8a1f, 0xffc933];                     // red, orange, yellow
const POP_COLORS = [0xff7ab8, 0xffe14a, 0x5ad8ff, 0x7dff52, 0xff9a3c];   // the colour that bursts out of a defeated Gloomling

const random = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const angleBetween = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));   // the short way round, from -pi to pi

// How far a point is from a line segment. Used so a fast fireball can never skip over a Gloomling between two frames.
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

// "ember" is the hero. "gloomlings" is the live list of enemies (defeated ones are taken out of it).
// "events" are optional: hit(gloom, amount, kind) for number pop-ups, defeat(gloom), cast() when the Flame Wave goes off.
export function createPowers({ scene, ember, gloomlings, events = {} }) {
  const sparks = createSparks(scene);
  const fireballs = [];
  const half = THREE.MathUtils.degToRad(EMBER.wave.angle / 2);   // half the width of the Flame Wave cone
  let fireTimer = 0;   // time until the next automatic fireball
  let waveLeft = 0;    // time until the Flame Wave is ready again
  let wave = null;     // the Flame Wave that is spreading out right now, if any

  // Fireball look: an orange ball with a pale core.
  const ballShape = new THREE.SphereGeometry(1, 12, 8);
  const orange = new THREE.MeshBasicMaterial({ color: 0xff7a1f });
  const paleCore = new THREE.MeshBasicMaterial({ color: 0xffe28a });

  // Flame Wave look: two flat fans on the ground, a big orange one with a smaller yellow one on top.
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

  // The nearest living Gloomling within "maxDistance" of Ember, or null.
  function nearest(maxDistance) {
    let best = null;
    let bestDistance = maxDistance;
    for (const g of gloomlings) {
      if (!g.alive) continue;
      const d = Math.hypot(g.position.x - ember.position.x, g.position.z - ember.position.z);
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

  function shoot(target) {
    const dx = target.position.x - ember.position.x;
    const dz = target.position.z - ember.position.z;
    const length = Math.hypot(dx, dz) || 1;
    const ball = new THREE.Group();
    const outer = new THREE.Mesh(ballShape, orange);
    outer.scale.setScalar(0.26);
    const inner = new THREE.Mesh(ballShape, paleCore);
    inner.scale.setScalar(0.14);
    ball.add(outer, inner);
    ball.position.set(ember.position.x + (dx / length) * 0.6, 1.0, ember.position.z + (dz / length) * 0.6);
    scene.add(ball);
    fireballs.push({ ball, dx: dx / length, dz: dz / length, travelled: 0 });
  }

  function updateFireballs(dt) {
    for (let i = fireballs.length - 1; i >= 0; i--) {
      const f = fireballs[i];
      const before = { x: f.ball.position.x, z: f.ball.position.z };
      const step = EMBER.attack.speed * dt;
      f.ball.position.x += f.dx * step;
      f.ball.position.z += f.dz * step;
      f.travelled += step;
      sparks.emit(f.ball.position.x, 1.0, f.ball.position.z, random(-0.6, 0.6), random(0.2, 1), random(-0.6, 0.6), 0.25, 0.16, pick(FLAME_COLORS));
      let done = f.travelled > EMBER.attack.range + 2;
      for (const g of gloomlings) {
        if (!g.alive) continue;
        if (distanceToSegment(g.position.x, g.position.z, before.x, before.z, f.ball.position.x, f.ball.position.z) < g.radius + 0.25) {
          damage(g, EMBER.attack.damage, f.dx * 0.3, f.dz * 0.3, 'hit');
          done = true;
          break;
        }
      }
      if (done) { scene.remove(f.ball); fireballs.splice(i, 1); }
    }
  }

  // The superpower. Returns true if it went off (it is refused while recharging or when Ember is knocked out).
  function castWave() {
    if (waveLeft > 0 || ember.down) return false;
    waveLeft = EMBER.wave.cooldown;
    const target = nearest(EMBER.wave.length + 1);   // it aims at the nearest Gloomling, or straight ahead if none is close
    const aim = target ? Math.atan2(target.position.x - ember.position.x, target.position.z - ember.position.z) : ember.yaw;
    ember.face(aim);
    wave = { x: ember.position.x, z: ember.position.z, aim, age: 0, hit: new Set() };
    fan.visible = true;
    for (let i = 0; i < 20; i++) {   // a burst of flames at her hands
      const a = aim + random(-half, half);
      sparks.emit(wave.x + Math.sin(a) * 0.6, random(0.5, 1.2), wave.z + Math.cos(a) * 0.6, Math.sin(a) * random(3, 8), random(0.5, 2), Math.cos(a) * random(3, 8), random(0.25, 0.45), random(0.25, 0.4), pick(FLAME_COLORS));
    }
    if (events.cast) events.cast();
    return true;
  }

  function updateWave(dt) {
    if (!wave) return;
    wave.age += dt;
    const life = wave.age / WAVE_LIFE;
    if (life >= 1) { wave = null; fan.visible = false; return; }
    const reach = Math.min(EMBER.wave.length, WAVE_SPEED * wave.age);

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
      damage(g, EMBER.wave.damage, (dx / distance) * EMBER.wave.push, (dz / distance) * EMBER.wave.push, 'big');
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

  // Called every frame. Fires automatically when a Gloomling is in range.
  function update(dt) {
    waveLeft = Math.max(0, waveLeft - dt);
    fireTimer -= dt;
    if (fireTimer <= 0) {
      const target = ember.down ? null : nearest(EMBER.attack.range);
      if (target) { shoot(target); fireTimer = EMBER.attack.cooldown; }
      else fireTimer = 0;   // stay ready, so the first shot is instant when an enemy comes into range
    }
    updateFireballs(dt);
    updateWave(dt);
    sparks.update(dt);
  }

  // Clears everything for a fresh start.
  function reset() {
    for (const f of fireballs) scene.remove(f.ball);
    fireballs.length = 0;
    wave = null;
    fan.visible = false;
    waveLeft = 0;
    fireTimer = 0;
  }

  return {
    update, castWave, reset, sparks,
    get waveProgress() { return 1 - waveLeft / EMBER.wave.cooldown; },   // 0 = just used, 1 = ready
    get waveReady() { return waveLeft <= 0; },
    get fireballCount() { return fireballs.length; },
  };
}
