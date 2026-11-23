// menus.js: the full-screen menus: the title screen, the squad screen, and the end screen after a round, where each
// hero's Power counts up. They take Space and Enter while they are showing.
import { QUIET } from './audio.js';
import { TYPE_COLORS } from './types.js';
import { shortNumber, tierIndex, TIERS } from './power.js';

const ENDINGS = {
  won: { title: 'Isle saved!', text: 'Sunmeadow is green again.', button: 'Play again' },
  lost: { title: 'Knocked out', text: 'Even heroes need a nap. Ready again?', button: 'Try again' },
};
const END_LOCK = 800;    // milliseconds after an end screen appears when taps are ignored, so a mashed button cannot skip it
const COUNT_TIME = 1.4;  // seconds a Power number takes to count up
const COUNT_GAP = 0.35;  // seconds between one hero's count-up starting and the next one's

// "onAgain" is called when the player taps "Play again" / "Try again". "audio" plays the clicks and the count-up sounds.
export function createMenus({ audio = QUIET, onAgain }) {
  const endScreen = document.getElementById('end');
  const endButton = document.getElementById('end-button');
  const gainsBox = document.getElementById('end-gains');
  const titleScreen = document.getElementById('title');
  const pickScreen = document.getElementById('squad-screen');
  const goButton = document.getElementById('squad-go');
  let endShownAt = 0;
  let titleStart = null;   // what to do when the title screen is tapped
  let pickDone = null;     // what the squad screen's Go! button does
  let run = 0;             // which count-up is on (a new screen stops the one before)

  // ---- The end screen ----

  // An end screen's button. The first moment after it appears is ignored (see END_LOCK).
  function again() {
    if (endScreen.hidden || performance.now() - endShownAt < END_LOCK) return;
    audio.play('click');
    onAgain();
  }
  endScreen.addEventListener('pointerdown', (event) => event.stopPropagation());   // nothing behind an end screen reacts to touches
  endButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    again();
  });

  // The power-up moment: each hero's Power counts up, one after another, with a ticking sound that rises. When a number
  // arrives the row flares; crossing an aura tier ("Glow!") is a bigger celebration. events.onFlare(gain) and
  // events.onTier(gain, tierName) tell the game (for the aura and the confetti).
  function countUp(gains, events) {
    const id = ++run;
    const start = performance.now();
    const rows = [...gainsBox.children];
    const arrived = gains.map(() => false);
    function frame(now) {
      if (id !== run) return;   // another screen took over
      let waiting = false;
      gains.forEach((gain, i) => {
        const progress = Math.max(0, Math.min(1, ((now - start) / 1000 - i * COUNT_GAP) / COUNT_TIME));
        const eased = 1 - (1 - progress) ** 3;
        const text = shortNumber(Math.round(gain.before + (gain.after - gain.before) * eased));
        const number = rows[i].querySelector('.gain-power');
        if (number.textContent !== text) {
          number.textContent = text;
          audio.play('tick', { pitch: 0.8 + 0.8 * eased });
        }
        if (progress < 1) { waiting = true; return; }
        if (arrived[i]) return;
        arrived[i] = true;
        if (gain.after <= gain.before) return;
        rows[i].classList.add('flare');
        audio.play('chime');
        if (tierIndex(gain.after) > tierIndex(gain.before)) {   // a new aura tier
          const tier = TIERS[tierIndex(gain.after)].name;
          rows[i].classList.add('tier');
          rows[i].insertAdjacentHTML('beforeend', `<span class="gain-tier">${tier}!</span>`);
          audio.play('tier');
          if (events.onTier) events.onTier(gain, tier);
        } else if (events.onFlare) {
          events.onFlare(gain);
        }
      });
      if (waiting) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  // kind: 'won' or 'lost'. "gains" is what the round did to each hero: [{ name, xp, before, after }].
  function showEnd(kind, gains = [], events = {}) {
    const ending = ENDINGS[kind];
    gainsBox.innerHTML = gains.map((g) => `<div class="gain"><span class="gain-name">${g.name}</span><span class="gain-label">Power</span><span class="gain-power">${shortNumber(g.before)}</span><span class="gain-xp">+${shortNumber(g.xp)} XP</span></div>`).join('');
    document.getElementById('end-title').textContent = ending.title;
    document.getElementById('end-text').textContent = ending.text;
    endButton.textContent = ending.button;
    endScreen.className = kind;
    endScreen.hidden = false;
    endShownAt = performance.now();
    countUp(gains, events);
  }

  function hideEnd() {
    run++;
    endScreen.hidden = true;
  }

  // ---- The title screen ----

  // The title screen waits for a tap (or Space / Enter), then hides itself and starts the story.
  function startFromTitle() {
    if (titleScreen.hidden || !titleStart) return;
    const go = titleStart;
    titleStart = null;
    titleScreen.hidden = true;
    go();
  }
  titleScreen.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    startFromTitle();
  });
  // "onReset" (optional) shows a small "Start over" button for someone who has saved progress.
  function showTitle(onStart, onReset = null) {
    titleStart = onStart;
    titleScreen.hidden = false;
    const reset = document.getElementById('title-reset');
    reset.hidden = !onReset;
    reset.onpointerdown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (onReset) onReset();
    };
  }
  function hideTitle() {
    titleStart = null;
    titleScreen.hidden = true;
  }

  // ---- The squad screen ----

  // The squad screen: tap heroes to choose who comes (the first one always does), then Go!
  // heroes is [{ kind, name, type, power }] and chosen the kinds picked so far; onGo(kinds) gets the final squad.
  function showSquad({ heroes, chosen, onGo }) {
    const holder = document.getElementById('squad-heroes');
    const size = Math.min(3, heroes.length);
    const picked = new Set([heroes[0].kind, ...chosen]);
    holder.textContent = '';
    const refresh = () => {
      for (const card of holder.children) card.classList.toggle('on', picked.has(card.dataset.kind));
      goButton.disabled = picked.size !== size;
      document.getElementById('squad-help').textContent = picked.size < size ? `${heroes[0].name} always comes. Pick ${size - picked.size} more.` : 'Ready!';
    };
    heroes.forEach((hero, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `card${i === 0 ? ' locked' : ''}`;
      card.dataset.kind = hero.kind;
      card.style.setProperty('--c', TYPE_COLORS[hero.type].css);
      card.innerHTML = `<span class="card-face">${hero.name[0]}</span><span class="card-name">${hero.name}</span><span class="card-type">${hero.type}</span><span>${hero.power}</span>`;
      card.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (i === 0) return;
        if (picked.has(hero.kind)) picked.delete(hero.kind);
        else if (picked.size < size) picked.add(hero.kind);
        audio.play('click');
        refresh();
      });
      holder.appendChild(card);
    });
    pickDone = () => {
      pickScreen.hidden = true;
      onGo(heroes.filter((hero) => picked.has(hero.kind)).map((hero) => hero.kind));
    };
    refresh();
    pickScreen.hidden = false;
  }
  goButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!goButton.disabled && pickDone) { audio.play('click'); pickDone(); }
  });
  goButton.addEventListener('go', () => { if (pickDone) pickDone(); });
  pickScreen.addEventListener('pointerdown', (event) => event.stopPropagation());   // nothing behind the squad screen reacts to touches

  // A menu that is showing takes Space and Enter. Returns true if it used the key.
  function handleKey(event) {
    if (!pickScreen.hidden) {   // on the squad screen, Space and Enter mean "Go!"
      event.preventDefault();
      if (!goButton.disabled) goButton.dispatchEvent(new Event('go'));
    } else if (!titleScreen.hidden) {   // on the title screen, they mean "begin"
      event.preventDefault();
      startFromTitle();
    } else if (!endScreen.hidden) {   // on an end screen, they mean "again"
      event.preventDefault();
      again();
    } else {
      return false;
    }
    return true;
  }

  return { handleKey, api: { showTitle, hideTitle, showEnd, hideEnd, showSquad } };
}
