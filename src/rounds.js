// rounds.js: how a round begins and ends. Who is in the squad and the squad screen, XP and Power, which heroes have
// joined, saving, and the walk-over before the closing conversation.
import { HEROES } from './heroes-data.js';
import { WALK_RADIUS } from './scene.js';
import { xpForKill, winBonus, enemyPowerFor, xpForPower } from './power.js';

const LESSON_XP = { climb: 12, move: 3, strike: 5, power: 7 };   // the prologue: Sol's Power climbs as Marlo teaches (to Power 10), so the numbers in the story are real

// pick: show the squad screen (the tests switch it off). onNewRound(): the game's own small resets (the hint, Pip's words).
export function createRounds({ progress, squad, waves, ui, story, marlo, ember, music, audio, player, powers, aura, pick, onNewRound }) {
  let ending = null;   // 'won', 'again' (a win after the first), or 'lost' while Marlo walks over before the closing conversation
  let endWait = 0;
  let roundXp = 0;     // XP from the Gloomlings beaten in this round so far
  let gains = [];      // what the last round did to each hero's Power: [{ kind, name, xp, before, after }]

  const enemyPower = (wave) => (progress.flat ? 10 : enemyPowerFor(progress.averagePower(squad.roster), wave));

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
  const defeat = (gloom) => { roundXp += xpForKill(gloom.power); };

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
    gains = progress.addXp(squad.roster, roundXp + (won ? winBonus(enemyPower(waves.total - 1)) : 0)).map((g) => ({ ...g, name: HEROES[g.kind].name }));
    roundXp = 0;
    if (won) {
      progress.winRound();
      progress.unlock(Object.keys(HEROES));
    }
    progress.store();
    refresh();
    ending = won ? (first ? 'won' : 'again') : 'lost';
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
    waves.start();
  }

  // "Play again" and "Try again": a fresh round (without the long introduction). Once more than one hero has joined,
  // the squad screen comes first.
  function restart() {
    ui.hideEnd();
    const unlocked = progress.unlocked;
    if (unlocked.length < 2 || !pick) { startRound(); return; }
    const heroes = unlocked.map((kind) => ({ kind, name: HEROES[kind].name, type: HEROES[kind].type, power: HEROES[kind].power.name }));
    ui.showSquad({ heroes, chosen: squad.roster.length > 1 ? squad.roster : ['ember', 'tide'], onGo: (kinds) => { chooseSquad(kinds); startRound(); } });
  }

  // The prologue is over: the first wave (or, for someone who has played before, the squad screen).
  function afterPrologue() {
    progress.mark('prologue');
    progress.store();
    if (progress.unlocked.length > 1 && pick) restart();
    else waves.start();
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
      story.scene({ won: 'win', again: 'winAgain', lost: 'lose' }[kind], () => ui.showEnd(kind === 'lost' ? 'lost' : 'won', gains, {
        onFlare: () => aura.flare(1.2),   // the power-up moment: the aura flares as each number arrives
        onTier: () => { aura.flare(3); powers.sparks.confetti(90); },   // and a new tier is a bigger celebration
      }));
    }
    if (story.waiting === 'arrive' && ember.arrived) story.resume();   // Ember is here: the talk carries on
  }

  // The words that story lines can use: "Power {power}" is Sol's Power now.
  const vars = () => { const power = progress.powerOf('sol'); return { power, next: power + 1 }; };

  return {
    update, defeat, end, restart, chooseSquad, reward, afterPrologue, arrive, enemyPower, refresh, vars,
    get ending() { return ending; },
    get gains() { return gains; },
  };
}
