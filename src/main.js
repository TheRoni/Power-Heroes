// main.js: starts the game. It creates the 3D world, Ember and the controls, then runs the game loop.
import * as THREE from '../lib/three.module.min.js';
import { createWorld, WALK_RADIUS } from './scene.js';
import { createInput } from './input.js';
import { createHero } from './hero.js';

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
const ember = createHero({ bound: WALK_RADIUS });
world.scene.add(ember.group);

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
  window.__game = { ember, input, world, renderer };   // lets the automatic tests look inside the game
}

// --- The game loop: runs once for every picture drawn ---
let last = performance.now();
function frame(now) {
  const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);   // a slow frame never causes a big jump
  last = now;
  const time = now / 1000;

  ember.update(dt, input.move, time);
  world.follow(ember.position, ember.velocity, dt, false);
  world.update(dt, time);
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
