// ui.js: everything drawn on top of the 3D picture: floating health bars, number pop-ups, the power button,
// the wave banner, and the squad portraits. (The full-screen menus are in menus.js.)
import * as THREE from '../lib/three.module.min.js';
import { CAMERA_PITCH } from './scene.js';
import { QUIET } from './audio.js';
import { TYPE_COLORS } from './types.js';
import { shortNumber } from './power.js';
import { createMenus } from './menus.js';


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
// "onAgain" is called when the player taps "Play again" / "Try again" on an end screen. "onSwap(index)" when a hero portrait
// is tapped or 1, 2 or 3 is pressed. "audio" plays the click and ready sounds.
export function createUI({ camera, onCast, onAgain, onSwap = () => {}, audio = QUIET }) {
  const healthFill = document.getElementById('hud-fill');
  const waveLabel = document.getElementById('hud-wave');
  const floaters = document.getElementById('floaters');
  const powerButton = document.getElementById('power-button');
  const banner = document.getElementById('banner');
  const portraitBox = document.getElementById('squad');
  const veil = document.getElementById('tint');
  const point = new THREE.Vector3();
  const menus = createMenus({ audio, onAgain });   // the title, squad and end screens
  let lastVeil = '';
  let portraits = [];      // the squad's round buttons
  let lastPortraits = '';

  // The buttons react the moment a finger touches them. stopPropagation keeps the joystick from also seeing the touch.
  powerButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onCast();
  });
  window.addEventListener('keydown', (event) => {
    if (/^Digit[1-3]$/.test(event.code) && !event.repeat) { onSwap(Number(event.code.slice(5)) - 1); return; }
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    if (menus.handleKey(event)) return;   // a menu that is showing takes Space and Enter
    if (event.code === 'Space') {
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
  function setHero({ name, type, power, powerName, powerId }) {
    document.getElementById('hud-name').textContent = name;
    setHeroPower(power);
    if (TYPE_COLORS[type]) document.getElementById('hud-hero').style.setProperty('--c', TYPE_COLORS[type].css);   // a dot of the hero's type colour
    document.getElementById('power-label').textContent = powerName;
    powerButton.dataset.power = powerId;
    powerButton.setAttribute('aria-label', powerName);
  }

  // The hero's Power number in the corner ("Power 12", or 12.4K when large).
  function setHeroPower(power) {
    document.getElementById('hud-power').textContent = power === undefined ? '' : `Power ${shortNumber(power)}`;
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

  // One round portrait for each hero in the squad: heroes is [{ name, type }]. A tap swaps to that hero.
  function setSquad(heroes) {
    portraitBox.textContent = '';
    portraits = heroes.map((hero, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'portrait';
      button.style.setProperty('--c', TYPE_COLORS[hero.type].css);
      button.setAttribute('aria-label', `Swap to ${hero.name} (${i + 1})`);
      button.innerHTML = `<span class="portrait-letter">${hero.name[0]}</span><span class="portrait-key">${i + 1}</span>`;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        onSwap(i);
      });
      portraitBox.appendChild(button);
      return button;
    });
    portraitBox.hidden = heroes.length < 2;
    lastPortraits = '';
  }

  // Every frame: health rings, who is in play, who is out, whose power is ready, and whether a swap is allowed yet.
  function setPortraits(status, swapReady) {
    const signature = status.map((s) => `${s.active ? 'A' : ''}${s.down ? 'D' : ''}${s.ready ? 'R' : ''}${s.health.toFixed(2)}`).join() + swapReady;
    if (signature === lastPortraits || status.length !== portraits.length) return;
    lastPortraits = signature;
    status.forEach((s, i) => {
      portraits[i].style.setProperty('--hp', s.health.toFixed(3));
      portraits[i].classList.toggle('active', s.active);
      portraits[i].classList.toggle('down', s.down);
      portraits[i].classList.toggle('ready', s.ready);
      portraits[i].classList.toggle('cool', !swapReady);
    });
  }

  // The frame-rate box (debug mode only): showFps() once, then fps(now, renderer) every frame.
  let fpsBox = null, fpsFrames = 0, fpsStart = 0;
  function showFps() {
    fpsBox = document.createElement('div');
    fpsBox.id = 'fps';
    document.body.appendChild(fpsBox);
  }
  function fps(now, renderer) {
    if (!fpsBox) return;
    fpsFrames++;
    if (now / 1000 - fpsStart >= 0.5) {
      fpsBox.textContent = `${Math.round(fpsFrames / (now / 1000 - fpsStart))} fps · ${renderer.info.render.calls} draws`;
      fpsFrames = 0;
      fpsStart = now / 1000;
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

  return { setHealth, setPower, setHero, setWaveText, setVeil, showBanner, popNumber, setSquad, setPortraits, showFps, fps, setHeroPower, ...menus.api };
}
