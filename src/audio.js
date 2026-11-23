// audio.js: the sound engine. Every sound is made in code with the Web Audio API (no audio files).
// Browsers only allow sound after a tap or a key press, so nothing plays until then. The Mute button (or the M key)
// silences everything and remembers the choice. Other files call audio.play('dart'); music.js plays on audio.music.

const MUTE_KEY = 'powerheroes.muted';
const LOUDNESS = 0.9;   // overall volume (the device's own volume knob comes on top)
const MAX_VOICES = 28;  // never more than this many effect sounds at once, so a busy fight cannot turn into noise
const GAPS = { dart: 0.05, tick: 0.04, bell: 0.07, pop: 0.05, blip: 0.03, click: 0.05, bump: 0.15 };   // least seconds between two of the same sound

// A "quiet" stand-in for code that is tested without sound.
export const QUIET = { play: () => false };

// The recipes. k.tone() plays a pitch (sliding from "from" to "to" Hz), k.noise() plays a burst of filtered hiss.
// "p" makes a sound higher (above 1) or lower (below 1), so repeats do not sound identical.
const SOUNDS = {
  dart: (k, p) => { k.tone({ from: 1500 * p, to: 900 * p, time: 0.08, volume: 0.035 }); k.tone({ type: 'triangle', from: 2250 * p, to: 1350 * p, time: 0.06, volume: 0.012 }); },
  tick: (k, p) => { k.noise({ filter: 'bandpass', from: 1800 * p, q: 2, time: 0.04, volume: 0.05 }); k.tone({ type: 'square', from: 300 * p, to: 180 * p, time: 0.05, volume: 0.02 }); },
  bell: (k, p) => { k.tone({ from: 880 * p, time: 0.5, volume: 0.05, attack: 0.002 }); k.tone({ from: 1320 * p, time: 0.35, volume: 0.025, attack: 0.002 }); k.tone({ from: 2217 * p, time: 0.2, volume: 0.012 }); },
  starburst: (k) => { k.tone({ from: 220, to: 880, time: 0.35, volume: 0.1, attack: 0.02 }); k.noise({ from: 400, to: 3000, time: 0.4, volume: 0.06, attack: 0.03 }); [1760, 2217, 2637].forEach((f, i) => k.tone({ from: f, time: 0.3, volume: 0.03, delay: 0.05 + i * 0.07 })); },
  flamewave: (k) => { k.noise({ from: 1400, to: 250, time: 0.5, volume: 0.12, attack: 0.03 }); k.tone({ type: 'sawtooth', from: 110, to: 70, time: 0.4, volume: 0.04 }); },
  pop: (k, p) => { k.tone({ from: 520 * p, to: 160 * p, time: 0.14, volume: 0.09 }); k.tone({ from: 1040 * p, to: 400 * p, time: 0.08, volume: 0.04, delay: 0.03 }); },
  bump: (k) => { k.tone({ from: 140, to: 55, time: 0.22, volume: 0.18 }); k.noise({ from: 700, to: 300, time: 0.1, volume: 0.08 }); },
  down: (k) => { k.tone({ type: 'triangle', from: 330, to: 110, time: 0.7, volume: 0.1, attack: 0.02 }); },
  blip: (k, p) => { k.tone({ type: 'triangle', from: 520 * p, to: 500 * p, time: 0.045, volume: 0.03, attack: 0.003 }); },
  click: (k) => { k.noise({ filter: 'highpass', from: 3000, time: 0.015, volume: 0.04 }); k.tone({ type: 'triangle', from: 900, to: 700, time: 0.03, volume: 0.04 }); },
  chime: (k) => { [1175, 1480, 1760].forEach((f, i) => { k.tone({ from: f, time: 0.55, volume: 0.07, delay: i * 0.09, attack: 0.003 }); k.tone({ from: f * 2, time: 0.25, volume: 0.015, delay: i * 0.09 }); }); },
  spawn: (k) => { k.tone({ from: 110, to: 220, time: 0.12, volume: 0.06 }); k.noise({ from: 300, time: 0.08, volume: 0.03 }); },
  wave: (k) => { k.tone({ type: 'triangle', from: 294, time: 0.2, volume: 0.07, attack: 0.03 }); k.tone({ type: 'triangle', from: 440, time: 0.4, volume: 0.07, attack: 0.03, delay: 0.18 }); k.tone({ from: 147, time: 0.55, volume: 0.05, attack: 0.03 }); },
  cleared: (k) => { [880, 988, 1175, 1319].forEach((f, i) => k.tone({ type: 'triangle', from: f, time: 0.35, volume: 0.06, delay: i * 0.07, attack: 0.003 })); },
  win: (k) => { [587, 740, 880, 1175].forEach((f, i) => { k.tone({ from: f, time: 0.9, volume: 0.07, delay: i * 0.12, attack: 0.004 }); k.tone({ from: f * 2, time: 0.4, volume: 0.015, delay: i * 0.12 }); }); },
  lose: (k) => { k.tone({ type: 'triangle', from: 440, time: 0.5, volume: 0.07, attack: 0.02 }); k.tone({ type: 'triangle', from: 370, time: 0.8, volume: 0.07, attack: 0.02, delay: 0.3 }); },
  whoosh: (k) => { k.noise({ filter: 'bandpass', from: 3000, to: 400, q: 1.5, time: 2, volume: 0.06, attack: 0.3 }); k.tone({ from: 1800, to: 300, time: 2, volume: 0.03, attack: 0.3 }); },
  boom: (k) => { k.tone({ from: 90, to: 35, time: 0.9, volume: 0.25, attack: 0.005 }); k.noise({ from: 900, to: 100, time: 0.8, volume: 0.2, attack: 0.005 }); [2093, 2637, 3136, 3520].forEach((f, i) => k.tone({ from: f, time: 0.7, volume: 0.03, delay: 0.1 + i * 0.12 })); },
  climb: (k, p) => { k.tone({ from: 587 * p, time: 0.4, volume: 0.07, attack: 0.003 }); k.tone({ from: 1174 * p, time: 0.2, volume: 0.015 }); },
  swoosh: (k) => { k.noise({ filter: 'bandpass', from: 500, to: 2500, q: 2, time: 0.3, volume: 0.07, attack: 0.05 }); },
  sunrise: (k) => { [587, 880, 1175, 1480].forEach((f, i) => k.tone({ from: f, time: 1.8, volume: 0.04, delay: i * 0.25, attack: 0.15 })); },
  ready: (k) => { k.tone({ from: 1760, time: 0.1, volume: 0.03, attack: 0.003 }); },
};

