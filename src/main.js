// main.js: starts the game. It creates the 3D world, Ember, the Gloomlings and the controls, then runs the game loop.
import * as THREE from '../lib/three.module.min.js';
import { createWorld, WALK_RADIUS } from './scene.js';
import { createInput } from './input.js';
import { createHero } from './hero.js';
import { createGloomling } from './gloom.js';
import { createPowers } from './powers.js';
import { createUI } from './ui.js';

// Add ?debug (or #debug, which also works in the Claude test link) to the end of the web address to show the frame rate.
const DEBUG = new URLSearchParams(location.search).has('debug') || location.hash === '#debug';

// --- Set up the screen ---
const canvas = document.getElementById('game');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
} catch (error) {
  document.getElementById('message').hidden = false;   // this device cannot draw 3D graphics
  throw error;
}
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// --- Create everything ---
const world = createWorld();
const input = createInput(document.getElementById('joystick'), document.getElementById('joystick-knob'));
const ui = createUI({ camera: world.camera, onCast: () => powers.castWave() });
const ember = createHero({
  scene: world.scene,
  bound: WALK_RADIUS,
  onHurt: (amount) => ui.popNumber(ember.position, amount, 'hurt'),
});
const gloomlings = [];   // every living Gloomling (powers.js takes defeated ones out of this list)
const powers = createPowers({
  scene: world.scene,
  ember,
  gloomlings,
  events: { hit: (gloom, amount, kind) => ui.popNumber(gloom.position, amount, kind, 1.6) },
});

// TEMPORARY until the wave system arrives (a later step): four Gloomlings start on the rim,
// four more arrive when they are all beaten, and everything starts over a few seconds after Ember is knocked out.
function spawnGloomlings(count) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random();
    gloomlings.push(createGloomling({ scene: world.scene, x: Math.cos(angle) * 10.8, z: Math.sin(angle) * 10.8 }));
  }
}
function clearGloomlings() {
  for (const gloomling of gloomlings) gloomling.remove();
  gloomlings.length = 0;
}
spawnGloomlings(4);
let downTime = 0;
let emptyTime = 0;

// --- Keep the picture the right size, on every screen and when the phone is turned ---
function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));   // sharp, but not wasteful on very dense screens
  renderer.setSize(width, height, false);
  world.resize(width, height);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();
world.follow(ember.position, ember.velocity, 0, true);   // start with the camera already on Ember

// --- Small extras ---
const hint = document.getElementById('hint');
let hintHidden = false;

let fpsBox = null;
let fpsFrames = 0;
let fpsStart = 0;
if (DEBUG) {
  fpsBox = document.createElement('div');
  fpsBox.id = 'fps';
  document.body.appendChild(fpsBox);
  window.__game = { ember, input, world, renderer, gloomlings, ui, powers };   // lets the automatic tests look inside the game
}

// --- The game loop: runs once for every picture drawn ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);   // a slow frame never causes a big jump
  last = now;
  const time = now / 1000;

  ember.update(dt, input.move, time);
  for (const gloomling of gloomlings) gloomling.update(dt, ember, time, gloomlings);
  powers.update(dt, time);
  world.follow(ember.position, ember.velocity, dt, false);
  world.update(dt, time);
  ui.setHealth(ember.health / ember.maxHealth);
  ui.setWave(powers.waveProgress);
  renderer.render(world.scene, world.camera);

  if (ember.down) {   // TEMPORARY restart
    downTime += dt;
    if (downTime > 2.5) {
      downTime = 0;
      ember.reset();
      powers.reset();
      clearGloomlings();
      spawnGloomlings(4);
    }
  } else if (gloomlings.length === 0) {   // TEMPORARY refill
    emptyTime += dt;
    if (emptyTime > 1.5) {
      emptyTime = 0;
      spawnGloomlings(4);
    }
  }

  if (!hintHidden && (input.move.x !== 0 || input.move.z !== 0)) {
    hintHidden = true;
    hint.classList.add('gone');
  }
  if (fpsBox) {
    fpsFrames++;
    if (time - fpsStart >= 0.5) {
      fpsBox.textContent = `${Math.round(fpsFrames / (time - fpsStart))} fps · ${renderer.info.render.calls} draws`;
      fpsFrames = 0;
      fpsStart = time;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
