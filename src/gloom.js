// gloom.js: the Gloomling, a small shadow creature that runs at Ember and bumps her.
import * as THREE from '../lib/three.module.min.js';
import { GLOOMLING } from './heroes-data.js';
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

// "scene" is where it is added. x and z are where it appears.
export function createGloomling({ scene, x, z }) {
  const group = new THREE.Group();
  const body = new THREE.Group();   // hops, squashes and swells inside the group
  group.add(body);
  const skin = new THREE.MeshLambertMaterial({ color: 0x4a2f7a });   // its own copy, so only this Gloomling flashes when hit

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
  }
  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });

  const p = group.position;
  p.set(x, 0, z);
  const bar = createFloatingBar(0.9, 0xff5a8a);
  bar.group.visible = false;   // only shown once it has been hurt
  scene.add(group, bar.group);

  const shove = { x: 0, z: 0 };   // the push it is currently sliding with
  let health = GLOOMLING.health;
  let alive = true;
  let mode = 'chase';   // chase, then windup (the warning), then the bump, then rest, then chase again
  let timer = 0;        // time left in the current mode
  let stun = 0;
  let flash = 0;        // white flash when hit
  let yaw = 0;
  let age = 0;          // for the grow-in when it first appears
  const phase = Math.random() * 6.28;

  // Called every frame. "target" is Ember. "others" are all the Gloomlings, so they can keep their distance.
  function update(dt, target, time, others) {
    if (!alive) return;
    age += dt;
    const dx = target.position.x - p.x;
    const dz = target.position.z - p.z;
    const distance = Math.hypot(dx, dz) || 1;
    let moving = false;

    stun = Math.max(0, stun - dt);
    if (stun > 0 || target.down) {
      mode = 'chase';   // a shove cancels a bump, and nobody bumps Ember while she is out
    } else if (mode === 'chase') {
      if (distance > GLOOMLING.reach * 0.7) {
        p.x += (dx / distance) * GLOOMLING.speed * dt;
        p.z += (dz / distance) * GLOOMLING.speed * dt;
        moving = true;
      }
      if (distance < GLOOMLING.reach) { mode = 'windup'; timer = GLOOMLING.windup; }
    } else if (mode === 'windup') {
      timer -= dt;
      if (timer <= 0) {
        if (distance < GLOOMLING.reach * 1.4) target.takeHit(GLOOMLING.damage, p.x, p.z);
        mode = 'rest';
        timer = GLOOMLING.pause;
      }
    } else {
      timer -= dt;
      if (timer <= 0) mode = 'chase';
    }

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
      if (gap < SPACING && gap > 0.0001) {
        const push = (SPACING - gap) * 0.5;
        p.x += (ox / gap) * push;
        p.z += (oz / gap) * push;
      }
    }
    const fromCentre = Math.hypot(p.x, p.z);
    if (fromCentre > EDGE) { p.x *= EDGE / fromCentre; p.z *= EDGE / fromCentre; }

    // Face Ember.
    const wanted = Math.atan2(dx, dz);
    yaw += Math.atan2(Math.sin(wanted - yaw), Math.cos(wanted - yaw)) * (1 - Math.exp(-10 * dt));
    group.rotation.y = yaw;

    // Look: hop while moving, swell and glare just before a bump, grow in when it first appears.
    const warning = mode === 'windup' ? 1 - Math.max(timer, 0) / GLOOMLING.windup : 0;
    const hop = moving ? Math.abs(Math.sin(time * 9 + phase)) : 0;
    const grow = Math.min(1, age / 0.35);
    const wide = (1 - hop * 0.06 + warning * 0.1) * grow;
    body.position.y = hop * 0.25;
    body.scale.set(wide, (1 + hop * 0.12 + warning * 0.25) * grow, wide);
    for (const eye of eyes) eye.material = mode === 'windup' ? eyeAngry : eyeCalm;
    flash = Math.max(0, flash - dt * 7);
    skin.emissive.setScalar(flash * 0.9);
    bar.group.position.set(p.x, 1.75, p.z);
    bar.set(health / GLOOMLING.health);
  }

  // Hurts it. "pushX, pushZ" is how far it gets shoved. Returns true if this finished it off.
  function hit(damage, pushX = 0, pushZ = 0) {
    if (!alive) return false;
    health -= damage;
    flash = 1;
    shove.x += pushX * SHOVE_FADE;   // a shove of a given distance needs a starting speed of distance x fade rate
    shove.z += pushZ * SHOVE_FADE;
    if (Math.hypot(pushX, pushZ) >= 1) stun = STUN_TIME;   // only a real shove stuns it, not a small tap
    bar.group.visible = true;
    if (health <= 0) alive = false;
    return !alive;
  }

  function remove() {
    scene.remove(group, bar.group);
    skin.dispose();
  }

  const gloomling = {
    group, position: p, radius: 0.5, update, hit, remove,
    get alive() { return alive; },
    get health() { return health; },
    get mode() { return mode; },
  };
  return gloomling;
}
