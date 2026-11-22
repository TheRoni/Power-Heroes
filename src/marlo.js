// marlo.js: Keeper Marlo, the old warrior who teaches the player. Built from simple shapes: a long grey-blue cloak,
// a big white beard and bushy brows, and a tall staff with a lantern that never goes out.
import * as THREE from '../lib/three.module.min.js';
import { lambert, part, starShape } from './hero-models.js';
import { createGlow } from './pip.js';

const HOME = { x: -5.4, z: -8.6 };   // where he waits and watches during a fight
const SPEED = 2.4;                    // walking speed, in units per second
const EDGE = 11.2;                    // he stays on the island
const STEP_ASIDE = 2.4;               // at his post he shuffles out of the way when a hero comes this close
const LIFT = 0.24;                    // how far the staff rises when he raises the lantern
const UP = new THREE.Vector3(0, 1, 0);
const ball = new THREE.SphereGeometry(1, 14, 10);
const SHOULDER_STAFF = new THREE.Vector3(0.62, 1.5, 0.02);
const SHOULDER_FREE = new THREE.Vector3(-0.62, 1.5, 0.02);
const HAND_STAFF = new THREE.Vector3(0.82, 0.98, 0.22);   // the hand that holds the staff, with the lantern lowered
const HAND_FREE = new THREE.Vector3(-0.5, 0.98, 0.42);    // the other hand rests at his belt
const turnBy = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));   // the short way round

// Stretches a unit-length capsule so it runs from one point to another (a sleeve from shoulder to hand).
function stretch(sleeve, from, to, scratch) {
  scratch.subVectors(to, from);
  sleeve.position.copy(from).addScaledVector(scratch, 0.5);
  sleeve.scale.set(1, scratch.length(), 1);
  sleeve.quaternion.setFromUnitVectors(UP, scratch.normalize());
}

