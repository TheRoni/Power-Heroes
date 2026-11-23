// aura.js: the aura around the hero in play. It grows with Power through five tiers (see power.js): Spark (a faint glow
// at the feet), Glow (soft light around the body), Blaze (a flickering aura in the type colour and rising sparks),
// Surge (a glowing ring on the ground; the hero's edges light up), Radiant (a halo, and a light trail when moving).
import * as THREE from '../lib/three.module.min.js';
import { createGlow } from './pip.js';
import { TYPE_COLORS } from './types.js';
import { tierIndex } from './power.js';

const GOLD = 0xfff2b0;
const GLOWS = [0, 0, 0, 0.1, 0.18];   // how much a hero's edges light up in each tier

const addBasic = (geometry, color, opacity) => new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));

// "position" is where the hero stands (the squad shares one), "sparks" is the pool of sparks (powers.js).
export function createAura({ scene, position, sparks }) {
  const group = new THREE.Group();
  const floor = addBasic(new THREE.CircleGeometry(1, 32), 0xffffff, 0);                 // Spark: a faint glow at the feet
  const body = createGlow({ inner: 'rgba(255,255,255,0.9)', mid: 'rgba(255,255,255,0.4)', outer: 'rgba(255,255,255,0)' }, 3.2);   // Glow: soft light around the body
  const flame = createGlow({ inner: 'rgba(255,255,255,0.7)', mid: 'rgba(255,255,255,0.3)', outer: 'rgba(255,255,255,0)' }, 4);    // Blaze: a flickering aura
  const ring = addBasic(new THREE.RingGeometry(1, 1.28, 48), 0xffffff, 0);              // Surge: a ring on the ground
  const halo = addBasic(new THREE.TorusGeometry(0.4, 0.05, 8, 32), GOLD, 0);            // Radiant: a halo above the head
  floor.rotation.x = ring.rotation.x = -Math.PI / 2;
  floor.position.y = 0.04;
  ring.position.y = 0.06;
  halo.rotation.x = Math.PI / 2;
  body.position.y = 1.0;
  flame.position.y = 1.1;
  group.add(floor, body, flame, ring, halo);
  group.visible = false;
  scene.add(group);

  let tier = 0;
  let flare = 0;         // 0 to 1+: how much the aura is flaring right now (it fades away)
  let sparkTimer = 0;
  const flat = { x: 0, z: 0 };

  // Call every frame. info: { power, type, visible, speed }.
  function update(dt, time, { power, type, visible, speed = 0 }) {
    tier = tierIndex(power);
    group.visible = visible;
    if (!visible) return;
    flare = Math.max(0, flare - dt);
    const boost = 1 + Math.min(1, flare) * 1.2;
    const color = TYPE_COLORS[type] ? TYPE_COLORS[type].hex : GOLD;
    group.position.set(position.x, 0, position.z);
    floor.material.color.setHex(color);
    floor.material.opacity = Math.min(1, (0.2 + Math.sin(time * 2) * 0.05) * boost);
    floor.scale.setScalar(0.95 + Math.sin(time * 2) * 0.08);
    body.visible = tier >= 1;
    body.material.color.setHex(color);
    body.material.opacity = Math.min(1, (0.3 + Math.sin(time * 2.6) * 0.06) * boost);
    flame.visible = tier >= 2;
    flame.material.color.setHex(color);
    flame.scale.setScalar(4 + Math.sin(time * 13) * 0.35 + Math.sin(time * 7.1) * 0.3 + flare * 1.5);   // it flickers
    flame.material.opacity = Math.min(1, (0.2 + Math.sin(time * 11) * 0.05) * boost);
    ring.visible = tier >= 3;
    ring.material.color.setHex(color);
    ring.material.opacity = Math.min(1, 0.45 * boost);
    ring.rotation.z += dt;
    ring.scale.setScalar(1 + Math.sin(time * 3) * 0.06 + flare * 0.4);
    halo.visible = tier >= 4;
    halo.position.y = 2.2 + Math.sin(time * 2.2) * 0.06;
    halo.rotation.z += dt * 1.5;
    halo.material.opacity = Math.min(1, 0.8 * boost);
    if (tier >= 2) {   // sparks rise from the ground (faster when flaring)
      sparkTimer -= dt;
      if (sparkTimer <= 0) {
        sparkTimer = 0.16 / boost;
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 0.7;
        sparks.emit(position.x + Math.sin(a) * r, 0.2, position.z + Math.cos(a) * r, 0, 1.4 + Math.random() * 1.2, 0, 0.8, 0.14, color);
      }
    }
    if (tier >= 4 && speed > 2) {   // a trail of light behind a running Radiant hero
      flat.x = position.x;
      flat.z = position.z;
      sparks.emit(flat.x, 0.5 + Math.random() * 0.5, flat.z, 0, 0, 0, 0.45, 0.26, GOLD);
    }
  }

  return {
    update, group,
    flare(seconds = 1.2) { flare = Math.max(flare, seconds); },   // the aura flares up for a moment (a power-up, Overdrive)
    get tier() { return tier; },
    get glow() { return GLOWS[tier]; },   // how much the hero's edges should light up
    get flaring() { return flare; },
    parts: { floor, body, flame, ring, halo },
  };
}
