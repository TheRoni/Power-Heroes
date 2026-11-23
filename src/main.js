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
import { createAura } from './aura.js';
import { createOverdrive, BOOST } from './overdrive.js';
import { createRounds } from './rounds.js';
import { createCampfire } from './campfire.js';
import { createVillage } from './village.js';
import { createProgress } from './power.js';
import { createSave } from './save.js';
import { registerOffline } from './offline.js';
import { flag, DEBUG, TITLE, PICK, CHAPTER, PERSIST, PLAYER_KIND } from './flags.js';

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
const save = createSave();
const progress = createProgress((kind) => HEROES[kind].startPower, PERSIST ? save : null, DEBUG && !flag('power') ? 10 : null);   // XP, who has joined, what has been seen
HEROES.sol.name = progress.name;   // what the player called the hero (Sol, unless they changed it on the title screen)
const said = { first: false, hurt: false, low: false, super: progress.has('super'), swap: progress.has('swap'), combo: progress.has('combo') };   // Pip's one-time comments, so they are not repeated every round
const soon = [];   // Pip's comments waiting for their moment: { key, left }

const saySoon = (key, delay) => soon.push({ key, left: delay });   // Pip says something after a short delay (so a wave's comment does not land on its banner)

const showHero = (kind) => ui.setHero({ name: HEROES[kind].name, type: HEROES[kind].type, power: progress.powerOf(kind), powerName: HEROES[kind].power.name, powerId: HEROES[kind].power.id });   // the corner box and the power button

function shake(amount) {
  if (!calmMotion) fx.shake = Math.max(fx.shake, amount);
}

const frozen = () => prologue.cinematic || rounds.ending !== null || story.waiting === 'arrive' || campfire.active;   // the controls are off

