// boss-model.js: what General Bramble looks like, built from simple shapes: a tall hedge-knight of twisted vines with a leaf
// crown, thorn shoulders and glowing amber eyes, and the tired young gardener he turns back into when he is beaten.
import * as THREE from '../lib/three.module.min.js';

const lambert = (color) => new THREE.MeshLambertMaterial({ color });
const ball = new THREE.SphereGeometry(1, 14, 10);
const thornShape = new THREE.ConeGeometry(0.17, 0.8, 6);
const leafShape = new THREE.ConeGeometry(0.2, 0.75, 4);   // a pointed leaf
const part = (geometry, material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
};

// Returns { group, arms, eyes, materials }: boss.js raises the arms, makes the eyes glare and flashes the materials.
export function buildBramble() {
  const group = new THREE.Group();
  const bark = lambert(0x6b4a2a), leaf = lambert(0x3f8f3a), dark = lambert(0x28602a), thorn = lambert(0xe3d08a), vine = lambert(0x58852f);
  const glow = new THREE.MeshBasicMaterial({ color: 0xffb42e });

  for (const side of [-1, 1]) group.add(part(new THREE.CylinderGeometry(0.4, 0.58, 1.3, 8), bark, side * 0.62, 0.65, 0));   // two root columns for legs
  const torso = part(ball, leaf, 0, 2.15, 0);
  torso.scale.set(1.3, 1.4, 1.05);
  group.add(torso);
  for (let i = 0; i < 6; i++) {   // vines and leaf patches wrapped round the middle
    const a = (i / 6) * Math.PI * 2;
    const patch = part(ball, i % 2 ? dark : vine, Math.sin(a) * 1.05, 1.75 + (i % 3) * 0.42, Math.cos(a) * 0.85);
    patch.scale.set(0.38, 0.3, 0.3);
    group.add(patch);
  }

  const belt = part(new THREE.TorusGeometry(1.15, 0.14, 8, 28), bark, 0, 1.45, 0);   // a thick vine round the waist
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.85, 1);
  group.add(belt);
  for (let i = 0; i < 9; i++) {   // a ruff of leaves round the neck
    const a = (i / 9) * Math.PI * 2;
    const ruff = part(leafShape, i % 2 ? leaf : dark, Math.sin(a) * 0.85, 3.5, 0.1 + Math.cos(a) * 0.8);
    ruff.rotation.set(Math.cos(a) * 1.0, 0, -Math.sin(a) * 1.0);
    ruff.scale.setScalar(1.15);
    group.add(ruff);
  }
  const head = part(ball, bark, 0, 4.0, 0.1);
  head.scale.set(0.72, 0.68, 0.7);
  group.add(head);
  const eyes = [-1, 1].map((side) => {
    const eye = part(ball, glow, side * 0.27, 4.05, 0.8);   // (on the front of the head, not inside it)
    eye.scale.set(0.2, 0.12, 0.08);
    const brow = part(new THREE.BoxGeometry(0.46, 0.1, 0.1), dark, side * 0.27, 4.28, 0.82);
    brow.rotation.z = side * 0.45;
    group.add(eye, brow);
    return eye;
  });
  group.add(part(new THREE.BoxGeometry(0.46, 0.08, 0.1), dark, 0, 3.75, 0.78));   // a grim mouth
  for (let i = 0; i < 8; i++) {   // the leaf crown
    const a = (i / 8) * Math.PI * 2;
    const crownLeaf = part(leafShape, i % 2 ? leaf : dark, Math.sin(a) * 0.5, 4.65, 0.1 + Math.cos(a) * 0.5);
    crownLeaf.rotation.set(Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4);
    crownLeaf.scale.set(1.1, 1.3, 1.1);
    group.add(crownLeaf);
  }

  const arms = [-1, 1].map((side) => {   // each arm hangs from a shoulder and swings (or rises) from there
    const arm = new THREE.Group();
    arm.position.set(side * 1.6, 3.0, 0);
    const shoulder = part(ball, dark, 0, 0.1, 0);
    shoulder.scale.setScalar(0.62);
    arm.add(shoulder, part(new THREE.CylinderGeometry(0.28, 0.36, 1.7, 8), vine, 0, -0.9, 0));
    const fist = part(ball, bark, 0, -1.85, 0);
    fist.scale.setScalar(0.5);
    arm.add(fist);
    for (let i = 0; i < 6; i++) {   // thorns round the shoulder
      const a = (i / 6) * Math.PI * 2;
      const spike = part(thornShape, thorn, Math.sin(a) * 0.52, 0.5, Math.cos(a) * 0.52);
      spike.rotation.set(Math.cos(a) * 0.8, 0, -Math.sin(a) * 0.8);
      arm.add(spike);
    }
    group.add(arm);
    return arm;
  });
  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  return { group, arms, eyes, glow, materials: [bark, leaf, dark, thorn, vine] };
}

// The young gardener Bramble was before the Rift: small, tired, in a green tunic with a leaf in his hair.
export function buildYoungBramble() {
  const group = new THREE.Group();
  const skin = lambert(0xffd3b0), tunic = lambert(0x4d9a3e), trim = lambert(0xd9c27a), boots = lambert(0x5a3a1c), hair = lambert(0x6b4a2a), leaf = lambert(0x58a838), ink = lambert(0x2b1a1a);
  group.add(part(new THREE.CapsuleGeometry(0.3, 0.28, 6, 14), tunic, 0, 0.62, 0), part(new THREE.SphereGeometry(0.4, 18, 14), skin, 0, 1.3, 0));
  const belt = part(new THREE.TorusGeometry(0.3, 0.045, 8, 24), trim, 0, 0.5, 0);
  belt.rotation.x = Math.PI / 2;
  const cap = part(ball, hair, 0, 1.45, -0.03);   // messy hair
  cap.scale.set(0.43, 0.3, 0.43);
  const sprig = part(leafShape, leaf, 0.12, 1.82, 0);
  sprig.scale.setScalar(0.5);
  sprig.rotation.z = -0.5;
  group.add(belt, cap, sprig);
  for (const side of [-1, 1]) {   // tired eyes: a closed, drooping arc
    const eye = part(new THREE.TorusGeometry(0.06, 0.014, 6, 12, Math.PI), ink, side * 0.15, 1.3, 0.375);
    eye.rotation.z = Math.PI;
    const arm = part(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), tunic, side * 0.33, 0.7, 0);
    arm.rotation.z = side * 0.15;
    const foot = part(ball, boots, side * 0.14, 0.14, 0.04);
    foot.scale.set(0.15, 0.12, 0.21);
    group.add(eye, arm, foot);
  }
  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });
  return { group, materials: [skin, tunic, trim, boots, hair, leaf, ink] };
}
