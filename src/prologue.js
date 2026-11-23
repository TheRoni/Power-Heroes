// prologue.js: the opening of the game. A star falls at night, Sol climbs out of the crater, Marlo comes to meet them,
// and three short lessons teach the controls. Then the sun comes up on Chapter 1.
import * as THREE from '../lib/three.module.min.js';
import { createGloomling } from './gloom.js';
import { createGlow } from './pip.js';
import { CHAPTER, PROLOGUE } from './story-data.js';
import { QUIET } from './audio.js';

const STAR_TO = new THREE.Vector3(0, 0.6, 0);   // where the star lands
const DARK_TIME = 1.4;    // seconds of quiet night before the star appears
const FALL_TIME = 2.0;    // seconds the star takes to fall
const RISE_TIME = 1.2;    // seconds for Sol to climb out of the crater
const DAWN_TIME = 3;      // seconds for the sun to come up
const ISLAND = 10.2;      // training Gloomlings are placed inside this distance from the middle
const RING_AT = { x: 4.2, z: 2.2 };       // the glowing ring of lesson one
const CLIMB = [['Power 1', 0, 1], ['Power 2', 0.9, 1.122], ['Power 4', 1.8, 1.26], ['Power 7', 2.7, 1.498]];   // the number Marlo reads climbing: text, when, and how high its note rings
const SPARKS = [0xffffff, 0xffe9a0, 0xffd24a, 0xfff6c8];

const random = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

