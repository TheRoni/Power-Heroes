// music.js: the flute and the other little instruments, and the song player. Everything is made in code (no audio files).
// The songs are note lists in music-data.js. music.play('battle') fades the song that is playing out and the new one in.
// The player schedules the notes a little ahead of time, so the music stays steady even when the game is busy.
import { SONGS } from './music-data.js';
import { noiseFor } from './audio.js';

const LOOKAHEAD = 0.8;   // seconds of music scheduled ahead
const TICK = 150;        // milliseconds between scheduling rounds
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// An envelope: rise to "peak", hold until "until", then fade away over "release".
function envelope(param, t, peak, attack, until, release) {
  const hold = Math.max(until, t + attack + 0.01);
  param.value = 0.0001;   // silent until its moment (otherwise the very first sample can click)
  param.setValueAtTime(0.0001, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.setValueAtTime(peak, hold);
  param.exponentialRampToValueAtTime(0.0001, hold + release);
  return hold + release;   // when the sound is over
}

// A gain that starts silent (the notes shape it themselves).
const quiet = (ctx) => { const gain = ctx.createGain(); gain.gain.value = 0.0001; return gain; };

// A tone. Returns the oscillator (connect it to where the sound should go).
function tone(ctx, type, from, to, t, stop) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + 0.15);
  osc.start(t);
  osc.stop(stop);
  return osc;
}

// A burst of filtered hiss.
function hiss(ctx, filter, freq, q, t, stop) {
  const source = ctx.createBufferSource();
  const biquad = ctx.createBiquadFilter();
  source.buffer = noiseFor(ctx);
  source.loop = true;
  biquad.type = filter;
  biquad.frequency.value = freq;
  biquad.Q.value = q;
  source.connect(biquad);
  source.start(t, Math.random());
  source.stop(stop);
  return biquad;
}

// The voices. Each plays one note: (ctx, t, n, out, echo) where t is the start time and n is { hz, secs, vel }.
// "out" is where the sound goes; "echo" is the shared echo (the flute and the chimes send some of themselves to it).
const VOICES = {
  // The flute: a soft tone with a quiet overtone, a puff of breath at the start, a little scoop up into the note,
  // and a gentle vibrato that arrives after a moment.
  flute(ctx, t, n, out, echo) {
    const release = Math.min(0.3, 0.1 + n.secs * 0.15);
    const body = ctx.createGain();
    const end = envelope(body.gain, t, 0.06 * n.vel, 0.07, t + n.secs, release);
    const depth = ctx.createGain();
    if (n.secs > 0.45) {   // vibrato: a slow wobble in the pitch (in cents) that grows in
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(7, t + Math.min(0.5, n.secs * 0.6));
      lfo.connect(depth);
      lfo.start(t);
      lfo.stop(end + 0.05);
    }
    for (const [ratio, level] of [[1, 1], [2, 0.2], [3, 0.03 + 0.05 * n.vel]]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(n.hz * ratio * 0.985, t);
      osc.frequency.exponentialRampToValueAtTime(n.hz * ratio, t + 0.06);
      gain.gain.value = level;
      depth.connect(osc.detune);
      osc.connect(gain);
      gain.connect(body);
      osc.start(t);
      osc.stop(end + 0.05);
    }
    const air = hiss(ctx, 'bandpass', Math.min(5000, Math.max(1800, n.hz * 3)), 0.9, t, end + 0.05);
    const puff = quiet(ctx);
    const steady = 0.008 * n.vel + 0.0002;
    puff.gain.setValueAtTime(0.0001, t);
    puff.gain.linearRampToValueAtTime(0.06 * n.vel, t + 0.015);
    puff.gain.exponentialRampToValueAtTime(steady, t + 0.14);
    puff.gain.setValueAtTime(steady, Math.max(t + n.secs, t + 0.15));
    puff.gain.exponentialRampToValueAtTime(0.0001, Math.max(t + n.secs, t + 0.15) + release);
    air.connect(puff);
    puff.connect(body);
    body.connect(out);
    const send = ctx.createGain();
    send.gain.value = 0.55;
    body.connect(send);
    send.connect(echo);
  },

  // A music box: a bell-like ping that rings out.
  chime(ctx, t, n, out, echo) {
    const gain = quiet(ctx);
    const length = Math.max(0.9, n.secs * 1.4);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.06 * n.vel, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    for (const [ratio, level] of [[1, 1], [2.76, 0.18], [5.4, 0.04]]) {
      const part = ctx.createGain();
      part.gain.value = level;
      tone(ctx, 'sine', n.hz * ratio, n.hz * ratio, t, t + length + 0.05).connect(part);
      part.connect(gain);
    }
    gain.connect(out);
    const send = ctx.createGain();
    send.gain.value = 0.45;
    gain.connect(send);
    send.connect(echo);
  },

  // A soft plucked string.
  pluck(ctx, t, n, out) {
    const length = Math.max(0.5, n.secs);
    const filter = ctx.createBiquadFilter();
    const gain = quiet(ctx);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.09 * n.vel, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    tone(ctx, 'triangle', n.hz, n.hz, t, t + length + 0.05).connect(filter);
    filter.connect(gain);
    gain.connect(out);
  },

  // A round, soft bass.
  bass(ctx, t, n, out) {
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const end = envelope(gain.gain, t, 0.04 * n.vel, 0.015, t + n.secs * 0.9, 0.1);
    const half = ctx.createGain();   // the sine and the triangle share the volume
    half.gain.value = 0.5;
    tone(ctx, 'sine', n.hz, n.hz, t, end + 0.05).connect(half);
    tone(ctx, 'triangle', n.hz, n.hz, t, end + 0.05).connect(half);
    half.connect(filter);
    filter.connect(gain);
    gain.connect(out);
  },

  // A slow, warm drone.
  pad(ctx, t, n, out) {
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    const end = envelope(gain.gain, t, 0.017 * n.vel, 1, t + n.secs, 1.4);
    tone(ctx, 'triangle', n.hz, n.hz, t, end + 0.05).connect(filter);
    tone(ctx, 'triangle', n.hz * 1.005, n.hz * 1.005, t, end + 0.05).connect(filter);
    filter.connect(gain);
    gain.connect(out);
  },

  kick(ctx, t, n, out) {
    const gain = quiet(ctx);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.14 * n.vel, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    const osc = tone(ctx, 'sine', 130, 45, t, t + 0.25);
    osc.connect(gain);
    gain.connect(out);
  },

  snare(ctx, t, n, out) {
    const gain = quiet(ctx);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.05 * n.vel, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    hiss(ctx, 'bandpass', 1700, 0.8, t, t + 0.13).connect(gain);
    gain.connect(out);
  },

  hat(ctx, t, n, out) {
    const gain = quiet(ctx);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.02 * n.vel, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    hiss(ctx, 'highpass', 6500, 0.7, t, t + 0.06).connect(gain);
    gain.connect(out);
  },
};