export const SOUND_NAMES = Object.keys(SOUNDS);

const noises = new WeakMap();   // one buffer of hiss per audio context
export function noiseFor(ctx) {
  if (!noises.has(ctx)) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 2), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noises.set(ctx, buffer);
  }
  return noises.get(ctx);
}

// Schedules one sound on "out", starting at time "start". Returns how long it lasts. (The automatic tests use this on
// an offline context, to measure every sound.)
export function buildSound(ctx, out, name, start = 0, pitch = 1, level = 1) {
  const recipe = SOUNDS[name];
  if (!recipe) return 0;
  let end = start;
  const shape = (gain, at, volume, attack, time) => {
    gain.gain.value = 0.0001;   // silent until its moment (otherwise the very first sample can click)
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.linearRampToValueAtTime(volume * level, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + time);
    end = Math.max(end, at + time);
  };
  const kit = {
    tone({ type = 'sine', from, to = from, time = 0.1, volume = 0.1, attack = 0.004, delay = 0 }) {
      const at = start + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, at);
      if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + time);
      shape(gain, at, volume, attack, time);
      osc.connect(gain);
      gain.connect(out);
      osc.start(at);
      osc.stop(at + time + 0.02);
    },
    noise({ filter = 'lowpass', from = 2000, to = from, q = 1, time = 0.1, volume = 0.1, attack = 0.004, delay = 0 }) {
      const at = start + delay;
      const source = ctx.createBufferSource();
      const biquad = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = noiseFor(ctx);
      source.loop = true;
      biquad.type = filter;
      biquad.Q.value = q;
      biquad.frequency.setValueAtTime(from, at);
      if (to !== from) biquad.frequency.exponentialRampToValueAtTime(to, at + time);
      shape(gain, at, volume, attack, time);
      source.connect(biquad);
      biquad.connect(gain);
      gain.connect(out);
      source.start(at, Math.random());
      source.stop(at + time + 0.02);
    },
  };
  recipe(kit, pitch);
  return end - start;
}

