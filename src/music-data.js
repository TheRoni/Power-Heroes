// music-data.js: the songs, written as note lists. music.js plays them.
// A note is its name and octave, then ":" and how many beats it lasts: "D5:2 F#5:1 Bb4:0.5". "r:2" is a rest.
// "D3+A3:8" plays two notes together (a chord). "x:0.5" is a drum hit (for the drum voices). "|" is only a bar line to
// help the eye. A melody that changes mood (Lyra's Lullaby) is written in scale degrees instead: "5:1 3^:2"
// (^ is an octave up, v an octave down), and the key and the mode are given separately.

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MODES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

// "F#5" -> 78 (MIDI numbers: C4 is 60, A4 is 69).
function midi(name) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`bad note name: ${name}`);
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// "5" or "3^" or "7v" in a key and mode -> MIDI number. "key" is the tonic, such as 'D4'.
function degree(text, key, mode) {
  const m = /^([1-7])([\^v]*)$/.exec(text);
  if (!m) throw new Error(`bad scale degree: ${text}`);
  const octave = [...m[2]].reduce((sum, c) => sum + (c === '^' ? 1 : -1), 0);
  return midi(key) + MODES[mode][Number(m[1]) - 1] + 12 * octave;
}

// Turns text into events: { beat, beats, notes: [midi, ...] } (notes is empty for a rest, [0] for a drum hit).
export function parseNotes(text, { key, mode } = {}) {
  const events = [];
  let beat = 0;
  for (const token of text.replace(/\|/g, ' ').split(/\s+/).filter(Boolean)) {
    const [pitch, length] = token.split(':');
    const beats = Number(length);
    if (!(beats > 0)) throw new Error(`bad length in "${token}"`);
    if (pitch !== 'r') {
      const notes = pitch === 'x' ? [0] : pitch.split('+').map((p) => (key ? degree(p, key, mode) : midi(p)));
      events.push({ beat, beats, notes });
    }
    beat += beats;
  }
  return { events, total: beat };
}

const repeat = (text, times) => Array(times).fill(text).join(' | ');

// Lyra's Lullaby, verse one, in scale degrees (3 beats a bar). It rises a sixth and sighs back down, twice, and then
// ends OPEN, on the fifth: "she used to fall asleep before the second verse". (Verse two, which comes home, is saved
// for the epilogue.)
const LULLABY_VERSE_ONE = '5:1 3^:2 | 2^:1 1^:1 7:1 | 6:2 5:1 | 6:3 | 5:1 3^:2 | 4^:1 3^:1 2^:1 | 1^:2 7:1 | 5:3';

