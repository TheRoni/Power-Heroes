// menus.js: the full-screen menus: the title screen, the squad screen, the end screen after a round (where each hero's
// Power counts up and "Sol passed Wren!" shows) and the Power Rankings board. They take Space and Enter while they are showing.
import { QUIET } from './audio.js';
import { TYPE_COLORS } from './types.js';
import { shortNumber, tierIndex, TIERS, NOT_NAME } from './power.js';

const ENDINGS = {
  won: { title: 'Isle saved!', text: 'Sunmeadow is green again.', button: 'Play again' },
  lost: { title: 'Knocked out', text: 'Even heroes need a nap. Ready again?', button: 'Try again' },
};
const END_LOCK = 800;    // milliseconds after an end screen appears when taps are ignored, so a mashed button cannot skip it
const COUNT_TIME = 1.4;  // seconds a Power number takes to count up
const COUNT_GAP = 0.35;  // seconds between one hero's count-up starting and the next one's
const PASS_WAIT = 350;   // milliseconds after the numbers arrive until the first "passed" line, and then between lines
const PASS_GAP = 450;

// "onAgain" is called when the player taps "Play again" / "Try again". "audio" plays the clicks and the count-up sounds.
export function createMenus({ audio = QUIET, onAgain }) {
  const endScreen = document.getElementById('end');
  const endButton = document.getElementById('end-button');
  const gainsBox = document.getElementById('end-gains');
  const passesBox = document.getElementById('end-passes');
  const endRankings = document.getElementById('end-rankings');
  const rankingsScreen = document.getElementById('rankings');
  const squadRankings = document.getElementById('squad-rankings');
  const titleScreen = document.getElementById('title');
  const pickScreen = document.getElementById('squad-screen');
  const goButton = document.getElementById('squad-go');
  let endShownAt = 0;
  let titleStart = null;   // what to do when the title screen is tapped
  let pickDone = null;     // what the squad screen's Go! button does
  let endBoard = null;     // what the end screen's Power Rankings button does
  let pickBoard = null;    // ...and the squad screen's
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
  endRankings.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (endBoard && performance.now() - endShownAt >= END_LOCK) { audio.play('click'); endBoard(); }
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
      else revealPasses(id, events);
    }
    requestAnimationFrame(frame);
  }

  // "Sol passed Wren!": the lines appear one after another, each with a chime (passing number 1 gets the fanfare).
  // events.onPass(pass) tells the game, for the aura and the confetti.
  function revealPasses(id, events) {
    [...passesBox.children].forEach((line, i) => setTimeout(() => {
      if (id !== run) return;
      const pass = events.passes ? events.passes.list[i] : null;
      line.classList.add('show');
      audio.play(pass && pass.big ? 'tier' : 'chime', { pitch: 1.1 + 0.12 * i });
      if (pass && events.onPass) events.onPass(pass);
    }, PASS_WAIT + i * PASS_GAP));
  }

  // kind: 'won' or 'lost'. "gains" is what the round did to each hero: [{ name, xp, before, after }].
  function showEnd(kind, gains = [], events = {}) {
    const ending = { ...ENDINGS[kind], ...(events.text || {}) };   // (a round of the chapter says its own words)
    gainsBox.innerHTML = gains.map((g) => `<div class="gain"><span class="gain-name">${g.name}</span><span class="gain-label">Power</span><span class="gain-power">${shortNumber(g.before)}</span><span class="gain-xp">+${shortNumber(g.xp)} XP</span></div>`).join('');
    const passes = events.passes || { list: [], more: 0 };
    passesBox.innerHTML = passes.list.map((p) => `<div class="pass${p.big ? ' big' : ''}">${p.big ? '★ ' : ''}${p.hero} passed ${p.rival}! <span class="pass-rank">Now #${p.rank}</span></div>`).join('') + (passes.more ? `<div class="pass">...and ${passes.more} more</div>` : '');
    endBoard = events.onRankings || null;
    endRankings.hidden = !endBoard;
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

  // The hero's name: a small button showing it; tapping it opens a text box. "naming" is { name(), set(text) } (main.js).
  const nameRow = document.getElementById('title-name-row');
  const renameButton = document.getElementById('title-rename');
  const renameForm = document.getElementById('title-rename-form');
  const renameInput = document.getElementById('title-rename-input');
  let naming = null;
  function commitName() {   // the typed name counts (and is cleaned up: set() says what it became)
    if (!naming || renameForm.hidden) return;
    naming.set(renameInput.value);
    renameForm.hidden = true;
    renameButton.hidden = false;
    document.getElementById('title-rename-name').textContent = naming.name();
  }
  nameRow.addEventListener('pointerdown', (event) => event.stopPropagation());   // a tap here does not start the game...
  nameRow.addEventListener('keydown', (event) => event.stopPropagation());       // ...and typing here is not a game key (WASD, Space)
  renameButton.addEventListener('click', () => {
    renameInput.value = naming.name();
    renameButton.hidden = true;
    renameForm.hidden = false;
    renameInput.focus();
    renameInput.select();
  });
  renameInput.addEventListener('input', () => { renameInput.value = renameInput.value.replace(NOT_NAME, ''); });
  renameForm.addEventListener('submit', (event) => { event.preventDefault(); commitName(); });

  // The title screen waits for a tap (or Space / Enter), then hides itself and starts the story.
  function startFromTitle() {
    if (titleScreen.hidden || !titleStart) return;
    commitName();
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
  // "onReset" (optional) shows a small "Start over" button for someone who has saved progress; "nameBox" (optional) lets
  // them change the hero's name.
  function showTitle(onStart, onReset = null, nameBox = null) {
    titleStart = onStart;
    titleScreen.hidden = false;
    naming = nameBox;
    nameRow.hidden = !naming;
    if (naming) {
      renameForm.hidden = true;
      renameButton.hidden = false;
      document.getElementById('title-rename-name').textContent = naming.name();
    }
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
  function showSquad({ heroes, chosen, onGo, onRankings = null, title = 'Choose your squad' }) {
    document.getElementById('squad-title').textContent = title;
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
    pickBoard = onRankings;
    squadRankings.hidden = !onRankings;
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
  squadRankings.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (pickBoard) { audio.play('click'); pickBoard(); }
  });

  // ---- The Power Rankings board ----

  // rows: the board (rankings.js): [{ rank, name, type, power, you }], or { gap: true } where rows were left out.
  function showRankings(rows, note = '') {
    document.getElementById('rankings-list').innerHTML = rows.map((row) => (row.gap ? '<li class="rank-gap" aria-hidden="true"></li>'
      : `<li class="rank-row${row.you ? ' you' : ''}" style="--c:${TYPE_COLORS[row.type].css}"><span class="rank-no">#${row.rank}</span><span class="rank-dot"></span><span class="rank-name">${row.name}</span><span class="rank-power">${shortNumber(row.power)}</span></li>`)).join('');
    document.getElementById('rankings-note').textContent = note;
    rankingsScreen.hidden = false;
  }
  function hideRankings() { rankingsScreen.hidden = true; }
  rankingsScreen.addEventListener('pointerdown', (event) => event.stopPropagation());   // nothing behind the board reacts to touches
  document.getElementById('rankings-back').addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    audio.play('click');
    hideRankings();
  });

  // A menu that is showing takes Space and Enter. Returns true if it used the key.
  function handleKey(event) {
    if (!rankingsScreen.hidden) {   // the board: Space, Enter and Escape close it
      event.preventDefault();
      hideRankings();
    } else if (event.code === 'Escape') {   // (Escape means nothing anywhere else)
      return false;
    } else if (!pickScreen.hidden) {   // on the squad screen, Space and Enter mean "Go!"
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

  // Is a full-screen menu showing? (Then the number keys and E are not for the game.)
  const open = () => !(titleScreen.hidden && pickScreen.hidden && endScreen.hidden && rankingsScreen.hidden);

  return { handleKey, open, api: { showTitle, hideTitle, showEnd, hideEnd, showSquad, showRankings, hideRankings } };
}
