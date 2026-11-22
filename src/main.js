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

// --- Screen effects ---
// shake: how hard the camera is shaking. freeze: seconds the game holds still (a "hit-stop").
// colour: 0 = the island is washed-out, 1 = full colour. It rises as Gloomlings are beaten.
const fx = { shake: 0, freeze: 0, freezes: 0, colour: 0 };
const WASHED_OUT = 0.6;    // how strong the grey veil is at the start of a round (0 = none, 1 = solid grey)
const CONFETTI = [0xff7ab8, 0xffe14a, 0x5ad8ff, 0x7dff52, 0xff9a3c];
const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;   // people who ask for less motion get no shaking
const tint = document.getElementById('tint');
let waveFreezePending = false;   // a Flame Wave freezes the game once, the first time it lands

function shake(amount) {
  if (!calmMotion) fx.shake = Math.max(fx.shake, amount);
}

// --- Create everything ---
const world = createWorld();
const input = createInput(document.getElementById('joystick'), document.getElementById('joystick-knob'));
const ui = createUI({ camera: world.camera, onCast: () => powers.castWave(), onAgain: restart });
const ember = createHero({
  scene: world.scene,
  bound: WALK_RADIUS,
  onHurt: (amount) => { ui.popNumber(ember.position, amount, 'hurt'); shake(0.16); },
  onDown: () => shake(0.3),
});
const gloomlings = [];   // every living Gloomling (waves.js adds to this list, powers.js takes defeated ones out)
const powers = createPowers({
  scene: world.scene,
  ember,
  gloomlings,
  events: {
    cast: () => { waveFreezePending = true; shake(0.12); },
    hit: (gloom, amount, kind) => {
      ui.popNumber(gloom.position, amount, kind, 1.6);
      if (kind === 'big' && waveFreezePending) {   // the Flame Wave has landed: a 60 ms freeze-frame and a shake
        waveFreezePending = false;
        fx.freeze = 0.06;
        fx.freezes++;
        shake(0.22);
      }
    },
  },
});
const waves = createWaves({
  scene: world.scene,
  ember,
  gloomlings,
  events: {
    wave: (number, total) => ui.showBanner(`Wave ${number}`, number === total ? 'Final wave!' : `of ${total}`),
    spawn: (gloom) => puff(gloom.position),
    cleared: (number) => celebrate(number === waves.total ? 110 : 25),
    end: (kind) => ui.showEnd(kind),
  },
});

// A puff of dark sparks where a Gloomling appears.
function puff(position) {
  for (let i = 0; i < 8; i++) {
    powers.sparks.emit(position.x, 0.3, position.z, (Math.random() - 0.5) * 4, 1 + Math.random() * 2, (Math.random() - 0.5) * 4, 0.5, 0.2, 0x6a45b0, -4);
  }
}

// Confetti shooting up all over the island when a wave is cleared (a big burst after the last one).
function celebrate(count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * 9;
    powers.sparks.emit(
      Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius,
      (Math.random() - 0.5) * 2, 6 + Math.random() * 4, (Math.random() - 0.5) * 2,
      1 + Math.random() * 0.6, 0.2 + Math.random() * 0.15, CONFETTI[i % CONFETTI.length], -9,
    );
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
  window.__game = { ember, input, world, renderer, gloomlings, ui, powers, waves, fx };   // lets the automatic tests look inside the game
}

// --- The game loop: runs once for every picture drawn ---
let last = performance.now();
let gameTime = 0;      // like the clock, but it stands still during a freeze-frame
let lastTint = '';
function frame(now) {
  const realDt = Math.min(Math.max((now - last) / 1000, 0), 0.05);   // a slow frame never causes a big jump
  last = now;
  let dt = realDt;
  if (fx.freeze > 0) {   // a freeze-frame: the game holds still for a moment while the picture is still drawn
    fx.freeze -= realDt;
    dt = 0;
  }
  gameTime += dt;

  ember.update(dt, input.move, gameTime);
  for (const gloomling of gloomlings) gloomling.update(dt, ember, gameTime, gloomlings);
  powers.update(dt, gameTime);
  waves.update(dt);
  world.follow(ember.position, ember.velocity, dt, false);
  world.update(dt, gameTime);

  if (fx.shake > 0.002) {   // camera shake: a quick random wobble that fades away
    world.camera.position.x += (Math.random() - 0.5) * 2 * fx.shake;
    world.camera.position.y += (Math.random() - 0.5) * 2 * fx.shake;
    fx.shake *= Math.exp(-9 * realDt);
  } else {
    fx.shake = 0;
  }

  fx.colour += (waves.progress - fx.colour) * (1 - Math.exp(-3 * realDt));   // colour drifts toward how much of the round is beaten
  const veil = (WASHED_OUT * (1 - fx.colour)).toFixed(3);
  if (veil !== lastTint) {
    lastTint = veil;
    tint.style.opacity = veil;
  }

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
    if (now / 1000 - fpsStart >= 0.5) {
      fpsBox.textContent = `${Math.round(fpsFrames / (now / 1000 - fpsStart))} fps · ${renderer.info.render.calls} draws`;
      fpsFrames = 0;
      fpsStart = now / 1000;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