// tempo: beats per minute. beats: beats in a bar. bars: bars in the loop. level: how loud the whole song is.
// Each track plays one voice (see music.js): flute, chime, pluck, bass, pad, kick, snare, hat.
export const SONGS = {
  // Night, a star falling: slow, wondering flute over soft chimes and a low drone. (D major)
  'falling-star': {
    tempo: 54, beats: 4, bars: 8, level: 0.9,
    tracks: [
      { voice: 'flute', notes: 'r:2 A4:2 | F#5:3 E5:1 | D5:2 A4:2 | B4:4 | r:2 A4:2 | F#5:2 A5:2 | G5:3 F#5:1 | E5:4' },
      { voice: 'chime', notes: `${repeat('D6:1 A5:1 F#5:1 A5:1', 2)} | ${repeat('B5:1 F#5:1 D6:1 F#5:1', 2)} | ${repeat('G5:1 D6:1 B5:1 D6:1', 2)} | ${repeat('A5:1 E6:1 C#6:1 E6:1', 2)}` },
      { voice: 'pad', notes: 'D3+A3:8 | B2+F#3:8 | G2+D3:8 | A2+E3:8' },
    ],
  },

  // The meadow by day: a bright, bouncing flute tune with light plucks. (G major)
  sunmeadow: {
    tempo: 108, beats: 4, bars: 8, level: 0.85,
    tracks: [
      { voice: 'flute', notes: 'D5:0.5 G5:0.5 B5:1 A5:0.5 G5:0.5 E5:1 | D5:0.5 E5:0.5 G5:1 A5:2 | D5:0.5 G5:0.5 B5:1 D6:0.5 B5:0.5 A5:1 | G5:3 r:1 | E5:0.5 G5:0.5 B5:1 C6:0.5 B5:0.5 A5:1 | G5:0.5 A5:0.5 B5:1 D6:2 | C6:0.5 B5:0.5 A5:1 G5:0.5 A5:0.5 F#5:1 | G5:3 r:1' },
      { voice: 'pluck', notes: [
        repeat('G3:0.5 B3:0.5 D4:0.5 B3:0.5', 2), repeat('E3:0.5 G3:0.5 B3:0.5 G3:0.5', 2),
        repeat('G3:0.5 B3:0.5 D4:0.5 B3:0.5', 2), repeat('G3:0.5 B3:0.5 D4:0.5 B3:0.5', 2),
        repeat('E3:0.5 G3:0.5 B3:0.5 G3:0.5', 2), repeat('C4:0.5 E4:0.5 G4:0.5 E4:0.5', 2),
        repeat('D4:0.5 F#4:0.5 A4:0.5 F#4:0.5', 2), repeat('G3:0.5 B3:0.5 D4:0.5 B3:0.5', 2),
      ].join(' | ') },
      { voice: 'bass', notes: 'G2:1 r:1 D3:1 r:1 | E2:1 r:1 B2:1 r:1 | G2:1 r:1 D3:1 r:1 | G2:1 r:1 D3:1 r:1 | E2:1 r:1 B2:1 r:1 | C3:1 r:1 G3:1 r:1 | D3:1 r:1 A3:1 r:1 | G2:1 r:1 D3:1 r:1' },
      { voice: 'hat', notes: repeat(repeat('r:0.5 x:0.5', 4), 8) },
    ],
  },

  // Marlo's theme: warm, low and kind. For the lessons and the quiet moments with him. (G major)
  marlo: {
    tempo: 72, beats: 4, bars: 8, level: 0.9,
    tracks: [
      { voice: 'flute', notes: 'G4:1 D5:2 B4:1 | A4:2 G4:1 E4:1 | G4:1 D5:2 B4:1 | A4:4 | B4:1 C5:1 D5:2 | E5:2 D5:1 B4:1 | A4:2 B4:1 G4:1 | G4:4' },
      { voice: 'pluck', notes: 'G3:1 D4:1 G4:1 D4:1 | E3:1 B3:1 E4:1 B3:1 | G3:1 D4:1 G4:1 D4:1 | D3:1 A3:1 D4:1 A3:1 | C3:1 G3:1 C4:1 G3:1 | E3:1 B3:1 E4:1 B3:1 | D3:1 A3:1 D4:1 A3:1 | G3:1 D4:1 G4:1 D4:1' },
      { voice: 'pad', notes: 'G2+D3:4 | E2+B2:4 | G2+D3:4 | D2+A2:4 | C2+G2:4 | E2+B2:4 | D2+A2:4 | G2+D3:4' },
    ],
  },

  // The Home Village: slow and sunny, an easy flute tune over a rocking pluck and a warm pad. (C major)
  village: {
    tempo: 78, beats: 4, bars: 8, level: 0.85,
    tracks: [
      { voice: 'flute', notes: 'G4:1 C5:1 E5:2 | D5:1 C5:1 A4:2 | G4:1 C5:1 E5:1 G5:1 | F5:2 E5:1 D5:1 | E5:1 D5:1 C5:1 A4:1 | G4:2 A4:1 C5:1 | D5:1 E5:1 D5:1 B4:1 | C5:3 r:1' },
      { voice: 'pluck', notes: 'C3:1 G3:1 E4:1 G3:1 | F3:1 C4:1 A3:1 C4:1 | C3:1 G3:1 E4:1 G3:1 | G3:1 D4:1 B3:1 D4:1 | A3:1 E4:1 C4:1 E4:1 | F3:1 C4:1 A3:1 C4:1 | G3:1 D4:1 B3:1 D4:1 | C3:1 G3:1 E4:2' },
      { voice: 'pad', notes: 'C2+G2:4 | F2+C3:4 | C2+G2:4 | G2+D3:4 | A2+E3:4 | F2+C3:4 | G2+D3:4 | C2+G2:4' },
    ],
  },

  // Lyra's Lullaby: one gentle solo flute, then four bars of silence to breathe. (D major)
  lullaby: {
    tempo: 60, beats: 3, bars: 12, level: 1,
    tracks: [{ voice: 'flute', key: 'D4', mode: 'major', notes: `${LULLABY_VERSE_ONE} | r:12` }],
  },

  // The same song in sorrow: the minor, very slow, and it stops in the middle of a phrase. Long silences. (D minor)
  'lullaby-sorrow': {
    tempo: 44, beats: 3, bars: 12, level: 0.9,
    tracks: [{ voice: 'flute', key: 'D4', mode: 'minor', notes: '5:1 3^:2 | 2^:1 1^:1 7:1 | 6:2 5:1 | 6:3 | 5:1 3^:2 | 4^:1 r:2 | r:18' }],
  },

  // The fight: quicker, in the minor, with a driving flute riff over soft drums. (D minor)
  battle: {
    tempo: 132, beats: 4, bars: 8, level: 0.75,
    tracks: [
      { voice: 'flute', notes: 'A5:0.5 A5:0.5 D6:1 C6:0.5 A5:0.5 G5:1 | A5:0.5 G5:0.5 F5:1 E5:2 | A5:0.5 A5:0.5 D6:1 E6:0.5 D6:0.5 C6:1 | D6:2 A5:2 | F5:0.5 F5:0.5 A5:1 G5:0.5 F5:0.5 E5:1 | D5:0.5 E5:0.5 F5:1 A5:2 | C6:0.5 C6:0.5 D6:1 C6:0.5 A5:0.5 G5:1 | A5:3 r:1' },
      { voice: 'bass', notes: ['D3', 'G2', 'D3', 'A2', 'D3', 'Bb2', 'F2', 'A2'].map((n) => `${n}:1 ${n}:0.5 ${n}:0.5 ${n}:1 ${n}:1`).join(' | ') },
      { voice: 'kick', notes: repeat('x:1 r:1 x:1 r:1', 8) },
      { voice: 'snare', notes: repeat('r:1 x:1 r:1 x:1', 8) },
      { voice: 'hat', notes: repeat(repeat('x:0.5', 8), 8) },
    ],
  },
};

// Work out every song's events once, when the game loads. Each track's notes must fill the loop exactly.
for (const [name, song] of Object.entries(SONGS)) {
  song.length = song.bars * song.beats;   // beats in one loop
  song.events = [];
  for (const track of song.tracks) {
    const { events, total } = parseNotes(track.notes, track);
    if (total !== song.length) throw new Error(`${name}: a ${track.voice} track has ${total} beats, not ${song.length}`);
    for (const e of events) song.events.push({ ...e, voice: track.voice, gain: track.gain ?? 1 });
  }
  song.events.sort((a, b) => a.beat - b.beat);
}
