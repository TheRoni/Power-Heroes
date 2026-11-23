// sky.js: the sky behind the island. It is painted on a small canvas, so it can change from day to night,
// with twinkling stars, as the story needs.
import * as THREE from '../lib/three.module.min.js';

const DAY = ['#4aa8ee', '#a6dcf8', '#fff0d6'];     // top, middle and bottom colours of the daytime sky
const NIGHT = ['#050b24', '#16256a', '#40307f'];   // and of the night sky
const STOPS = [0, 0.55, 1];

export function createSky() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const day = DAY.map((c) => new THREE.Color(c));
  const night = NIGHT.map((c) => new THREE.Color(c));
  const mix = new THREE.Color();

  // Star positions, as fractions of the screen. The same every time.
  let seed = 11;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const stars = Array.from({ length: 70 }, () => ({ x: random(), y: random() * 0.85, size: 1 + random() * 1.2, phase: random() * 6.28 }));

  let amount = 0;      // 0 = day, 1 = full night
  let painted = null;  // what was painted last, so we only repaint when something changed

  // Paints the sky. "time" makes the stars twinkle.
  function paint(time) {
    const { width, height } = canvas;
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    STOPS.forEach((stop, i) => gradient.addColorStop(stop, `#${mix.lerpColors(day[i], night[i], amount).getHexString()}`));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    if (amount > 0) {
      ctx.fillStyle = '#ffffff';
      for (const s of stars) {
        ctx.globalAlpha = amount * (0.6 + 0.4 * Math.sin(time * 2 + s.phase));
        ctx.fillRect(s.x * width, s.y * height, s.size, s.size);
      }
      ctx.globalAlpha = 1;
    }
    texture.needsUpdate = true;
  }

  // The picture matches the screen's shape, so the stars stay round.
  function resize(width, height) {
    canvas.width = Math.max(32, Math.ceil(width / 3));
    canvas.height = Math.max(32, Math.ceil(height / 3));
    texture.dispose();   // the picture changed size, so the graphics card must make a new one (otherwise it complains)
    painted = null;
    paint(0);
  }

  // 0 = day, 1 = night. Repaints only when needed (always, while it is night, for the twinkling).
  function set(value, time = 0) {
    amount = value;
    if (value === 0 && painted === 0) return;
    painted = value;
    paint(time);
  }

  resize(300, 600);
  return { texture, set, resize };
}
