// character-gen.js: makes the people of the clan out of mix-and-match parts: a name, a type, a Power number, a personality and a
// look (body shape, skin, hair, hat, outfit colours, an accessory). The same seed always makes the same people, so the village
// has the same clan every visit. Nothing here draws anything: member-model.js turns a look into shapes.
import { TYPE_COLORS } from './types.js';

// A small random-number maker with a fixed starting number.
export function makeRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const TYPES = ['fire', 'water', 'storm', 'nature'];
export const PERSONALITIES = ['proud', 'shy', 'cheerful', 'sleepy', 'serious', 'jokey', 'curious', 'grumpy'];
export const BODIES = ['round', 'tall', 'small'];                                  // how the body is shaped
export const HAIR = ['spiky', 'round', 'bun', 'long', 'tuft'];                     // hair styles
export const HATS = [null, null, 'cap', 'hood', 'headband', 'flower'];             // (more people go bare-headed than not)
export const ACCESSORIES = [null, null, 'scarf', 'glasses', 'satchel'];
export const SKIN = [0xffd3b0, 0xf2b98f, 0xd9a273, 0xb67b4f, 0x8a5a3a];
export const HAIR_COLORS = [0x3a2a1c, 0x6b4a2a, 0xc88a3a, 0xe8d36a, 0xb04a2a, 0x2a2a3a, 0xd9d9e8, 0x7a4ac8, 0x2f8f6a];

// Names that are not taken by a hero or a character of the story.
export const NAMES = ['Basil', 'Clover', 'Dusty', 'Embry', 'Flint', 'Gus', 'Hazel', 'Ivy', 'Jasper', 'Kit', 'Lark', 'Moss', 'Nettle', 'Olive', 'Quill', 'Rue', 'Sage', 'Tansy', 'Umber', 'Vale', 'Willa', 'Yarrow', 'Zinnia', 'Bo', 'Cedar', 'Dill', 'Fig', 'Heath', 'Indigo', 'Juniper'];

// The people who were on the Power Rankings before there was a village (rankings.js): they are in the clan, with the same Power.
export const CLAN_FIXED = [
  { name: 'Wren', type: 'water', power: 45, personality: 'shy' },
  { name: 'Pebble', type: 'nature', power: 80, personality: 'sleepy' },
  { name: 'Juno', type: 'storm', power: 150, personality: 'proud' },
  { name: 'Marigold', type: 'water', power: 230, personality: 'cheerful' },
  { name: 'Brindle', type: 'fire', power: 340, personality: 'serious' },
  { name: 'Fennel', type: 'nature', power: 480, personality: 'jokey' },
];

const pick = (rand, list) => list[Math.floor(rand() * list.length)];

// A look. The outfit takes the colour of the person's type (a little paler), so you can tell the type at a glance.
export function makeLook(rand, type) {
  const color = TYPE_COLORS[type].hex;
  return {
    body: pick(rand, BODIES), skin: pick(rand, SKIN),
    hair: pick(rand, HAIR), hairColor: pick(rand, HAIR_COLORS),
    hat: pick(rand, HATS), hatColor: pick(rand, [color, 0xf4ead0, 0x5a3a1c, 0x3a4a8a]),
    outfit: color, trim: pick(rand, [0xf4ead0, 0x5a3a1c, 0xffd24a, 0xffffff]),
    accessory: pick(rand, ACCESSORIES), accessoryColor: pick(rand, [0xd04a3a, 0xf4ead0, 0x3a7ac8, 0xffd24a]),
  };
}

// The clan: "count" people. The named ones from the Rankings come first, then random people, with Power from about 20 to 600
// (most are small, a few are strong).
export function makeClan(seed = 7, count = 14) {
  const rand = makeRandom(seed);
  const used = new Set(CLAN_FIXED.map((p) => p.name));
  const people = CLAN_FIXED.slice(0, count).map((p) => ({ ...p }));
  while (people.length < count) {
    const free = NAMES.filter((n) => !used.has(n));
    const name = pick(rand, free);
    used.add(name);
    people.push({ name, type: pick(rand, TYPES), power: Math.round(20 * 30 ** rand()), personality: pick(rand, PERSONALITIES) });
  }
  return people.map((p, i) => ({ ...p, id: i, look: makeLook(rand, p.type) }));
}