// "scene" is where he is added. "emit" (optional) throws a spark: emit(x, y, z, vx, vy, vz, life, size, colour, gravity).
export function createMarlo({ scene, emit }) {
  const group = new THREE.Group();   // moves and turns
  const body = new THREE.Group();    // sways and bobs inside it
  group.add(body);
  const robe = lambert(0x56708f), cape = lambert(0x6a85a8), skin = lambert(0xe9c7a4), white = lambert(0xf4f1ea);
  const leather = lambert(0x6b4a2b), gold = lambert(0xe2b84a), wood = lambert(0x8a5a35), ink = lambert(0x2b1a1a);

  // Cloak, shoulders, belt, and the pin: a crescent around a star. (That crest matters later in the story.)
  body.add(part(new THREE.CylinderGeometry(0.46, 0.8, 1.55, 14), robe, 0, 0.78, 0));
  const shoulders = part(ball, cape, 0, 1.55, 0);
  shoulders.scale.set(0.64, 0.28, 0.5);
  const belt = part(new THREE.TorusGeometry(0.58, 0.06, 8, 24), leather, 0, 0.92, 0);
  belt.rotation.x = Math.PI / 2;
  const pin = new THREE.Group();
  pin.position.set(0.4, 1.36, 0.34);
  pin.rotation.y = 0.5;
  const crescent = part(new THREE.TorusGeometry(0.07, 0.016, 6, 16, Math.PI * 1.5), gold);
  crescent.rotation.z = Math.PI * 0.75;
  pin.add(crescent, part(new THREE.ShapeGeometry(starShape(0.04, 0.018)), gold));
  // A hint of the warrior he used to be: a steel guard on the staff shoulder, and a gold hem on the cloak.
  const guard = part(ball, lambert(0x8d98a8), 0.64, 1.64, 0.02);
  guard.scale.set(0.28, 0.17, 0.28);
  const hem = part(new THREE.TorusGeometry(0.79, 0.03, 6, 28), gold, 0, 0.05, 0);
  hem.rotation.x = Math.PI / 2;
  body.add(shoulders, belt, guard, hem, part(new THREE.BoxGeometry(0.16, 0.14, 0.05), gold, 0, 0.92, 0.6), pin);

  // Head: white hair behind a weathered face, a round nose, bushy brows, a moustache and kind eyes.
  body.add(part(new THREE.SphereGeometry(0.38, 20, 16), skin, 0, 2.05, 0));
  const hair = part(new THREE.SphereGeometry(0.4, 18, 14), white, 0, 2.1, -0.12);
  const nose = part(ball, lambert(0xe3a98c), 0, 2.03, 0.385);
  nose.scale.setScalar(0.075);
  body.add(hair, nose);
  for (const side of [-1, 1]) {
    const eye = part(ball, ink, side * 0.14, 2.1, 0.345);
    eye.scale.set(0.045, 0.06, 0.03);
    const brow = part(ball, white, side * 0.14, 2.2, 0.32);
    brow.scale.set(0.11, 0.05, 0.07);
    brow.rotation.z = -side * 0.2;   // raised a little in the middle: kind, not stern
    const moustache = part(ball, white, side * 0.1, 1.98, 0.37);
    moustache.scale.set(0.15, 0.05, 0.08);
    moustache.rotation.z = -side * 0.25;
    body.add(eye, brow, moustache);
  }
  const beard = new THREE.Group();   // hangs from the chin and sways
  beard.position.set(0, 2.0, 0.2);
  const beardShape = part(ball, white, 0, -0.42, 0.04);
  beardShape.scale.set(0.37, 0.5, 0.3);
  beard.add(beardShape);
  body.add(beard);

  // Arms: sleeves stretched from the shoulders to the hands. One hand holds the staff, the other rests at the belt.
  const sleeve = new THREE.CapsuleGeometry(0.12, 1, 4, 8);
  const sleeveStaff = part(sleeve, robe);
  const sleeveFree = part(sleeve, robe);
  const handStaff = part(ball, skin);
  const handFree = part(ball, skin);
  handStaff.scale.setScalar(0.11);
  handFree.scale.setScalar(0.11);
  body.add(sleeveStaff, sleeveFree, handStaff, handFree);
  stretch(sleeveFree, SHOULDER_FREE, HAND_FREE, new THREE.Vector3());
  handFree.position.copy(HAND_FREE);

  // The staff, with a lantern on top. It rises a little when the lantern is raised.
  const staff = new THREE.Group();
  staff.position.set(HAND_STAFF.x, 0, HAND_STAFF.z);
  staff.add(part(new THREE.CylinderGeometry(0.04, 0.05, 2.75, 8), wood, 0, 1.375, 0));
  const lantern = new THREE.Group();
  lantern.position.y = 2.78;
  lantern.add(
    part(new THREE.ConeGeometry(0.15, 0.16, 8), gold, 0, 0.22, 0),
    part(new THREE.CylinderGeometry(0.12, 0.1, 0.28, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }), 0, 0.02, 0),
    part(new THREE.CylinderGeometry(0.11, 0.07, 0.07, 8), gold, 0, -0.15, 0),
  );
  const glow = createGlow({ inner: 'rgba(255, 236, 170, 1)', mid: 'rgba(255, 170, 70, 0.6)', outer: 'rgba(255, 140, 40, 0)' }, 1.8);
  glow.position.y = 0.02;
  lantern.add(glow);
  staff.add(lantern);
  body.add(staff);
  group.traverse((object) => { if (object.isMesh) object.castShadow = true; });

  group.position.set(HOME.x, 0, HOME.z);
  scene.add(group);

  const p = group.position;
  const scratch = new THREE.Vector3();
  const hand = new THREE.Vector3();
  let post = { x: HOME.x, z: HOME.z };   // where he is heading, or waiting
  let atHome = true;                     // at home he watches the hero and shuffles aside; sent elsewhere he stays put
  let yaw = 0;
  let raised = false;                    // is the lantern raised?
  let level = 0;                         // how raised it is right now, 0 to 1 (it eases up and down)
  let walk = 0;                          // 0 = standing, 1 = walking (eases)
  let sparkTimer = 0;

  // Sends him to a spot. He stays there until goHome().
  function walkTo(x, z) {
    post = { x, z };
    atHome = false;
  }

  function goHome() {
    post = { x: HOME.x, z: HOME.z };
    atHome = true;
  }

  function raise(on) {
    raised = on;
  }

  // Called every frame. "hero" is the position of the hero he watches (and steps aside for).
  function update(dt, time, hero) {
    // Where to go: his post, unless he is at home and the hero comes too close.
    let goal = post;
    if (atHome && hero) {
      const ax = p.x - hero.x;
      const az = p.z - hero.z;
      const apart = Math.hypot(ax, az);
      if (apart < STEP_ASIDE) goal = { x: hero.x + (ax / (apart || 1)) * (STEP_ASIDE + 0.4), z: hero.z + (az / (apart || 1)) * (STEP_ASIDE + 0.4) };
    }

    // Walk there, or stand and watch the hero.
    const gx = goal.x - p.x;
    const gz = goal.z - p.z;
    const distance = Math.hypot(gx, gz);
    let moving = false;
    if (distance > 0.08) {
      const step = Math.min(distance, SPEED * dt);
      p.x += (gx / distance) * step;
      p.z += (gz / distance) * step;
      moving = distance > 0.15;
      yaw += turnBy(yaw, Math.atan2(gx, gz)) * (1 - Math.exp(-8 * dt));
    } else if (hero) {
      yaw += turnBy(yaw, Math.atan2(hero.x - p.x, hero.z - p.z)) * (1 - Math.exp(-4 * dt));
    }
    const fromCentre = Math.hypot(p.x, p.z);
    if (fromCentre > EDGE) { p.x *= EDGE / fromCentre; p.z *= EDGE / fromCentre; }
    group.rotation.y = yaw;

    // Animate: a slow waddle when walking, breathing and a swaying beard when standing, a flickering lantern.
    walk += ((moving ? 1 : 0) - walk) * (1 - Math.exp(-8 * dt));
    level += ((raised ? 1 : 0) - level) * (1 - Math.exp(-3 * dt));
    body.position.y = Math.abs(Math.sin(time * 7)) * 0.05 * walk;
    body.rotation.z = Math.sin(time * 7) * 0.04 * walk + 0.02;   // a little lean on the staff
    body.scale.y = 1 + Math.sin(time * 1.6) * 0.012;
    beard.rotation.z = Math.sin(time * 1.3) * 0.05 + Math.sin(time * 7) * 0.08 * walk;
    beard.rotation.x = 0.1 * walk;

    staff.position.y = level * LIFT;
    hand.set(HAND_STAFF.x, HAND_STAFF.y + level * LIFT, HAND_STAFF.z);
    handStaff.position.copy(hand);
    stretch(sleeveStaff, SHOULDER_STAFF, hand, scratch);
    const flicker = 1 + Math.sin(time * 9) * 0.05 + Math.sin(time * 23) * 0.03;
    glow.scale.setScalar((1.8 + level * 1.0) * flicker);
    glow.material.opacity = 0.85 + level * 0.15 + Math.sin(time * 11) * 0.06;

    // Warm sparks drift up from the lantern (more when it is raised).
    sparkTimer -= dt;
    if (emit && sparkTimer <= 0) {
      sparkTimer = 0.5 - level * 0.3;
      const x = p.x + HAND_STAFF.x * Math.cos(yaw) + HAND_STAFF.z * Math.sin(yaw);
      const z = p.z - HAND_STAFF.x * Math.sin(yaw) + HAND_STAFF.z * Math.cos(yaw);
      emit(x + (Math.random() - 0.5) * 0.2, 2.85 + level * LIFT, z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.3, 0.6, (Math.random() - 0.5) * 0.3, 1.0, 0.07, 0xffcf7a, 0);
    }
  }

  return {
    group, position: p, walkTo, goHome, raise, update,
    get arrived() { return Math.hypot(post.x - p.x, post.z - p.z) < 0.15; },
    get atHome() { return atHome; },
    get yaw() { return yaw; },
    get lantern() { return level; },   // 0 = lowered, 1 = fully raised
  };
}
