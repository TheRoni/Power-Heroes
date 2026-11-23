// Writes the generated part of sw.js (the service worker): the list of every file the game needs and a version made from
// what is in those files. Run it after ANY change to a game file: node tests/bump-sw.js
// (The test for the app, group 20, fails if sw.js is out of date, so a phone can never keep an old copy by mistake.)
// Not part of the game.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SW = path.join(ROOT, 'sw.js');
const BEGIN = '// BEGIN GENERATED (node tests/bump-sw.js)';
const END = '// END GENERATED';

// Every file the game loads: the page, what it links, the icons, the saved Three.js, and every file in src/.
function gameFiles() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const linked = [...html.matchAll(/(?:href|src)="([^":#]+)"/g)].map((m) => m[1]);   // (no web addresses)
  const files = new Set(['index.html', ...linked, 'manifest.webmanifest', ...manifest.icons.map((i) => i.src)]);
  for (const dir of ['src', 'lib']) for (const f of fs.readdirSync(path.join(ROOT, dir)).sort()) if (f.endsWith('.js')) files.add(`${dir}/${f}`);
  return ['./', ...[...files].sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)))];
}

function generated(files) {
  const hash = crypto.createHash('sha1');
  for (const f of files.filter((x) => x !== './')) hash.update(`${f}\0`).update(fs.readFileSync(path.join(ROOT, f)));
  return `${BEGIN}\nconst VERSION = 'power-heroes-${hash.digest('hex').slice(0, 8)}';\nconst FILES = [\n${files.map((f) => `  '${f}',`).join('\n')}\n];\n${END}`;
}

// What sw.js should say now.
function expected() {
  const current = fs.readFileSync(SW, 'utf8');
  const from = current.indexOf(BEGIN);
  const to = current.indexOf(END);
  if (from < 0 || to < 0) throw new Error('sw.js has no generated part');
  return current.slice(0, from) + generated(gameFiles()) + current.slice(to + END.length);
}

module.exports = { gameFiles, expected };
if (require.main === module) {
  const next = expected();
  const changed = next !== fs.readFileSync(SW, 'utf8');
  fs.writeFileSync(SW, next);
  console.log(changed ? 'sw.js updated' : 'sw.js was already up to date');
}