export function createAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const counts = {};        // how many times each sound was asked for (the automatic tests look at this)
  const lastPlayed = {};
  let voices = [];          // when each playing effect ends
  let ctx = null;
  let master = null;        // everything goes through this (Mute turns it down)
  let sfx = null;           // effects bus
  let music = null;         // music bus (music.js plays on it)
  let muted = false;
  let button = null;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (error) { /* storage may be unavailable: that is fine */ }

  function build() {
    ctx = new AudioContextClass();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : LOUDNESS;
    const squash = ctx.createDynamicsCompressor();   // keeps a busy moment from clipping
    squash.threshold.value = -14;
    squash.knee.value = 12;
    squash.ratio.value = 6;
    const soften = ctx.createBiquadFilter();         // takes the harsh top off
    soften.type = 'lowpass';
    soften.frequency.value = 9000;
    sfx = ctx.createGain();
    sfx.gain.value = 1.5;     // effects sit on top of the music
    music = ctx.createGain();
    music.gain.value = 0.8;
    sfx.connect(master);
    music.connect(master);
    master.connect(squash);
    squash.connect(soften);
    soften.connect(ctx.destination);
    ctx.addEventListener('statechange', () => { if (ctx.state === 'running') forget(); });
  }

  // The first tap or key press: make the sound engine and wake it up. Tried again on every press until it is running.
  const UNLOCK = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
  function unlock() {
    if (!AudioContextClass) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;   // too early: the browser does not count this touch yet (it will, at the end of the tap)
    if (!ctx) build();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }
  function forget() { for (const name of UNLOCK) window.removeEventListener(name, unlock, true); }
  if (AudioContextClass) for (const name of UNLOCK) window.addEventListener(name, unlock, true);

  // Quiet while the page is hidden (another tab or app); back when it returns.
  document.addEventListener('visibilitychange', () => {
    if (!ctx || ctx.state === 'closed') return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });

  function play(name, { pitch = 1, volume = 1, delay = 0 } = {}) {
    counts[name] = (counts[name] || 0) + 1;
    if (!ctx || ctx.state !== 'running' || muted || !SOUNDS[name]) return false;
    const now = ctx.currentTime;
    if (now - (lastPlayed[name] ?? -1) < (GAPS[name] || 0)) return false;
    voices = voices.filter((end) => end > now);
    if (voices.length >= MAX_VOICES) return false;
    lastPlayed[name] = now;
    voices.push(now + delay + buildSound(ctx, sfx, name, now + delay, pitch, volume));
    return true;
  }

  function showMute() {
    if (!button) return;
    button.classList.toggle('off', muted);
    button.setAttribute('aria-pressed', String(muted));
    button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }

  function setMuted(on) {
    muted = on;
    try { localStorage.setItem(MUTE_KEY, on ? '1' : '0'); } catch (error) { /* fine */ }
    if (master) master.gain.setTargetAtTime(on ? 0 : LOUDNESS, ctx.currentTime, 0.02);
    showMute();
    if (!on) play('click');   // so you can hear that it is back
  }

  // The Mute button: it reacts the moment a finger touches it, and the touch never reaches the joystick.
  function bindButton(element) {
    button = element;
    showMute();
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setMuted(!muted);
    });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyM' && !event.repeat) setMuted(!muted);
    });
  }

  return {
    play, setMuted, bindButton, counts,
    get muted() { return muted; },
    get context() { return ctx; },
    get master() { return master; },
    get sfxBus() { return sfx; },
    get musicBus() { return music; },
    get state() { return !AudioContextClass ? 'unsupported' : ctx ? ctx.state : 'idle'; },   // idle (no tap yet), running, suspended, ...
  };
}
