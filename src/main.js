// main.js: starts the game. It creates the 3D world, Ember, the waves and the controls, then runs the game loop.
import * as THREE from '../lib/three.module.min.js';
import { createWorld, WALK_RADIUS } from './scene.js';
import { createInput } from './input.js';
import { createHero } from './hero.js';
import { createPowers } from './powers.js';
import { createWaves } from './waves.js';
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
const ui = createUI({ camera: world.camera, onCast: () => powers.castWave(), onAgain: restart });
const ember = createHero({
  scene: world.scene,
  bound: WALK_RADIUS,
  onHurt: (amount) => ui.popNumber(ember.position, amount, 'hurt'),
});
const gloomlings = [];   // every living Gloomling (waves.js adds to this list, powers.js takes defeated ones out)
const powers = createPowers({
  scene: world.scene,
  ember,
  gloomlings,
  events: { hit: (gloom, amount, kind) => ui.popNumber(gloom.position, amount, kind, 1.6) },
});
const waves = createWaves({
  scene: world.scene,
  ember,
  gloomlings,
  events: {
    wave: (number, total) => ui.showBanner(`Wave ${number}`, number === total ? 'Final wave!' : `of ${total}`),
    spawn: (gloom) => puff(gloom.position),
    end: (kind) => ui.showEnd(kind),
  },
});

// A puff of dark sparks where a Gloomling appears.
function puff(position) {
  for (let i = 0; i < 8; i++) {
    powers.sparks.emit(position.x, 0.3, position.z, (Math.random() - 0.5) * 4, 1 + Math.random() * 2, (Math.random() - 0.5) * 4, 0.5, 0.2, 0x6a45b0, -4);
  }
}

// "Play again" and "Try again": a completely fresh round.
function restart() {
  ui.hideEnd();
  ember.reset();
  powers.reset();
  waves.start();
}
waves.start();

// The small note in the corner, such as "Wave 2/3 · 5 left".
function waveText() {
  if (waves.state === 'break') return waves.wave === 1 ? 'Get ready…' : `Wave ${waves.wave} coming…`;
  if (waves.state === 'spawning' || waves.state === 'fighting') return `Wave ${waves.wave}/${waves.total} · ${waves.remaining} left`;
  return '';
}

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
  window.__game = { ember, input, world, renderer, gloomlings, ui, powers, waves };   // lets the automatic tests look inside the game
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
  waves.update(dt);
  world.follow(ember.position, ember.velocity, dt, false);
  world.update(dt, time);
  ui.setHealth(ember.health / ember.maxHealth);
  ui.setWave(powers.waveProgress);
  ui.setWaveText(waveText());
  renderer.render(world.scene, world.camera);

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
