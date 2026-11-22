// hero-models.js: the look of each hero, built from simple shapes. hero.js moves and animates whatever is built here.
import * as THREE from '../lib/three.module.min.js';

const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const part = (geometry, material, x = 0, y = 0, z = 0) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
};
const ball = new THREE.SphereGeometry(1, 14, 10);   // one round shape, stretched into eyes, cheeks, boots and hands

// The chubby little body every hero shares. "outfit" picks the colours.
// Returns { body, arms, feet, top, edge, materials }: hero.js swings the arms and feet, and flashes the materials when hit.
function buildBase(outfit) {
  const body = new THREE.Group();
  const skin = lambert(0xffd3b0), top = lambert(outfit.jacket), edge = lambert(outfit.trim), shoes = lambert(outfit.boot);
  const ink = lambert(0x2b1a1a), white = lambert(0xffffff), blush = lambert(0xff9a8a);

  // Torso, belt and head.
  body.add(part(new THREE.CapsuleGeometry(0.3, 0.28, 6, 14), top, 0, 0.62, 0));
  const belt = part(new THREE.TorusGeometry(0.3, 0.045, 8, 24), edge, 0, 0.5, 0);
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

  // Collar.
  const collar = part(new THREE.TorusGeometry(0.3, 0.075, 8, 20), edge, 0, 1.0, 0);
  collar.rotation.x = Math.PI / 2;
  body.add(collar);

  // Arms swing from the shoulders and feet from the hips (left, then right).
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.34, 0.9, 0);
    arm.rotation.z = side * 0.3;
    const hand = part(ball, skin, 0, -0.36, 0);
    hand.scale.setScalar(0.09);
    arm.add(part(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), top, 0, -0.17, 0), hand);
    body.add(arm);
    return arm;
  });
  const feet = [-1, 1].map((side) => {
    const foot = part(ball, shoes, side * 0.14, 0.14, 0.04);
    foot.scale.set(0.15, 0.12, 0.21);
    body.add(foot);
    return foot;
  });

  return { body, arms, feet, top, edge, materials: [skin, top, edge, shoes, ink, white, blush] };
}

// A scarf or cape that hangs from the back of the neck and streams out behind when running.
function buildTail(width, length, material) {
  const tail = new THREE.Group();
  tail.position.set(0, 1.0, -0.28);
  tail.add(part(new THREE.BoxGeometry(width, 0.05, length), material, 0, 0, -length / 2 + 0.01));
  return tail;
}

// --- Ember: red jacket, gold scarf, and hair made of flames ---

// One row per flame: [x, y, z, width, height, tilt forward/back, tilt sideways, colour number]
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

function buildEmber() {
  const base = buildBase({ jacket: 0xe8452c, trim: 0xffb42e, boot: 0x6b2d1f });
  const tail = buildTail(0.2, 0.55, base.edge);
  base.body.add(tail);
  const flameMaterials = FLAME_COLORS.map((color) => new THREE.MeshBasicMaterial({ color }));
  const flames = FLAMES.map(([x, y, z, width, height, tiltX, tiltZ, colour], i) => {
    const shape = new THREE.ConeGeometry(width, height, 6).translate(0, height / 2, 0);   // pivots from its base so it can flicker
    const flame = part(shape, flameMaterials[colour], x, y, z);
    base.body.add(flame);
    return { flame, tiltX, tiltZ, phase: i * 1.7 };
  });
  return {
    ...base,
    // Called every frame. "run" is 0 when standing and 1 at full speed. "fall" is 1 when knocked out.
    animate(time, run, fall) {
      for (const f of flames) {
        f.flame.scale.y = (1 + Math.sin(time * 9 + f.phase) * 0.12) * (1 - fall * 0.75);   // flames shrink when she is out
        f.flame.rotation.x = f.tiltX - run * 0.4;   // flames stream backwards as she runs
        f.flame.rotation.z = f.tiltZ + Math.sin(time * 6 + f.phase) * 0.06;
      }
      tail.rotation.x = -0.45 + run * 1.1 + Math.sin(time * 14) * 0.08 * run;
      tail.rotation.y = Math.sin(time * 9) * 0.25 * run;
    },
  };
}

