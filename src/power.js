// power.js: Power. Every hero and every Gloomling has a Power number. It comes from XP and has no known limit, and each
// step up costs a bit more XP than the last, so growth stays steady. The numbers in heroes-data.js are for Power 10: a
// hero's (or a Gloomling's) health and damage are multiplied by Power / 10.

export const REFERENCE = 10;

// The hero's name, as a player may type it: letters (any language), digits, spaces, apostrophes and hyphens, at most 10;
// anything else is dropped, and nothing left means the default name. (Nothing that could break a page, either.)
export const DEFAULT_NAME = 'Sol';
export const NOT_NAME = /[^\p{L}\p{N} '’-]/gu;
export const cleanName = (text, fallback = DEFAULT_NAME) => String(text ?? '').replace(NOT_NAME, '').replace(/\s+/g, ' ').trim().slice(0, 10).trim() || fallback;

export const stepXp = (power) => 2 + 0.2 * power;                                  // XP to go from this Power to the next
export const xpForPower = (power) => 2 * (power - 1) + 0.1 * power * (power - 1);  // total XP needed to reach a Power (Power 1 is 0 XP)

// The Power that some XP is worth.
export function powerFromXp(xp) {
  const amount = Math.max(0, xp);
  let power = Math.max(1, Math.floor((-1.9 + Math.sqrt(3.61 + 0.4 * (amount + 2))) / 0.2));
  while (xpForPower(power + 1) <= amount) power++;
  while (power > 1 && xpForPower(power) > amount) power--;
  return power;
}

export const strength = (power = REFERENCE) => power / REFERENCE;   // what health and damage are multiplied by

// The aura tiers. (A hidden tier is added by a later stage.)
export const TIERS = [{ name: 'Spark', at: 0 }, { name: 'Glow', at: 100 }, { name: 'Blaze', at: 300 }, { name: 'Surge', at: 1000 }, { name: 'Radiant', at: 3000 }];
export function tierIndex(power) {
  let index = 0;
  TIERS.forEach((tier, i) => { if (power >= tier.at) index = i; });
  return index;
}

// Big numbers in short form: 1,234 then 12.4K, 3.1M, 2B.
export function shortNumber(n) {
  const whole = Math.floor(n);
  if (whole < 10000) return String(whole).replace(/\B(?=(\d{3})+$)/g, ',');
  for (const [size, letter] of [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]) {
    if (whole >= size) return `${(Math.floor(whole / (size / 10)) / 10).toString().replace(/\.0$/, '')}${letter}`;
  }
  return String(whole);
}

// What a round pays. Every Gloomling gives XP in proportion to its Power, and a win adds a bonus.
export const xpForKill = (enemyPower) => Math.max(1, Math.round(0.3 * enemyPower));
export const winBonus = (enemyPower) => Math.round(2 * enemyPower);

// How strong a round's Gloomlings are: about 0.8, 1, 1.2 (and 1.4 in a fourth wave) times your squad's average Power in
// waves 1, 2 and 3, so the fight stays fair as you grow. (Never below 6.) A chapter's later rounds add a bit more (chapters.js).
const WAVE_FACTOR = [0.8, 1, 1.2, 1.4];
export const enemyPowerFor = (averagePower, wave) => Math.max(6, Math.round(averagePower * WAVE_FACTOR[Math.min(wave, WAVE_FACTOR.length - 1)]));

// The record of how far you have come: XP for every hero, rounds won, who has joined, and what has been seen.
// "start(kind)" says each hero's Power when they join (heroes-data.js). "save" ({ load(), store(data) }) is optional.
// "flat" (a number) makes every hero's Power that number whatever their XP (debug mode: the tests expect Power 10).
export function createProgress(start, save = null, flat = null) {
  const fresh = () => ({ version: 1, xp: { sol: 0 }, roundsWon: 0, unlocked: ['sol'], seen: {}, round: 1, shards: [] });
  let data = (save && save.load()) || fresh();
  let name = cleanName(save && save.loadName ? save.loadName() : null);   // the hero's name (kept even when the progress is wiped)
  const xpOf = (kind) => data.xp[kind] ?? xpForPower(start(kind) || 1);
  const powerOf = (kind) => flat ?? powerFromXp(xpOf(kind));
  return {
    xpOf, powerOf,
    get flat() { return flat !== null; },
    get data() { return data; },
    get name() { return name; },
    setName(text) { name = cleanName(text); if (save && save.storeName) save.storeName(name); return name; },
    get roundsWon() { return data.roundsWon; },
    get round() { return data.round || 1; },   // the round of the chapter to play next (one more than the last one is: the chapter is done)
    advance(last) { data.round = Math.min(last, (data.round || 1) + 1); },
    get shards() { return (data.shards || []).length; },   // memory shards found (one for each chapter)
    collectShard(chapter = 1) { data.shards = data.shards || []; if (!data.shards.includes(chapter)) data.shards.push(chapter); },
    get unlocked() { return [...data.unlocked]; },
    averagePower(kinds) { return Math.round(kinds.reduce((sum, kind) => sum + powerOf(kind), 0) / Math.max(1, kinds.length)); },
    // Gives XP to some heroes. Returns what happened to each: { kind, xp, before, after }.
    addXp(kinds, amount) {
      return kinds.map((kind) => {
        const before = powerOf(kind);
        data.xp[kind] = xpOf(kind) + amount;
        return { kind, xp: amount, before, after: powerOf(kind) };
      });
    },
    unlock(kinds) { for (const kind of kinds) if (!data.unlocked.includes(kind)) { data.unlocked.push(kind); data.xp[kind] = xpOf(kind); } },
    winRound() { data.roundsWon++; },
    has: (name) => Boolean(data.seen[name]),
    mark(name) { data.seen[name] = true; },
    store() { if (save) save.store(data); },
    reset() { data = fresh(); if (save) save.store(data); },
    get saved() { return Boolean(save) && (data.seen.prologue || data.roundsWon > 0); },
  };
}
