// boss.js: General Bramble, the boss of Chapter 1. For the rest of the game he is a very big Gloomling (darts, superpowers and
// combos treat him like any other), with moves of his own: a fan of thorns, a root slam (a red circle on the ground, then vines
// burst out), and under half health he roars, speeds up and calls Gloomlings. When he is beaten he does not vanish: he shrinks into
// the tired young gardener he was, says his last words (the story's job), then fades into leaves.
import * as THREE from '../lib/three.module.min.js';
import { BOSSES, GLOOMLING } from './heroes-data.js';
import { strength } from './power.js';
import { buildBramble, buildYoungBramble } from './boss-model.js';

const EDGE = 10.4;         // he stays on the island
const SHOVE_FADE = 8;
const SHOVE_SHARE = 0.1;   // a big knight hardly moves when he is hit
const FALL_TIME = 1.7;     // seconds he shakes and shrinks when he is beaten
const FADE_TIME = 1.5;     // seconds he takes to fade into leaves after his last words
const LEAVES = [0x6fbf45, 0x3f8f3a, 0xc7d96a, 0xe3d08a];
const SIZE = 0.85;         // how big the model is drawn (a boss that fills the screen is too much on a phone)
const random = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// events (all optional): shake(amount), taunt(key) for his words, summon(count, x, z) returns how many Gloomlings came,
// down(boss) when his health runs out, fallen(boss) when he has shrunk and stands there as himself (time for his last words),
// gone(boss) when he has faded.
// "emit" makes a spark (powers.sparks.emit).
export function createBoss({ scene, kind = 'bramble', x, z, power = 10, events = {}, emit = () => {} }) {
  const D = BOSSES[kind];
  const model = buildBramble();
  const young = buildYoungBramble();
  young.group.visible = false;
  const group = new THREE.Group();
  group.add(model.group, young.group);
  group.position.set(x, 0, z);
  const p = group.position;
  scene.add(group);

  const maxHealth = Math.round(GLOOMLING.health * D.health * strength(power));
  const thornHurt = Math.round(D.thorns.damage * strength(power));
  const slamHurt = Math.round(D.slam.damage * strength(power));
  const bumpHurt = Math.round(D.contact.damage * strength(power));
  let health = maxHealth;
  let alive = true;
  let gone = false;
  let enraged = false;
  let state = 'grow';   // grow (he rises), walk, thorns, slam, summon, bump, roar, rest, then fall, young, fade
  let timer = D.growIn;
  let age = 0;
  let flash = 0;
  let yaw = 0;
  let down = 0;         // seconds since he fell
  let fade = 0;
  let summoned = 0;
  let told = false;     // his last words have been asked for
  let thornLeft = 2.5, slamLeft = 4, summonLeft = 1, bumpLeft = 0;
  let lift = 0;         // how high the arms are (0 down, 1.6 straight forward, 3 straight up)
  let slamAt = null;
  const shove = { x: 0, z: 0 };

  // Things he leaves on the island: the red circle, thorns in the air, vines that burst up.
  const circle = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.22, depthWrite: false }));
  const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.5, depthWrite: false }));
  circle.rotation.x = fill.rotation.x = -Math.PI / 2;
  circle.position.y = 0.03;
  fill.position.y = 0.04;
  circle.visible = fill.visible = false;
  scene.add(circle, fill);
  const thornMaterial = new THREE.MeshLambertMaterial({ color: 0xc9a85a });
  const vineMaterial = new THREE.MeshLambertMaterial({ color: 0x4f8f2e });
  const thornShape = new THREE.ConeGeometry(0.17, 0.75, 6);
  const vineShape = new THREE.ConeGeometry(0.24, 1.8, 6);
  const thorns = [];   // { holder, dx, dz, left }
  const bursts = [];   // { vines, age }

  function begin(next, time = 0) { state = next; timer = time; }

  function fireThorns(target) {
    const base = Math.atan2(target.position.x - p.x, target.position.z - p.z);
    const { count, spread, speed, life } = D.thorns;
    for (let i = 0; i < count; i++) {
      const angle = base + (i - (count - 1) / 2) * ((spread * Math.PI / 180) / (count - 1));
      const holder = new THREE.Group();
      const cone = new THREE.Mesh(thornShape, thornMaterial);
      cone.rotation.x = Math.PI / 2;   // a cone points up; turned to point forward
      holder.add(cone);
      holder.rotation.y = angle;
      holder.position.set(p.x + Math.sin(angle) * (D.radius + 0.3), 1.1, p.z + Math.cos(angle) * (D.radius + 0.3));
      scene.add(holder);
      thorns.push({ holder, dx: Math.sin(angle) * speed, dz: Math.cos(angle) * speed, left: life });
    }
    if (events.sound) events.sound('thorns');
  }

  function slamBurst(target) {
    const { x: cx, z: cz } = slamAt;
    const vines = [];
    for (let i = 0; i < 9; i++) {
      const a = random(0, Math.PI * 2);
      const r = Math.sqrt(Math.random()) * D.slam.radius * 0.9;
      const vine = new THREE.Mesh(vineShape, vineMaterial);
      vine.position.set(cx + Math.sin(a) * r, 0, cz + Math.cos(a) * r);
      vine.scale.y = 0.01;
      scene.add(vine);
      vines.push(vine);
    }
    bursts.push({ vines, age: 0 });
    for (let i = 0; i < 14; i++) emit(cx + random(-1.5, 1.5), 0.3, cz + random(-1.5, 1.5), random(-2, 2), random(2, 5), random(-2, 2), random(0.4, 0.8), random(0.14, 0.24), pick(LEAVES), -9);
    if (!target.down && Math.hypot(target.position.x - cx, target.position.z - cz) < D.slam.radius) target.takeHit(slamHurt, cx, cz);
    if (events.shake) events.shake(0.3);
    if (events.sound) events.sound('slam');
  }

  // Thorns fly, vines grow and shrink: these carry on even while he does something else.
  function updateThings(dt, target) {
    for (let i = thorns.length - 1; i >= 0; i--) {
      const t = thorns[i];
      t.holder.position.x += t.dx * dt;
      t.holder.position.z += t.dz * dt;
      t.left -= dt;
      const hitHero = !target.down && Math.hypot(target.position.x - t.holder.position.x, target.position.z - t.holder.position.z) < 0.7;
      if (hitHero) target.takeHit(thornHurt, t.holder.position.x - t.dx * 0.1, t.holder.position.z - t.dz * 0.1);
      if (hitHero || t.left <= 0 || Math.hypot(t.holder.position.x, t.holder.position.z) > 13) {
        scene.remove(t.holder);
        thorns.splice(i, 1);
      }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.age += dt;
      const grow = b.age < 0.15 ? b.age / 0.15 : b.age < 0.5 ? 1 : Math.max(0, 1 - (b.age - 0.5) / 0.3);
      for (const vine of b.vines) { vine.scale.y = Math.max(0.01, grow); vine.position.y = 0.9 * grow; }
      if (b.age > 0.8) {
        for (const vine of b.vines) scene.remove(vine);
        bursts.splice(i, 1);
      }
    }
  }

  // Gloomlings cannot stand inside him.
  function pushOut(others) {
    for (const other of others) {
      if (other === boss || !other.alive) continue;
      const ox = other.position.x - p.x;
      const oz = other.position.z - p.z;
      const gap = Math.hypot(ox, oz);
      const least = D.radius + 0.4;
      if (gap < least && gap > 0.0001) { other.position.x = p.x + (ox / gap) * least; other.position.z = p.z + (oz / gap) * least; }
    }
  }

  function paint(time) {
    const glare = state === 'thorns' || state === 'slam' || state === 'roar' || state === 'summon';
    const glowLevel = glare ? 1 : 0.6 + Math.sin(time * 3) * 0.15;
    model.glow.color.setRGB(1, 0.5 + glowLevel * 0.25, 0.1 + (glare ? 0 : 0.15));
    for (const material of model.materials) material.emissive.setRGB(flash * 0.8, flash * 0.8, flash * 0.8);
  }

  // After he is beaten: he shakes and shrinks, a young gardener is left kneeling, and after his last words he fades.
  function fallen(dt, time) {
    down += dt;
    if (state === 'fall') {
      const t = Math.min(1, down / FALL_TIME);
      model.group.position.x = t < 0.35 ? Math.sin(down * 70) * 0.09 : 0;
      model.group.scale.setScalar(SIZE * (t < 0.35 ? 1 : Math.max(0.001, 1 - (t - 0.35) / 0.65)));
      if (Math.random() < dt * 40) emit(p.x + random(-1, 1), random(0.5, 3.5), p.z + random(-1, 1), random(-2, 2), random(1, 4), random(-2, 2), random(0.5, 0.9), random(0.12, 0.22), pick(LEAVES), -4);
      if (t >= 1) {
        state = 'young';
        down = 0;
        model.group.visible = false;
        young.group.visible = true;
        young.group.scale.setScalar(0.001);
      }
    } else if (state === 'young') {
      const pop = Math.min(1, down / 0.3);
      young.group.scale.setScalar(Math.max(0.001, pop * (1 + (1 - pop) * 0.4)));
      young.group.rotation.x = 0.12 + Math.sin(time * 1.6) * 0.02;   // slumped, breathing
      if (down >= 0.5 && !told) { told = true; if (events.fallen) events.fallen(boss); }   // a moment of quiet, then his last words
    } else if (state === 'fade') {
      fade += dt;
      const t = Math.min(1, fade / FADE_TIME);
      for (const material of young.materials) { material.transparent = true; material.opacity = 1 - t; }
      young.group.position.y = t * 0.8;
      if (Math.random() < dt * 30) emit(p.x + random(-0.5, 0.5), random(0.3, 1.8), p.z + random(-0.5, 0.5), random(-1, 1), random(0.5, 2), random(-1, 1), random(0.6, 1.1), random(0.1, 0.2), pick(LEAVES), 1);
      if (t >= 1 && !gone) { gone = true; remove(); if (events.gone) events.gone(boss); }
    }
  }

  // Every frame: "target" is whoever is in play (the squad), "others" all the Gloomlings (he is one of them).
  function update(dt, target, time, others) {
    if (gone) return;
    age += dt;
    flash = Math.max(0, flash - dt * 6);
    updateThings(dt, target);
    if (!alive) { fallen(dt, time); return; }
    paint(time);

    const dx = target.position.x - p.x;
    const dz = target.position.z - p.z;
    const distance = Math.hypot(dx, dz) || 1;
    thornLeft -= dt; slamLeft -= dt; summonLeft -= dt; bumpLeft -= dt;
    timer -= dt;
    if (!enraged && health <= maxHealth * D.phaseAt && state !== 'grow') {   // under half health: a roar, then faster and meaner
      enraged = true;
      begin('roar', D.roar);
      circle.visible = fill.visible = false;
      if (events.taunt) events.taunt('enrage');
      if (events.shake) events.shake(0.4);
      if (events.sound) events.sound('roar');
    }
    const speed = enraged ? D.speed2 : D.speed;
    let walking = false;
    let want = 0;   // how high the arms want to be

    if (state === 'grow') {
      if (timer <= 0) { begin('walk'); if (events.taunt) events.taunt('spawn'); }
    } else if (state === 'walk') {
      if (!target.down) {
        if (enraged && summonLeft <= 0 && summoned < D.summon.max) begin('summon', D.summon.windup);
        else if (slamLeft <= 0 && distance < D.slam.range) { slamAt = { x: target.position.x, z: target.position.z }; begin('slam', D.slam.warning); }
        else if (thornLeft <= 0 && distance > D.thorns.minRange) begin('thorns', D.thorns.windup);
        else if (bumpLeft <= 0 && distance < D.radius + D.contact.reach) begin('bump', D.contact.windup);
      }
      if (state === 'walk' && !target.down && distance > D.stopAt) {
        p.x += (dx / distance) * speed * dt;
        p.z += (dz / distance) * speed * dt;
        walking = true;
      }
    } else if (state === 'thorns') {
      want = 1.6;
      if (timer <= 0) { fireThorns(target); thornLeft = enraged ? D.thorns.every2 : D.thorns.every; begin('rest', 0.5); }
    } else if (state === 'slam') {
      want = 3;
      circle.visible = fill.visible = true;
      circle.position.set(slamAt.x, 0.03, slamAt.z);
      fill.position.set(slamAt.x, 0.04, slamAt.z);
      circle.scale.setScalar(D.slam.radius);
      fill.scale.setScalar(Math.max(0.01, D.slam.radius * (1 - Math.max(0, timer) / D.slam.warning)));   // the inner circle fills the outer one: that is when the vines come
      if (timer <= 0) {
        circle.visible = fill.visible = false;
        lift = 0;   // the arms come crashing down
        slamBurst(target);
        slamLeft = enraged ? D.slam.every2 : D.slam.every;
        begin('rest', 0.7);
      }
    } else if (state === 'summon') {
      want = 3;
      if (timer <= 0) {
        summoned += events.summon ? events.summon(D.summon.count, p.x, p.z) : 0;
        summonLeft = D.summon.every;
        begin('rest', 0.5);
      }
    } else if (state === 'bump') {
      want = 1.2;
      if (timer <= 0) {
        if (!target.down && distance < D.radius + D.contact.reach * 1.5) target.takeHit(bumpHurt, p.x, p.z);
        bumpLeft = D.contact.pause;
        begin('rest', 0.4);
      }
    } else if (state === 'roar') {
      want = 2.4;
      if (timer <= 0) { begin('walk'); summonLeft = 0.5; }
    } else if (timer <= 0) {   // rest
      begin('walk');
    }

    // Slide with a shove, stay on the island, and keep the little ones out of his body.
    p.x += shove.x * dt;
    p.z += shove.z * dt;
    const fadeOut = Math.exp(-SHOVE_FADE * dt);
    shove.x *= fadeOut;
    shove.z *= fadeOut;
    const fromCentre = Math.hypot(p.x, p.z);
    if (fromCentre > EDGE) { p.x *= EDGE / fromCentre; p.z *= EDGE / fromCentre; }
    pushOut(others);

    // Look: face the hero, rise from the ground at the start, rock as he walks, raise the arms for a move.
    if (state !== 'slam') {
      const wanted = Math.atan2(dx, dz);
      yaw += Math.atan2(Math.sin(wanted - yaw), Math.cos(wanted - yaw)) * (1 - Math.exp(-4 * dt));
    }
    group.rotation.y = yaw;
    const grow = state === 'grow' ? 1 - Math.max(0, timer) / D.growIn : 1;
    model.group.scale.setScalar((0.2 + 0.8 * grow) * SIZE);
    model.group.position.y = (grow - 1) * 3 + (walking ? Math.abs(Math.sin(time * 4)) * 0.12 : 0);
    model.group.rotation.z = walking ? Math.sin(time * 4) * 0.04 : 0;
    lift += (want - lift) * (1 - Math.exp(-12 * dt));
    model.arms.forEach((arm, i) => { arm.rotation.x = -(lift + (walking ? Math.sin(time * 4 + i * Math.PI) * 0.35 : 0)); });
  }

  // Hurts him. He is shoved only a little and never stunned. At zero health he starts to fall; powers.js is told "not
  // defeated" on purpose, because he is not taken off the island until he has said his last words (events.fallen / gone).
  function hit(damage, pushX = 0, pushZ = 0) {
    if (!alive || state === 'grow') return false;
    health = Math.max(0, health - damage);
    flash = 1;
    shove.x += pushX * SHOVE_FADE * SHOVE_SHARE;
    shove.z += pushZ * SHOVE_FADE * SHOVE_SHARE;
    if (health <= 0) {
      alive = false;
      state = 'fall';
      down = 0;
      circle.visible = fill.visible = false;
      for (const t of thorns) scene.remove(t.holder);
      thorns.length = 0;
      if (events.shake) events.shake(0.5);
      if (events.down) events.down(boss);
    }
    return false;
  }

  // After his last words he fades away.
  function finish() { if (state === 'young') { state = 'fade'; fade = 0; } }

  function remove() {
    scene.remove(group, circle, fill);
    for (const t of thorns) scene.remove(t.holder);
    for (const b of bursts) for (const vine of b.vines) scene.remove(vine);
    thorns.length = 0;
    bursts.length = 0;
  }

  const boss = {
    boss: true, name: D.name, group, position: p, radius: D.radius, type: D.type, power, maxHealth, update, hit, remove, finish,
    soak() {},
    get soaked() { return 0; },
    get alive() { return alive; },
    get health() { return health; },
    get mode() { return state; },
    get state() { return state; },
    get enraged() { return enraged; },
    get gone() { return gone; },
  };
  return boss;
}
