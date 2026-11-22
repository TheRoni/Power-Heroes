// heroes-data.js: every number that decides how the fight feels. Change a number here to change the game.
// Distances are in game units (Ember is about 2 units tall). Times are in seconds.

export const EMBER = {
  name: 'Ember',
  health: 100,
  invulnerable: 0.4,   // how long she is protected after a hit, so several bumps cannot land at once
  attack: { damage: 10, range: 7, cooldown: 0.7, speed: 16 },   // the automatic fireball
  wave: { name: 'Flame Wave', damage: 45, length: 6, angle: 100, cooldown: 5, push: 3 },   // her superpower (angle in degrees)
};

export const GLOOMLING = {
  health: 30,
  speed: 3,        // Ember runs at 7, so she can always get away
  damage: 8,
  windup: 0.3,     // the warning flash before a bump
  pause: 1,        // how long it rests after a bump
  reach: 1.1,      // how close it must get to bump
};

export const WAVES = {
  sizes: [4, 6, 8],   // how many Gloomlings in each wave
  spawnGap: 1,        // seconds between Gloomlings appearing
  breakTime: 1.5,     // seconds between waves
};
