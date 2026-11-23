// main.js: starts the game. It creates the 3D world, the player's hero, Pip, the waves and the controls, then runs the game loop.
import * as THREE from '../lib/three.module.min.js';
import { createWorld, WALK_RADIUS } from './scene.js';
import { createInput } from './input.js';
import { createGuest } from './hero.js';
import { createSquad } from './squad.js';
import { HEROES } from './heroes-data.js';
import { createWaves } from './waves.js';
import { createPip } from './pip.js';
import { createMarlo } from './marlo.js';
import { createStory } from './story.js';
import { createPrologue } from './prologue.js';
import { createUI } from './ui.js';
import { createAudio } from './audio.js';
import { createMusic } from './music.js';

// Add ?debug (or #debug, which also works in the Claude test link) to the end of the web address to show the frame rate.
const FLAGS = new URLSearchParams(location.search);
const HASH = location.hash.slice(1).split(/[,&-]/);   // "#debug", "#debug-title" and "#debug-squad" work too (in the Claude test link)
const flag = (name) => FLAGS.has(name) || HASH.includes(name);
const DEBUG = flag('debug');
const TITLE = !DEBUG || flag('title');   // debug mode skips the title screen and the squad screen (so the tests are quick), unless asked
const PICK = !DEBUG || flag('squad');
const PLAYER_KIND = DEBUG && HEROES[FLAGS.get('hero')] ? FLAGS.get('hero') : 'sol';   // which hero the player controls (a key in heroes-data.js); ?debug&hero=tide previews another

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
const NO_MOVE = { x: 0, z: 0 };   // the controls, as the opening cinematic sees them
const calmMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;   // people who ask for less motion get no shaking
let waveFreezePending = false;   // a superpower freezes the game once, the first time it lands
let waveHits = 0;                // how many Gloomlings the latest superpower hit
let waveHitTimer = -1;           // counts down until we know how big that superpower was
const said = { first: false, hurt: false, low: false };   // Pip's one-time comments, so they are not repeated every round
const soon = [];   // Pip's comments waiting for their moment: { key, left }
let ending = null;   // 'won' or 'lost' while Marlo walks over, before the closing conversation
let endWait = 0;
let unlocked = ['sol'];   // the heroes you can choose from (the rest join after the first win)

const saySoon = (key, delay) => soon.push({ key, left: delay });   // Pip says something after a short delay (so a wave's comment does not land on its banner)

function shake(amount) {
  if (!calmMotion) fx.shake = Math.max(fx.shake, amount);
}

const frozen = () => prologue.cinematic || ending !== null || story.waiting === 'arrive';   // the controls are off

