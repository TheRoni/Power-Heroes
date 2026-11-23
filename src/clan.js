// clan.js: the clan of the Home Village, Marlo's old clan. The people are made by character-gen.js and drawn by member-model.js; here they
// live in the village: each has a spot they like (the yard, the ring, the pond, the fire, the tower, the notice board), stands about or
// wanders a little, turns to look at you when you come close, and has an aura that shows their Power at a glance. A small tag with their
// name and Power appears over the ones near you. (Stage 11 gives them daily lives; for now they idle.)
import * as THREE from '../lib/three.module.min.js';
import { makeClan, makeRandom } from './character-gen.js';
import { buildMember } from './member-model.js';
import { JOBS, PARTNERS, buildProps, createSparks, act, stand } from './activities.js';
import { tierIndex, shortNumber } from './power.js';
import { TYPE_COLORS } from './types.js';

// Where each person likes to be, and what they look at from there: [x, z, lookX, lookZ].
const SPOTS = [
  [-13, -4.5, -11.5, -3], [-10, -1.4, -11.5, -3], [-13.2, -0.8, -11.5, -3],   // the training yard
  [10.3, -3, 12.7, -3], [12.7, -3, 10.3, -3], [11.5, -5.8, 11.5, -3],          // the sparring ring (the first two spar, the third cheers)
  [-6.3, 6.4, -10, 8], [-12.6, 4.6, -10, 8],                                  // the pond
  [-1.2, 6.6, 1.5, 5.5], [4.2, 4.5, 1.5, 5.5], [2.0, 8.3, 1.5, 5.5],          // the fire
  [10.2, 7.3, 12.5, 9],                                                        // the tower
  [-6.9, -7.7, -5, -9.5], [-3.5, -7.2, -5, -9.5],                              // the notice board
];
// Where everybody sits round the fire at night: two rings.
const FIRE = { x: 1.5, z: 5.5 };
const SEATS = [...Array(8).keys()].map((k) => [FIRE.x + Math.sin(k * Math.PI / 4 + 0.4) * 2.8, FIRE.z + Math.cos(k * Math.PI / 4 + 0.4) * 2.8])
  .concat([...Array(6).keys()].map((k) => [FIRE.x + Math.sin(k * Math.PI / 3) * 4.0, FIRE.z + Math.cos(k * Math.PI / 3) * 4.0]));
const GATHER_AT = 0.55;   // how dark it must be (0 to 1) for the clan to go to the fire, and below which they go home
const WANDER = 1.1;     // how far from their spot they stroll
const SPEED = 1.1;      // how fast they stroll
const HURRY = 1.7;      // ...and how fast they walk to the fire or back
const NEAR = 4.5;       // closer than this and they turn to look at you
const TAG_RANGE = 6.5;  // closer than this and their name tag shows
const FAR = 15;         // farther than this and they are drawn with fewer details

const turnBy = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const glowCache = new Map();   // one soft disc material for each colour and strength
function glowMaterial(color, opacity) {
  const key = `${color}:${opacity}`;
  if (!glowCache.has(key)) glowCache.set(key, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  return glowCache.get(key);
}
const disc = new THREE.CircleGeometry(1, 20);
const flameShape = new THREE.ConeGeometry(0.5, 1.9, 8, 1, true);

// An aura for a Power: a glow at the feet (Spark), a bigger one and soft body light (Glow), and from 300 (Blaze) a flickering flame of light.
function buildAura(power, type) {
  const color = TYPE_COLORS[type].hex;
  const tier = tierIndex(power);
  const group = new THREE.Group();
  const floor = new THREE.Mesh(disc, glowMaterial(color, 0.22 + tier * 0.06));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.05;
  floor.scale.setScalar(0.8 + tier * 0.35);
  group.add(floor);
  let flame = null;
  if (tier >= 1) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), glowMaterial(color, 0.12));
    body.position.y = 0.9;
    body.scale.set(0.75, 1.15, 0.75);
    group.add(body);
  }
  if (tier >= 2) {
    flame = new THREE.Mesh(flameShape, glowMaterial(color, 0.3));
    flame.position.y = 1.0;
    group.add(flame);
  }
  return { group, flame };
}

