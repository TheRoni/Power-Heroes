// ui.js: everything drawn on top of the 3D picture: floating health bars, number pop-ups, the power button,
// the wave banner, and the win and knocked-out screens.
import * as THREE from '../lib/three.module.min.js';
import { CAMERA_PITCH } from './scene.js';
import { QUIET } from './audio.js';

const ENDINGS = {
  won: { title: 'Isle saved!', text: 'Sunmeadow is green again.', button: 'Play again' },
  lost: { title: 'Knocked out', text: 'Even heroes need a nap. Ready again?', button: 'Try again' },
};
const END_LOCK = 800;   // milliseconds after an end screen appears when taps are ignored, so a mashed button cannot skip it

// A small health bar that floats in the 3D world and always faces the camera.
// Move bar.group where you want it. bar.set(0.5) shows it half full.
export function createFloatingBar(width, color) {
  const tilted = new THREE.Group();
  tilted.rotation.x = -CAMERA_PITCH;   // tipped back so it faces the camera
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 0.16, 0.26),
    new THREE.MeshBasicMaterial({ color: 0x120a22, transparent: true, opacity: 0.9, depthTest: false }),
  );
  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(width, 0.16).translate(width / 2, 0, 0),   // its pivot is its left edge, so it shrinks leftwards
    new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false }),
  );
  fill.position.set(-width / 2, 0, 0.01);
  back.renderOrder = 10;   // drawn on top of the world: the dark back first, then the coloured fill
  fill.renderOrder = 11;
  tilted.add(back, fill);
  const group = new THREE.Group();
  group.add(tilted);
  return { group, set: (fraction) => { fill.scale.x = Math.max(0.0001, Math.min(1, fraction)); } };
}

// "onCast" is called when the player taps the power button or presses Space.
// "onAgain" is called when the player taps "Play again" / "Try again" on an end screen. "audio" plays the click and ready sounds.
export function createUI({ camera, onCast, onAgain, audio = QUIET }) {
  const healthFill = document.getElementById('hud-fill');
  const waveLabel = document.getElementById('hud-wave');
  const floaters = document.getElementById('floaters');
  const powerButton = document.getElementById('power-button');
  const banner = document.getElementById('banner');
  const endScreen = document.getElementById('end');
  const endButton = document.getElementById('end-button');
  const titleScreen = document.getElementById('title');
  const veil = document.getElementById('tint');
  const point = new THREE.Vector3();
  let endShownAt = 0;
  let titleStart = null;   // what to do when the title screen is tapped
  let lastVeil = '';

  // An end screen's button. The first moment after it appears is ignored (see END_LOCK).
  function again() {
    if (endScreen.hidden || performance.now() - endShownAt < END_LOCK) return;
    audio.play('click');
    onAgain();
  }

  // The title screen waits for a tap (or Space / Enter), then hides itself and starts the story.
  function startFromTitle() {
    if (titleScreen.hidden || !titleStart) return;
    const go = titleStart;
    titleStart = null;
    titleScreen.hidden = true;
    go();
  }
  titleScreen.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    startFromTitle();
  });
  function showTitle(onStart) {
    titleStart = onStart;
    titleScreen.hidden = false;
  }
  function hideTitle() {
    titleStart = null;
    titleScreen.hidden = true;
  }

  // The buttons react the moment a finger touches them. stopPropagation keeps the joystick from also seeing the touch.
  powerButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onCast();
  });
  endScreen.addEventListener('pointerdown', (event) => event.stopPropagation());   // nothing behind an end screen reacts to touches
  endButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    again();
  });
  window.addEventListener('keydown', (event) => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    if (!titleScreen.hidden) {   // on the title screen, Space and Enter mean "begin"
      event.preventDefault();
      startFromTitle();
    } else if (!endScreen.hidden) {   // on an end screen, Space and Enter mean "again"
      event.preventDefault();
      again();
    } else if (event.code === 'Space') {
      event.preventDefault();
      onCast();
    }
  });

  // Ember's health bar in the corner (0 = empty, 1 = full).
  function setHealth(fraction) {
    const f = Math.max(0, Math.min(1, fraction));
    healthFill.style.transform = `scaleX(${f})`;
    healthFill.classList.toggle('low', f < 0.3);
  }

  // Shows which hero you are: the name in the corner, and the power button's label and icon.
  function setHero({ name, powerName, powerId }) {
    document.getElementById('hud-name').textContent = name;
    document.getElementById('power-label').textContent = powerName;
    powerButton.dataset.power = powerId;
    powerButton.setAttribute('aria-label', powerName);
  }

  // The power button. "progress" goes from 0 (just used) to 1 (ready). The dark sweep shows how much is left.
  let lastLeft = '';
  let lastReady = null;
  function setPower(progress) {
    const left = (1 - Math.max(0, Math.min(1, progress))).toFixed(3);
    if (left !== lastLeft) {   // only touch the page when something actually changed
      lastLeft = left;
      powerButton.style.setProperty('--left', left);
    }
    const ready = progress >= 1;
    if (ready !== lastReady) {
      if (ready && lastReady === false) audio.play('ready');   // a little tick when the power has recharged
      lastReady = ready;
      powerButton.classList.toggle('ready', ready);
    }
  }

  // The grey veil over the picture (0 = none, 1 = solid grey).
  function setVeil(amount) {
    const text = amount.toFixed(3);
    if (text === lastVeil) return;
    lastVeil = text;
    veil.style.opacity = text;
  }

  // The small "Wave 1/3 · 4 left" note under Ember's health bar.
  let lastText = null;
  function setWaveText(text) {
    if (text === lastText) return;
    lastText = text;
    waveLabel.textContent = text;
  }

  // The big title that sweeps across the screen at the start of a wave.
  function showBanner(title, subtitle = '') {
    document.getElementById('banner-title').textContent = title;
    document.getElementById('banner-sub').textContent = subtitle;
    banner.classList.remove('show');
    void banner.offsetWidth;   // lets the page notice the change, so the animation can restart
    banner.classList.add('show');
  }

  // kind: 'won' or 'lost'.
  function showEnd(kind) {
    const ending = ENDINGS[kind];
    document.getElementById('end-title').textContent = ending.title;
    document.getElementById('end-text').textContent = ending.text;
    endButton.textContent = ending.button;
    endScreen.className = kind;
    endScreen.hidden = false;
    endShownAt = performance.now();
  }

  function hideEnd() {
    endScreen.hidden = true;
  }

  // A number that pops up over a spot in the world, then floats away.
  // kind: 'hit' (white), 'hurt' (red, when Ember is hit) or 'big' (gold, for the Flame Wave).
  function popNumber(position, text, kind = 'hit', lift = 2) {
    point.set(position.x, position.y + lift, position.z).project(camera);
    if (point.z > 1) return;   // behind the camera
    const element = document.createElement('div');
    element.className = `floater ${kind}`;
    element.textContent = text;
    element.style.left = `${(point.x * 0.5 + 0.5) * window.innerWidth}px`;
    element.style.top = `${(-point.y * 0.5 + 0.5) * window.innerHeight}px`;
    floaters.appendChild(element);
    setTimeout(() => element.remove(), 900);
  }

  return { setHealth, setPower, setHero, setWaveText, setVeil, showBanner, showEnd, hideEnd, popNumber, showTitle, hideTitle };
}
