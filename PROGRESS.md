# Power Heroes: Progress

## Status
- Done: game bible (`CLAUDE.md`), story bible (`STORY.md`), this roadmap, and
  Stages 1 to 3 (movement, the first fight, the story begins). All 124
  automatic checks pass on the normal page and on the Claude test link.
- **Story redirect (director, on Opus):** you are now the **Newcomer**, a Light
  hero who falls from the sky; **Keeper Marlo** is your mentor and teaches the
  game; **Nyx is secretly his lost daughter Lyra**; he dies in Chapter 4; the
  music is **flute**, with sad flute for emotional scenes. Characters chase
  Power as eagerly as the player. Details: `STORY.md`.
- **Stage 4 in progress (built on Sonnet, one chunk per reply):** chunk 1 is done
  (you play Sol; heroes are general). **Next: chunk 2, Keeper Marlo.**
  Until chunk 3 rewrites the words, the story text still talks to "Ember".

## How we work
- **Opus** plans stages and fixes hard problems. **Sonnet** builds from the
  written plans. **Haiku** only for simple repetitive content.
- The director wants short one-line updates, no long paragraphs, and a
  "say next" prompt after each chunk.
- Each chunk: build, test in a browser, check against `CLAUDE.md`, update this
  file, save to GitHub. At the end of a stage, republish the Claude test link.
- Files stay under about 300 lines. New files are listed in the stage plan.

## Tests (in `tests/`, not part of the game)
- `tests/test-stage1.js` (19 checks: movement) and `tests/test-stage2.js` (118
  checks in 6 groups: 1 enemies, 2 powers, 3 waves, 4 polish, 5 story, 6 heroes).
- Run from the project folder: `node tests/test-stage2.js <screenshot folder> [groups]`,
  for example `node tests/test-stage2.js /tmp/shots 3 5`. The game must be at
  `/home/user/power-heroes`. Playwright and Chromium come with the container.
- Add `ARTIFACT_PAGE=<page>` to test the Claude-wrapped page, built with
  `node tests/make-artifact-page.js <page>`.
- The tests skip the opening conversation (`story.skip()`); group 5 keeps it.
- The test browser has no graphics card: allow generous waits, and never trust
  its frame rate. Running several test files at once slows them down.
- When the story changes (Stage 4), update the story checks in group 5.

## Director to-do (one time)
- [ ] Turn on GitHub Pages (needed in Stage 8 for offline play and installing
  on the home screen; the Claude test link covers testing until then). In a
  normal web browser (not the GitHub app), signed in, open
  https://github.com/TheRoni/power-heroes/settings/pages
  and set Source = **Deploy from a branch**, Branch = **main**, folder
  **/ (root)**, then **Save**. If it says the repository must be public, tell Claude.

## Claude test link (private, for phone testing)
- Published in Claude as "Power Heroes" (find it with the Artifact list). Only
  the director can open it. Add `#debug` for the frame rate. The link is not
  saved here because this repository is public.
- **Republish after every stage:** build the page with
  `node tests/make-artifact-page.js <page>` (Claude wraps pages in its own
  `<html>`, so the script moves the title and viewport to the top and puts all
  stylesheets inline), then publish it with every `src/*.js` file and
  `lib/three.module.min.js` beside it. Test the wrapped page first.
- Limits inside Claude: no offline mode, no home-screen install.

## Roadmap
### Done
- [x] **Stage 1: Arena and movement.** Floating island, Ember runs with a
  joystick or keys, the camera follows.
- [x] **Stage 2: First fight.** Gloomlings in 3 waves, automatic fireballs,
  the Flame Wave button, health bars, win and knocked-out screens, screen
  shake, freeze-frame, the island's colour returning, confetti.
- [x] **Stage 3: The story begins.** Pip, tap-through conversations, speech
  bubbles, Chapter 1 told around the fight. (Its words get rewritten in Stage 4.)

### Next
- [ ] **Stage 4: The Newcomer and Marlo.** You play Sol; Marlo's prologue
  teaches the game; Ember meets you as a rival. (Plan below.)
- [ ] **Stage 5: Flute music and sound.** Lyra's Lullaby and the other cues,
  sound effects, a Mute button. (Plan below.)
- [ ] **Stage 6: The squad.** Ember, Tide and Volt join; hero swapping; types
  with "SUPER!" and "weak" pop-ups; the first combo (Shock Chain).
- [ ] **Stage 7: Power, auras and Rankings.** Power numbers, XP, the power-up
  moment, auras Spark to Blaze, Overdrive, a Power Rankings board, saving.
- [ ] **Stage 8: Phone app.** Title screen with name entry, icons, offline
  play, install to the home screen (needs GitHub Pages).

### The adventure
- [ ] **Stage 9: Chapter 1, Sunmeadow, complete.** 5 rounds, General Bramble,
  the campfire scene with Marlo's flute, the first memory shard.
- [ ] **Stage 10: Home Village, first version.** Marlo's old clan: a walkable
  village, clan members with auras, the Rankings board, the Hero Hall.
- [ ] **Stage 11: Village life.** Daily activities, day and night, talk,
  spar, guest teammates.
- [ ] **Stage 12: More enemies and surprises.** Brute, Spitter, Shielder,
  Golden Gloom, mystery visitor, more combos.
- [ ] **Stage 13: Chapters 2 and 3.** Tidecove (Tide, Rook) and Stormspire
  (Volt, saving Rook), two Generals, two shards.
- [ ] **Stage 14: Chapters 4 and 5.** Cinderpeak (Nyx appears, Marlo's death,
  the first Awakening), the Heartlight finale, the epilogue.
- [ ] **Stage 15: The Rift and secrets.** Endless mode, hidden aura forms.

