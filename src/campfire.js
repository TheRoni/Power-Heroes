// campfire.js: the night after General Bramble. The screen goes dark, night falls over a campfire, and Marlo plays his flute and
// tells about Lyra. A memory shard rises out of the fire and shows a picture of little Lyra on her father's shoulders; then it goes
// to Sol. Everything here moves by the real clock: the story waits while people talk, but the fire keeps burning.
import * as THREE from '../lib/three.module.min.js';

const FADE = 0.8;       // seconds the screen takes to go dark, and again to come back
const FIRE = { x: 0, z: 0 };   // where the fire is (everybody is moved round it while the screen is dark)
const SEATS = { sol: { x: -1.8, z: 0.9 }, marlo: { x: -2.4, z: -1.3 }, ember: { x: 1.9, z: 0.8 } };
const RISE = 1.2;       // seconds the shard takes to rise out of the fire
const FLY = 0.9;        // ...and to fly to Sol
const random = (min, max) => min + Math.random() * (max - min);

// A soft round glow, drawn in code: warm in the middle, nothing at the edge.
export function glowTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function buildFire() {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x5a3a1c });
  const stone = new THREE.MeshLambertMaterial({ color: 0x8a8f9c });
  for (let i = 0; i < 5; i++) {   // logs leaning together
    const a = (i / 5) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.5, 7), wood);
    log.position.set(Math.sin(a) * 0.32, 0.55, Math.cos(a) * 0.32);
    log.rotation.set(Math.cos(a) * 0.75, 0, -Math.sin(a) * 0.75);
    group.add(log);
  }
  for (let i = 0; i < 10; i++) {   // a ring of stones
    const a = (i / 10) * Math.PI * 2;
    const rock = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), stone);
    rock.position.set(Math.sin(a) * 1.0, 0.1, Math.cos(a) * 1.0);
    rock.scale.set(1, 0.6, 1);
    group.add(rock);
  }
  const flames = [[0xff5a1f, 0.5, 1.5], [0xff9a2a, 0.36, 1.15], [0xffd54a, 0.22, 0.8]].map(([color, radius, height]) => {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }));
    flame.userData = { height, phase: random(0, 6) };
    flame.position.y = 0.45 + height / 2;
    group.add(flame);
    return flame;
  });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,160,70,0.8)', 'rgba(255,140,60,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.05;
  group.add(glow);
  const embers = Array.from({ length: 14 }, () => {   // little sparks that float up (their own, so they move while people talk)
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true }));
    ember.userData = { age: random(0, 2), speed: random(0.6, 1.4), x: 0, z: 0 };
    group.add(ember);
    return ember;
  });
  group.visible = false;
  return { group, flames, glow, embers };
}

// The flames lean and flicker, the glow breathes, little sparks float up. "clock" is the time in seconds.
export function animateFire(fire, clock, dt) {
  for (const flame of fire.flames) {
    const { height, phase: offset } = flame.userData;
    const flicker = 1 + Math.sin(clock * 11 + offset) * 0.1 + Math.sin(clock * 23 + offset * 2) * 0.06;
    flame.scale.set(1 + Math.sin(clock * 7 + offset) * 0.08, flicker, 1 + Math.cos(clock * 8 + offset) * 0.08);
    flame.position.y = 0.45 + (height * flicker) / 2;
    flame.rotation.z = Math.sin(clock * 3 + offset) * 0.08;
  }
  fire.glow.material.opacity = 0.85 + Math.sin(clock * 9) * 0.1;
  for (const spark of fire.embers) {
    const d = spark.userData;
    d.age += dt * d.speed;
    if (d.age > 2) { d.age = 0; d.x = random(-0.3, 0.3); d.z = random(-0.3, 0.3); }
    spark.position.set(d.x + Math.sin(d.age * 3 + d.z * 9) * 0.25, 0.7 + d.age * 1.2, d.z);
    spark.material.opacity = Math.max(0, 1 - d.age / 2);
  }
}

// The shard: a little crystal of light (a stretched octahedron with a glow).
function buildShard() {
  const group = new THREE.Group();
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }));
  crystal.scale.set(0.7, 1.4, 0.7);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,244,190,0.95)', 'rgba(255,230,140,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.setScalar(2);
  group.add(halo, crystal);
  group.visible = false;
  return { group, crystal };
}

