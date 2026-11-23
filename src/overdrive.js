// overdrive.js: Overdrive. Hits fill a meter. When it is full, tap the hero's name box (or press E, or tap the portrait
// of the hero in play): for a few seconds the hero's Power number jumps (damage is 1.5 times), the aura flares, and
// the superpower recharges three times as fast. One meter for the whole squad; it starts empty every round.

const PER_HIT = 0.03;    // how much of the meter a hit fills
const PER_BIG = 0.06;    // ...and a superpower hit
const DURATION = 6;      // seconds of Overdrive
export const BOOST = 1.5;

// squad: whoever is in play gets the boost. aura: flares. ui.showBanner and audio.play make the show.
export function createOverdrive({ squad, aura, ui, audio, shake }) {
  let meter = 0;
  let timeLeft = 0;      // seconds of Overdrive left (0 = not on)
  let announced = false; // "ready" has been said for this fill

  // A hit landed. "kind" is 'big' for a superpower.
  function hit(kind) {
    if (timeLeft > 0 || meter >= 1) return;
    meter = Math.min(1, meter + (kind === 'big' ? PER_BIG : PER_HIT));
    if (meter >= 1 && !announced) {
      announced = true;
      audio.play('ready');
    }
  }

  // Starts Overdrive, if the meter is full and the hero in play is not knocked out. Returns true if it started.
  function activate() {
    if (meter < 1 || timeLeft > 0 || squad.player.down) return false;
    meter = 0;
    announced = false;
    timeLeft = DURATION;
    squad.player.setBoost(BOOST);
    aura.flare(DURATION);
    audio.play('overdrive');
    shake(0.2);
    ui.showBanner('OVERDRIVE!', 'Power up!');
    return true;
  }

  // Every frame, with the game's time (it waits during conversations).
  function update(dt) {
    if (timeLeft <= 0) return;
    timeLeft = Math.max(0, timeLeft - dt);
    squad.player.setBoost(BOOST);   // whoever is in play (after a swap) has it too
    if (timeLeft === 0) squad.player.setBoost(1);
  }

  function reset() {
    meter = 0;
    timeLeft = 0;
    announced = false;
    squad.player.setBoost(1);
  }

  return {
    hit, activate, update, reset,
    get meter() { return meter; },
    get active() { return timeLeft > 0; },
    get timeLeft() { return timeLeft; },
    get ready() { return meter >= 1 && timeLeft <= 0; },
  };
}