// --- Sol: white and gold, soft pale-gold hair swept back, a glowing star on the chest, drifting motes of light ---

// One row per hair spike: [x, y, z, width, height, tilt forward/back, tilt sideways, colour number]
const SOL_HAIR = [
  [0, 1.64, -0.02, 0.15, 0.46, -0.7, 0, 0],
  [0.16, 1.62, -0.04, 0.13, 0.4, -0.65, -0.3, 1],
  [-0.16, 1.62, -0.04, 0.13, 0.4, -0.65, 0.3, 1],
  [0.28, 1.5, -0.04, 0.11, 0.34, -0.55, -0.7, 0],
  [-0.28, 1.5, -0.04, 0.11, 0.34, -0.55, 0.7, 0],
  [0, 1.6, 0.16, 0.12, 0.28, 0.3, 0, 1],
  [0.12, 1.62, 0.1, 0.1, 0.26, 0.1, -0.35, 0],
  [-0.12, 1.62, 0.1, 0.1, 0.26, 0.1, 0.35, 0],
];

function starShape(outer, inner) {   // a five-pointed star
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? inner : outer;
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) shape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  shape.closePath();
  return shape;
}

function buildSol() {
  const base = buildBase({ jacket: 0xfff4dc, trim: 0xffc93c, boot: 0xc99a4a });
  const { body } = base;
  const hairMaterials = [lambert(0xf3cf6a, { emissive: 0x4a3a08 }), lambert(0xfff0b0, { emissive: 0x4a3a08 })];   // they glow a little
  const spikes = SOL_HAIR.map(([x, y, z, width, height, tiltX, tiltZ, colour]) => {
    const spike = part(new THREE.ConeGeometry(width, height, 6).translate(0, height / 2, 0), hairMaterials[colour], x, y, z);
    spike.rotation.set(tiltX, 0, tiltZ);
    body.add(spike);
    return { spike, tiltX };
  });

  const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape(0.1, 0.045)), new THREE.MeshBasicMaterial({ color: 0xffc93c, side: THREE.DoubleSide }));
  star.position.set(0, 0.68, 0.305);   // on the front of the jacket
  body.add(star);

  const cape = buildTail(0.42, 0.62, base.top);
  cape.add(part(new THREE.BoxGeometry(0.42, 0.055, 0.08), base.edge, 0, 0, -0.6));   // a gold hem
  body.add(cape);

  const moteMaterial = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const motes = Array.from({ length: 5 }, () => {
    const mote = new THREE.Mesh(ball, moteMaterial);
    body.add(mote);
    return mote;
  });

  return {
    ...base,
    animate(time, run, fall) {
      cape.rotation.x = -0.45 + run * 1.0 + Math.sin(time * 12) * 0.07 * run;
      cape.rotation.y = Math.sin(time * 8) * 0.2 * run;
      for (const s of spikes) s.spike.rotation.x = s.tiltX - run * 0.25;   // the hair sweeps back when running
      star.scale.setScalar(1 + Math.sin(time * 3) * 0.1);
      motes.forEach((mote, i) => {   // little lights circle slowly around the hero
        const angle = time * 1.2 + (i / motes.length) * Math.PI * 2;
        mote.position.set(Math.cos(angle) * 0.62, 0.62 + Math.sin(time * 1.7 + i * 2) * 0.2, Math.sin(angle) * 0.62);   // at body height, never across the face
        mote.scale.setScalar((0.045 + Math.sin(time * 4 + i) * 0.02) * (1 - fall * 0.8));
      });
    },
  };
}

const BUILDERS = { ember: buildEmber, sol: buildSol };

// "kind" is the hero's key in heroes-data.js, for example 'sol'.
export function buildHeroModel(kind) {
  return BUILDERS[kind]();
}
