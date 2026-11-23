// member-model.js: draws a clan member from their look (character-gen.js): a chubby little body like the heroes', with the hair,
// hat, outfit and accessory the look says. There are many of them, so each is built from few shapes, with no shadows (a soft blob
// under the feet instead), and the small details are in a group that is switched off when they are far away.
import * as THREE from '../lib/three.module.min.js';

const ball = new THREE.SphereGeometry(1, 10, 8);
const body = new THREE.CapsuleGeometry(0.3, 0.28, 4, 10);
const limb = new THREE.CapsuleGeometry(0.075, 0.2, 3, 6);
const cone = new THREE.ConeGeometry(0.1, 0.34, 5);
const ring = new THREE.TorusGeometry(1, 0.12, 5, 14);
const box = new THREE.BoxGeometry(1, 1, 1);
const blob = new THREE.CircleGeometry(0.5, 14);
const SIZE = { round: [1.12, 0.96], tall: [0.92, 1.14], small: [0.88, 0.84] };   // [width, height] of the whole person

const materials = new Map();   // one material for each colour, shared by everybody
const lambert = (color) => {
  if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color }));
  return materials.get(color);
};
const blobMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
const part = (geometry, color, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) => {
  const mesh = new THREE.Mesh(geometry, lambert(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  return mesh;
};

// Returns { group, arms, feet, head, fine }: clan.js swings the arms and feet, and switches "fine" off for far-away people.
export function buildMember(look) {
  const group = new THREE.Group();
  const person = new THREE.Group();   // the person, sized by their body shape
  const [width, height] = SIZE[look.body];
  person.scale.set(width, height, width);
  group.add(person);
  const shadow = new THREE.Mesh(blob, blobMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.03;
  shadow.scale.set(width * 1.1, width * 1.1, 1);
  group.add(shadow);

  const head = new THREE.Group();
  head.position.y = 1.3;
  head.add(part(ball, look.skin, 0, 0, 0, 0.4));
  person.add(part(body, look.outfit, 0, 0.62, 0), head);
  const belt = part(ring, look.trim, 0, 0.5, 0, 0.3);
  belt.rotation.x = Math.PI / 2;
  belt.scale.z = 0.4;
  person.add(belt);

  // Hair, on top and (for some) behind.
  const hair = look.hairColor;
  const cap = part(ball, hair, 0, 0.12, -0.03, 0.43, 0.3, 0.43);
  if (look.hair === 'spiky') for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const tip = part(cone, hair, Math.sin(a) * 0.22, 0.42, Math.cos(a) * 0.22, 1.1, 1.3, 1.1); tip.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); head.add(tip); }
  else head.add(cap);
  if (look.hair === 'bun') head.add(part(ball, hair, 0, 0.5, -0.05, 0.17));
  if (look.hair === 'long') head.add(part(body, hair, 0, -0.2, -0.3, 1.1, 1.3, 0.6));
  if (look.hair === 'tuft') { const tuft = part(cone, hair, 0.05, 0.5, 0.1, 1, 1.2, 1); tuft.rotation.z = -0.4; head.add(tuft); }

  // A hat, if there is one.
  if (look.hat === 'cap') { head.add(part(ball, look.hatColor, 0, 0.2, 0, 0.44, 0.22, 0.44)); head.add(part(box, look.hatColor, 0, 0.16, 0.4, 0.34, 0.04, 0.22)); }
  else if (look.hat === 'hood') { head.add(part(ball, look.hatColor, 0, 0.08, -0.08, 0.5, 0.48, 0.48)); head.add(part(cone, look.hatColor, 0, 0.5, -0.3, 1.5, 1.8, 1.5)); }
  else if (look.hat === 'headband') { const band = part(ring, look.hatColor, 0, 0.18, 0, 0.4); band.rotation.x = Math.PI / 2; band.scale.set(0.4, 0.4, 0.5); head.add(band); }
  else if (look.hat === 'flower') for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; head.add(part(ball, 0xff8fb0, 0.16 + Math.sin(a) * 0.08, 0.45, Math.cos(a) * 0.08, 0.07)); }

  // Details you only see close up: eyes, glasses, the scarf, the satchel.
  const fine = new THREE.Group();
  for (const side of [-1, 1]) fine.add(part(ball, 0x2b1a1a, side * 0.15, 1.3, 0.37, 0.06, 0.09, 0.04));
  if (look.accessory === 'glasses') for (const side of [-1, 1]) { const lens = part(ring, 0x2b1a1a, side * 0.15, 1.31, 0.4, 0.1); lens.scale.z = 0.5; fine.add(lens); }
  if (look.accessory === 'scarf') { const wrap = part(ring, look.accessoryColor, 0, 1.0, 0, 0.3); wrap.rotation.x = Math.PI / 2; wrap.scale.set(0.3, 0.3, 0.6); fine.add(wrap, part(box, look.accessoryColor, 0.1, 0.8, 0.28, 0.12, 0.3, 0.05)); }
  if (look.accessory === 'satchel') fine.add(part(box, look.accessoryColor, -0.32, 0.4, 0.05, 0.12, 0.2, 0.2));
  person.add(fine);

  // Arms swing from the shoulders and feet from the hips (left, then right).
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.34, 0.9, 0);
    arm.rotation.z = side * 0.3;
    arm.add(part(limb, look.outfit, 0, -0.17, 0), part(ball, look.skin, 0, -0.36, 0, 0.09));
    person.add(arm);
    return arm;
  });
  const feet = [-1, 1].map((side) => {
    const foot = part(ball, 0x5a3a1c, side * 0.14, 0.14, 0.04, 0.15, 0.12, 0.21);
    person.add(foot);
    return foot;
  });
  return { group, person, arms, feet, head, fine };
}