// The picture in the shard: a young father with a small girl on his shoulders, her arms up, in soft gold light.
export function buildVision() {   // (exported so the pictures of it can be taken: tests/look-boss.js style)
  const group = new THREE.Group();
  const materials = [];
  const gold = (color) => { const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 }); materials.push(m); return m; };
  const body = gold(0xffe9b8), skin = gold(0xfff3dc), hair = gold(0xffd35a), cloak = gold(0xbfd4ff);
  const part = (geometry, material, x, y, z) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); group.add(m); return m; };
  const ball = new THREE.SphereGeometry(1, 12, 9);
  part(new THREE.CapsuleGeometry(0.3, 0.8, 5, 10), cloak, 0, 0.7, 0);                       // him
  part(ball, skin, 0, 1.55, 0).scale.setScalar(0.27);
  part(ball, hair, 0, 1.68, -0.04).scale.set(0.3, 0.2, 0.3);
  for (const side of [-1, 1]) part(new THREE.CapsuleGeometry(0.07, 0.5, 4, 8), cloak, side * 0.34, 0.8, 0.05).rotation.z = side * 0.25;
  part(new THREE.CapsuleGeometry(0.16, 0.3, 5, 10), body, 0, 2.05, 0);                      // her, on his shoulders
  part(ball, skin, 0, 2.5, 0).scale.setScalar(0.19);
  part(ball, hair, 0, 2.58, -0.03).scale.set(0.22, 0.16, 0.22);
  part(ball, hair, 0.16, 2.46, -0.12).scale.setScalar(0.09);                                 // a little ponytail
  const star = part(new THREE.OctahedronGeometry(0.07), body, -0.12, 2.68, 0.05);            // and a star in her hair
  star.scale.set(1, 1.5, 1);
  for (const side of [-1, 1]) part(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), body, side * 0.24, 2.3, 0).rotation.z = side * 2.4;   // her arms up
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,244,200,0.9)', 'rgba(255,230,150,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.scale.setScalar(5.5);
  halo.position.y = 1.5;
  group.add(halo);
  group.visible = false;
  group.scale.setScalar(1.35);
  return { group, materials, halo };
}

