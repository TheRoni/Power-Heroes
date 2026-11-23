// village-props.js: the buildings and things of the Home Village, built from simple shapes: the Hero Hall, the training yard, the
// sparring ring, the pond, the campfire square, the lookout tower, the notice board, trees and lamps. village.js puts them on the isle.
import * as THREE from '../lib/three.module.min.js';
import { glowTexture } from './campfire.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const M = {
  wood: lambert(0x8a5a2c), dark: lambert(0x5a3a1c), stone: lambert(0x9aa0ad), roof: lambert(0xd0553a), cream: lambert(0xf4ead0), blue: lambert(0x3f7fd0),
  sand: lambert(0xe8d08a), grass: lambert(0x7ccf4a), leaf: lambert(0x3f9a3a), leaf2: lambert(0x58b04a), reed: lambert(0x5fae3a), pad: lambert(0x3f9a4a),
  water: new THREE.MeshLambertMaterial({ color: 0x4fb4ff, transparent: true, opacity: 0.85 }),
  glow: new THREE.MeshBasicMaterial({ color: 0xffd27a }),
  paper: lambert(0xfff6d8), rope: lambert(0xd9b46a), path: lambert(0xd9c9a0),
};
export const windowMaterial = new THREE.MeshBasicMaterial({ color: 0x8a7a5a });   // the Hall's windows: dark by day, lit at night (village.js changes the colour)
const part = (geometry, material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
};
const box = (w, h, d, material, x, y, z) => part(new THREE.BoxGeometry(w, h, d), material, x, y, z);
const cyl = (r1, r2, h, material, x, y, z, sides = 10) => part(new THREE.CylinderGeometry(r1, r2, h, sides), material, x, y, z);
const cone = (r, h, material, x, y, z, sides = 10) => part(new THREE.ConeGeometry(r, h, sides), material, x, y, z);

// The isle: grass on top, soil, and rock below, like the arena's.
export function buildIsle(radius) {
  const group = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.6, 72), M.grass);
  top.position.y = -0.3;
  top.receiveShadow = true;
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, 1.2, 72), lambert(0x8a5a2c));
  soil.position.y = -1.2;
  const rock = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.92, 7, 14), lambert(0x7d7e8c));
  rock.rotation.x = Math.PI;
  rock.position.y = -5.3;
  group.add(top, soil, rock);
  return group;
}

// A flat strip of path from one place to another.
export function buildPath(ax, az, bx, bz, width = 1.6) {
  const length = Math.hypot(bx - ax, bz - az);
  const strip = new THREE.Mesh(new THREE.BoxGeometry(width, 0.04, length), M.path);
  strip.position.set((ax + bx) / 2, 0.02, (az + bz) / 2);
  strip.rotation.y = Math.atan2(bx - ax, bz - az);
  strip.receiveShadow = true;
  return strip;
}

// The Hero Hall: a chunky hall with a red roof, two little towers with banners and a glowing door on its south side.
export function buildHall() {
  const g = new THREE.Group();
  g.add(box(7, 3, 4, M.cream, 0, 1.5, 0), box(7.4, 0.3, 4.4, M.stone, 0, 0.15, 0));
  const roof = cone(4.9, 2.4, M.roof, 0, 4.2, 0, 4);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.62;
  g.add(roof);
  for (const side of [-1, 1]) {
    g.add(cyl(0.9, 1.0, 4.4, M.cream, side * 3.8, 2.2, 0.4), cone(1.3, 1.6, M.blue, side * 3.8, 5.2, 0.4));
    g.add(box(0.05, 1.2, 0.7, M.blue, side * 3.8, 3.6, 1.45));   // a banner on the front of each tower
  }
  g.add(box(2.2, 2.7, 0.3, M.dark, 0, 1.35, 2.05));   // the door: a dark frame, and the light inside
  g.add(box(1.7, 2.3, 0.2, M.glow, 0, 1.25, 2.15));
  g.add(box(3.4, 0.5, 0.25, M.blue, 0, 3.15, 2.1));   // a sign over the door
  for (const x of [-2.5, -1.6, 1.6, 2.5]) g.add(box(0.55, 0.8, 0.12, windowMaterial, x, 1.8, 2.03));   // windows
  return g;
}

// The training yard: a sand square with a low fence, three posts with targets, and a weapon rack.
export function buildYard() {
  const g = new THREE.Group();
  const floor = box(7, 0.06, 7, M.sand, 0, 0.03, 0);
  floor.castShadow = false;
  g.add(floor);
  for (let i = -3; i <= 3; i++) for (const side of [-1, 1]) { g.add(box(0.14, 0.7, 0.14, M.dark, i, 0.35, side * 3.5), box(0.14, 0.7, 0.14, M.dark, side * 3.5, 0.35, i)); }
  for (const side of [-1, 1]) g.add(box(7, 0.1, 0.1, M.wood, 0, 0.55, side * 3.5), box(0.1, 0.1, 7, M.wood, side * 3.5, 0.55, 0));
  for (const x of [-2, 0, 2]) {
    g.add(cyl(0.12, 0.14, 1.7, M.wood, x, 0.85, -1.2), cyl(0.5, 0.5, 0.12, M.paper, x, 1.35, -1.05));
    const dot = cyl(0.25, 0.25, 0.14, M.roof, x, 1.35, -1.0);
    dot.rotation.x = Math.PI / 2;
    g.add(dot);
    g.children[g.children.length - 2].rotation.x = Math.PI / 2;
  }
  g.add(box(2, 0.12, 0.5, M.wood, 0, 1.3, 3.0), box(0.12, 1.3, 0.12, M.dark, -0.9, 0.65, 3.0), box(0.12, 1.3, 0.12, M.dark, 0.9, 0.65, 3.0));
  return g;
}

