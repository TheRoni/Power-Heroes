// residents.js: your own heroes who live in the village. Ember, Tide and Volt (whoever is not in your squad) wander about the isle: each
// has favourite places, strolls between them, and goes to the fire when night comes. You can talk to them. They are the real heroes
// (same look as in a fight), steered like Ember's guest at the end of Chapter 1.
import { createGuest } from './hero.js';
import { HEROES } from './heroes-data.js';

const FIRE = { x: 1.5, z: 5.5 };
// Favourite places, as [x, z, lookX, lookZ] (what they look at when they get there).
const SPOTS = {
  ember: [[-9.2, -1.4, -11.5, -3], [-13.6, -0.6, -11.5, -3], [9.6, -0.8, 11.5, -3]],   // the yard and the ring
  tide: [[-6.2, 5.6, -10, 8], [-12.4, 5.2, -10, 8], [-9.5, 12, -10, 8]],               // by the pond
  volt: [[9.6, 6.4, 12.5, 9], [7.6, -7.4, 5, -9.5], [3.8, -2, 0, -3]],                 // the tower, the board, the road
  sol: [[0, 2, 0, 0]],
};
const NIGHT_SEATS = { ember: [3.4, 3.9], tide: [-0.5, 7.6], volt: [-0.8, 3.6], sol: [4.2, 7.2] };
const GATHER_AT = 0.55;

// "scene" is where they are drawn; "bound" how far they may walk. Everybody is made when first needed.
export function createResidents({ scene, bound }) {
  const people = {};   // kind -> { kind, guest, wait, night, spot }

  // Shows these heroes (the ones not in your squad) in the village, and hides everyone else.
  function show(kinds) {
    for (const kind of Object.keys(people)) if (!kinds.includes(kind)) { people[kind].guest.leave(); people[kind].here = false; }
    kinds.forEach((kind, i) => {
      if (!HEROES[kind] || !SPOTS[kind]) return;
      const person = people[kind] || (people[kind] = { kind, guest: createGuest({ scene, bound, kind }), wait: 1 + i, night: false, here: false, spot: 0 });
      if (person.here) return;
      const [x, z, lx, lz] = SPOTS[kind][i % SPOTS[kind].length];
      person.guest.runIn(x, z, x, z, lx, lz, { cheers: false });
      person.here = true;
    });
  }

  function hide() { for (const person of Object.values(people)) { person.guest.leave(); person.here = false; } }

  // Every frame: they stroll between their favourite places, or go to the fire at night.
  function update(dt, time, night = 0) {
    for (const person of Object.values(people)) {
      const { guest, kind } = person;
      guest.update(dt, time);
      if (!person.here || guest.state === 'away') continue;
      const wantFire = night > GATHER_AT;
      if (wantFire !== person.night) {
        person.night = wantFire;
        person.wait = Math.random() * 5;
        person.moved = false;
      }
      if (guest.state !== 'here') continue;
      if ((person.wait -= dt) > 0) continue;
      const p = guest.position;
      if (wantFire) {
        if (!person.moved) {
          const [x, z] = NIGHT_SEATS[kind];
          guest.runIn(p.x, p.z, x, z, FIRE.x, FIRE.z, { cheers: false, pace: 0.45 });
          person.moved = true;
        }
        person.wait = 5;
      } else {
        const options = SPOTS[kind];
        person.spot = (person.spot + 1 + Math.floor(Math.random() * (options.length - 1 || 1))) % options.length;
        const [x, z, lx, lz] = options[person.spot];
        guest.runIn(p.x, p.z, x, z, lx, lz, { cheers: false, pace: 0.3 });
        person.wait = 8 + Math.random() * 12;
      }
    }
  }

  // The hero nearest to a place within "range" (for talking), as { kind, name, group, position }, or null.
  function nearest(at, range = 2.4) {
    let best = null;
    let bestDistance = range;
    for (const person of Object.values(people)) {
      if (!person.here) continue;
      const d = Math.hypot(person.guest.position.x - at.x, person.guest.position.z - at.z);
      if (d < bestDistance) { best = person; bestDistance = d; }
    }
    return best ? { kind: best.kind, name: HEROES[best.kind].name, group: best.guest.group, position: best.guest.position } : null;
  }

  return { show, hide, update, nearest, people };
}
