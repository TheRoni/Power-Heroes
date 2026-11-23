# Power Heroes: Progress

## Status
- Done: game bible (`CLAUDE.md`), story bible (`STORY.md`), this roadmap, and
  Stages 1 to 4 (movement, the first fight, the story begins, the Newcomer and
  Marlo). All 200 automatic checks pass on the normal page and on the Claude
  test link, which was republished at the end of Stage 4.
- **Story redirect (director, on Opus):** you are now the **Newcomer**, a Light
  hero who falls from the sky; **Keeper Marlo** is your mentor and teaches the
  game; **Nyx is secretly his lost daughter Lyra**; he dies in Chapter 4; the
  music is **flute**, with sad flute for emotional scenes. Characters chase
  Power as eagerly as the player. Details: `STORY.md`.
- **Stage 4 is done (built on Sonnet):** you play Sol, Keeper Marlo is in the game,
  the game opens with the falling star and three lessons, and Ember runs in
  when you win. **Next: Stage 5, flute music and sound.**

## How we work
- **Opus** plans stages and fixes hard problems. **Sonnet** builds from the
  written plans. **Haiku** only for simple repetitive content.
- The director wants short one-line updates, no long paragraphs, and a
  "say next" prompt after each chunk.
- Each chunk: build, test in a browser, check against `CLAUDE.md`, update this
  file, save to GitHub. At the end of a stage, republish the Claude test link.
- Files stay under about 300 lines. New files are listed in the stage plan.

## Tests (in `tests/`, not part of the game)
- `tests/test-stage1.js` (19 checks: movement) and `tests/test-stage2.js` (181
  checks in 9 groups: 1 enemies, 2 powers, 3 waves, 4 polish, 5 story, 6 heroes,
  7 Marlo, 8 prologue, 9 Ember and the closing scenes). A full run takes about
  15 minutes in the test browser.
- Run from the project folder: `node tests/test-stage2.js <screenshot folder> [groups]`,
  for example `node tests/test-stage2.js /tmp/shots 3 5`. The game must be at
  `/home/user/power-heroes`. Playwright and Chromium come with the container.
- Add `ARTIFACT_PAGE=<page>` to test the Claude-wrapped page, built with
  `node tests/make-artifact-page.js <page>`.
- The tests skip the prologue (`prologue.skip()`); groups 5 and 8 keep what they need of it.
- The test browser has no graphics card: allow generous waits, and never trust
  its frame rate. Running several test files at once slows them down. The test
  runner closes each game page when it opens the next one, for the same reason.
- When the story words change, update the story checks in group 5 (they read
  `story-data.js`, so most of them follow the words by themselves).

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
  bubbles, Chapter 1 told around the fight.
- [x] **Stage 4: The Newcomer and Marlo.** You play Sol; the game opens with a
  falling star and Marlo's three lessons; Ember runs in when you win. (Plan below.)

### Next
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

**Chunk 2: Keeper Marlo. DONE.**
- New `src/marlo.js`: tall, broad old warrior built from shapes: grey-blue
  cloak, white beard and bushy brows, a staff topped with a warm, flickering
  lantern (a glow sprite). Idle: leans on the staff, beard sways a little.
  He can walk to a spot. During waves he stands at the far edge of the arena,
  lantern raised.
- Pip floats by Marlo in scenes and by you in fights.

**Chunk 2 build notes:**
- New `src/marlo.js` (about 190 lines). He is taller and broader than the
  heroes: grey-blue cloak with a gold hem, steel shoulder guard, white beard and
  hair, bushy raised brows, a moustache, a crescent-and-star pin (the crest that
  matters in Chapter 2 to 4), and a staff with a flickering lantern that throws
  warm sparks. Standing, he breathes, his beard sways, and he turns to watch the hero.
- API: `walkTo(x, z)` (2.4 units a second, he stays there), `goHome()`,
  `raise(true/false)` (lantern up or down, eased), `arrived`, `atHome`, `lantern`.
- His post is at the north-west edge (`HOME` in `marlo.js`). At his post he
  shuffles aside when the hero walks into him. `main.js` raises his lantern
  while a wave is on.
- Pip hovers by Marlo (higher, above his shoulder) during a conversation when
  Marlo is within 5 units of the hero, otherwise by the hero. Chunk 3 will walk
  Marlo over to the hero for each scene.