// A shared echo: a soft repeat that makes the flute sound like it is in a big quiet room. Returns the node to send to.
export function makeEcho(ctx, out) {
  const input = ctx.createGain();
  const delay = ctx.createDelay(1);
  const feedback = ctx.createGain();
  const soften = ctx.createBiquadFilter();
  const wet = ctx.createGain();
  delay.delayTime.value = 0.33;
  feedback.gain.value = 0.34;
  soften.type = 'lowpass';
  soften.frequency.value = 2300;
  wet.gain.value = 0.3;
  input.connect(delay);
  delay.connect(soften);
  soften.connect(feedback);
  feedback.connect(delay);
  soften.connect(wet);
  wet.connect(out);
  return input;
}

// Schedules the notes of one song that start between beats "fromBeat" and "toBeat" of the song (counting loops:
// beat 20 of an 8-beat song is the 5th beat of its third lap). "start" is the time (in seconds) when beat 0 plays.
// "only" limits it to some voices (the automatic tests use that). Returns nothing; the notes are on their way.
export function scheduleSong(ctx, out, echo, name, start, fromBeat, toBeat, only = null) {
  const song = SONGS[name];
  const spb = 60 / song.tempo;
  for (let lap = Math.floor(fromBeat / song.length); lap * song.length < toBeat; lap++) {
    for (const e of song.events) {
      const beat = lap * song.length + e.beat;
      if (beat < fromBeat || beat >= toBeat) continue;
      if (only && !only.includes(e.voice)) continue;
      for (const note of e.notes) {
        VOICES[e.voice](ctx, start + beat * spb, { hz: hz(note), secs: e.beats * spb * 0.97, vel: e.gain * song.level }, out, echo);
      }
    }
  }
}

export function createMusic(audio) {
  let wanted = null;    // the song we should be playing (it starts as soon as the sound engine is running)
  let playing = null;   // the song that is playing now: { name, gain, start, done } (done = beats already scheduled)
  let echo = null;      // built once, when the sound engine is running
  let wired = null;     // the audio context the echo belongs to

  function fadeOut(song, seconds) {
    const t = audio.context.currentTime;
    song.gain.gain.cancelScheduledValues(t);
    song.gain.gain.setValueAtTime(song.level, t);
    song.gain.gain.linearRampToValueAtTime(0.0001, t + seconds);
    setTimeout(() => song.gain.disconnect(), (seconds + 2) * 1000);   // the notes already on their way die away first
  }

  // Called every moment: starts the wanted song (when the engine runs) and schedules notes a little ahead.
  function tick() {
    const ctx = audio.context;
    if (!ctx || audio.state !== 'running') return;
    if (wired !== ctx) { echo = makeEcho(ctx, audio.musicBus); wired = ctx; }
    if (wanted && (!playing || playing.name !== wanted.name)) {
      if (playing) fadeOut(playing, wanted.fade);
      const gain = ctx.createGain();
      const level = SONGS[wanted.name].level;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + wanted.fade);
      gain.connect(audio.musicBus);
      playing = { name: wanted.name, gain, level: 1, start: ctx.currentTime + 0.15, done: 0 };
    } else if (!wanted && playing) {
      fadeOut(playing, 1.5);
      playing = null;
    }
    if (!playing) return;
    const song = SONGS[playing.name];
    const spb = 60 / song.tempo;
    const until = (ctx.currentTime + LOOKAHEAD - playing.start) / spb;   // schedule up to this beat
    if (until > playing.done) {
      if (!audio.muted) scheduleSong(ctx, playing.gain, echo, playing.name, playing.start, playing.done, until);
      playing.done = until;
    }
  }
  setInterval(tick, TICK);

  return {
    tick,
    // Starts a song (a no-op if it is already the one playing). "fade" is the cross-fade in seconds.
    play(name, fade = 1.2) {
      if (!SONGS[name]) return;
      if (wanted && wanted.name === name) return;
      wanted = { name, fade };
      tick();
    },
    stop() { wanted = null; tick(); },
    get song() { return wanted ? wanted.name : null; },
    get playing() { return playing ? playing.name : null; },
  };
}