// --- Create everything ---
const world = createWorld();
const input = createInput(document.getElementById('joystick'), document.getElementById('joystick-knob'));
const audio = createAudio();   // sound starts at the first tap (the title screen)
audio.bindButton(document.getElementById('mute'));
const music = createMusic(audio);   // the flute and the songs (they start when the story begins)
const ui = createUI({
  camera: world.camera, audio, onAgain: restart,
  onCast: () => { if (!story.active && !frozen()) powers.castPower(); },
  onSwap: (index) => { if (!story.active && !frozen()) squad.swapTo(index); },   // a portrait tapped, or 1, 2, 3
});
const ember = createGuest({ scene: world.scene, bound: WALK_RADIUS, kind: 'ember' });   // she runs in at the end of Chapter 1
const gloomlings = [];   // every living Gloomling (waves.js adds to this list, powers.js takes defeated ones out)
const squad = createSquad({
  scene: world.scene,
  bound: WALK_RADIUS,
  gloomlings,
  audio,
  onHurt: (amount) => {
    ui.popNumber(player.position, amount, 'hurt');
    shake(0.16);
    audio.play('bump');
    if (!said.hurt) { said.hurt = true; story.say('hurt'); }
  },
  onDown: () => { shake(0.3); audio.play('down'); },
  onSwap: (kind) => ui.setHero({ name: HEROES[kind].name, powerName: HEROES[kind].power.name, powerId: HEROES[kind].power.id }),   // the button, the name and the icon follow whoever is in play
  events: {
    cast: () => { waveFreezePending = true; waveHits = 0; waveHitTimer = 0.5; shake(0.12); },
    hit: (gloom, amount, kind) => {
      ui.popNumber(gloom.position, amount, kind, 1.6);
      if (kind !== 'big') return;
      prologue.noteHit(kind);
      waveHits++;
      if (waveFreezePending) {   // the superpower has landed: a 60 ms freeze-frame and a shake
        waveFreezePending = false;
        fx.freeze = 0.06;
        fx.freezes++;
        shake(0.22);
      }
    },
    defeat: () => { if (!said.first && !prologue.running) { said.first = true; story.say('first'); } },
  },
});
const player = squad.player;   // always whoever is in play (see squad.js)
const powers = squad.powers;
chooseSquad([PLAYER_KIND]);
const pip = createPip({ scene: world.scene, emit: (...spark) => powers.sparks.emit(...spark) });
const marlo = createMarlo({ scene: world.scene, emit: (...spark) => powers.sparks.emit(...spark) });
const story = createStory({
  camera: world.camera,
  anchors: { pip: { object: pip.group, lift: 0.7 }, marlo: { object: marlo.group, lift: 3.4 } },   // where each speaker's bubble floats
  onStart: () => input.release(),   // a conversation starts: let go of the controls
  onSpeak: () => pip.excite(),
  onWait: (kind) => (kind === 'arrive' ? emberArrives() : prologue.startLesson(kind)),   // a lesson begins, or Ember runs in
  onCue: (cue) => prologue.cue(cue),
  audio,
  music,
});
const waves = createWaves({
  scene: world.scene,
  hero: player,
  gloomlings,
  events: {
    wave: (number, total) => {
      ui.showBanner(`Wave ${number}`, number === total ? 'Final wave!' : `of ${total}`);
      audio.play('wave');
      music.play('battle', 1);
      saySoon(`wave${number}`, 1.2);
    },
    spawn: (gloom) => { powers.sparks.puff(gloom.position); audio.play('spawn'); },
    cleared: (number) => {
      powers.sparks.confetti(number === waves.total ? 110 : 25);
      audio.play('cleared');
      if (number < waves.total) story.say('cleared');
    },
    end: (kind) => { ending = kind; endWait = 0; if (kind === 'won') unlocked = Object.keys(HEROES); audio.play(kind === 'won' ? 'win' : 'lose'); music.play('sunmeadow', 2.5); marlo.walkTo(player.position.x + 2.2, player.position.z - 1.3); },   // Marlo walks over, then a short conversation, then the end screen
  },
});

// Ember runs in from the left edge and stops beside Sol (the win conversation waits for her).
function emberArrives() {
  const p = player.position;
  ember.runIn(-WALK_RADIUS * 0.95, WALK_RADIUS * 0.25, p.x - 2, p.z + 0.8, p.x, p.z);
  audio.play('swoosh');
}

// Chooses the squad (the first one is in play) and shows their portraits.
function chooseSquad(kinds) {
  squad.set(kinds);
  ui.setSquad(squad.roster.map((kind) => HEROES[kind]));
}

// "Play again" and "Try again": a fresh round (without the long introduction). Once more than one hero has joined,
// the squad screen comes first.
function restart() {
  ui.hideEnd();
  if (unlocked.length < 2 || !PICK) { startRound(); return; }
  const heroes = unlocked.map((kind) => ({ kind, name: HEROES[kind].name, type: HEROES[kind].type, power: HEROES[kind].power.name }));
  ui.showSquad({ heroes, chosen: squad.roster.length > 1 ? squad.roster : ['ember', 'tide'], onGo: (kinds) => { chooseSquad(kinds); startRound(); } });
}

function startRound() {
  hintHidden = true;   // the how-to-play hint is for the first round only (it would sit on the portraits)
  hint.classList.add('gone');
  player.reset();
  powers.reset();
  said.first = said.hurt = said.low = false;
  ending = null;
  ember.leave();
  waveHitTimer = -1;
  soon.length = 0;
  marlo.goHome();
  waves.start();
}