// The sparring ring: a sand circle ringed by posts and ropes, with a bell on a pole.
export function buildRing() {
  const g = new THREE.Group();
  const floor = cyl(3.8, 3.8, 0.08, M.sand, 0, 0.04, 0, 28);
  floor.castShadow = false;
  g.add(floor);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(cyl(0.1, 0.12, 0.9, M.dark, Math.sin(a) * 3.8, 0.45, Math.cos(a) * 3.8, 6));
    const next = ((i + 1) / 10) * Math.PI * 2;
    const x = (Math.sin(a) + Math.sin(next)) * 1.9;
    const z = (Math.cos(a) + Math.cos(next)) * 1.9;
    const rope = box(0.06, 0.06, 2.35, M.rope, x, 0.7, z);
    rope.rotation.y = Math.atan2(Math.sin(next) - Math.sin(a), Math.cos(next) - Math.cos(a));
    g.add(rope);
  }
  g.add(cyl(0.08, 0.08, 2.2, M.dark, 4.6, 1.1, 0, 6), cone(0.3, 0.4, lambert(0xffd24a), 4.6, 2.2, 0, 8));
  return g;
}

// The pond: water, a few reeds, lily pads and a little wooden dock.
export function buildPond() {
  const g = new THREE.Group();
  const water = cyl(3.4, 3.4, 0.1, M.water, 0, 0.0, 0, 28);
  water.castShadow = false;
  g.add(water);
  const bank = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.2, 6, 28), M.stone);
  bank.rotation.x = Math.PI / 2;
  bank.position.y = 0.05;
  g.add(bank);
  for (let i = 0; i < 9; i++) {
    const a = 0.5 + i * 0.55;
    g.add(cone(0.06, 1.0 + (i % 3) * 0.25, M.reed, Math.sin(a) * 3.0, 0.5, Math.cos(a) * 3.0, 4));
  }
  for (const [x, z] of [[-1, 0.6], [0.8, -1.1], [1.4, 1.2]]) g.add(cyl(0.45, 0.45, 0.04, M.pad, x, 0.07, z, 10));
  g.add(box(1.1, 0.1, 2.6, M.wood, 0, 0.18, 3.2), box(0.1, 0.4, 0.1, M.dark, -0.5, 0.0, 4.4), box(0.1, 0.4, 0.1, M.dark, 0.5, 0.0, 4.4));
  return g;
}

// The campfire square: a ring of stones and four log benches (the fire itself comes from campfire.js).
export function buildSquare() {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bench = cyl(0.28, 0.28, 2.2, M.wood, Math.sin(a) * 2.6, 0.32, Math.cos(a) * 2.6, 8);
    bench.rotation.z = Math.PI / 2;
    bench.rotation.y = a;
    g.add(bench);
  }
  const ground = cyl(3.6, 3.6, 0.05, M.sand, 0, 0.025, 0, 28);
  ground.castShadow = false;
  g.add(ground);
  return g;
}

// The lookout tower: four legs, a platform, a roof and a telescope.
export function buildTower() {
  const g = new THREE.Group();
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(cyl(0.15, 0.2, 5, M.dark, x * 0.9, 2.5, z * 0.9, 6));
  g.add(box(2.6, 0.25, 2.6, M.wood, 0, 4.9, 0), box(2.4, 0.5, 0.08, M.wood, 0, 5.3, 1.2), box(2.4, 0.5, 0.08, M.wood, 0, 5.3, -1.2));
  for (const x of [-1, 1]) for (const z of [-1, 1]) g.add(cyl(0.07, 0.07, 1.6, M.dark, x * 1.1, 5.8, z * 1.1, 5));
  g.add(cone(2.2, 1.2, M.roof, 0, 7.2, 0, 4), cyl(0.07, 0.07, 1.0, M.blue, 0.4, 5.5, 0.5));
  g.children[g.children.length - 2].rotation.y = Math.PI / 4;
  g.add(box(0.1, 0.1, 2.0, M.dark, 0, 2.5, 0.95));   // a ladder rail
  return g;
}

// The notice board: where the Power Rankings are posted.
export function buildBoard() {
  const g = new THREE.Group();
  g.add(box(0.14, 2.2, 0.14, M.dark, -1, 1.1, 0), box(0.14, 2.2, 0.14, M.dark, 1, 1.1, 0), box(2.5, 1.5, 0.12, M.wood, 0, 1.6, 0.05));
  for (let i = 0; i < 6; i++) g.add(box(0.5, 0.36, 0.05, M.paper, -0.75 + (i % 3) * 0.75, 1.95 - Math.floor(i / 3) * 0.55, 0.13));
  g.add(box(2.7, 0.18, 0.2, M.roof, 0, 2.5, 0.05));
  return g;
}

// A round tree and a lamp post (a glowing ball on a pole).
export function buildTree(scale = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.3, 1.5, M.dark, 0, 0.75, 0, 6), part(new THREE.SphereGeometry(1.2, 10, 8), M.leaf, 0, 2.3, 0), part(new THREE.SphereGeometry(0.85, 10, 8), M.leaf2, 0.5, 3.1, 0.2));
  g.scale.setScalar(scale);
  return g;
}
export function buildLamp() {
  const g = new THREE.Group();
  g.add(cyl(0.06, 0.08, 2.0, M.dark, 0, 1.0, 0, 5), part(new THREE.SphereGeometry(0.22, 8, 6), M.glow, 0, 2.1, 0));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,214,130,0.9)', 'rgba(255,200,100,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.y = 2.1;
  halo.scale.setScalar(2.4);
  g.add(halo);
  g.userData.halo = halo;   // (it shines at night)
  return g;
}