// "scene" is where they are drawn; "camera" and "tags" (a page element) are for the name tags; "seed" makes the same clan every time.
export function createClan({ scene, camera, tags, seed = 7, count = 14 }) {
  const rand = makeRandom(seed + 99);
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const fx = createSparks(group);   // little sparks for training and sparring
  const spot = new THREE.Vector3();
  const members = makeClan(seed, count).map((person, i) => {
    const [x, z, lookX, lookZ] = SPOTS[i % SPOTS.length];
    const model = buildMember(person.look);
    const aura = buildAura(person.power, person.type);
    model.group.add(aura.group);
    model.group.position.set(x, 0, z);
    const yaw = Math.atan2(lookX - x, lookZ - z);
    model.group.rotation.y = yaw;
    group.add(model.group);
    const tag = document.createElement('div');
    tag.className = 'tag';
    tag.innerHTML = `<b>${person.name}</b> <span>Power ${shortNumber(person.power)}</span>`;
    tag.style.setProperty('--c', TYPE_COLORS[person.type].css);
    tag.hidden = true;
    tags.appendChild(tag);
    return { ...person, index: i, job: JOBS[i % JOBS.length], partner: PARTNERS[i], props: buildProps(model.person, model.group), doing: false, rest: 2 + rand() * 8, workLeft: 0, t: 0, lastFlare: -1, model, aura, tag, home: { x, z }, seat: { x: SEATS[i % SEATS.length][0], z: SEATS[i % SEATS.length][1] }, look: { x: lookX, z: lookZ }, yaw, goal: null, wait: rand() * 4, phase: rand() * 6.28, walk: 0, sit: 0, atNight: false, sitting: false, stir: 0, position: model.group.position };
  });

  // Every frame. "hero" is where the player is, and "night" how dark it is (0 to 1): at night they go and sit round the fire, and in
  // the morning they go back to their own spots. People far away only move; people near show their details.
  const ctx = { dt: 0, members, spark: (...a) => fx.spark(...a) };
  function update(dt, time, hero, night = 0) {
    if (!group.visible) return;
    ctx.dt = dt;
    fx.update(dt);
    let shown = 0;
    for (const m of members) {
      const p = m.position;
      const away = Math.hypot(hero.x - p.x, hero.z - p.z);
      // Night falls (or the day comes): each one sets off a moment after the others, to the fire or back home.
      const wantSeat = night > GATHER_AT;
      if (wantSeat !== m.atNight) { m.atNight = wantSeat; m.sitting = false; m.stir = rand() * 6; m.goal = null; m.leaving = true; }
      if (m.leaving && (m.stir -= dt) <= 0) { m.leaving = false; m.goal = { ...(wantSeat ? m.seat : m.home), fast: true }; }
      // By day each one does their own job for a while (training, sparring, fishing...) and then rests and strolls; see activities.js.
      // Two who spar do it together (the second follows the first).
      const free = !m.atNight && !m.leaving && !m.goal && !m.sitting;
      if (m.partner !== undefined && m.index > m.partner) { m.doing = free && members[m.partner].doing; m.t = members[m.partner].t; }
      else if (m.doing && (!free || (m.workLeft -= dt) <= 0)) { m.doing = false; stand(m); m.rest = 4 + rand() * 6; }
      else if (!m.doing && free && (m.rest -= dt) <= 0) { m.doing = true; m.t = 0; m.workLeft = 10 + rand() * 8; }
      if (!m.doing && m.wasDoing) stand(m);
      m.wasDoing = m.doing;
      // Stroll: wait a while, pick a spot near home, walk there.
      let moving = false;
      if (m.goal) {
        const gx = m.goal.x - p.x;
        const gz = m.goal.z - p.z;
        const d = Math.hypot(gx, gz);
        if (d < 0.12) { m.sitting = m.atNight; m.goal = null; m.wait = 2 + rand() * 5; }
        else {
          const speed = m.goal.fast ? HURRY : SPEED;
          p.x += (gx / d) * speed * dt;
          p.z += (gz / d) * speed * dt;
          m.yaw += turnBy(m.yaw, Math.atan2(gx, gz)) * (1 - Math.exp(-6 * dt));
          moving = true;
        }
      } else if (m.sitting) {   // sitting round the fire: facing it (and looking at you if you come close)
        const [lx, lz] = away < NEAR * 0.6 ? [hero.x, hero.z] : [FIRE.x, FIRE.z];
        m.yaw += turnBy(m.yaw, Math.atan2(lx - p.x, lz - p.z)) * (1 - Math.exp(-3 * dt));
      } else if (m.doing) {   // busy: the job says where they look
        // (see act, below)
      } else if (m.leaving) {   // (about to set off)
        m.yaw += turnBy(m.yaw, Math.atan2((m.atNight ? m.seat.x : m.home.x) - p.x, (m.atNight ? m.seat.z : m.home.z) - p.z)) * (1 - Math.exp(-3 * dt));
      } else if (away < NEAR) {   // somebody is near: look at them
        m.yaw += turnBy(m.yaw, Math.atan2(hero.x - p.x, hero.z - p.z)) * (1 - Math.exp(-4 * dt));
      } else {
        m.yaw += turnBy(m.yaw, Math.atan2(m.look.x - p.x, m.look.z - p.z)) * (1 - Math.exp(-2 * dt));
        if ((m.wait -= dt) <= 0) { const a = rand() * 6.28; const r = rand() * WANDER; m.goal = { x: m.home.x + Math.sin(a) * r, z: m.home.z + Math.cos(a) * r }; }
      }
      m.model.group.rotation.y = m.yaw;

      // Look: breathing, a bob and swinging arms when walking, a flickering flame for the strong ones.
      m.walk += ((moving ? 1 : 0) - m.walk) * (1 - Math.exp(-8 * dt));
      const swing = Math.sin(time * 8 + m.phase) * 0.6 * m.walk;
      m.sit += ((m.sitting ? 1 : 0) - m.sit) * (1 - Math.exp(-6 * dt));   // sitting lowers them a little
      m.model.person.position.y = Math.abs(Math.sin(time * 8 + m.phase)) * 0.06 * m.walk - 0.17 * m.sit;
      m.model.person.scale.y = (m.model.person.userData.height ??= m.model.person.scale.y) * (1 + Math.sin(time * 1.7 + m.phase) * 0.012 - 0.12 * m.sit);
      m.model.arms[0].rotation.x = swing - 0.5 * m.sit;
      m.model.arms[1].rotation.x = -swing - 0.5 * m.sit;
      m.model.feet[0].position.z = 0.04 + swing * 0.12;
      m.model.feet[1].position.z = 0.04 - swing * 0.12;
      m.model.fine.visible = away < FAR;
      if (m.doing) { m.t += m.partner !== undefined && m.index > m.partner ? 0 : dt; act(m, m.t, ctx); }   // (the job moves the arms and body)
      if (m.aura.flame) { const flicker = 1 + Math.sin(time * 9 + m.phase) * 0.08; m.aura.flame.scale.set(flicker, 1 + Math.sin(time * 6 + m.phase) * 0.1, flicker); }

      // The name tag, for the nearest few.
      const near = away < TAG_RANGE && shown < 3;
      m.tag.hidden = !near;
      if (near) {
        shown++;
        spot.set(p.x, 2.15, p.z).project(camera);
        m.tag.style.transform = `translate(-50%, -100%) translate(${((spot.x + 1) / 2) * window.innerWidth}px, ${((1 - spot.y) / 2) * window.innerHeight}px)`;
      }
    }
  }

  // The person nearest to a place, within "range", or null.
  function nearest(at, range = 2.4) {
    let best = null;
    let bestDistance = range;
    for (const m of members) {
      const d = Math.hypot(m.position.x - at.x, m.position.z - at.z);
      if (d < bestDistance) { best = m; bestDistance = d; }
    }
    return best;
  }

  function show(on) {
    group.visible = on;
    if (!on) for (const m of members) m.tag.hidden = true;
  }

  return { members, update, nearest, show, get visible() { return group.visible; } };
}
