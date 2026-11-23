// types.js: the types and the damage rules. Fire burns Nature, Nature grounds Storm, Storm shocks Water and Water puts
// out Fire (the main circle). Light and Shadow hurt each other. Everything else is a normal hit.

// The colour of each type: hex for sparks and tints, css for the buttons and portraits.
export const TYPE_COLORS = {
  light: { hex: 0xffe27a, css: '#ffd24a' },
  fire: { hex: 0xff7a3c, css: '#ff6a2c' },
  water: { hex: 0x4fb4ff, css: '#3f9cf0' },
  storm: { hex: 0xffe14a, css: '#f2c200' },
  nature: { hex: 0x7dff52, css: '#4ecb2a' },
  shadow: { hex: 0x8a5ad8, css: '#7a4ac8' },
};

const BEATS = { fire: 'nature', nature: 'storm', storm: 'water', water: 'fire' };   // each type beats the next one on the circle
export const STRONG = 1.5;   // damage against a type you beat (a big "SUPER!")
export const WEAK = 0.67;    // damage against a type that beats you (a small grey "weak")

// How well an attacker of one type does against a defender of another (either can be null: no type).
// Returns { multiplier, label } where the label is 'super', 'weak' or 'normal'.
export function effectiveness(attacker, defender) {
  if (!attacker || !defender) return { multiplier: 1, label: 'normal' };
  const lightAndShadow = (attacker === 'light' && defender === 'shadow') || (attacker === 'shadow' && defender === 'light');
  if (BEATS[attacker] === defender || lightAndShadow) return { multiplier: STRONG, label: 'super' };
  if (BEATS[defender] === attacker) return { multiplier: WEAK, label: 'weak' };
  return { multiplier: 1, label: 'normal' };
}