- Small refactors: `createGlow` (in `pip.js`) is shared by Pip and Marlo's
  lantern; `hero-models.js` exports `lambert`, `part` and `starShape`; Pip's
  `update` takes a hover height.
- Tests: group 7 (13 checks). `tests/look-heroes.js` also draws Marlo:
  `node tests/look-heroes.js <folder> marlo`.

**Chunk 3: the Prologue (the tutorial) and the new words. DONE.**
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

**Chunk 3 build notes:**
- New `src/sky.js`: the sky as a gradient painted on a small canvas, day or night
  (deep blue, purple glow at the horizon, 70 twinkling stars). `scene.js` has
  `world.setNight(0 to 1, time)`: the sky, the two lights and the clouds' glow
  change together. `world.night` says how dark it is.
- New `src/prologue.js` (the opening, about 290 lines). Phases: dark (1.4 s),
  a star falls (2 s, with a spark trail), it lands (white flash, shake, spark
  burst, a glowing crater) and Sol climbs out, Marlo walks over, the
  conversation (with three lessons), the sunrise (3 s, title "Sunmeadow ·
  Chapter 1"), then the first wave. During the dark part the controls are off.
- Lessons: **walk** into a glowing ring; **strike**: one training Gloomling
  that the darts bring down by themselves; **power**: three training
  Gloomlings around Sol, the darts switched off, Starburst must hit two.
  A short hint box shows what to do (different words on a phone and a
  computer). Training Gloomlings are pale blue (`passive` in `gloom.js`): they
  never move, never bump and cannot be shoved.
- "Skip intro" button (top right) jumps straight to daylight and the first
  wave. "Play again" never replays the prologue. With "reduce motion" the
  landing is a soft glow, not a white flash, and nothing shakes.
- `story.js`: lines can be `{ wait, hint }` steps (lessons) and can name a cue
  (`'power-climb'`: Sol's Power number climbs above their head while Marlo
  reads it). Bubbles can be Marlo's (shown as "Marlo: ..." above him).
- `story-data.js` is rewritten: prologue (19 steps), win (Ember meets Sol,
  Marlo: "So did she."), lose (Marlo helps Sol up), and bubbles from Pip and Marlo.
- Small changes: `powers.autoFire` (darts can be switched off), `hero.setVisible`,
  `waves.progress` never goes below 0, the grey veil is not drawn at night and
  comes in with the sunrise.
- Tests: group 5 rewritten for the new story (reads `story-data.js`); new group 8
  (prologue: unit checks, the whole prologue played with the keys, both Skip
  cases, reduce motion, a phone).

**Chunk 4: Ember arrives, Marlo walks over, full test run, republish. DONE.**
- `hero.js` has `createGuest` (no new file): a hero the game steers. It is hidden
  until `runIn(...)`, runs to a spot (easing off near the end), turns to face Sol,
  hops for joy for 1.4 s, and has no health bar. `leave()` hides it. Ember is the
  first guest (`__game.ember`).
- The win and knocked-out scenes now start only when **Marlo has walked over**
  to Sol (the controls are off while he comes; 8 s safety limit). The win scene
  has a new step `{ wait: 'arrive' }` (no hint) before Ember's first line: the
  talk pauses, Ember runs in from the left edge, and her line comes when she
  stands beside Sol. Sol cannot walk or use Starburst while she runs in.
  She and Marlo stay beside Sol on the "Isle saved!" screen; "Play again"
  sends them away.
- `story.js`: a wait may have no hint.
- Tests: new group 9 (18 checks: the guest on its own, then the win and the
  knocked-out scenes played live). Older tests use `waitForClosing()` to put
  Marlo beside Sol so a closing scene starts at once.

**New files in Stage 4:** `src/hero-models.js`, `src/marlo.js`, `src/superpowers.js`,
`src/sky.js`, `src/prologue.js` (the last two were not in the first plan).

## Stage 5 plan: flute music and sound
**Goal:** the game gets a voice: small sound effects, and music built around a
flute (all made in code, no audio files). Chunks, one per step:

**Chunk 1: the sound engine, a Mute button, a "Tap to begin" screen, sound effects.**
- New `src/audio.js`: the sound engine. Sound starts only after the first tap
  or key (browsers insist). A Mute button (top right, also the M key) that
  remembers its setting. `audio.play('dart')` plays a named effect. Effects are
  small recipes of tones and noise: light dart, hit, Starburst bell, defeat pop,
  bump, typing blips (one pitch per speaker), click, chime, wave horn, spawn
  puff, the falling star whoosh and landing boom, the climbing Power notes.
- A very small title screen ("Power Heroes", "Tap to begin") so the first tap
  starts the sound and then the falling star. (Stage 8 grows it into the full title
  with name entry.) `?debug` skips it, so the tests are not slowed down.
- Effects are hooked in where things happen (shots, hits, hurt, waves, talk).
- Tests: every effect is rendered offline and measured (not silent, not
  clipping, sensible length); Mute; the first-tap rule; the title screen.

**Chunk 1 build notes (DONE):**
- `src/audio.js` (about 205 lines): the sound engine. It makes the browser's audio
  context only after the first tap, click or key (it waits for the browser to
  count the touch), so nothing plays before that. Everything passes through one
  master volume, a gentle compressor and a soft low-pass filter. 22 effects are
  small recipes (`SOUNDS`); `audio.play(name, { pitch, volume })`. Rules: a
  minimum gap between repeats of the same sound, at most 28 effect sounds at once.
  Mute: the button (top right) or the M key, remembered in the browser.
  The sound stops while the page is hidden.
- `QUIET` (a stand-in that plays nothing) is the default for every file that takes
  `audio`, so the unit tests need no sound.
- Title screen ("Power Heroes", "Tap to begin"): `ui.showTitle`. The prologue has
  a new `title` phase (night, Sol off stage, waiting) and `go()` starts it.
  `?debug` skips the title; `?debug&title` (or `#debug-title`) keeps it.
- Sounds are hooked in: darts, hits, defeats, Starburst (`powers.js`), bump and
  knocked out, wave horn, Gloomling puff, cleared, win and lose (`main.js`), typing
  blips with a pitch per speaker (`story.js`, `SPEAKERS.pitch`), the star's
  whoosh and landing boom, the climbing Power notes, lesson chime and sunrise
  (`prologue.js`), clicks, and a tick when Starburst has recharged (`ui.js`).
- `ui.setVeil` replaced the veil code in `main.js`.
- Tests: group 10 (26 checks): every effect rendered offline and measured, the
  first-tap rule, Mute and its memory, the hooks, the title screen on a computer and
  a phone.

**Chunk 2: the flute and the first songs.**
- New `src/music.js` (the flute voice and the song player) and
  `src/music-data.js` (songs written as note lists). The flute: a soft tone with
  a quiet overtone, a puff of breath at the start of each note, a gentle
  vibrato that arrives after a moment, soft fades, a little echo. Songs are
  scheduled a little ahead, loop, and cross-fade.
- Songs: The Falling Star (title and prologue), Sunmeadow (calm moments), Battle (waves).
- Tests: songs are rendered offline; the pitches and timing are checked.

**Chunk 3: Marlo's Theme, Lyra's Lullaby, scene music, polish.**
- Marlo's Theme (lessons), **Lyra's Lullaby** (verse one ends open: "she fell
  asleep before the second verse"; verse two is saved for the epilogue) and the
  Lullaby in sorrow (slow, minor, long silences). Scenes name their music in
  `story-data.js` (`{ music: 'marlo' }` steps). Win and knocked-out stingers.
- Full test run on both pages, republish the Claude link, update docs.

Later stages add the other cues from `STORY.md` (Nyx, Bloom) when their scenes exist.

## Known problems and untested things
- **Not tested on a real phone:** touch feel, real frame rate, pinch-zoom on
  iPhones, how hard the fight is, how the conversation box reads, and whether
  48 letters a second feels right. Difficulty numbers are in `src/heroes-data.js`.
- The prologue has a Skip button; the win and knocked-out conversations do not
  (you tap through them). Closing the page mid-prologue replays it next visit
  (saving comes in Stage 7).
- Open differences from `CLAUDE.md`: no sound yet (Stage 5); Ember only appears
  in the win scene (she joins your squad in Stage 6); no types, swapping or
  combos (Stage 6); no Power numbers, auras or Overdrive (Stage 7). The Power
  numbers Marlo and Pip say in the story are only words for now.
- `sky.js` and `prologue.js` are new files that were not in the first plan
  (the director was told in the Stage 4 plan).
- Trees only grow along the far side of the island.