// --- Create everything ---
const world = createWorld();
const input = createInput(document.getElementById('joystick'), document.getElementById('joystick-knob'));
const audio = createAudio();   // sound starts at the first tap (the title screen)
audio.bindButton(document.getElementById('mute'));
const music = createMusic(audio);   // the flute and the songs (they start when the story begins)
const ui = createUI({
  camera: world.camera, audio, onAgain: () => rounds.restart(),
  onCast: () => { if (story.active) return; if (village.active) rounds.press(); else if (!frozen()) powers.castPower(); },   // (in the village the big button is the action button)
  onSwap: (index) => { if (story.active || frozen()) return; if (index === squad.slot) overdrive.activate(); else squad.swapTo(index); },   // a portrait tapped, or 1, 2, 3 (the hero in play: Overdrive)
  onOverdrive: () => { if (!story.active && !frozen()) overdrive.activate(); },   // the button, or E
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
  powerOf: (kind) => progress.powerOf(kind),
  onSwap: (kind) => showHero(kind),   // the button, the name and the icon follow whoever is in play
  events: {
    cast: () => { waveFreezePending = true; waveHits = 0; waveHitTimer = 0.5; shake(0.12); },
    hit: (gloom, amount, kind, label) => {
      overdrive.hit(kind);
      ui.popNumber(gloom.position, amount, kind, 1.6);
      if (label !== 'normal') ui.popNumber(gloom.position, label === 'super' ? 'SUPER!' : 'weak', label, 2.5);   // the type pop-ups
      if (label === 'super' && !said.super) { said.super = true; progress.mark('super'); saySoon('super', 0.8); }
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
    defeat: (gloom) => { rounds.defeat(gloom); if (!said.first && !prologue.running) { said.first = true; story.say('first'); } },
    combo: (name, count, gloom) => {   // a combo went off: the first time it gets a banner and a word from Pip
      shake(0.15);
      if (said.combo) ui.popNumber(gloom.position, `${name}!`, 'combo', 2.8);
      else { said.combo = true; progress.mark('combo'); ui.showBanner(`${name}!`, 'A new combo!'); saySoon('combo', 1); }
    },
  },
});
const player = squad.player;   // always whoever is in play (see squad.js)
const powers = squad.powers;
const pip = createPip({ scene: world.scene, emit: (...spark) => powers.sparks.emit(...spark) });
const marlo = createMarlo({ scene: world.scene, emit: (...spark) => powers.sparks.emit(...spark) });
const story = createStory({
  camera: world.camera,
  anchors: { pip: { object: pip.group, lift: 0.7 }, marlo: { object: marlo.group, lift: 3.4 } },   // where each speaker's bubble floats
  onStart: () => input.release(),   // a conversation starts: let go of the controls
  onSpeak: () => pip.excite(),
  onWait: (kind) => (kind === 'arrive' ? rounds.arrive() : prologue.startLesson(kind)),   // a lesson begins, or Ember runs in
  vars: () => rounds.vars(),   // "Power {power}" in a line is Sol's Power
  onCue: (cue) => { if (!campfire.cue(cue)) prologue.cue(cue); },   // the campfire's cues (the fire, the shard), or the prologue's
  audio,
  music,
});
const waves = createWaves({
  scene: world.scene,
  hero: player,
  gloomlings,
  enemyPower: (wave) => rounds.enemyPower(wave),
  emit: (...spark) => powers.sparks.emit(...spark),
  bossEvents: {   // General Bramble's own news: his shake, his words and his sounds
    shake: (amount) => shake(amount),
    taunt: (key) => story.say(`bramble_${key}`),
    sound: (name) => audio.play(name),
    down: (boss) => { rounds.defeat(boss); audio.play('bossdown'); fx.freeze = 0.15; },   // (XP for him, and a moment of stillness)
    fallen: (boss) => story.scene('bossDown', () => boss.finish()),   // his last words, and then he fades away
  },
  events: {
    wave: (number, total, info) => {
      const round = number === 1 && rounds.round;   // the first wave of a round of the chapter announces the round
      if (info && info.boss) ui.showBanner(info.boss.name, 'Boss!');
      else ui.showBanner(round ? `Round ${progress.round}` : `Wave ${number}`, round ? round.name : number === total ? 'Final wave!' : `of ${total}`);
      audio.play('wave');
      music.play('battle', 1);
      saySoon(round && round.intro ? round.intro : `wave${number}`, 1.2);
    },
    spawn: (gloom) => { powers.sparks.puff(gloom.position); audio.play('spawn'); },
    cleared: (number) => {
      powers.sparks.confetti(number === waves.total ? 110 : 25);
      audio.play('cleared');
      if (number < waves.total) story.say('cleared');
    },
    end: (kind) => rounds.end(kind),   // XP, then Marlo walks over, then a short conversation, then the end screen
  },
});

// The rounds: the squad, XP and Power, the squad screen, saving, and how a round ends (see rounds.js).
const aura = createAura({ scene: world.scene, position: player.position, sparks: powers.sparks });   // grows with Power (see aura.js)
const overdrive = createOverdrive({ squad, aura, ui, audio, shake });   // hits fill a meter; when it is full, Overdrive
const campfire = createCampfire({ world, player, marlo, ember, story, audio, aura, progress, ui });   // the night after the boss (see campfire.js)
const village = createVillage({ world });   // the Home Village, a place to walk about between battles (see village.js)
const rounds = createRounds({
  progress, squad, waves, ui, story, marlo, ember, music, audio, player, powers, aura, campfire, village, pick: PICK, chapter: CHAPTER,
  onNewRound: () => {   // the game's own small resets
    hintHidden = true;   // the how-to-play hint is for the first round only (it would sit on the portraits)
    hint.classList.add('gone');
    said.first = said.hurt = said.low = false;
    if (squad.roster.length > 1 && !said.swap) { said.swap = true; progress.mark('swap'); saySoon('swapTip', 3); }
    waveHitTimer = -1;
    soon.length = 0;
    overdrive.reset();
  },
});
rounds.chooseSquad([PLAYER_KIND]);

// The very first thing the player sees: a star falls, Marlo comes, three short lessons, then the sunrise. The first wave starts after it.
const prologue = createPrologue({ world, player, marlo, powers, story, gloomlings, ui, shake, audio, music, reward: rounds.reward, onDone: rounds.afterPrologue });
prologue.begin();   // the night scene is ready, with Sol off stage
const begin = () => (progress.has('prologue') ? (music.play('sunmeadow', 1), prologue.skip()) : prologue.go());   // someone who has played before skips the prologue
const naming = { name: () => progress.name, set: (text) => { HEROES.sol.name = progress.setName(text); showHero(player.kind); } };   // the title screen's name box
if (TITLE) ui.showTitle(begin, progress.saved ? () => { save.clear(); location.reload(); } : null, naming);   // the first tap starts the sound and the story
else prologue.go();

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
registerOffline();   // on a real web address, the game saves itself on the phone so it works with no internet (offline.js)
const hint = document.getElementById('hint');
let hintHidden = false;

if (DEBUG) {
  ui.showFps();
  window.__game = { player, input, world, renderer, gloomlings, ui, powers, waves, fx, story, pip, marlo, prologue, ember, audio, music, squad, progress, rounds, aura, overdrive, campfire, village };   // lets the automatic tests look inside the game
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
  if (village.active) village.keepOut(player.position);   // (the Hall, the pond, the tower and so on are solid)
  for (const gloomling of gloomlings) gloomling.update(dt, player, gameTime, gloomlings);
  powers.update(dt, gameTime);
  waves.update(dt);
  world.follow(player.position, player.velocity, dt, false);
  aura.update(dt, gameTime, { power: progress.powerOf(player.kind), type: player.type, visible: player.group.visible, speed: Math.hypot(player.velocity.x, player.velocity.z) });
  player.setGlow(aura.glow);
  overdrive.update(dt);
  ui.setOverdrive(overdrive);
  ui.setBoss(waves.boss);   // the boss's health bar, while he is on the island
  ui.setHeroPower(Math.round(progress.powerOf(player.kind) * (overdrive.active ? BOOST : 1)), overdrive.active);
  world.update(dt, gameTime);
  prologue.update(realDt, now / 1000);
  story.update(realDt);
  marlo.raise(waves.state === 'spawning' || waves.state === 'fighting' || prologue.lanternUp);   // he holds his lantern up while the fight is on
  marlo.update(realDt, now / 1000, player.position);
  ember.update(realDt, now / 1000);
  campfire.update(realDt, now / 1000);
  village.update(realDt, now / 1000);
  ui.setAction(village.active ? (village.actionAt(player.position) || { label: '' }) : null);   // the big button: "Hero Hall", "Rankings", or nothing
  rounds.update(realDt);
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

  fx.colour += ((village.active ? 1 : waves.progress) - fx.colour) * (1 - Math.exp(-3 * realDt));   // colour drifts toward how much of the round is beaten
  ui.setVeil(WASHED_OUT * (1 - fx.colour) * (1 - world.night));   // no veil at night: the washed-out look comes in with the sunrise

  ui.setHealth(player.health / player.maxHealth);
  ui.setPortraits(squad.status, squad.swapReady);
  ui.setPower(powers.powerProgress);
  ui.setWaveText(rounds.note());
  renderer.render(world.scene, world.camera);

  if (!hintHidden && (village.active || move.x !== 0 || move.z !== 0)) {   // (the how-to-play hint goes away when you move, or in the village)
    hintHidden = true;
    hint.classList.add('gone');
  }
  ui.fps(now, renderer);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
