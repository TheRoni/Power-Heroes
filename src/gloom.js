// gloom.js: the Gloomling, a small shadow creature that runs at Ember and bumps her.
import * as THREE from '../lib/three.module.min.js';
import { GLOOMLING, ENEMIES } from './heroes-data.js';
import { TYPE_COLORS } from './types.js';
import { strength } from './power.js';
import { createFloatingBar } from './ui.js';

const EDGE = 11.2;         // Gloomlings cannot be shoved past the edge of the island
const SHOVE_FADE = 8;      // how quickly a shove dies away (higher = a shorter, snappier shove)
const STUN_TIME = 0.35;    // a shove also stuns it for this long, which cancels a bump that was about to land
const SPACING = 0.9;       // Gloomlings push each other apart so they never stack on one spot

// Shapes and materials that every Gloomling shares.
const blobShape = new THREE.SphereGeometry(0.5, 16, 12);
const roundShape = new THREE.SphereGeometry(1, 10, 8);
const earShape = new THREE.ConeGeometry(0.13, 0.3, 6);
const browShape = new THREE.BoxGeometry(0.24, 0.05, 0.05);
const eyeCalm = new THREE.MeshBasicMaterial({ color: 0xfff08a });    // glowing yellow eyes
const eyeAngry = new THREE.MeshBasicMaterial({ color: 0xff4a3a });   // eyes turn red just before a bump
const browMaterial = new THREE.MeshLambertMaterial({ color: 0x1d1233 });
const hornShape = new THREE.ConeGeometry(0.12, 0.45, 6);
const hornMaterial = new THREE.MeshLambertMaterial({ color: 0xd9d2c0 });
const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x2a0a22 });
const bubbleShape = new THREE.SphereGeometry(1, 18, 12);
const bubbleMaterial = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
const rimShape = new THREE.RingGeometry(0.92, 1, 48);
const rimMaterial = new THREE.MeshBasicMaterial({ color: 0xcff0ff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
const gooMaterials = new Map(), gooDark = new THREE.MeshBasicMaterial({ color: 0x2a1a55 });   // a goo ball for each type (in a dark shell)
const SOFTEN = ENEMIES.shielder.shield.soften;   // a shield (or a Shielder's bubble) lets this share of a hit through
const goo = (type) => { if (!gooMaterials.has(type)) gooMaterials.set(type, new THREE.MeshBasicMaterial({ color: type ? TYPE_COLORS[type].hex : 0x9a5ad8 })); return gooMaterials.get(type); };

// "scene" is where it is added. x and z are where it appears. A "passive" Gloomling is a training dummy:
// pale blue, and it just stands there and never bumps anyone. A "type" (fire, water, storm, nature) tints its body.
// A "kind" is another sort of Gloom (ENEMIES in heroes-data.js): 'brute', 'spitter', 'shielder' or 'golden'. events (all optional):
// escaped(gloom) when a Golden Gloom gets away, shieldBreak(gloom) when a Shielder's bubble pops, spit(gloom) when a Spitter fires.
export function createGloomling({ scene, x, z, passive = false, type = null, power = 10, kind = 'gloomling', events = {} }) {
  const K = ENEMIES[kind] || ENEMIES.gloomling;
  const S = K.scale;
  const group = new THREE.Group();
  const body = new THREE.Group();   // hops, squashes and swells inside the group
  group.add(body);
  const color = new THREE.Color(0x3a2670).lerp(new THREE.Color(type ? TYPE_COLORS[type].hex : 0x6a45b0), type ? 0.7 : 0.3);
  if (kind === 'brute') color.lerp(new THREE.Color(0x000000), 0.28);
  else if (kind === 'spitter') color.lerp(new THREE.Color(0xff7ab0), 0.3);
  else if (kind === 'shielder') color.lerp(new THREE.Color(0xffffff), 0.4);
  else if (kind === 'golden') color.set(0xffd24a);
  const skin = new THREE.MeshLambertMaterial({ color: passive ? 0x6f86b8 : color });   // its own copy, so only this Gloomling flashes when hit

  const blob = new THREE.Mesh(blobShape, skin);
  blob.scale.set(1, 0.85, 1);
  blob.position.y = 0.45;
  body.add(blob);
  const eyes = [];
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earShape, skin);
    ear.position.set(side * 0.3, 0.88, 0);
    ear.rotation.z = -side * 0.5;
    const eye = new THREE.Mesh(roundShape, eyeCalm);
    eye.position.set(side * 0.17, 0.55, 0.4);
    eye.scale.set(0.1, 0.13, 0.05);
    const brow = new THREE.Mesh(browShape, browMaterial);
    brow.position.set(side * 0.17, 0.74, 0.43);
    brow.rotation.z = side * 0.45;
    body.add(ear, eye, brow);
    eyes.push(eye);
    if (kind === 'brute') { const horn = new THREE.Mesh(hornShape, hornMaterial); horn.position.set(side * 0.38, 0.85, 0.05); horn.rotation.z = -side * 0.9; body.add(horn); }
  }
  let mouth = null;    // a Spitter's open mouth: it swells just before it spits
  if (kind === 'spitter') { mouth = new THREE.Mesh(roundShape, mouthMaterial); mouth.position.set(0, 0.36, 0.43); mouth.scale.set(0.2, 0.12, 0.08); body.add(mouth); }
  let bubble = null, rim = null;   // a Shielder's protecting bubble: a low dome over everyone it shelters, with a bright rim on the ground
  if (K.shield) {
    const reach = K.shield.radius / S;
    bubble = new THREE.Mesh(bubbleShape, bubbleMaterial);
    bubble.scale.set(reach, 0.55 * reach, reach);
    rim = new THREE.Mesh(rimShape, rimMaterial);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.05;
    rim.scale.setScalar(reach);
    group.add(bubble, rim);
  }
  group.scale.setScalar(S);
  group.traverse((object) => { if (object.isMesh) object.castShadow = object !== bubble && object !== rim; });   // (the bubble casts no shadow)

  const p = group.position;
  p.set(x, 0, z);
  const bar = createFloatingBar(0.9 * S, 0xff5a8a);
  bar.group.visible = false;   // only shown once it has been hurt
  scene.add(group, bar.group);

  const shove = { x: 0, z: 0 };   // the push it is currently sliding with
  const maxHealth = Math.round(GLOOMLING.health * K.health * strength(power));   // a stronger Gloomling has more health and bumps harder
  const bump = Math.round(GLOOMLING.damage * K.damage * strength(power));
  const speed = GLOOMLING.speed * K.speed;
  const windupTime = K.shot ? K.shot.windup : K.windup;   // how long its warning lasts before a bump (or a spit)
  const heavy = 1 / S;   // a big Gloom is shoved less far
  let health = maxHealth;
  let alive = true;
  let mode = 'chase';   // chase, then windup (the warning), then the bump, then rest, then chase again
  let timer = 0;        // time left in the current mode
  let stun = 0;
  let soaked = 0;       // seconds left of being soaked (Big Splash): wet Gloomlings shine blue
  let flash = 0;        // white flash when hit
  let yaw = 0;
  let age = 0;          // for the grow-in when it first appears
  let shieldUp = Boolean(K.shield);   // a Shielder's bubble is up until it is hit by the type that beats its own (or cracks)
  let shielded = false;               // any other Gloom standing in a Shielder's bubble takes almost no damage
  let cracks = 0;                     // hits the bubble has soaked up
  let shotLeft = 1 + Math.random() * 1.5;   // a Spitter: time until it spits
  let escapeLeft = K.life || 0;       // a Golden Gloom: time until it gets away
  let escaped = false;
  const goos = [];                    // goo balls in the air (a Spitter's)
  const phase = Math.random() * 6.28;

  // A Spitter's ball of goo flies straight at where the hero stood, slowly enough to dodge, and hurts if it lands on them.
  function spit(dx, dz, distance) {
    const s = K.shot;
    const mesh = new THREE.Group();   // a dark shell round a coloured core, so it shows up on any ground
    for (const [material, size] of [[gooDark, 2.2], [goo(type), 1.3]]) { const ball = new THREE.Mesh(blobShape, material); ball.scale.setScalar(s.size * size); mesh.add(ball); }
    mesh.position.set(p.x, 0.7, p.z);
    scene.add(mesh);
    goos.push({ mesh, vx: (dx / distance) * s.speed, vz: (dz / distance) * s.speed, life: s.life });
    if (events.spit) events.spit(gloomling);
  }
  function flyGoos(dt, target) {
    for (let i = goos.length - 1; i >= 0; i--) {
      const g = goos[i];
      g.life -= dt;
      g.mesh.position.x += g.vx * dt;
      g.mesh.position.z += g.vz * dt;
      g.mesh.position.y = 0.7 + Math.sin(g.life * 12) * 0.06;
      const landed = !target.down && Math.hypot(g.mesh.position.x - target.position.x, g.mesh.position.z - target.position.z) < 0.7;
      if (landed) target.takeHit(bump, p.x, p.z);
      if (landed || g.life <= 0) { scene.remove(g.mesh); goos.splice(i, 1); }
    }
  }

  // A Golden Gloom runs from the hero, sliding along the rim of the island instead of getting stuck on it.
  function flee(dx, dz, distance, dt) {
    let mx = -dx / distance;
    let mz = -dz / distance;
    const r = Math.hypot(p.x, p.z) || 1;
    if (r > EDGE - 2) {
      const nx = p.x / r;
      const nz = p.z / r;
      const out = mx * nx + mz * nz;
      if (out > 0) { mx -= out * nx; mz -= out * nz; }
      if (Math.hypot(mx, mz) < 0.3) { mx = -nz; mz = nx; }   // (cornered: run round the rim)
      const length = Math.hypot(mx, mz) || 1;
      mx /= length;
      mz /= length;
    }
    p.x += mx * speed * dt;
    p.z += mz * speed * dt;
  }

  // How much of a hit gets through (1 = all of it). A Shielder's bubble, and anyone standing in it, lets only a little through,
  // unless the hit is SUPER against the Shielder itself: that pops its bubble.
  function guard(label) {
    if (shieldUp) return label === 'super' ? 1 : SOFTEN;
    return shielded ? SOFTEN : 1;
  }

  // Called every frame. "target" is Ember. "others" are all the Gloomlings, so they can keep their distance.
  function update(dt, target, time, others) {
    if (!alive) return;
    age += dt;
    const dx = target.position.x - p.x;
    const dz = target.position.z - p.z;
    const distance = Math.hypot(dx, dz) || 1;
    let moving = false;
    const walk = (sign) => { p.x += (dx / distance) * sign * speed * dt; p.z += (dz / distance) * sign * speed * dt; moving = true; };

    stun = Math.max(0, stun - dt);
    soaked = Math.max(0, soaked - dt);
    shielded = !K.shield && others.some((o) => o !== gloomling && o.alive && o.shieldUp && Math.hypot(o.position.x - p.x, o.position.z - p.z) < o.shieldRadius);
    const running = K.flees && stun <= 0 && distance < 9;   // a Golden Gloom bolts when the hero comes near
    if (K.flees) {
      escapeLeft -= dt;
      if (running) { flee(dx, dz, distance, dt); moving = true; }
      if (escapeLeft <= 0) { escaped = true; alive = false; if (events.escaped) events.escaped(gloomling); return; }
    } else if (stun > 0 || target.down || passive) {
      mode = 'chase';   // a shove cancels a bump, nobody bumps a hero who is out, and a training dummy never does
    } else if (K.shot) {   // a Spitter keeps its distance, then spits
      if (mode === 'chase') {
        if (distance < K.shot.keep[0]) walk(-1); else if (distance > K.shot.keep[1]) walk(1);
        shotLeft -= dt;
        if (shotLeft <= 0 && distance < K.shot.range) { mode = 'windup'; timer = windupTime; }
      } else if (mode === 'windup') {
        timer -= dt;
        if (timer <= 0) { spit(dx, dz, distance); mode = 'rest'; timer = K.pause; shotLeft = K.shot.every; }
      } else {
        timer -= dt;
        if (timer <= 0) mode = 'chase';
      }
    } else if (mode === 'chase') {
      if (distance > K.reach * 0.7) walk(1);
      if (distance < K.reach) { mode = 'windup'; timer = windupTime; }
    } else if (mode === 'windup') {
      timer -= dt;
      if (timer <= 0) {
        if (distance < K.reach * 1.4) target.takeHit(bump, p.x, p.z);
        mode = 'rest';
        timer = K.pause;
      }
    } else {
      timer -= dt;
      if (timer <= 0) mode = 'chase';
    }
    flyGoos(dt, target);

    // Slide with any shove, keep apart from the others, and stay on the island.
    p.x += shove.x * dt;
    p.z += shove.z * dt;
    const fade = Math.exp(-SHOVE_FADE * dt);
    shove.x *= fade;
    shove.z *= fade;
    for (const other of others) {
      if (other === gloomling || !other.alive) continue;
      const ox = p.x - other.position.x;
      const oz = p.z - other.position.z;
      const gap = Math.hypot(ox, oz);
      const room = SPACING + (S - 1) * 0.5 + (other.boss ? 0 : (other.radius || 0.5) - 0.5);   // (big ones need more room)
      if (gap < room && gap > 0.0001) {
        const push = (room - gap) * 0.5;
        p.x += (ox / gap) * push;
        p.z += (oz / gap) * push;
      }
    }
    const fromCentre = Math.hypot(p.x, p.z);
    if (fromCentre > EDGE) { p.x *= EDGE / fromCentre; p.z *= EDGE / fromCentre; }

    // Face Ember (a Golden Gloom, running, faces away).
    const turn = running ? -1 : 1;
    const wanted = Math.atan2(dx * turn, dz * turn);
    yaw += Math.atan2(Math.sin(wanted - yaw), Math.cos(wanted - yaw)) * (1 - Math.exp(-10 * dt));
    group.rotation.y = yaw;

    // Look: hop while moving, swell and glare just before a bump, grow in when it first appears.
    const warning = mode === 'windup' ? 1 - Math.max(timer, 0) / windupTime : 0;
    const hop = moving ? Math.abs(Math.sin(time * 9 + phase)) : 0;
    const grow = Math.min(1, age / 0.35);
    const wide = (1 - hop * 0.06 + warning * 0.1) * grow;
    body.position.y = hop * 0.25;
    body.scale.set(wide, (1 + hop * 0.12 + warning * 0.25) * grow, wide);
    if (mouth) mouth.scale.set(0.2 + warning * 0.1, 0.12 + warning * 0.2, 0.08);
    for (const eye of eyes) eye.material = mode === 'windup' ? eyeAngry : eyeCalm;
    if (bubble) bubble.visible = rim.visible = shieldUp;
    flash = Math.max(0, flash - dt * 7);
    const wet = Math.min(1, soaked * 2);   // fades out at the end
    const glint = K.flees ? 0.3 + Math.sin(time * 9) * 0.15 : 0;   // a Golden Gloom glitters
    skin.emissive.setRGB(flash * 0.9 + glint * 0.8, flash * 0.9 + wet * 0.1 + glint * 0.6, flash * 0.9 + wet * 0.24 + glint * 0.1);
    bar.group.position.set(p.x, 1.3 + 0.45 * S, p.z);
    bar.set(health / maxHealth);
  }

  // Hurts it. "pushX, pushZ" is how far it gets shoved, "label" how the type circle rated the hit ('super', 'weak' or 'normal').
  // Returns true if this finished it off.
  function hit(damage, pushX = 0, pushZ = 0, label = 'normal') {
    if (!alive) return false;
    health -= damage;
    flash = 1;
    if (shieldUp) {   // a Shielder's bubble pops when the right type hits it, or after it has soaked up enough hits
      cracks++;
      if (label === 'super' || cracks >= K.shield.cracks) {
        shieldUp = false;
        if (events.shieldBreak) events.shieldBreak(gloomling, label === 'super');
      }
    }
    if (!passive) {   // a training dummy stays where it is, so it can never be shoved out of reach
      shove.x += pushX * SHOVE_FADE * heavy;   // a shove of a given distance needs a starting speed of distance x fade rate
      shove.z += pushZ * SHOVE_FADE * heavy;
      if (Math.hypot(pushX, pushZ) >= 1) stun = STUN_TIME;   // only a real shove stuns it, not a small tap
    }
    bar.group.visible = true;
    if (health <= 0) alive = false;
    return !alive;
  }

  function remove() {
    scene.remove(group, bar.group);
    for (const g of goos) scene.remove(g.mesh);
    goos.length = 0;
    skin.dispose();
  }

  const gloomling = {
    group, position: p, radius: 0.5 * S, type, power, maxHealth, kind, xp: K.xp, extra: Boolean(K.flees), shieldRadius: K.shield ? K.shield.radius : 0,
    update, hit, guard, remove,
    soak(seconds) { soaked = Math.max(soaked, seconds); },
    get soaked() { return soaked; },
    get alive() { return alive; },
    get health() { return health; },
    get mode() { return mode; },
    get shieldUp() { return shieldUp; },
    get shielded() { return shielded; },
    get escaped() { return escaped; },
    get goos() { return goos.length; },   // goo balls in the air (the automatic tests look)
  };
  return gloomling;
}
