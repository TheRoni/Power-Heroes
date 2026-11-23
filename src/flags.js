// flags.js: the switches in the web address. Add ?debug (or #debug, which also works in the Claude test link) to show the
// frame rate and to make the game quick to test; the other switches below work together with it. Without ?debug the game is
// the real one: title screen, squad screen, the five rounds of Chapter 1, and progress saved in the browser.
import { HEROES } from './heroes-data.js';

const FLAGS = new URLSearchParams(location.search);
const HASH = location.hash.slice(1).split(/[,&-]/);   // "#debug", "#debug-title" and "#debug-squad" work too (in the Claude test link)
export const flag = (name) => FLAGS.has(name) || HASH.includes(name);
export const DEBUG = flag('debug');
export const TITLE = !DEBUG || flag('title');       // debug mode skips the title screen and the squad screen (so the tests are quick), unless asked
export const PICK = !DEBUG || flag('squad');
export const CHAPTER = !DEBUG || flag('chapter');   // the five rounds of Chapter 1 one after another (debug mode keeps the one round that repeats)
export const PERSIST = !DEBUG || flag('save');      // progress is saved in the browser (debug mode forgets, so the tests start fresh)
const PREVIEW = FLAGS.get('hero') || (HASH.find((h) => h.startsWith('hero=')) || '').slice(5);   // ?debug&hero=tide (or #debug-hero=tide) previews another hero
export const PLAYER_KIND = DEBUG && HEROES[PREVIEW] ? PREVIEW : 'sol';   // which hero the player controls (a key in heroes-data.js)
