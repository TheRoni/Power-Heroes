// story.js: tells the story. A scene is a conversation you tap through (the game waits while it plays).
// A bubble is a quick line from Pip that floats by while the fight carries on.
import * as THREE from '../lib/three.module.min.js';
import { SPEAKERS, SCENES, BUBBLES } from './story-data.js';

const TYPING_SPEED = 48;   // letters per second
const BUBBLE_TIME = 3.2;   // how long a bubble stays (seconds)
const TAP_LOCK = 0.25;     // when a scene starts, taps are ignored for this long, so a hurried tap cannot skip the first line
const MOVEMENT_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// "anchor" is the 3D object Pip's bubble follows. "root" is the page to draw on (tests pass a spare one).
// "touch" is true on a phone, so lines can mention the thumb controls. onStart() runs when a scene begins.
// onSpeak() runs when Pip says something.
export function createStory({ camera, anchor, root = document, touch, onStart, onSpeak }) {
  const byId = (id) => root.getElementById(id);
  const overlay = byId('dialogue');
  const nameBox = byId('dialogue-name');
  const textBox = byId('dialogue-text');
  const nextMark = byId('dialogue-next');
  const bubble = byId('bubble');
  const phone = touch === undefined ? window.matchMedia('(pointer: coarse)').matches : touch;
  const point = new THREE.Vector3();

  let lines = [];       // the lines of the scene being told
  let index = 0;        // which line we are on
  let full = '';        // the whole line being typed
  let typed = 0;        // how many letters should be showing
  let shown = 0;        // how many letters are on the page right now
  let lock = 0;         // time left in the tap lock
  let onDone = null;    // what to do when the scene ends
  let active = false;
  let bubbleLeft = 0;   // time left before the bubble fades
  let lastBubble = '';

  const resolve = (text) => (typeof text === 'string' ? text : phone ? text.touch : text.keys);

  function showLine() {
    const [who, text] = lines[index];
    const speaker = SPEAKERS[who];
    full = resolve(text);
    typed = 0;
    shown = 0;
    nameBox.textContent = speaker.name;
    overlay.style.setProperty('--speaker', speaker.color);
    textBox.textContent = '';
    nextMark.classList.remove('on');
    if (who === 'pip' && onSpeak) onSpeak();
  }

  function finish() {
    active = false;
    overlay.hidden = true;
    const callback = onDone;
    onDone = null;
    if (callback) callback();
  }

  // A tap, click, Space or Enter. The first one finishes typing the line. The next one goes on.
  function advance() {
    if (!active || lock > 0) return;
    if (typed < full.length) {
      typed = full.length;
      shown = full.length;
      textBox.textContent = full;
      nextMark.classList.add('on');
      return;
    }
    index++;
    if (index < lines.length) showLine();
    else finish();
  }

  // Starts a conversation. "onEnd" is called when the last line has been read.
  function scene(id, onEnd) {
    lines = SCENES[id];
    index = 0;
    active = true;
    lock = TAP_LOCK;
    onDone = onEnd || null;
    bubble.classList.remove('show');
    bubbleLeft = 0;
    overlay.hidden = false;
    if (onStart) onStart();
    showLine();
  }

  // Ends the conversation right away (used by the automatic tests).
  function skip() {
    if (active) finish();
  }

  // A quick line from Pip. Refused while a conversation is on. Never the same line twice in a row.
  function say(key) {
    const options = BUBBLES[key];
    if (active || !options || options.length === 0) return false;
    let text;
    do text = resolve(options[Math.floor(Math.random() * options.length)]);
    while (text === lastBubble && options.length > 1);
    lastBubble = text;
    bubble.textContent = text;
    bubble.classList.add('show');
    bubbleLeft = BUBBLE_TIME;
    if (onSpeak) onSpeak();
    return true;
  }

  // Called every frame with the real time that passed (it keeps going even while the game waits).
  function update(dt) {
    if (active) {
      lock = Math.max(0, lock - dt);
      if (typed < full.length) {
        typed = Math.min(full.length, typed + dt * TYPING_SPEED);
        const count = Math.floor(typed);
        if (count !== shown) {
          shown = count;
          textBox.textContent = full.slice(0, count);
        }
        if (typed >= full.length) nextMark.classList.add('on');
      }
    }
    if (bubbleLeft > 0) {
      bubbleLeft -= dt;
      if (bubbleLeft <= 0) {
        bubble.classList.remove('show');
      } else {   // keep the bubble just above Pip, and on the screen
        point.copy(anchor.position);
        point.y += 0.7;
        point.project(camera);
        const x = Math.max(130, Math.min(window.innerWidth - 130, (point.x * 0.5 + 0.5) * window.innerWidth));
        const y = Math.max(60, (-point.y * 0.5 + 0.5) * window.innerHeight);
        bubble.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      }
    }
  }

  overlay.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();   // nothing behind the conversation (joystick, buttons) sees the touch
    advance();
  });

  // Keys are caught before anything else sees them, so Space cannot also fire the Flame Wave, and Ember cannot walk off.
  window.addEventListener('keydown', (event) => {
    if (!active) return;
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) advance();
    } else if (MOVEMENT_KEYS.includes(event.code)) {
      event.stopImmediatePropagation();
    }
  }, true);

  return { scene, say, skip, advance, update, get active() { return active; } };
}