// "world" is { scene, setNight, follow }. "ui.setCurtain(on)" fades the screen. "audio" plays the little sounds, "aura" flares when the
// shard goes to Sol, and "progress" remembers the shard.
export function createCampfire({ world, player, marlo, ember, story, audio, aura, progress, ui }) {
  const fire = buildFire();
  const shard = buildShard();
  const vision = buildVision();
  world.scene.add(fire.group, shard.group, vision.group);
  let phase = 'idle';   // idle, dusk (going dark), lit (coming back, at the fire), scene (the story), dawn (going dark again), back
  let timer = 0;
  let then = null;      // what to do when it is all over
  let shardState = 'hidden';   // hidden, rising, hovering, flying, taken
  let shardAge = 0;
  let visionGoal = 0;
  let visionAmount = 0;
  let clock = 0;

  const place = (object, seat) => object.position.set(FIRE.x + seat.x, 0, FIRE.z + seat.z);

  // The screen is dark: everybody to the fire, and night falls.
  function arrange(time) {
    world.setNight(1, time);
    fire.group.position.set(FIRE.x, 0, FIRE.z);
    fire.group.visible = true;
    place(player, SEATS.sol);
    player.velocity.x = player.velocity.z = 0;
    player.face(Math.atan2(FIRE.x - player.position.x, FIRE.z - player.position.z));
    place(marlo, SEATS.marlo);
    marlo.walkTo(marlo.position.x, marlo.position.z);
    marlo.raise(false);
    if (player.kind !== 'ember') ember.runIn(FIRE.x + 3.8, FIRE.z + 1.6, FIRE.x + SEATS.ember.x, FIRE.z + SEATS.ember.z, FIRE.x, FIRE.z);   // (she is already there if she is the hero in play)
    world.follow(player.position, player.velocity, 0, true);
  }

  // The screen is dark again: day returns, the fire goes out.
  function restore(time) {
    world.setNight(0, time);
    fire.group.visible = shard.group.visible = vision.group.visible = false;
    visionAmount = visionGoal = 0;
    ember.leave();
    marlo.goHome();
    marlo.raise(false);
  }

  // The shard goes to Sol (or, if the cues were skipped, is simply taken).
  function take() {
    if (shardState === 'taken') return;
    if (shardState === 'hidden') { shard.group.position.set(FIRE.x, 2.8, FIRE.z); shard.group.visible = true; }
    shardState = 'flying';
    shardAge = 0;
    visionGoal = 0;
  }

  // The story names these in its lines.
  function cue(name) {
    if (name === 'shard-rise') { shardState = 'rising'; shardAge = 0; shard.group.visible = true; audio.play('chime'); }
    else if (name === 'vision') { visionGoal = 1; vision.group.visible = true; audio.play('sunrise'); }
    else if (name === 'shard-take') take();
    else if (name === 'flute') marlo.raise(true);
    else return false;
    return true;
  }

  // Called once, when the round-5 talk is over. "done" is called when the screen is back to day.
  function play(done) {
    then = done;
    phase = 'dusk';
    timer = FADE;
    shardState = 'hidden';
    ui.setCurtain(true);
  }

  function finish() {
    take();
    marlo.raise(false);
    phase = 'dawn';
    timer = FADE + FLY;   // (the shard may still be on its way)
    ui.setCurtain(true);
  }

  // Every frame, with the real time that passed.
  function update(dt, time) {
    clock += dt;
    if (phase === 'dusk' && (timer -= dt) <= 0) { arrange(time); ui.setCurtain(false); phase = 'lit'; timer = FADE + 0.4; }
    else if (phase === 'lit' && (timer -= dt) <= 0) { phase = 'scene'; story.scene('campfire', finish); }
    else if (phase === 'dawn' && (timer -= dt) <= 0) { restore(time); ui.setCurtain(false); phase = 'back'; timer = FADE; }
    else if (phase === 'back' && (timer -= dt) <= 0) { phase = 'idle'; if (then) then(); }
    if (phase === 'idle') return;
    if (phase === 'lit' || phase === 'scene') world.setNight(1, time);   // (every frame, so the stars twinkle)

    if (fire.group.visible) animateFire(fire, clock, dt);

    // The shard rises out of the fire, hangs there and turns, then flies to Sol.
    if (shardState !== 'hidden' && shardState !== 'taken') {
      shardAge += dt;
      const spin = clock * 1.6;
      shard.crystal.rotation.y = spin;
      if (shardState === 'rising') {
        const t = Math.min(1, shardAge / RISE);
        shard.group.position.set(FIRE.x, 1.0 + t * 1.8, FIRE.z);
        if (t >= 1) shardState = 'hovering';
      } else if (shardState === 'hovering') {
        shard.group.position.set(FIRE.x, 2.8 + Math.sin(clock * 2) * 0.1, FIRE.z);
      } else if (shardState === 'flying') {
        const t = Math.min(1, shardAge / FLY);
        const ease = t * t * (3 - 2 * t);
        shard.group.position.set(FIRE.x + (player.position.x - FIRE.x) * ease, 2.8 + (1.4 - 2.8) * ease + Math.sin(t * Math.PI) * 0.8, FIRE.z + (player.position.z - FIRE.z) * ease);
        if (t >= 1) {
          shardState = 'taken';
          shard.group.visible = false;
          progress.collectShard();
          progress.store();
          aura.flare(3);
          audio.play('tier');
        }
      }
    }

    // The picture fades in above the fire, turns slowly, and fades out when the shard goes.
    visionAmount += (visionGoal - visionAmount) * (1 - Math.exp(-3 * dt));
    if (vision.group.visible) {
      vision.group.position.set(FIRE.x + 0.4, 0.6 + Math.sin(clock * 1.3) * 0.1, FIRE.z - 0.2);
      vision.group.rotation.y = Math.sin(clock * 0.5) * 0.5;
      for (const material of vision.materials) material.opacity = visionAmount * 0.85;
      vision.halo.material.opacity = visionAmount * 0.4;
      if (visionGoal === 0 && visionAmount < 0.01) vision.group.visible = false;
    }
  }

  return {
    play, update, cue,
    get active() { return phase !== 'idle'; },
    get phase() { return phase; },
    get shard() { return shardState; },
  };
}
