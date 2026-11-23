// activities.js: what the people of the village do by day. Each activity is a small animation of the person's arms and body, with a
// prop or a little effect when it helps: they TRAIN (hit the targets), SPAR (two in the ring), CHEER the sparring on, FISH from the dock,
// COOK at the fire, CHAT (nod and talk), NAP, LOOK through the telescope, READ the notice board and SHOW OFF. clan.js picks one for each
// person (by where they stand), runs it for a while, then lets them rest and stroll. Sparks use a small pool of their own.
import * as THREE from '../lib/three.module.min.js';
import { glowTexture } from './campfire.js';
import { TYPE_COLORS } from './types.js';

// What each spot's person does (in the order of SPOTS in clan.js), and who they spar with.
export const JOBS = ['train', 'train', 'train', 'spar', 'spar', 'cheer', 'fish', 'fish', 'cook', 'chat', 'nap', 'look', 'read', 'showoff'];
export const PARTNERS = { 3: 4, 4: 3 };
const TARGETS = [[-13.5, -4.2], [-11.5, -4.2], [-9.5, -4.2]];     // the training targets
const WATER = [-10, 8];                                             // the pond
const BOARD = [-5, -9.5];
const FIRE = [1.5, 5.5];

const pickOf = (list, i) => list[i % list.length];
const SPARK = new THREE.SphereGeometry(0.07, 6, 5);

// A pool of little sparks (their own: they move by the real clock). spark(x, y, z, color, count) bursts some.
export function createSparks(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const pool = Array.from({ length: 36 }, () => {
    const mesh = new THREE.Mesh(SPARK, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }));
    mesh.visible = false;
    mesh.userData = { life: 0, vx: 0, vy: 0, vz: 0 };
    group.add(mesh);
    return mesh;
  });
  let next = 0;
  return {
    group,
    spark(x, y, z, color, count = 4) {
      for (let i = 0; i < count; i++) {
        const mesh = pool[next++ % pool.length];
        mesh.position.set(x, y, z);
        mesh.material.color.setHex(color);
        mesh.userData = { life: 0.5, vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3 };
        mesh.visible = true;
      }
    },
    update(dt) {
      for (const mesh of pool) {
        if (!mesh.visible) continue;
        const d = mesh.userData;
        d.life -= dt;
        d.vy -= 6 * dt;
        mesh.position.x += d.vx * dt; mesh.position.y += d.vy * dt; mesh.position.z += d.vz * dt;
        mesh.material.opacity = Math.max(0, d.life * 2);
        if (d.life <= 0) mesh.visible = false;
      }
    },
  };
}

