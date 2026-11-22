// heroes-data.js: every number that decides how the fight feels. Change a number here to change the game.
// Distances are in game units (a hero is about 2 units tall). Times are in seconds.

// Each hero has a type, health, an automatic attack ("look" picks how the shot looks) and one superpower.
export const HEROES = {
  sol: {
    name: 'Sol',
    type: 'light',
    health: 100,
    invulnerable: 0.4,   // how long a hero is protected after a hit, so several bumps cannot land at once
    attack: { look: 'dart', damage: 9, range: 7, cooldown: 0.6, speed: 18 },   // quick darts of light
    power: { id: 'starburst', name: 'Starburst', damage: 40, radius: 4.5, push: 2.5, cooldown: 5 },   // a ring of light in every direction
  },
  ember: {
    name: 'Ember',
    type: 'fire',
    health: 100,
    invulnerable: 0.4,
    attack: { look: 'fireball', damage: 10, range: 7, cooldown: 0.7, speed: 16 },
    power: { id: 'flamewave', name: 'Flame Wave', damage: 45, length: 6, angle: 100, cooldown: 5, push: 3 },   // a cone of fire (angle in degrees)
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

export const WAVES = {
  sizes: [4, 6, 8],   // how many Gloomlings in each wave
  spawnGap: 1,        // seconds between Gloomlings appearing
  breakTime: 1.5,     // seconds between waves
};
