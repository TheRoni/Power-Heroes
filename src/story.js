// story.js: tells the story. A scene is a conversation you tap through (the game waits while it plays). A scene can
// also hand the game back to the player for a lesson (a "wait") and carry on when the lesson is done.
// A bubble is a quick line that floats by while the fight carries on.
import * as THREE from '../lib/three.module.min.js';
import { SPEAKERS, SCENES, BUBBLES } from './story-data.js';
import { QUIET } from './audio.js';

const DEFAULT_VARS = { name: 'Sol' };   // what {name} means if nobody says (the game says what the player chose)

const TYPING_SPEED = 48;   // letters per second
const BUBBLE_TIME = 3.2;   // how long a bubble stays (seconds)
const TAP_LOCK = 0.25;     // when a scene starts, taps are ignored for this long, so a hurried tap cannot skip the first line
const MOVEMENT_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const BLIP_EVERY = 4;       // a little typing sound for every 4th letter

// "anchors" say where each speaker's bubble floats: { pip: { object, lift }, marlo: { object, lift } }.
// "root" is the page to draw on (tests pass a spare one). "touch" is true on a phone, so lines can mention the thumb
// controls. onStart() runs when a conversation begins. onSpeak() when Pip speaks. onWait(kind) when a lesson begins.
// onCue(name) when a line that names a cue appears. "audio" plays the typing blips; "music" plays the songs a scene names.
// "vars()" gives the words that can be put into lines, such as { power: 12 } for "Power {power}".
export function createStory({ camera, anchors, root = document, touch, onStart, onSpeak, onWait, onCue, audio = QUIET, music = QUIET, vars = () => ({}) }) {
  const byId = (id) => root.getElementById(id);
  const overlay = byId('dialogue');
  const nameBox = byId('dialogue-name');
  const textBox = byId('dialogue-text');
  const nextMark = byId('dialogue-next');
  const bubble = byId('bubble');
  const lessonBox = byId('lesson');
  const phone = touch === undefined ? window.matchMedia('(pointer: coarse)').matches : touch;
  const point = new THREE.Vector3();

  let lines = [];        // the steps of the scene being told
  let index = 0;         // which step we are on
  let full = '';         // the whole line being typed
  let typed = 0;         // how many letters should be showing
  let shown = 0;         // how many letters are on the page right now
  let lock = 0;          // time left in the tap lock
  let onDone = null;     // what to do when the scene ends
  let active = false;    // the conversation box is showing (the game waits)
  let waiting = null;    // the kind of lesson the scene is waiting for, if any (the game runs)
  let bubbleLeft = 0;    // time left before the bubble fades
  let bubbleAnchor = null;
  let lastBubble = '';
  let blipPitch = 1;     // the speaker's typing sound

  const fill = (text) => text.replace(/\{(\w+)\}/g, (match, name) => String(vars()[name] ?? DEFAULT_VARS[name] ?? match));   // "Power {power}" becomes "Power 12"
  const resolve = (text) => fill(typeof text === 'string' ? text : phone ? text.touch : text.keys);

  function showLine([who, text, cue]) {
    const speaker = SPEAKERS[who];
    full = resolve(text);
    typed = 0;
    shown = 0;
    nameBox.textContent = fill(speaker.name);
    blipPitch = speaker.pitch || 1;
    overlay.style.setProperty('--speaker', speaker.color);
    textBox.textContent = '';
    nextMark.classList.remove('on');
    if (who === 'pip' && onSpeak) onSpeak();
    if (cue && onCue) onCue(cue);
  }

  // A lesson: hide the conversation, show a short reminder, and let the player play until the lesson is done.
  function startWait(step) {
    active = false;
    overlay.hidden = true;
    waiting = step.wait;
    lessonBox.textContent = step.hint ? resolve(step.hint) : '';   // some waits (a character running in) need no reminder
    lessonBox.hidden = !step.hint;
    if (onWait) onWait(step.wait);
  }

  function showStep() {
    const step = lines[index];
    if (Array.isArray(step)) showLine(step);
    else if (step.music) { music.play(step.music, step.fade || 2); goOn(); }   // { music: 'marlo' } changes the song and carries on
    else startWait(step);
  }

  function finish() {
    active = false;
    waiting = null;
    overlay.hidden = true;
    lessonBox.hidden = true;
    const callback = onDone;
    onDone = null;
    if (callback) callback();
  }

  function goOn() {
    index++;
    if (index < lines.length) showStep();
    else finish();
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
    goOn();
  }

  // Starts a conversation. "onEnd" is called when the last step is done.
  function scene(id, onEnd) {
    lines = SCENES[id];
    index = 0;
    active = true;
    waiting = null;
    lock = TAP_LOCK;
    onDone = onEnd || null;
    bubble.classList.remove('show');
    bubbleLeft = 0;
    overlay.hidden = false;
    if (onStart) onStart();
    showStep();
  }

  // The lesson is done: the conversation comes back and carries on.
  function resume() {
    if (!waiting) return;
    waiting = null;
    lessonBox.hidden = true;
    active = true;
    lock = TAP_LOCK;
    overlay.hidden = false;
    if (onStart) onStart();
    goOn();
  }

  // Ends the conversation (or lesson) right away. Used by the skip button and by the automatic tests.
  function skip() {
    if (active || waiting) finish();
  }

  // A quick line. A plain line is Pip's; { who, text } is someone else's. Refused during a conversation or lesson.
  // Never the same line twice in a row.
  function say(key) {
    const options = BUBBLES[key];
    if (active || waiting || !options || options.length === 0) return false;
    let choice;
    let text;
    do {
      choice = options[Math.floor(Math.random() * options.length)];
      text = resolve(choice.who ? choice.text : choice);
      if (choice.who) text = `${fill(SPEAKERS[choice.who].name)}: ${text}`;
    } while (text === lastBubble && options.length > 1);
    lastBubble = text;
    bubble.textContent = text;
    bubble.classList.add('show');
    bubbleLeft = BUBBLE_TIME;
    bubbleAnchor = anchors[choice.who || 'pip'] || anchors.pip;
    if (!choice.who && onSpeak) onSpeak();
    return true;
  }

  // A line from somebody who is not Pip or Marlo (a person of the village): "text" floats over "object" (anything with a position).
  function sayAt(text, object, lift = 2.7) {
    if (active || waiting) return false;
    lastBubble = text;
    bubble.textContent = text;
    bubble.classList.add('show');
    bubbleLeft = BUBBLE_TIME + 1;
    bubbleAnchor = { object, lift };
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
          if (Math.floor(count / BLIP_EVERY) !== Math.floor(shown / BLIP_EVERY)) audio.play('blip', { pitch: blipPitch * (0.92 + Math.random() * 0.16) });
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
      } else {   // keep the bubble just above whoever is speaking, and on the screen
        point.copy(bubbleAnchor.object.position);
        point.y += bubbleAnchor.lift;
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

  // Keys are caught before anything else sees them, so Space cannot also fire the superpower, and the hero cannot walk off.
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

  return {
    scene, say, sayAt, skip, advance, resume, update,
    get active() { return active; },
    get waiting() { return waiting; },
    get inScene() { return active || waiting !== null; },
  };
}
