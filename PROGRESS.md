# Power Heroes: Progress

## Status
- Done: game bible (`CLAUDE.md`), story bible (`STORY.md`), this roadmap, and
  Stages 1 to 6 (movement, the first fight, the story begins, the Newcomer and
  Marlo, flute music and sound, the squad). All 307 automatic checks pass on the
  normal page and on the Claude test link, which was republished at the end of Stage 6.
- **Story redirect (director, on Opus):** you are now the **Newcomer**, a Light
  hero who falls from the sky; **Keeper Marlo** is your mentor and teaches the
  game; **Nyx is secretly his lost daughter Lyra**; he dies in Chapter 4; the
  music is **flute**, with sad flute for emotional scenes. Characters chase
  Power as eagerly as the player. Details: `STORY.md`.
- **Stage 6 is done (built on Sonnet):** Tide and Volt, a squad of three with
  swapping (keys 1-3 or portraits), the squad screen, types (SUPER! and weak), and
  the first combo, Shock Chain. **Next: Stage 7, Power, auras and Rankings.**
- Stage 5 (title, sound, flute music) was done before it. Nobody has *listened* to
  it yet (see "Known problems").

## How we work
- **Opus** plans stages and fixes hard problems. **Sonnet** builds from the
  written plans. **Haiku** only for simple repetitive content.
- The director wants short one-line updates, no long paragraphs, and a
  "say next" prompt after each chunk.
- Each chunk: build, test in a browser, check against `CLAUDE.md`, update this
  file, save to GitHub. At the end of a stage, republish the Claude test link.
- Files stay under about 300 lines. New files are listed in the stage plan.