// The props some activities use, hung on the person: a fishing rod, a spoon, a telescope, "Zzz" and a speech mark.
const textTexture = (text) => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  g.font = 'bold 40px sans-serif';
  g.textAlign = 'center';
  g.fillStyle = '#fff';
  g.strokeStyle = '#2a3a6a';
  g.lineWidth = 5;
  g.strokeText(text, 32, 44);
  g.fillText(text, 32, 44);
  return new THREE.CanvasTexture(canvas);
};
const sprites = {};
export function buildProps(person, group) {   // (the rod, spoon and telescope go on the person; the "Zzz" and speech mark on the whole figure, so they stay upright)
  const wood = new THREE.MeshLambertMaterial({ color: 0x8a5a2c });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.6, 5), wood);
  rod.position.set(0, 0.2, 0.7); rod.rotation.x = -1.1; rod.visible = false;
  const spoon = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.7, 5), wood);
  spoon.position.set(0, 0.1, 0.35); spoon.rotation.x = -0.9; spoon.visible = false;
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.8, 8), new THREE.MeshLambertMaterial({ color: 0x3f7fd0 }));
  scope.position.set(0, 1.35, 0.35); scope.rotation.x = Math.PI / 2; scope.visible = false;
  const mark = (text) => {
    sprites[text] = sprites[text] || new THREE.SpriteMaterial({ map: textTexture(text), transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(sprites[text]);
    sprite.scale.setScalar(0.7); sprite.position.y = 2.2; sprite.visible = false;
    return sprite;
  };
  const zzz = mark('Zzz');
  const talk = mark('...');
  person.add(rod, spoon, scope);
  group.add(zzz, talk);
  return { rod, spoon, scope, zzz, talk };
}

const swing = (arm, amount) => { arm.rotation.x = amount; };

// One activity for one frame. "m" is the person (position, yaw, model, props, partner...), "t" the time in seconds since they began,
// "ctx" has what is around (the sparks, everybody, the scene to put the bobber in). It may turn the person (m.yaw) and move their arms.
export function act(m, t, ctx) {
  const [arm0, arm1] = m.model.arms;
  const color = TYPE_COLORS[m.type].hex;
  const p = m.position;
  const beat = (period, offset = 0) => Math.floor((t + offset) / period);
  const phase = (period, offset = 0) => ((t + offset) % period) / period;
  const face = (x, z, amount = 6) => { m.yaw += Math.atan2(Math.sin(Math.atan2(x - p.x, z - p.z) - m.yaw), Math.cos(Math.atan2(x - p.x, z - p.z) - m.yaw)) * (1 - Math.exp(-amount * ctx.dt)); };
  const props = m.props;
  const crossed = (period, at) => { const before = ((((t - ctx.dt) % period) + period) % period) / period; return before < at && phase(period) >= at; };   // (this frame passed that moment of the beat)
  const reset = () => { for (const k of ['rod', 'spoon', 'scope', 'zzz', 'talk']) props[k].visible = false; };
  reset();
  switch (m.job) {
    case 'train': {   // hit the nearest target, left fist then right, with a little spark
      const target = TARGETS.reduce((best, c) => (Math.hypot(c[0] - p.x, c[1] - p.z) < Math.hypot(best[0] - p.x, best[1] - p.z) ? c : best));
      face(target[0], target[1]);
      const k = phase(0.9);
      const punch = k < 0.35 ? Math.sin((k / 0.35) * Math.PI) : 0;
      swing(m.model.arms[beat(0.9) % 2], -1.5 * punch);
      m.model.person.position.z = 0.1 * punch;
      if (crossed(0.9, 0.18)) ctx.spark(target[0], 1.3, target[1], color, 3);
      break;
    }
    case 'spar': {   // two in the ring: one attacks (a lunge and a swing, a spark between them), then the other
      const other = ctx.members[m.partner];
      if (!other) break;
      face(other.position.x, other.position.z);
      const turn = beat(0.8) % 2 === (m.index < m.partner ? 0 : 1);
      const k = phase(0.8);
      const lunge = turn && k < 0.5 ? Math.sin((k / 0.5) * Math.PI) : 0;
      const sway = !turn && k < 0.5 ? Math.sin((k / 0.5) * Math.PI) : 0;
      swing(turn ? arm1 : arm0, -1.5 * lunge);
      m.model.person.position.z = 0.45 * lunge - 0.25 * sway;
      if (turn && crossed(0.8, 0.25)) ctx.spark((p.x + other.position.x) / 2, 1.2, (p.z + other.position.z) / 2, color, 5);
      break;
    }
    case 'cheer': {   // arms up and a little hop
      face(11.5, -3);   // (the ring)
      const up = Math.abs(Math.sin(t * 5));
      swing(arm0, -2.6 + up * 0.5); swing(arm1, -2.6 + up * 0.5);
      m.model.person.position.y = up * 0.18;
      break;
    }
    case 'fish': {   // stand at the water's edge with a rod; now and then pull it
      face(WATER[0], WATER[1]);
      props.rod.visible = true;
      const pull = phase(7) < 0.08 ? Math.sin((phase(7) / 0.08) * Math.PI) : 0;
      props.rod.rotation.x = -1.1 - 0.5 * pull;
      swing(arm0, -0.9); swing(arm1, -0.7 - 0.4 * pull);
      if (crossed(7, 0.04)) ctx.spark(WATER[0] + (p.x - WATER[0]) * 0.55, 0.2, WATER[1] + (p.z - WATER[1]) * 0.55, 0x9fe0ff, 3);
      break;
    }
    case 'cook': {   // stir the pot by the fire
      face(FIRE[0], FIRE[1]);
      props.spoon.visible = true;
      swing(arm0, -1.0 + Math.sin(t * 5) * 0.3); swing(arm1, -0.2);
      props.spoon.rotation.z = Math.sin(t * 5) * 0.4;
      break;
    }
    case 'chat': {   // turn to whoever is nearest, nod, and now and then "talk"
      let near = null;
      for (const o of ctx.members) if (o !== m && (!near || Math.hypot(o.position.x - p.x, o.position.z - p.z) < Math.hypot(near.position.x - p.x, near.position.z - p.z))) near = o;
      if (near) face(near.position.x, near.position.z);
      props.talk.visible = phase(3.2) < 0.35;
      props.talk.position.y = 2.2 + Math.sin(t * 6) * 0.04;
      swing(arm0, phase(3.2) < 0.35 ? -0.8 + Math.sin(t * 9) * 0.3 : -0.1);
      m.model.head.rotation.x = Math.sin(t * 2) * 0.08;
      break;
    }
    case 'nap': {   // lie down and sleep, with "Zzz"
      m.model.person.rotation.x = -1.45;
      m.model.person.position.y = 0.3;
      m.model.person.position.z = -0.3;
      props.zzz.visible = true;
      props.zzz.position.set(0, 0.9 + (t % 2) * 0.35, 0.5);
      props.zzz.material.opacity = 1 - (t % 2) / 2.2;
      break;
    }
    case 'look': {   // look through the telescope, slowly sweeping the isle
      m.yaw += Math.sin(t * 0.5) * 0.4 * ctx.dt;
      props.scope.visible = true;
      swing(arm0, -1.3); swing(arm1, -1.3);
      break;
    }
    case 'read': {   // read the notice board, tilting the head
      face(BOARD[0], BOARD[1]);
      m.model.head.rotation.x = 0.15 + Math.sin(t * 0.8) * 0.1;
      swing(arm0, -0.3);
      break;
    }
    case 'showoff': {   // strike a pose, flex, and flare the aura
      const flex = Math.sin(t * 2.5);
      swing(arm0, -1.3 - flex * 0.2); swing(arm1, -1.3 + flex * 0.2);
      arm0.rotation.z = 1.2; arm1.rotation.z = -1.2;
      if (beat(4) !== m.lastFlare) { m.lastFlare = beat(4); ctx.spark(p.x, 0.3, p.z, color, 6); }
      m.aura.group.scale.setScalar(1 + Math.max(0, Math.sin(phase(4) * Math.PI)) * 0.5);
      break;
    }
    default:
  }
}

// Puts a person back as they were (arms, body, props), when an activity ends or the night comes.
export function stand(m) {
  for (const k of ['rod', 'spoon', 'scope', 'zzz', 'talk']) m.props[k].visible = false;
  m.model.person.rotation.x = 0;
  m.model.person.position.z = 0;
  m.model.head.rotation.x = 0;
  m.aura.group.scale.setScalar(1);
  m.model.arms.forEach((arm, i) => { arm.rotation.set(0, 0, (i === 0 ? -1 : 1) * 0.3); });
}