// The very first thing the player sees: a star falls, Marlo comes, three short lessons, then the sunrise. The first wave starts after it.
const prologue = createPrologue({ world, player, marlo, powers, story, gloomlings, ui, shake, audio, music, onDone: () => waves.start() });
prologue.begin();   // the night scene is ready, with Sol off stage
if (TITLE) ui.showTitle(() => prologue.go());   // the first tap starts the sound and the story
else prologue.go();

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
world.follow(player.position, player.velocity, 0, true);   // start with the camera already on the player

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
  window.__game = { player, input, world, renderer, gloomlings, ui, powers, waves, fx, story, pip, marlo, prologue, ember, audio, music, squad };   // lets the automatic tests look inside the game
}

// --- The game loop: runs once for every picture drawn ---
let last = performance.now();
let gameTime = 0;      // like the clock, but it stands still during a freeze-frame or a conversation
function frame(now) {
  const realDt = Math.min(Math.max((now - last) / 1000, 0), 0.05);   // a slow frame never causes a big jump
  last = now;
  let dt = realDt;
  if (fx.freeze > 0) {   // a freeze-frame: the game holds still for a moment while the picture is still drawn
    fx.freeze -= realDt;
    dt = 0;
  }
  if (story.active) dt = 0;   // a conversation: the game waits
  gameTime += dt;

  const move = frozen() ? NO_MOVE : input.move;
  player.update(dt, move, gameTime);
  for (const gloomling of gloomlings) gloomling.update(dt, player, gameTime, gloomlings);
  powers.update(dt, gameTime);
  waves.update(dt);
  world.follow(player.position, player.velocity, dt, false);
  world.update(dt, gameTime);
  prologue.update(realDt, now / 1000);
  story.update(realDt);
  marlo.raise(waves.state === 'spawning' || waves.state === 'fighting' || prologue.lanternUp);   // he holds his lantern up while the fight is on
  marlo.update(realDt, now / 1000, player.position);
  ember.update(realDt, now / 1000);
  if (ending && (marlo.arrived || (endWait += realDt) > 8)) {   // Marlo has come over: the closing conversation begins
    const kind = ending;
    ending = null;
    story.scene(kind === 'won' ? 'win' : 'lose', () => ui.showEnd(kind));
  }
  if (story.waiting === 'arrive' && ember.arrived) story.resume();   // Ember is here: the talk carries on
  // Pip stays by the hero, but in a conversation Pip hovers by Marlo if he has come over to talk.
  const marloHere = prologue.pipWithMarlo || (story.active && Math.hypot(marlo.position.x - player.position.x, marlo.position.z - player.position.z) < 5);
  pip.update(realDt, now / 1000, marloHere ? marlo.position : player.position, marloHere ? 3.5 : 2.7);

  for (let i = soon.length - 1; i >= 0; i--) {
    soon[i].left -= realDt;
    if (soon[i].left <= 0) {
      story.say(soon[i].key);
      soon.splice(i, 1);
    }
  }
  if (waveHitTimer > 0) {   // a big superpower (three or more Gloomlings) gets a cheer from Pip
    waveHitTimer -= realDt;
    if (waveHitTimer <= 0 && waveHits >= 3) story.say('big');
  }
  if (!said.low && !player.down && waves.state !== 'idle' && player.health / player.maxHealth < 0.3) {
    said.low = true;
    story.say('low');
  }

  if (fx.shake > 0.002) {   // camera shake: a quick random wobble that fades away
    world.camera.position.x += (Math.random() - 0.5) * 2 * fx.shake;
    world.camera.position.y += (Math.random() - 0.5) * 2 * fx.shake;
    fx.shake *= Math.exp(-9 * realDt);
  } else {
    fx.shake = 0;
  }

  fx.colour += (waves.progress - fx.colour) * (1 - Math.exp(-3 * realDt));   // colour drifts toward how much of the round is beaten
  ui.setVeil(WASHED_OUT * (1 - fx.colour) * (1 - world.night));   // no veil at night: the washed-out look comes in with the sunrise

  ui.setHealth(player.health / player.maxHealth);
  ui.setPortraits(squad.status, squad.swapReady);
  ui.setPower(powers.powerProgress);
  ui.setWaveText(waveText());
  renderer.render(world.scene, world.camera);

  if (!hintHidden && (move.x !== 0 || move.z !== 0)) {
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