## Tests (in `tests/`, not part of the game)
- `tests/test-stage1.js` (19 checks: movement) and `tests/test-stage2.js` (288
  checks in 15 groups: 1 enemies, 2 powers, 3 waves, 4 polish, 5 story, 6 heroes,
  7 Marlo, 8 prologue, 9 Ember and the closing scenes, 10 sound and the title
  screen, 11 music, 12 Tide and Volt, 13 the squad, 14 types, 15 Shock Chain).
  A full run takes 10 to 25 minutes in the test browser.
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
- [x] **Stage 5: Flute music and sound.** A title screen, 22 sound effects, a Mute
  button, and flute music (six songs, including Lyra's Lullaby). (Plan below.)
- [x] **Stage 6: The squad.** Tide and Volt, a squad of three with swapping,
  types with SUPER! and weak, and the first combo (Shock Chain). (Plan below.)

### Next
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

**Chunk 2: the flute and the first songs. DONE.**
- New `src/music.js` (the flute voice and the song player) and
  `src/music-data.js` (songs written as note lists). The flute: a soft tone with
  a quiet overtone, a puff of breath at the start of each note, a gentle
  vibrato that arrives after a moment, soft fades, a little echo. Songs are
  scheduled a little ahead, loop, and cross-fade.
- Songs: The Falling Star (title and prologue), Sunmeadow (calm moments), Battle (waves).
- Tests: songs are rendered offline; the pitches and timing are checked.

**Chunk 2 build notes:**
- New `src/music.js` (the flute and other voices, the song player) and
  `src/music-data.js` (the songs as note lists: `"D5:2 F#5:1 r:1"`, chords with
  `+`, drum hits `x`, scale degrees for the lullaby). The loader checks that
  every track fills its loop exactly.
- Voices: **flute** (a soft tone with a quiet octave and a hint of the twelfth,
  a puff of breath at the start, a little scoop up into the note, a vibrato
  that grows in after a moment, a shared echo), music-box **chime**, **pluck**,
  **bass**, **pad**, **kick**, **snare**, **hat**.
- The player schedules 0.8 s ahead, loops, cross-fades between songs, and makes
  no new notes while Mute is on. `music.play(name, fadeSeconds)`.
- Songs: The Falling Star (title and the falling star), Sunmeadow (sunrise and
  after a win), Battle (every wave). The game picks them in `main.js` and `prologue.js`.
- A bug found by measuring: every envelope began one sample late, which made
  a tiny click on noise sounds. Every gain now starts silent.
- Loudness was measured and balanced: each song is about 0.04 RMS (the flute
  loudest), effects sit on top (the effects bus is 1.5x).
- Tests: group 11 renders every song offline and checks that each long flute
  note is at its written pitch (all exactly in tune), that the flute is silent
  before its first note, that songs loop, the loudness, and the real output of
  the playing game.

**Chunk 3: Marlo's Theme, Lyra's Lullaby, scene music. DONE.**
- Songs added: **Marlo's Theme** (warm, low flute, harp-like plucks and a soft
  pad, for the lessons and when he helps Sol up), **Lyra's Lullaby** (solo flute,
  D major, in 3; verse one ends OPEN on the fifth, then four bars of silence)
  and **Lullaby in sorrow** (the same tune in the minor, very slow, stopping in
  mid-phrase; not used by a scene yet, it waits for Marlo's farewell in Stage 14).
- Scenes choose their songs in `story-data.js` with `{ music: 'marlo', fade: 2.5 }`
  steps: the prologue conversation (Marlo's Theme), the win scene (the lullaby
  comes in at "So did she."), the knocked-out scene (Marlo's Theme).
- Tests: group 5 and group 11 cover the scene music and the lullaby's shape.

**Not done on purpose:** Nyx's and Bloom's songs (their scenes come in
Stages 13 and 14), and a title song of its own.
- Marlo's Theme (lessons), **Lyra's Lullaby** (verse one ends open: "she fell
  asleep before the second verse"; verse two is saved for the epilogue) and the
  Lullaby in sorrow (slow, minor, long silences). Scenes name their music in
  `story-data.js` (`{ music: 'marlo' }` steps). Win and knocked-out stingers.
- Full test run on both pages, republish the Claude link, update docs.

Later stages add the other cues from `STORY.md` (Nyx, Bloom) when their scenes exist.
**New files in Stage 5:** `src/audio.js`, `src/music.js` (both were in the first plan
of `CLAUDE.md`) and `src/music-data.js` (added to the list).

## Stage 6 plan: the squad, types and the first combo
**Goal:** before a round you pick 3 heroes; you control one at a time and swap
at any moment; types make some fights easier ("SUPER!") or harder ("weak");
and the first combo (Shock Chain) can be found by experimenting. The heroes
are Sol (Light), Ember (Fire), **Tide** (Water) and **Volt** (Storm).
This changes how the game plays, so each chunk ends playable and is reported.

**Chunk 1: Tide and Volt, and every hero with its own powers.**
- Looks in `hero-models.js`: Tide (blue, a wave of hair, a water-drop pendant,
  droplets that drift up), Volt (yellow, spiky hair, a bolt mark, little
  sparks). Numbers in `heroes-data.js`.
- Superpowers: **Big Splash** (a ring wave that pushes Gloomlings away and soaks
  them) and **Lightning Dash** (zips forward, shocking everything on the path).
  `superpowers.js` is near the size limit, so the new ones go in a second file.
- `powers.js` becomes one set of powers per hero (each with its own recharge)
  that share one pool of sparks.

**Chunk 1 build notes (DONE):**
- `heroes-data.js`: **Tide** (Water; water-bubble shots, 9 damage, every 0.65 s;
  Big Splash: ring of 5 units, 12 damage, shoves 4.5, soaks for 6 s, recharge 6 s)
  and **Volt** (Storm; fast bolts, 8 damage, every 0.5 s; Lightning Dash: zips 7
  units in 0.2 s, 40 damage to everything within 0.8 of the path, recharge 4.5 s).
- `hero-models.js`: Tide (blue spiky waves of hair, a water-drop pendant, an aqua
  collar and scarf, droplets rising around them) and Volt (yellow, jagged hair
  that twitches, a bolt on the chest, flickering sparks).
- `superpowers.js`: Starburst and Big Splash are now both "rings" (same code,
  different colours, Big Splash also soaks and sprays droplets); Lightning Dash is
  new. `distanceToSegment` moved here (shared with `powers.js`).
- `gloom.js`: `soak(seconds)` and `soaked` (a wet Gloomling shines blue, and it
  wears off); this is what the Shock Chain combo will look for.
- The power button has a water-drop and a bolt icon, and a colour for each power.
- Preview any hero without the squad: add `&hero=tide` (or volt, ember, sol) to
  `?debug`.
- Tests: group 12 (14 checks): both heroes' data and looks, their shots, Big
  Splash (reach, shove, soak, wears off), Lightning Dash (distance, path, aim),
  and the live game as Tide and as Volt.

**Chunk 2: the squad and swapping.**
- New `src/squad.js`: three heroes, one active. The other two wait on the
  bench (hidden; their portraits show their health). Swap with keys 1, 2, 3 or by
  tapping a portrait; a short cooldown stops spamming; a small puff marks the swap.
  Each hero has their own health; a knocked-out hero sits out; the round is lost
  when all three are down.
- A squad screen before the round (pick 3 of 4; Sol is always there).
- The corner hero name, health bar and power button follow the active hero.

**Chunk 2 build notes (DONE):**
- New `src/squad.js` (about 145 lines). All four heroes are made once, hidden. A
  squad of up to three is chosen with `squad.set(['sol', 'ember', 'tide'])`.
  `squad.player` and `squad.powers` look like one hero and one set of powers and
  always mean whoever is in play, so almost nothing else in the game changed.
- The whole squad stands in one place (`createHero({ shared })` makes every hero use
  the same position and speed), so a swap is instant and exact. A swap has a
  1.5 s cooldown, a puff in the hero's type colour and a sound.
- Every hero has their own health and their own power recharge (benched
  heroes recharge). Only the hero in play shoots. A knocked-out hero lies there for
  0.6 s, then the next one steps in; the round is lost when all three are out.
- Controls: keys 1, 2, 3, or tap a round portrait (above the power button). The
  portrait's ring is the hero's health; a gold dot means their power is ready;
  they go grey when knocked out and dim during the cooldown. The corner name and
  the power button follow the hero in play.
- The squad screen ("Choose your squad", Sol always comes, pick two more, Go!)
  comes with "Play again" / "Try again" once other heroes have joined. For now
  Ember, Tide and Volt all join after the first win (the story will gate them later).
  Space or Enter means Go!.
- Small moves: `puff` and `confetti` now live with the sparks (`powers.sparks`),
  `ui.setVeil`-style helpers for the portraits (`ui.setSquad`, `ui.setPortraits`,
  `ui.showSquad`), `TYPE_COLORS` in `heroes-data.js`, a `swap` sound.
- The how-to-play hint is only for the first round.
- Tests: group 13 (27 checks): the squad on its own (choosing, one place, swap
  rules and cooldown, own health and recharge, who shoots, knock-outs, losing,
  reset, the portraits' status) and the live game (the squad screen, picking,
  keys, taps, knock-outs, losing, Try again, a phone).

**Chunk 3: types.**
- New `src/types.js` (the circle Fire > Nature > Storm > Water > Fire, and
  Light and Shadow against each other): 1.5x and 0.67x damage; a big "SUPER!"
  pop-up and a small grey "weak". Gloomlings get a type (tinted in the type's
  colour); the waves mix types so choosing the right hero matters.

**Chunk 3 build notes (DONE):**
- New `src/types.js`: `effectiveness(attackerType, defenderType)` gives 1.5x
  ("super"), 0.67x ("weak") or 1x ("normal") from the circle (Fire > Nature >
  Storm > Water > Fire) and Light <-> Shadow; and `TYPE_COLORS` (moved here).
- Every hit goes through `powers.damage()`, so darts and superpowers are
  all multiplied (rounded). The hit event also says super/weak: a big red "SUPER!"
  (with a bright two-note sound) or a small grey "weak" (a dull thud) pops up.
- Gloomlings have a type (`createGloomling({ type })`), shown by body colour: Fire
  red, Water blue, Storm yellow, Nature green (plain ones stay purple; training
  dummies stay pale blue). Waves mix types (`WAVES.types`): wave 1 Nature and
  Fire, wave 2 adds Storm, wave 3 has all four. Sol (Light) never gets a bonus,
  so round one stays simple.
- The corner name has a dot in the hero's type colour.
- Later rounds (Ember has joined) use a short win scene (`winAgain`) instead of
  the introduction; the frame-rate box moved to `ui.js` (`showFps`, `fps`).
- Tests: group 14 (8 checks): the whole type table, the numbers, darts and superpowers,
  Gloomling colours, wave mixes, and the pop-ups live.

**Chunk 4 build notes (DONE):**
- New `src/combos.js`: **Shock Chain**. A Storm hit (Volt's bolts or Lightning Dash)
  on a *soaked* Gloomling (Big Splash soaks for 6 s) jumps to the nearest wet
  Gloomling within 4 units, then on to the next, up to three. Each takes 60% of the
  hit that started it (at least 6) and is shoved and stunned a little. A hit from a
  chain never starts another chain. The chain still goes on if the first one
  was defeated.
- Every `createPowers` has its own combo checker, called after every hit in
  `powers.damage()`. The game hears about it through `events.combo(name, count)`.
- The first time: a banner "Shock Chain!" ("A new combo!"), a screen shake and a
  word from Pip. After that a "Shock Chain!" pop-up over the Gloomling. A crackle sound.
- Pip's hints (once): the first SUPER! ("Fire > Nature > Storm > Water > Fire"),
  and at the start of the first round with a squad, how to swap.
- Tests: group 15 (6 checks): the chain rules, defeated first target, no chain from
  other types or dry Gloomlings, no endless chains, and the live game as Volt.

**Chunk 4 (original plan): the first combo, polish, republish.**
- New `src/combos.js`: **Soaked + lightning = Shock Chain** (Big Splash soaks;
  a Storm hit on a soaked Gloomling jumps to the wet ones nearby). A name pop-up
  the first time it is found. Tests, full run on both pages, republish, docs.

## Stage 7 plan: Power, auras and Rankings (the progression)
**Goal:** every hero and every Gloomling has a Power number; Power comes from XP,
has no limit, makes heroes stronger, shows as an aura, is saved, and you can see
how you rank. After a round the number counts up.
- **The numbers.** XP to go from Power k to k+1 is `2 + 0.2k` (each step costs a bit
  more than the last), so Power 12 needs 35 XP, 100 needs about 1,200, 300 about
  9,600 and 1,000 about 100,000. Stats in `heroes-data.js` are for Power 10: a
  hero's health and damage are multiplied by Power / 10. Gloomlings have Power too
  (the round's enemy Power is about 0.8, 1.0 and 1.2 times your squad's average
  in waves 1, 2 and 3, so fights stay fair) and give XP in proportion.
- **Chunk 1: Power and saving.** New `src/power.js` (the maths, tiers, big
  numbers like 12.4K, and the progress record) and `src/save.js` (the browser's
  storage, safe if it is missing). Stats scale with Power; Gloomlings get Power;
  XP for every Gloomling, a win bonus, and some for a lost round; the lessons give
  XP too (so the Power numbers in the story are real); the corner shows
  "Sol · Power 12" and the wave note shows the Gloom Power. Progress (XP, unlocked
  heroes, rounds won, what Pip has already said) is saved; `?debug` ignores saves
  (`&save` turns them on); "Start over" on the title screen.
- **Chunk 1 build notes (DONE):** `src/power.js` (XP and Power maths, tiers, short
  numbers, pay for kills and wins, the progress record), `src/save.js` (browser
  storage that may be missing), and `src/rounds.js` (new: how a round starts and
  ends, moved out of `main.js`: the squad screen, XP, unlocking, saving, the walk-over).
  Health and damage follow Power; Gloomlings have Power and give XP (30% of their
  Power, at least 1; a win adds 2x the last wave's Power; a lost round still pays for
  what was beaten). The prologue's lessons raise Sol's Power to 10 (1, 5, 6, 8, 10), so
  Pip and Ember say real numbers (`{power}` in story lines). Ember joins at Power
  120, Tide 90, Volt 100. The corner says "Sol  Power 10"; the wave note says
  "Gloom Power 8"; the end screen says "Sol: Power 10 → 17 (+36 XP)". Progress is
  saved (XP, who has joined, wins, what Pip has said); a returning player skips the
  prologue; "Start over" is on the title screen. Debug mode keeps everyone at Power 10
  and forgets (`&power` and `&save` turn them on), so the older tests are unchanged.
  Tests: group 16 (25 checks).
- **Chunk 2: the power-up moment and auras.** The end screen counts each squad
  member's Power up with a ticking sound; crossing a tier ("Glow!") is a bigger
  celebration. New `src/aura.js`: Spark (faint glow at the feet), Glow (soft light),
  Blaze (flickering aura in the type colour, rising sparks), Surge (a glowing ring
  on the ground, brighter edges), Radiant (a halo and a light trail).
- **Chunk 3: Overdrive.** Hits fill a meter; when it is full, tap the hero's
  name box (or press E): a few seconds of a boosted Power number, a flaring aura
  and a faster-recharging superpower.
- **Chunk 4: Rankings, polish, republish.** A Power Rankings board (your heroes
  among Rook, Marlo's faded 9,999 and others), "You passed Rook!" moments, tests
  on both pages, republish.

## Known problems and untested things
- **Not tested on a real phone:** touch feel, real frame rate, pinch-zoom on
  iPhones, how hard the fight is, how the conversation box reads, and whether
  48 letters a second feels right. Difficulty numbers are in `src/heroes-data.js`.
- The prologue has a Skip button; the win and knocked-out conversations do not
  (you tap through them). Closing the page mid-prologue replays it next visit
  (saving comes in Stage 7).
- **Nobody has listened to the sound yet.** Claude cannot hear: the effects and songs
  were checked by measuring (every note's pitch, timing, loudness, clicks, clipping),
  not by ear. The flute is made of plain tones, breath and an echo, so it will sound
  like a synthetic flute, not a real one. Please say what sounds wrong (too loud,
  too quiet, too sharp, annoying). The numbers to change are in `src/audio.js`
  (effects) and `src/music.js` / `src/music-data.js` (music).
- Sound only starts after the first tap on the title screen (a browser rule).
- Open differences from `CLAUDE.md`: no Power numbers, auras or Overdrive
  (Stage 7); only Gloomlings so far (no Brutes, Spitters, Shielders or the
  Golden Gloom: Stage 12); Rook and the other 11 heroes are not made yet;
  Ember, Tide and Volt all join after the first win (the story gates them in
  Stages 9 and 13); the other combos (Wildfire, Vortex Blast, Shatter) need heroes
  that come later; the squad screen asks "pick 3 of 4" and nothing is saved yet (Stage 7). The Power
  numbers Marlo and Pip say in the story are only words for now.
- `sky.js` and `prologue.js` are new files that were not in the first plan
  (the director was told in the Stage 4 plan).
- Trees only grow along the far side of the island.
