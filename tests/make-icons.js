// Draws the app icons (PNG) from the two SVG files in icons/. Not part of the game: run it again if the SVG changes.
// Run: node tests/make-icons.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ICONS = path.resolve(__dirname, '..', 'icons');
// [source svg, output png, size]. The "maskable" one is a full square (the phone cuts its own shape out of it);
// the Apple one must not be see-through (iPhones turn see-through into black), so it is the square one too.
const JOBS = [
  ['icon.svg', 'icon-192.png', 192],
  ['icon.svg', 'icon-512.png', 512],
  ['icon-maskable.svg', 'icon-maskable-512.png', 512],
  ['icon-maskable.svg', 'apple-touch-icon.png', 180],
  ['icon.svg', 'favicon-32.png', 32],
];

(async () => {
  const browser = await chromium.launch();
  for (const [source, output, size] of JOBS) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const svg = fs.readFileSync(path.join(ICONS, source), 'utf8');
    await page.setContent(`<body style="margin:0;background:transparent"><img width="${size}" height="${size}" style="display:block" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body>`);
    await page.waitForFunction(() => document.images[0].complete && document.images[0].naturalWidth > 0);
    await page.screenshot({ path: path.join(ICONS, output), omitBackground: true });
    await page.close();
    console.log(`${output}: ${size}x${size}`);
  }
  await browser.close();
})();
