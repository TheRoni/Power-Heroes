// heroes-data.js: every number that decides how the fight feels. Change a number here to change the game.
// Distances are in game units (a hero is about 2 units tall). Times are in seconds.

// Each hero has a type, health, an automatic attack ("look" picks how the shot looks) and one superpower.
export const HEROES = {
  sol: {
    name: 'Sol',
    type: 'light',
    startPower: 1,   // the Power they have when they join (Sol starts at 1 and climbs faster than anyone)
    health: 100,
    invulnerable: 0.4,   // how long a hero is protected after a hit, so several bumps cannot land at once
    attack: { look: 'dart', damage: 9, range: 7, cooldown: 0.6, speed: 18 },   // quick darts of light
    power: { id: 'starburst', name: 'Starburst', damage: 40, radius: 4.5, push: 2.5, cooldown: 5 },   // a ring of light in every direction
  },
  ember: {
    name: 'Ember',
    type: 'fire',
    startPower: 120,   // "Power 120. You?"
    health: 100,
    invulnerable: 0.4,
    attack: { look: 'fireball', damage: 10, range: 7, cooldown: 0.7, speed: 16 },
    power: { id: 'flamewave', name: 'Flame Wave', damage: 45, length: 6, angle: 100, cooldown: 5, push: 3 },   // a cone of fire (angle in degrees)
  },
  tide: {
    name: 'Tide',
    type: 'water',
    startPower: 90,
    health: 100,
    invulnerable: 0.4,
    attack: { look: 'bubble', damage: 9, range: 7, cooldown: 0.65, speed: 15 },   // bubbles of water
    power: { id: 'bigsplash', name: 'Big Splash', damage: 12, radius: 5, push: 4.5, cooldown: 6, soak: 6 },   // a ring wave: pushes Gloomlings far away and soaks them for 6 s
  },
  volt: {
    name: 'Volt',
    type: 'storm',
    startPower: 100,
    health: 100,
    invulnerable: 0.4,
    attack: { look: 'zap', damage: 8, range: 6.5, cooldown: 0.5, speed: 26 },   // fast little bolts
    power: { id: 'lightningdash', name: 'Lightning Dash', damage: 40, length: 7, width: 1.6, push: 2, cooldown: 4.5 },   // zips forward, shocking everything on the way
  },
};

export const GLOOMLING = {
  health: 30,
  speed: 3,        // Ember runs at 7, so she can always get away
  damage: 8,
  windup: 0.3,     // the warning flash before a bump
  pause: 1,        // how long it rests after a bump
  reach: 1.1,      // how close it must get to bump
};

// The bosses (boss.js). "health" is how many Gloomlings' worth he has (at the same Power); damage is at Power 10, like the heroes' numbers.
export const BOSSES = {
  bramble: {
    name: 'General Bramble', type: 'nature', radius: 1.6, health: 40, speed: 1.6, speed2: 2.4, stopAt: 2.6, growIn: 0.9, phaseAt: 0.5, roar: 1.2,
    thorns: { count: 7, spread: 70, speed: 7, damage: 10, life: 2.4, windup: 0.7, every: 4.5, every2: 3.2, minRange: 3.5 },   // a fan of thorns (the spread is in degrees)
    slam: { radius: 2.4, warning: 1.1, damage: 18, every: 7, every2: 5, range: 9 },   // a red circle on the ground, then vines burst out
    summon: { count: 3, every: 12, max: 6, windup: 0.9 },   // under half health: Gloomlings come
    contact: { reach: 0.9, windup: 0.5, damage: 12, pause: 1.4 },   // if you stand right next to him
  },
};

// The other kinds of Glooms: each number multiplies the Gloomling's (health, speed, damage), at the same Power. "xp" is how much more a
// kill is worth. A Brute is big, slow and tough; a Spitter keeps away and spits goo; a Shielder's bubble protects the Glooms near it until
// it is hit by the type that beats its own; a Golden Gloom runs away (it escapes after "life" seconds) and is worth a lot.
export const ENEMIES = {
  gloomling: { scale: 1, health: 1, speed: 1, damage: 1, windup: GLOOMLING.windup, pause: GLOOMLING.pause, reach: GLOOMLING.reach, xp: 1 },
  brute: { scale: 1.9, health: 4, speed: 0.55, damage: 2.2, windup: 0.65, pause: 1.4, reach: 1.5, xp: 3 },
  spitter: { scale: 0.85, health: 0.6, speed: 0.9, damage: 0.8, windup: 0.3, pause: 1, reach: 1.1, xp: 1.5, shot: { range: 7.5, keep: [3.8, 5.8], every: 2.8, windup: 0.5, speed: 5.5, life: 2.4, size: 0.38 } },
  shielder: { scale: 1.15, health: 1.5, speed: 0.75, damage: 1, windup: 0.4, pause: 1.1, reach: 1.2, xp: 2, shield: { radius: 3.4, soften: 0.1, cracks: 8 } },
  golden: { scale: 0.9, health: 1.5, speed: 1.9, damage: 0, windup: 0.3, pause: 1, reach: 1, xp: 15, flees: true, life: 15 },
};

export const WAVES = {
  sizes: [4, 6, 8],   // how many Gloomlings in each wave
  types: [['nature', 'fire'], ['fire', 'storm', 'nature'], ['fire', 'water', 'storm', 'nature']],   // the types they come in (each wave cycles through its list)
  spawnGap: 1,        // seconds between Gloomlings appearing
  breakTime: 1.5,     // seconds between waves
};
