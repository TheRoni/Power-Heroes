// rounds.js: how a round begins and ends. Who is in the squad and the squad screen, XP and Power, which heroes have
// joined, saving, and the walk-over before the closing conversation.
import { HEROES } from './heroes-data.js';
import { WALK_RADIUS } from './scene.js';
import { xpForKill, winBonus, enemyPowerFor, xpForPower, shortNumber } from './power.js';
import { board, passes, windowed, MARLO } from './rankings.js';
import { CHAPTERS, ROUNDS, SHARDS } from './chapters.js';
import { DOOR, PLACES, VILLAGE_WALK } from './village.js';

const BOSS_XP = 10;   // a boss is worth this many Gloomlings
const LESSON_XP = { climb: 12, move: 3, strike: 5, power: 7 };   // the prologue: Sol's Power climbs as Marlo teaches (to Power 10), so the numbers in the story are real

// pick: show the squad screen (the tests switch it off). chapter: play the five rounds of Chapter 1 one after another (the
// tests keep the one round that repeats). onNewRound(): the game's own small resets (the hint, Pip's words).
export function createRounds({ progress, squad, waves, ui, story, marlo, ember, music, audio, player, powers, aura, campfire = null, village = null, pick, chapter = false, onNewRound }) {
  let ending = null;   // 'won', 'again' (a win after the first), or 'lost' while Marlo walks over before the closing conversation
  let endWait = 0;
  let roundXp = 0;     // XP from the Gloomlings beaten in this round so far
  let gains = [];      // what the last round did to each hero's Power: [{ kind, name, xp, before, after }]
  let passed = { list: [], more: 0 };   // who the last round passed on the Rankings board
  let closing = null;   // the closing conversation, when it is not the usual one for the ending (a round of the chapter)
  let wonText = null;   // what the end screen says after a round of the chapter
  let night = false;    // the chapter is won: the campfire comes before the end screen
  let retryAtBoss = false;   // a round lost to the boss is tried again at the boss (not the waves before him)

  // The round of Chapter 1 to play now (null: ordinary rounds, after the chapter is done or when it is switched off).
  const current = () => (chapter && progress.round <= ROUNDS ? CHAPTERS[1].rounds[progress.round - 1] : null);
  const enemyPower = (wave) => {
    if (progress.flat) return 10;
    const round = current();
    return Math.max(6, Math.round(enemyPowerFor(progress.averagePower(squad.roster), wave) * (round ? round.power : 1)));
  };

  // The Power Rankings: the heroes who have joined you, among the other heroes of the isle.
  const rows = () => board(progress.unlocked.map((kind) => ({ kind, name: HEROES[kind].name, type: HEROES[kind].type, power: progress.powerOf(kind) })));
  const showRankings = () => ui.showRankings(windowed(rows()), MARLO.note);

  // Everybody takes their Power (it changed after some XP), and the corner shows the hero in play.
  function refresh() {
    squad.refreshPowers();
    ui.setHeroPower(progress.powerOf(player.kind));
  }

  // Chooses the squad (the first one is in play) and shows their portraits.
  function chooseSquad(kinds) {
    squad.set(kinds);
    ui.setSquad(squad.roster.map((kind) => HEROES[kind]));
    ui.setHeroPower(progress.powerOf(player.kind));
  }

  // A Gloomling was beaten: its XP waits until the round is over.
  const defeat = (gloom) => { roundXp += xpForKill(gloom.power) * (gloom.boss ? BOSS_XP : 1); };

  // The prologue: Sol's Power climbs. 'skip' gives whatever the lessons would have (so skipping them is no loss).
  function reward(kind) {
    progress.addXp(['sol'], kind === 'skip' ? Math.max(0, xpForPower(10) - progress.xpOf('sol')) : LESSON_XP[kind] || 0);
    progress.store();
    refresh();
  }

  // The waves say the round is over ('won' or 'lost'): hand out the XP (a lost round still earns what was beaten),
  // let the others join after the first win, save, and send Marlo over for the closing conversation.
  function end(kind) {
    const won = kind === 'won';
    const first = progress.unlocked.length < 2;
    const round = current();   // (the round that was just played)
    const number = round ? progress.round : 0;
    gains = progress.addXp(squad.roster, roundXp + (won ? winBonus(enemyPower(waves.total - 1)) : 0)).map((g) => ({ ...g, name: HEROES[g.kind].name }));
    roundXp = 0;
    if (won) {
      progress.winRound();
      progress.unlock(Object.keys(HEROES));
      if (round) progress.advance(ROUNDS + 1);
    }
    progress.store();
    refresh();
    passed = passes(gains, rows());
    ending = won ? (first ? 'won' : 'again') : 'lost';
    closing = won && number > 1 ? `win${number}` : null;   // round 1 has the first-win conversation (Ember arrives); the others have their own
    wonText = won && round ? round.won : null;
    night = won && number === ROUNDS && Boolean(campfire);
    retryAtBoss = !won && waves.atBoss;
    endWait = 0;
    audio.play(won ? 'win' : 'lose');
    music.play('sunmeadow', 2.5);
    marlo.walkTo(player.position.x + 2.2, player.position.z - 1.3);
  }

  function startRound() {
    onNewRound();
    squad.refreshPowers();
    player.reset();
    powers.reset();
    ending = null;
    roundXp = 0;
    ember.leave();
    marlo.goHome();
    waves.start(current(), retryAtBoss);
    retryAtBoss = false;
  }

  // "Play again" and "Try again": a fresh round (without the long introduction). Once more than one hero has joined,
  // the squad screen comes first.
  function restart() {
    ui.hideEnd();
    const unlocked = progress.unlocked;
    if (unlocked.length < 2 || !pick) { startRound(); return; }
    const heroes = unlocked.map((kind) => ({ kind, name: HEROES[kind].name, type: HEROES[kind].type, power: HEROES[kind].power.name }));
    ui.showSquad({ heroes, chosen: squad.roster.length > 1 ? squad.roster : ['ember', 'tide'], onGo: (kinds) => { chooseSquad(kinds); startRound(); }, onRankings: showRankings, onVillage: village ? toVillage : null, title: label() ? `${label()} · ${current().name}` : undefined });
  }

  // The Home Village: a place to walk about between battles (village.js). The Hall's door brings you back to the next round.
  function toVillage() {
    ui.hideEnd();
    ui.hideSquad();
    waves.reset();   // no Gloomlings, no round
    ending = null;
    ember.leave();
    player.setBound(VILLAGE_WALK);
    village.enter();
    player.position.set(DOOR.x, 0, DOOR.z + 3.2);   // (a few steps from the door, so the big button has nothing to say yet)
    player.velocity.x = player.velocity.z = 0;
    player.face(0);
    marlo.position.set(PLACES.square.x - 2.8, 0, PLACES.square.z + 0.6);
    marlo.walkTo(marlo.position.x, marlo.position.z);
    music.play('sunmeadow', 1.5);
    story.say('village');
  }
  function fromVillage() {
    village.leave();
    player.setBound(WALK_RADIUS);
    marlo.goHome();
    restart();
  }
  // The big button in the village: the Hall's door starts the next round, the notice board shows the Power Rankings.
  function press() {
    const action = village.actionAt(player.position);
    if (action && action.id === 'hall') fromVillage();
    else if (action && action.id === 'board') showRankings();
  }

  // The prologue is over: the first wave (or, for someone who has played before, the squad screen).
  function afterPrologue() {
    progress.mark('prologue');
    progress.store();
    if (progress.unlocked.length > 1 && pick) restart();
    else waves.start(current());
  }

  // Ember runs in from the left edge and stops beside Sol (the win conversation waits for her).
  function arrive() {
    const p = player.position;
    ember.runIn(-WALK_RADIUS * 0.95, WALK_RADIUS * 0.25, p.x - 2, p.z + 0.8, p.x, p.z);
    audio.play('swoosh');
  }

  // Every frame, with the real time that passed.
  function update(dt) {
    if (ending && (marlo.arrived || (endWait += dt) > 8)) {   // Marlo has come over: the closing conversation begins
      const kind = ending;
      ending = null;
      const showEnd = () => ui.showEnd(kind === 'lost' ? 'lost' : 'won', gains, {
        text: wonText && wonText.shard ? { ...wonText, text: `${wonText.text} Memory shard ${progress.shards} of ${SHARDS}.` } : wonText,   // "Round 2 won!" and the like (nothing: the usual words)
        onFlare: () => aura.flare(1.2),   // the power-up moment: the aura flares as each number arrives
        onTier: () => { aura.flare(3); powers.sparks.confetti(90); },   // and a new tier is a bigger celebration
        passes: passed,   // "Sol passed Wren!" (and passing Rook, number 1, is a bigger celebration too)
        onPass: (pass) => { aura.flare(pass.big ? 3 : 1); if (pass.big) powers.sparks.confetti(90); },
        onRankings: showRankings,
        onVillage: village ? toVillage : null,
      });
      story.scene(closing || { won: 'win', again: 'winAgain', lost: 'lose' }[kind], night ? () => campfire.play(showEnd) : showEnd);   // (after the last round: the night at the campfire first)
    }
    if (story.waiting === 'arrive' && ember.arrived) story.resume();   // Ember is here: the talk carries on
  }

  const label = () => (current() ? `Round ${progress.round}/${ROUNDS}` : '');   // "Round 2/5" (nothing in an ordinary round)

  // The small note in the corner, such as "Round 2/5 · Wave 2/3 · 5 left · Gloom Power 120".
  function note() {
    const where = label() ? `${label()} · ` : '';
    if (waves.state === 'break') return where + (waves.wave === 1 ? 'Get ready…' : `Wave ${waves.wave} coming…`);
    if (waves.state === 'spawning' || waves.state === 'fighting') return `${where}Wave ${waves.wave}/${waves.total} · ${waves.remaining} left · Gloom Power ${shortNumber(waves.enemyPower)}`;
    return '';
  }

  // The words that story lines can use: "Power {power}" is Sol's Power now, and {name} is what the player called the hero.
  const vars = () => { const power = progress.powerOf('sol'); return { power, next: power + 1, name: progress.name }; };

  return {
    update, defeat, end, restart, chooseSquad, reward, afterPrologue, arrive, enemyPower, refresh, vars, rows, showRankings, label, note, toVillage, fromVillage, press,
    get round() { return current(); },   // the round of the chapter being played: { name, sizes, types, power, intro, won }, or null
    get ending() { return ending; },
    get gains() { return gains; },
  };
}