// "world" is { scene, camera, setNight }. "shake(amount)" shakes the screen. onDone() starts the first wave.
export function createPrologue({ world, player, marlo, powers, story, gloomlings, ui, shake, onDone, audio = QUIET }) {
  const scene = world.scene;
  const flashBox = document.getElementById('flash');
  const skipButton = document.getElementById('skip');
  const sparks = powers.sparks;
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const starFrom = new THREE.Vector3();
  let phase = 'idle';   // idle, title, dark, falling, rising, walking, talking, dawn, skipping, done
  let clock = 0;        // seconds in the current phase
  let night = 0;        // 1 = night, 0 = day
  let craterAmount = 0; // how visible the crater is, 0 to 1
  let lesson = null;    // the lesson being played: { kind, dummies }
  let bigHits = 0;      // Gloomlings hit by the superpower since the last lesson began
  const numbers = [];   // the climbing "Power" numbers waiting to pop up: { left, text, pitch }

  // The falling star: a bright ball with a soft glow.
  const star = new THREE.Group();
  star.add(createGlow({ inner: 'rgba(255, 255, 255, 1)', mid: 'rgba(255, 232, 150, 0.8)', outer: 'rgba(255, 200, 80, 0)' }, 3.6));
  star.add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })));
  star.visible = false;
  scene.add(star);

  // The crater: a scorched patch, a glowing rim, and a soft golden glow.
  const crater = new THREE.Group();
  const scorch = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32), new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0, depthWrite: false }));
  const rim = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.8, 40), new THREE.MeshBasicMaterial({ color: 0xffd86a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  scorch.rotation.x = -Math.PI / 2;
  rim.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.03;
  rim.position.y = 0.05;
  const glow = createGlow({ inner: 'rgba(255, 240, 180, 0.9)', mid: 'rgba(255, 200, 90, 0.5)', outer: 'rgba(255, 170, 60, 0)' }, 5);
  glow.position.y = 0.4;
  crater.add(scorch, rim, glow);
  crater.visible = false;
  scene.add(crater);

  // The glowing ring of lesson one.
  const ring = new THREE.Group();
  const ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.1, 40), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  ringMesh.rotation.x = -Math.PI / 2;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.4, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.14, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = 0.7;
  ring.add(ringMesh, beam);
  ring.position.set(RING_AT.x, 0.05, RING_AT.z);
  ring.visible = false;
  scene.add(ring);

  // A white flash over the whole screen (the star landing).
  function flash() {
    flashBox.style.transition = 'none';
    flashBox.style.opacity = calm ? '0.35' : '1';   // people who ask for less motion get a gentle glow instead of a flash
    void flashBox.offsetWidth;   // lets the page notice, so the fade can start from white
    flashBox.style.transition = 'opacity 1.1s ease-out';
    flashBox.style.opacity = '0';
  }

  function burst(x, z, count) {
    for (let i = 0; i < count; i++) {
      const a = random(0, Math.PI * 2);
      const speed = random(2, 9);
      sparks.emit(x, 0.3, z, Math.sin(a) * speed, random(1, 7), Math.cos(a) * speed, random(0.6, 1.2), random(0.15, 0.3), pick(SPARKS), -8);
    }
  }

  // Places a training Gloomling (a harmless one). It is kept on the island.
  function spawnDummy(x, z) {
    const length = Math.hypot(x, z);
    const scale = length > ISLAND ? ISLAND / length : 1;
    const dummy = createGloomling({ scene, x: x * scale, z: z * scale, passive: true });
    gloomlings.push(dummy);
    return dummy;
  }

  function removeDummies() {
    if (!lesson || !lesson.dummies) return;
    for (const dummy of lesson.dummies) {
      if (!dummy.alive) continue;
      dummy.remove();
      const index = gloomlings.indexOf(dummy);
      if (index >= 0) gloomlings.splice(index, 1);
    }
  }

  // A lesson begins (story.js asks for it). The player plays until update() sees it is done.
  function startLesson(kind) {
    bigHits = 0;
    if (kind === 'move') {
      ring.visible = true;
      lesson = { kind };
    } else if (kind === 'strike') {   // one training Gloomling, a few steps away (on screen, just inside the darts' reach)
      lesson = { kind, dummies: [spawnDummy(player.position.x - 4.4, player.position.z - 4.6)] };
    } else if (kind === 'power') {   // three training Gloomlings around the player, all inside Starburst's reach. Darts rest.
      powers.autoFire = false;
      const p = player.position;
      lesson = { kind, dummies: [0.4, 2.5, 4.6].map((a) => spawnDummy(p.x + Math.sin(a) * 3.3, p.z + Math.cos(a) * 3.3)) };
    }
  }

  function endLesson() {
    ring.visible = false;
    removeDummies();
    powers.autoFire = true;
    lesson = null;
  }

  function lessonDone() {
    burst(player.position.x, player.position.z, 26);
    audio.play('chime');
    endLesson();
    story.resume();
  }

  // Lines can name a cue. "power-climb" is Marlo reading Sol's glow: the number climbs above their head.
  function cue(name) {
    if (name === 'power-climb') for (const [text, left, pitch] of CLIMB) numbers.push({ text, left, pitch });
  }

  // The superpower hit something (main.js tells us), for the third lesson.
  function noteHit(kind) {
    if (kind === 'big') bigHits++;
  }

  // The night scene is set up with Sol off stage. It waits (on the title screen) until go().
  function begin() {
    phase = 'title';
    clock = 0;
    night = 1;
    world.setNight(1, 0);
    document.body.classList.add('prologue');
    player.setVisible(false);
  }

  // The title screen was tapped: the story begins.
  function go() {
    if (phase !== 'title') return;
    phase = 'dark';
    clock = 0;
    skipButton.hidden = false;
    ui.showBanner(PROLOGUE.name, PROLOGUE.subtitle);
  }

  function beginFall() {
    world.camera.updateMatrixWorld();
    const camera = world.camera;
    const toward = new THREE.Vector3(-0.8, 1.2, 0.5).unproject(camera).sub(camera.position).normalize();   // from the top left of the screen
    starFrom.copy(camera.position).addScaledVector(toward, camera.position.distanceTo(STAR_TO) * 0.9);
    star.position.copy(starFrom);
    star.visible = true;
    audio.play('whoosh');
    phase = 'falling';
    clock = 0;
  }

  function impact() {
    star.visible = false;
    audio.play('boom');
    flash();
    shake(0.55);
    burst(0, 0, 70);
    player.setVisible(true);
    player.group.scale.setScalar(0.01);
    phase = 'rising';
    clock = 0;
  }

  function beginDawn() {
    if (phase !== 'talking') return;
    phase = 'dawn';
    clock = 0;
    audio.play('sunrise');
    skipButton.hidden = true;
    marlo.goHome();
    ui.showBanner(CHAPTER.name, `Chapter ${CHAPTER.number}`);
  }

  // The prologue is over: the first wave can start.
  function finish(showBanner) {
    phase = 'done';
    document.body.classList.remove('prologue');
    skipButton.hidden = true;
    if (showBanner) ui.showBanner(CHAPTER.name, `Chapter ${CHAPTER.number}`);
    onDone();
  }

  // Jumps to the end: day, Sol in place, Marlo back at his post. (The skip button, and the automatic tests, use this.)
  function skip() {
    if (phase === 'idle' || phase === 'done') return;
    phase = 'skipping';   // so the end of the conversation does not start the sunrise
    ui.hideTitle();
    story.skip();
    endLesson();
    star.visible = false;
    crater.visible = false;
    craterAmount = 0;
    numbers.length = 0;
    player.setVisible(true);
    player.group.scale.setScalar(1);
    marlo.goHome();
    night = 0;
    world.setNight(0, 0);
    finish(true);
  }

  // Called every frame with the real time that passed (not paused by conversations) and the clock.
  function update(dt, time) {
    if (phase === 'idle' || phase === 'done') return;
    if (phase !== 'title') clock += dt;

    for (let i = numbers.length - 1; i >= 0; i--) {
      numbers[i].left -= dt;
      if (numbers[i].left <= 0) {
        ui.popNumber(player.position, numbers[i].text, 'big', 2.8);
        audio.play('climb', { pitch: numbers[i].pitch });
        numbers.splice(i, 1);
      }
    }

    if (phase === 'dark') {
      if (clock > DARK_TIME) beginFall();
    } else if (phase === 'falling') {
      const t = Math.min(1, clock / FALL_TIME);
      star.position.lerpVectors(starFrom, STAR_TO, t ** 1.8);
      for (let i = 0; i < 3; i++) {   // a trail of sparks
        sparks.emit(star.position.x + random(-0.2, 0.2), star.position.y + random(-0.2, 0.2), star.position.z + random(-0.2, 0.2), random(-0.5, 0.5), random(-0.5, 0.5), random(-0.5, 0.5), 0.55, random(0.18, 0.34), pick(SPARKS), -1);
      }
      if (t >= 1) impact();
    } else if (phase === 'rising') {
      const t = Math.min(1, clock / RISE_TIME);
      player.group.scale.setScalar(Math.max(0.01, 1 - (1 - t) ** 3));
      craterAmount = Math.min(1, clock / 0.6);
      if (t >= 1) {
        player.group.scale.setScalar(1);
        marlo.walkTo(player.position.x + 2.2, player.position.z - 1.3);   // Marlo comes over to meet them
        phase = 'walking';
        clock = 0;
      }
    } else if (phase === 'walking') {
      if ((marlo.arrived && clock > 0.6) || clock > 12) {   // (the 12 seconds is only a safety net)
        phase = 'talking';
        story.scene('prologue', beginDawn);
      }
    } else if (phase === 'talking' && lesson) {
      const p = player.position;
      if (lesson.kind === 'move' && Math.hypot(p.x - RING_AT.x, p.z - RING_AT.z) < 1.0) lessonDone();
      else if (lesson.kind === 'strike' && lesson.dummies.every((d) => !d.alive)) lessonDone();
      else if (lesson.kind === 'power' && bigHits >= 2) lessonDone();
    } else if (phase === 'dawn') {
      night = Math.max(0, 1 - clock / DAWN_TIME);
      craterAmount = night;
      if (night === 0) finish(false);
    }

    if (night > 0 || phase === 'dawn' || phase === 'done') world.setNight(night, time);   // every frame at night (the stars twinkle), and once more when the sun is fully up
    crater.visible = craterAmount > 0.01;
    if (crater.visible) {
      scorch.material.opacity = 0.85 * craterAmount;
      rim.material.opacity = (0.75 + 0.25 * Math.sin(time * 3)) * craterAmount;
      glow.material.opacity = (0.7 + 0.2 * Math.sin(time * 2.3)) * craterAmount;
    }
    if (ring.visible) ring.scale.setScalar(1 + Math.sin(time * 4) * 0.06);
    star.children[0].material.opacity = 0.85 + Math.sin(time * 30) * 0.15;
  }

  skipButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();   // the joystick never sees this touch
    audio.play('click');
    skip();
  });

  return {
    begin, go, update, skip, cue, startLesson, noteHit,
    get phase() { return phase; },
    get running() { return phase !== 'idle' && phase !== 'done'; },
    get cinematic() { return ['title', 'dark', 'falling', 'rising', 'walking'].includes(phase); },   // the controls are off (the world keeps moving)
    get pipWithMarlo() { return ['title', 'dark', 'falling', 'rising', 'walking'].includes(phase); },
    get lanternUp() { return ['title', 'dark', 'falling', 'rising', 'walking', 'talking'].includes(phase); },
    get lessonKind() { return lesson ? lesson.kind : null; },
    get starVisible() { return star.visible; },   // (these three let the automatic tests look at the scene)
    get craterVisible() { return crater.visible; },
    get ringVisible() { return ring.visible; },
  };
}