## Stage 4 plan: the Newcomer and Marlo
**Goal:** you play **Sol**, the Newcomer. The game opens with the falling star
and Marlo's lessons (the tutorial), then the existing 3 waves become the start
of Chapter 1. Ember arrives at the end as a rival.

**Chunk 1: heroes made general, and Sol. DONE.**
- New `src/hero-models.js`: the look of each hero. Move Ember's look here
  (unchanged). Add **Sol**: white-and-gold outfit, short pale-gold hair in soft
  swept-back spikes, a glowing star mark on the chest, tiny light motes
  drifting from the hands. Same chibi size as Ember.
- `hero.js` becomes general: `createHero({ scene, bound, kind, ... })`, with its
  numbers from `HEROES[kind]` in `heroes-data.js` (Sol: health 100, Light).
- Attacks per hero: Sol throws white-gold light darts (Ember keeps fireballs).
  Sol's superpower is **Starburst**: a ring of light bursts out around Sol
  (radius 4.5, damage 40, shove 2.5, recharge 5 s). Keep the Flame Wave code
  for Ember. If `powers.js` would pass 300 lines, move the superpowers into a
  new `src/superpowers.js`.
- The power button shows the current hero's power (a star icon and
  "Starburst" for Sol).
- Update the tests to Sol; add Starburst checks (hits everything inside the
  ring, nothing outside, shoves outward, recharge).

**Chunk 1 build notes:**
- New files: `src/hero-models.js` (shared chibi body, plus Ember and Sol looks),
  `src/superpowers.js` (Flame Wave and Starburst). `powers.js` now holds only the
  automatic shots, the damage rules and the sparks.
- `heroes-data.js` has `HEROES` (sol, ember). Sol: Light, 100 health, light darts
  (9 damage, range 7, every 0.6 s), Starburst (40 damage, radius 4.5, shove 2.5,
  recharge 5 s). `main.js` picks the player with `PLAYER_KIND = 'sol'`.
- Renames: `castWave` is now `castPower`, `waveProgress`/`waveReady` are
  `powerProgress`/`powerReady`, `#wave-button` is `#power-button`, `__game.ember`
  is `__game.player`. The button's icon, label and colour follow the hero
  (`ui.setHero`). The tests were updated, plus a new group 6 (13 checks) for Sol.
- `tests/look-heroes.js` renders close-ups of any hero: `node tests/look-heroes.js <folder> sol ember`.

**Chunk 2: Keeper Marlo.**
- New `src/marlo.js`: tall, broad old warrior built from shapes: grey-blue
  cloak, white beard and bushy brows, a staff topped with a warm, flickering
  lantern (a glow sprite). Idle: leans on the staff, beard sways a little.
  He can walk to a spot. During waves he stands at the far edge of the arena,
  lantern raised.
- Pip floats by Marlo in scenes and by you in fights.

**Chunk 3: the Prologue (the tutorial) and the new words.**
- `story.js`: a scene line can wait for the player to do something, hiding the
  box until it is done: `wait: 'move'` (walk into a glowing ring), `'strike'`
  (beat one training Gloomling), `'power'` (use the superpower on a small group).
- `scene.js`: a night look for the prologue (dark blue sky, the grey veil
  stronger) and a falling star that streaks down with a flash; you rise from
  a small glowing crater; then morning returns for Chapter 1.
- Rewrite `src/story-data.js` from `STORY.md`: speakers Marlo, Sol, Pip, Ember.
  Prologue: the falling star, "Power 1. ...No. Look at it climb.", the three
  lessons, "Everyone in the Sky Isles chases Power. Most never ask what it's
  for." Chapter 1 bubbles: Marlo and Pip, with Power talk. Win scene: Ember
  arrives ("So YOU'RE the falling star. Power 120. You?"), Marlo: "Everyone
  here wants more. So did I. So did she." Lose scene: Marlo helps you up.
- Characters talk about Power the way players do: numbers, records, envy,
  excitement. Never preachy.
- Banners: "Prologue · The Falling Star", then "Chapter 1 · Sunmeadow".
  "Play again" skips the prologue.

**Chunk 4:** full test run on both pages, polish, republish, update docs.

**New files:** `src/hero-models.js`, `src/marlo.js` (and maybe `src/superpowers.js`).

## Stage 5 plan: flute music and sound (outline; detail it before building)
- New `src/audio.js` (sound engine, starts on the first tap, Mute button that
  remembers its setting), `src/music.js` (the flute voice and song player),
  `src/music-data.js` (melodies written as note lists).
- The flute: a soft sine tone with a quiet overtone, a puff of breath noise at
  the start of each note, gentle vibrato after a moment, soft fade in and out,
  a little echo.
- Songs first: The Falling Star, Sunmeadow, Battle, Marlo's Theme, Lyra's
  Lullaby, and the Lullaby in sorrow (for later emotional scenes). Each story
  scene can name its music in `story-data.js`.
- Sound effects: fireball, light dart, Starburst, Flame Wave, hits, "SUPER!",
  a defeat pop, a bump, a soft blip for the typing text, buttons.

## Known problems and untested things
- **Not tested on a real phone:** touch feel, real frame rate, pinch-zoom on
  iPhones, how hard the fight is, how the conversation box reads, and whether
  48 letters a second feels right. Difficulty numbers are in `src/heroes-data.js`.
- No skip button for conversations yet (the opening plays once per visit).
- Open differences from `CLAUDE.md`: no sound yet (Stage 5); you are still Ember
  until Stage 4; no types, swapping or combos (Stage 6); no Power numbers,
  auras or Overdrive (Stage 7).
- Trees only grow along the far side of the island.
