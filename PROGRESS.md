# Power Heroes: Progress

## Status
- Done: game bible (`CLAUDE.md`), story bible (`STORY.md`), this roadmap, and
  Stages 1 to 10 (movement, the first fight, the story begins, the Newcomer and
  Marlo, flute music and sound, the squad, Power and Rankings, the phone app,
  Chapter 1 with its boss and its campfire, and the Home Village). All
  automatic checks pass on the normal page and on the Claude test link, which was
  republished at the end of each stage.
- **Story redirect (director, on Opus):** you are now the **Newcomer**, a Light
  hero who falls from the sky; **Keeper Marlo** is your mentor and teaches the
  game; **Nyx is secretly his lost daughter Lyra**; he dies in Chapter 4; the
  music is **flute**, with sad flute for emotional scenes. Characters chase
  Power as eagerly as the player. Details: `STORY.md`.
- **Stage 10 is done (built on Sonnet):** the Home Village. After a round (or from the squad screen) the
  "Village" button takes you to a calm isle with no enemies: the Hero Hall, a training yard, a sparring ring,
  a pond, a campfire square, a lookout tower and a notice board, and 14 people of Marlo's old clan with auras,
  name tags ("Juno Power 150") and a line to say when you talk to them. The notice board shows the Power
  Rankings, which now list those real people; the Hall's door starts the next round. **Next: Stage 11, village
  life (day and night, what people do, spars, guests).**
- **Stage 9 was done before it (built on Sonnet):** Chapter 1 is five rounds with a story between them.
  The last round ends with General Bramble, a thorny boss (a fan of thorns, a root slam, a
  roar, Gloomlings called to help); beaten, he turns back into a tired young gardener and says
  his last words. Then the campfire: night falls, Marlo plays the flute, tells about Lyra, and
  the first memory shard rises out of the fire and shows little Lyra on her father's shoulders.
  **Next: Stage 10, the Home Village (the open-world part).**
- Stage 8 (name your hero, app icons, offline play) came before it; the only thing left there is
  the director's one-time step: turn on GitHub Pages (see the to-do below), so there is a real
  web address to install from. Stage 7 (Power, XP, auras, Overdrive, Rankings) and Stage 6
  (Tide and Volt, the squad, types, Shock Chain) came before that.
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
- `tests/test-stage1.js` (19 checks: movement), `tests/test-stage8.js` (13 checks: the
  manifest, the icons, the service worker, and playing with no internet, from a real
  local web address) and `tests/test-stage2.js` (everything else, in 30 groups: 1 enemies, 2 powers, 3 waves, 4 polish, 5 story, 6 heroes,
  7 Marlo, 8 prologue, 9 Ember and the closing scenes, 10 sound and the title
  screen, 11 music, 12 Tide and Volt, 13 the squad, 14 types, 15 Shock Chain,
  16 Power and saving, 17 auras and the power-up moment, 18 Overdrive, 19 Rankings,
  20 naming the hero, 21 the five rounds of Chapter 1, 22 General Bramble, 23 his last
  words and trying again, 24 the campfire and the memory shard, 25 the village, 26 the clan,
  27 talking and the Rankings board, 28 days and nights, 29 what the clan does,
  30 your own heroes in the village)
  A full run takes 10 to 25 minutes in the test browser.
- **After changing any game file, run `node tests/bump-sw.js`** (it rewrites the file
  list and the version in `sw.js`; without it a phone could keep an old copy of the
  game). `tests/test-stage8.js` fails if `sw.js` is out of date.
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
  (The address will be `https://theroni.github.io/Power-Heroes/` after a minute or two.)
- [ ] Then, on the phone, open that address once with internet (the game saves
  itself), and add it to the home screen: **Android (Chrome):** menu (three dots) >
  Install app (or Add to Home screen). **iPhone (Safari):** Share button > Add to
  Home Screen. After that it opens like an app, with the golden-star icon, and
  works with no internet. New versions arrive the next time it is opened online.

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
- [x] **Stage 7: Power, auras and Rankings.** Power numbers, XP, saving, the
  power-up moment, auras Spark to Radiant, Overdrive, a Power Rankings board.
  (Plan below.)

- [x] **Stage 8: Phone app.** Name entry, icons, a manifest and offline play (the one
  thing left is turning on GitHub Pages: see the director to-do). (Plan below.)
- [x] **Stage 9: Chapter 1, Sunmeadow, complete.** Five rounds, General Bramble, the
  campfire with Marlo's flute and the first memory shard. (Plan below.)
- [x] **Stage 10: Home Village, first version.** A walkable village with the Hero Hall, the
  clan (auras, name tags, a line each) and the Rankings board on the notice board. (Plan below.)

- [x] **Stage 11: Village life (chunks 1 to 3).** Day and night, what the clan does by day, your own heroes
  live there. (The friendly spar and guest teammates are still to do: see the plan below.)

### Next
- [ ] **Stage 12: More enemies and surprises.** Brute, Spitter, Shielder,
  Golden Gloom, mystery visitor, more combos. (Plan below.)

### The adventure
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
- **Chunk 2 build notes (DONE):** the full-screen menus moved from `ui.js` to the new
  `src/menus.js` (title, squad screen, end screen, and the Space/Enter keys they take).
  The end screen's **power-up moment**: each squad member's Power counts up (1.4 s,
  one after another) with rising ticks; when the number arrives the row flares and
  chimes; crossing an aura tier shows "GLOW!" (or BLAZE, SURGE, RADIANT), plays a
  fanfare, flares the aura and sets off confetti. New `src/aura.js`: the aura of the hero
  in play follows Power through the five tiers (a glow at the feet, soft body light, a
  flickering aura with rising sparks, a ground ring, a halo with a light trail when
  running) in the hero's type colour; at Surge and Radiant the hero's own edges
  light up (`hero.setGlow`). Tests: group 17 (8 checks).
- **Chunk 3: Overdrive.** Hits fill a meter; when it is full, tap the hero's
  name box (or press E): a few seconds of a boosted Power number, a flaring aura
  and a faster-recharging superpower.
- **Chunk 3 build notes (DONE):** new `src/overdrive.js`. One meter for the whole squad:
  a hit fills 3%, a superpower hit 6% (about 30 hits); it starts empty every round. When
  full, a pulsing "OVERDRIVE ready! Press E" button appears under the name box (tap it,
  press E, or tap the portrait of the hero in play). For 6 seconds the hero in play does
  1.5x damage, the superpower recharges 3x as fast, the aura flares, and the Power number in
  the corner jumps (Power 10 to 15) and turns gold, with an "OVERDRIVE!" banner, a rising
  sound and a small shake. A swap during Overdrive carries it to the new hero. It cannot
  start during a conversation, while it is already on, or when the hero in play is knocked
  out. Tests: group 18 (16 checks).
- **Chunk 4: Rankings, polish, republish.** A Power Rankings board (your heroes
  among Rook, Marlo's faded 9,999 and others), "You passed Rook!" moments, tests
  on both pages, republish.
- **Chunk 4 build notes (DONE):** new `src/rankings.js` (the other heroes of the isle:
  Rook 2,400 at number 1, then Fennel, Brindle, Marigold, Juno, Pebble and Wren down to 45;
  sorting with ties going to the rival; who a round passed; a short version of the board
  for small screens) and new `menus.css` (the board, the "passed" lines, and the end,
  squad and board screens on a phone held sideways: the end card puts its words left and
  its numbers right, the squad screen puts the heroes in one row). The board shows your
  heroes (marked "you") among the others, number 1 always, a dotted gap where rows are
  left out, and "Keeper Marlo is retired. His Power is still a faded 9,999." (he is not
  ranked). A "Power Rankings" button is on the end screen and the squad screen. After a
  round the end screen says "Sol passed Wren! Now #10" (up to three lines, one after
  another with a chime); passing Rook is a gold line, the fanfare and confetti. The number
  keys and E are ignored while a menu is on screen. Tests: group 19 (25 checks, including
  that every card fits on 390x844, 844x390, 667x375 and 568x320 screens).

## Stage 8 plan: the phone app
**Goal:** the game can be added to a phone's home screen, opens like an app and works
with no internet; and you can name your hero. (Hosting needs GitHub Pages: see the
director to-do. Until then the Claude test link covers phone testing, but it cannot
install or work offline.)
- **Chunk 1: Name entry.** A small "Name: Sol" button on the title screen opens a text
  box (1 to 10 letters, digits, spaces, apostrophes or hyphens; empty means Sol).
  The name is saved, and used everywhere: the corner, the conversations
  (`{name}` in `story-data.js`), the end screen, the Rankings board. Space and Enter
  type normally inside the box.
- **Chunk 2: Icons and the manifest.** New `icons/` (a golden star on a sky-blue
  rounded square: `icon.svg`, plus 192, 512, maskable 512 and 180 pixel PNGs and a
  favicon, drawn by a small script `tests/make-icons.js`), `manifest.webmanifest`
  (name, colours, full screen, any orientation) and the tags in `index.html`.
- **Chunk 3: Offline.** New `sw.js` (the service worker: saves every game file on first
  visit, then loads from the saved copy; a version number replaces the old copy) and
  `src/offline.js` (registers it, only on a real web address). A new test file
  `tests/test-stage8.js` serves the game from a real local address, goes offline and
  reloads; and checks that every game file is on the service worker's list.
- **Chunk 4: Republish and notes.** The Claude link, a short "how to install" note,
  mismatches list.
- New files (the director was told here): `src/offline.js`, `tests/test-stage8.js`,
  `tests/make-icons.js`, `tests/bump-sw.js`.
- **Chunk 1 build notes (DONE):** a small "Hero name: Sol · change" button on the title
  screen opens a text box (up to 10 letters, digits, spaces, apostrophes, hyphens, in any
  language; symbols are dropped as you type; empty means Sol). Space, W A S D and Enter
  type normally in the box; Enter or tapping anywhere else keeps the name. It is saved on its
  own (`powerheroes.save.name`), so "Start over" keeps it. The name is used in the corner,
  the end screen, the Rankings board and every conversation (`{name}` in `story-data.js`;
  Marlo says "so I'll call you Pat"). Tests: group 20 (18 checks).
- **Chunk 2 build notes (DONE):** `icons/` (a golden star with sparkles on a sky-blue square:
  `icon.svg` and `icon-maskable.svg` are the sources; `tests/make-icons.js` draws the PNGs:
  192, 512, a maskable 512, an Apple 180 and a favicon 32), `manifest.webmanifest`
  (app opens like an app, any orientation) and the tags in `index.html`.
- **Chunk 3 build notes (DONE):** `sw.js` saves every game file on the first visit
  (44 files) and loads from the saved copy after that (ignoring `?debug` and the like);
  when a game file changes `node tests/bump-sw.js` changes its version, and the new
  copy (taken straight from the server, not the browser's short-term copy) replaces
  the old one. `src/offline.js` registers it, only on a real web address (so not in the
  tests' fake address or inside the Claude link). `tests/test-stage8.js` checks the files and runs
  the game from a real local address: it goes offline, reloads, opens a new tab, and then
  plays a new version. **Not tested:** a real phone, installing, and GitHub Pages itself.

## Stage 9 plan: Chapter 1, Sunmeadow, complete
**Goal:** the game stops being one round on repeat. Chapter 1 is five rounds with a
story between them, ends with a boss, General Bramble, and then the campfire: Marlo plays
his flute, tells about Lyra, and you get the first memory shard. (Plan written on Sonnet from
`STORY.md`; the director can ask Opus to rework it.)
- **The five rounds.** 1 The Meadow (as now, then Ember arrives), 2 The Long Grass, 3 The
  Old Oak (4 waves), 4 Bramble's Shadow (4 waves, something big is seen in the distance), 5
  General Bramble. Each round has a short line from Marlo, Pip or Ember before it starts,
  a bit more Gloom Power than the last, and a "Round 2/5" note in the corner. The end screen says
  "Round 2 won!" with a "Next round" button (the squad screen comes first). Progress is saved:
  a returning player carries on from their round. After the chapter, "Keep playing" gives
  ordinary rounds to level up in until Chapter 2 exists.
- **General Bramble** (Nature, a tall hedge-knight of twisted vines, a leaf crown and thorn
  shoulders). He walks slowly towards you and has two attacks: a **thorn fan** (six thorns, dodge
  them) and a **root slam** (a red circle on the ground, one second of warning, then vines burst
  out). Under half health he speeds up, **summons Gloomlings** and taunts ("More! Give me
  more!"). Fire is super effective against him, Storm is weak (types matter). A wide boss health
  bar at the top. When beaten he is himself again, a tired young hero, and says one line ("She
  promised us more. We just wanted to matter.") before he fades into petals.
- **The campfire.** Night falls, a fire burns, the squad and Marlo sit round it. Marlo plays the
  flute (Lyra's Lullaby) and tells about her ("She used to fall asleep before the second verse.
  Every time."). The **first memory shard** floats up from the flute: a short picture of little
  Lyra on her father's shoulders. Then "Chapter 1 complete" and "Memory shard 1 of 5".
- **Chunks:** 1 rounds, progress and between-round scenes; 2 General Bramble (look, bar, moves,
  phases, defeat); 3 the boss round and its rewards; 4 the campfire, the shard and the chapter
  screen; 5 polish, tests on both pages, republish.
- **New files (the director is told here):** `src/chapters.js` (the five rounds as data),
  `src/boss.js` and `src/boss-model.js` (General Bramble), `src/flags.js` (the switches in
  the web address, moved out of `main.js` to keep it under 300 lines), `src/campfire.js`
  (the night scene and the shard).
- **Chunk 1 build notes (DONE):** `chapters.js` holds the five rounds (waves, types, Gloom
  Power 1.0 to 1.4 times, a line as the round starts, the end-screen words); round 1 is
  unchanged and later rounds are longer (18, 21, 28, 36 Gloomlings). The corner says
  "Round 2/5 · Wave 1/3 ..."; the first wave announces "Round 2 / The Long Grass"; Pip or Marlo
  say a line about the round; each round has its own closing conversation; the squad screen is
  headed "Round 3/5 · The Old Oak"; losing keeps you on the same round ("Try again"); after
  round 5 the rounds are ordinary again ("Keep playing"). The round is saved. Debug mode keeps
  the one repeating round unless `&chapter` is added. Tests: group 21 (28 checks).
- **Chunk 2 build notes (DONE):** `boss.js` + `boss-model.js`: General Bramble is a very big
  Nature enemy (40 Gloomlings' health, radius 1.6) that the rest of the game treats like any
  other. He rises from the ground, walks at you, and uses a fan of 7 thorns, a root slam (a red
  circle fills for 1.1 s, then vines burst: step out of it), and a bump if you stand next to him.
  Under half health he roars, moves faster, attacks more often and calls three Gloomlings at a
  time (up to six). Fire is super effective against him, Storm is weak. His health bar is in the
  top-left column (red-hot under half). When his health runs out he shakes, shrinks into the
  tired young gardener he was and stays there until his last words are done, then fades into
  leaves. New sounds: thorns, slam, roar, boss-down. Tests: group 22 (20 checks).
- **Chunk 3 build notes (DONE):** round 5 is two waves of Gloomlings and then the boss alone
  (banner "General Bramble / Boss!"). When he falls the Gloomlings he called vanish, he gives
  his last words ("She promised us more. We just wanted to matter."; Marlo: "...Matter. Yes. So did
  we all.") with sad flute, and the round is won. He is worth ten Gloomlings of XP. After the
  fight Pip and Marlo talk about him and Marlo promises the story "tonight, by the fire". If the
  hero's squad loses to him, "Try again" starts at the boss (not the two waves before).
  Tests: group 23 (9 checks).
- **Chunk 4 build notes (DONE):** `campfire.js`: after the closing talk of round 5 the screen goes
  dark, night falls over a campfire (logs, a ring of stones, flickering flames, a warm glow,
  floating sparks) with Sol, Marlo and Ember round it, Pip joking and Marlo playing the lullaby.
  He tells about Lyra ("She used to fall asleep before the second verse. Every time."); a memory
  shard rises out of the fire and shows a picture: a young father with a small girl on his
  shoulders, her arms up, a star in her hair; then it flies to Sol (the aura flares) and is
  saved (`progress.shards`). Day returns and the end screen says "Chapter 1 complete! Sunmeadow
  is green again. Memory shard 1 of 5." The campfire is made of shapes and runs by the real
  clock, so it moves while people talk. Tests: group 24 (13 checks).
- Tide and Volt still join after the first win for now (the story gates them in Stage 13);
  Ember and Sol are the Chapter 1 pair in the words.

## Stage 10 plan: the Home Village (first version)
**Goal:** the open-world part. A calm, walkable village on its own floating isle with no enemies and no
timer: Marlo's old clan lives there, you walk up and talk to them, you can see who is strong by their
aura, and the Hero Hall is where you pick your squad and start the next battle. (Plan written on
Sonnet from `CLAUDE.md`'s Home Village section; Stage 11 adds the daily life, sparring and guests.)
- **The place (chunk 1).** `src/village.js`: a bigger isle than the arena (radius about 18, the arena is
  hidden while you are in the village), with places: the **Hero Hall** (a chunky building with a
  glowing door), the **training yard** (dummies and posts), the **sparring ring** (a sand circle with
  ropes), the **pond** (water, reeds, lily pads), the **campfire square** (the fire from Chapter 1,
  logs and benches), the **lookout tower**, a **notice board** (the Power Rankings), trees, lamps and
  paths. The hero walks with the same controls; the walking limit and the camera follow the bigger isle.
  A "Village" button on the end screen takes you there; walking into the Hall's glowing door brings the
  squad screen and the next round.
- **The clan (chunks 2 and 3).** `src/character-gen.js` makes random clan members from mix-and-match parts
  (body shape, hair, hat, colours, accessory), each with a name, a type, a Power number and a personality;
  the clan is made once from a saved seed, so the same people are there every visit. `src/clan.js` puts
  about 14 of them in the village (each near a place), idling and wandering a little, with an aura that
  shows their Power at a glance and a small name tag with their Power when you are near. The Rankings
  board now lists these real people (Rook stays number 1), so you can go and find them.
- **Talk (chunk 3).** Walk up to someone and a "Talk" button appears: one short line from their
  personality (proud, shy, cheerful, sleepy, serious...). Their Power and rank are on the name tag.
- **The Hall and polish (chunk 4).** The Hall's door starts the next round; coming back from a round puts
  you at the Hall door; the village has its own calm music; tests on both pages; republish.
- **Chunk 1 build notes (DONE):** `village.js` + `village-props.js`: the Home Village isle (radius 18), the Hero
  Hall (red roof, two blue towers, a glowing door), the training yard (fence, three targets, a rack), the sparring
  ring (sand, ten posts, ropes, a bell), the pond (water, reeds, lily pads, a dock), the campfire square (the fire,
  four log benches), the lookout tower, the notice board, a ring of trees, lamps and paths. The hero walks out to
  16.4 and cannot walk through the Hall, the pond, the tower, the board or the fire. The big button becomes the
  action button: "Hero Hall" at the door (starts the next round: squad screen, then the arena) and "Rankings" at
  the board. A "Village" button on the end screen and the squad screen takes you there; you arrive a few steps
  from the Hall door, Pip says something, Marlo waits at the fire, and there is no grey veil. `title.js` (the
  title screen moved out of `menus.js`), `scene.js` (the arena's pieces are one group and `setMode`),
  `hero.js`/`squad.js` (`setBound`). Tests: group 25 (15 checks).
- **Chunk 2 build notes (DONE):** `character-gen.js` (names, types, Power, personalities and looks from a seed; the
  same seed makes the same clan; the six people of the Rankings come first with their old Power, then eight made up
  with Power from 20 to 600), `member-model.js` (a person built from their look: three body shapes, five hair styles,
  hats, a scarf, glasses or a satchel, outfit in their type colour; about 20 shapes each, no shadows, a soft blob
  under the feet, the fine details switched off when far away) and `clan.js` (14 people, each with a spot they like:
  the yard, the ring, the pond, the fire, the tower, the notice board; they stand, stroll a little, turn to look at
  you when you come close, and have an aura by Power: a glow at the feet, soft light from 100, a flickering flame from
  300; a small name tag "Juno Power 150" shows over the nearest three). The village with all its people is 136 draw
  calls. The clan's seed is saved (`progress.clanSeed`). Tests: group 26 (12 checks).
- **Chunk 3 build notes (DONE):** walk up to someone and the big button says "Talk"; pressing it makes them say one of
  three lines for their kind of person (proud, shy, cheerful, sleepy, serious, jokey, curious, grumpy; some say their
  own Power) in a bubble over their head. The Power Rankings now list the real people of the village (Rook stays
  number 1) and "Sol passed Jasper!" names them. A calm village song. Tests: group 27 (5 checks).
- **Phone speed:** members are drawn with few shapes (no shadows, a flat blob under them) and far ones
  are simpler; the aim is 14 now and 20 to 30 later.
- **New files:** `src/village.js`, `src/clan.js`, `src/character-gen.js` (all in the planned folder list).
  Changes to old files: `scene.js` (the arena's pieces are grouped so they can be hidden; a "mode" switch),
  `hero.js`/`squad.js` (the walking limit can change), `menus.js` (a "Village" button), `rankings.js`.

## Stage 11 plan: village life (daily rhythm, spars and guests)
**Goal:** the village feels alive: the day turns into night, the clan does things (train, spar, fish, cook,
chat, nap, show off), the night gathers everybody round the fire, you can spar with someone for fun, and
you can ask someone to fight beside you in a battle. (Plan written on Sonnet from `CLAUDE.md`.)
- **Chunk 1: day and night.** A day in the village lasts about 8 minutes: morning, day, dusk, night
  (`world.setNight`). The lamps glow at dusk, the Hall's windows light up, the stars come out. At dusk the
  clan walks to the fire square and sits round it; at night Marlo plays the lullaby there (the flute is
  already made); in the morning they spread out again. The time is saved only as "what time it was when you
  left", so you arrive at about the same time of day.
- **Chunk 2: what they do.** Each person has a daytime job that fits their kind: **train** (hit the targets,
  with little sparks of their type), **spar** (two people in the ring, quick dodging and a flash of their
  colours), **fish** (on the pond's dock, a rod and a float), **cook** (at the fire, a pot and steam), **chat**
  (two people face each other with little speech marks), **nap** (lying down, "Zzz"), **show off** (a pose
  and a flare of their aura). It takes a few shapes and some small animations, not a new system: `clan.js`
  gets a list of activities and a small timetable (busier by day).
- **Chunk 3: your heroes live here.** Ember, Tide and Volt (the ones not in your squad) wander about the
  village (and sit at the fire at night); you can talk to them too. Marlo stays near the fire.
- **Chunk 4: a friendly spar.** Next to someone, a second button "Spar" starts a short friendly fight with them
  in the ring: they fight with their own type and Power (a copy of the boss's moves, but small and gentle); you
  cannot lose, there is no timer, and you get a little XP. Beating them nudges their respect ("You're
  something, Newcomer").
- **Chunk 5: a guest teammate.** "Invite" asks someone to join your next battle as a guest: they fight beside
  you, with their own type and a simple attack, and leave after the round.
- **Chunk 6: polish, tests on both pages, republish.**
- New files likely: `src/activities.js` (what people do and how it looks), `src/guest.js` (a clan member in a
  battle); `clan.js` grows (or splits).
- **Chunk 1 build notes (DONE):** a day in the village lasts 420 seconds (`nightAt` in `village.js`: day, dusk,
  night, dawn; never fully dark, 0.85 at most). The sky and lights follow it, the lamps glow and the Hall's windows
  light up at night, the clan sets off for the fire a moment after one another at dusk and sits in two rings round
  it (a little lower, facing the flames), and stands up and walks home in the morning. The song changes to the
  lullaby at night and back to the village song by day. The time carries on where it was when you left, and the
  arena is always daylight. Tests: group 28 (9 checks).
- **Chunk 2 build notes (DONE):** `activities.js`: each person has a job that fits where they stand and does it
  for 10 to 18 seconds, then rests and strolls: three **train** at the yard (punches, sparks of their type), two
  **spar** in the ring (they lunge and sway in turn, sparks between them) with one who **cheers**, two **fish**
  (a rod, a pull and a splash), one **cooks** (a spoon), one **chats** (turns to the nearest, nods, a speech
  mark), one **naps** (lies down, "Zzz"), one **looks** through the telescope, one **reads** the board and one
  **shows off** (a pose and a flare). Everyone stops at night. Tests: group 29 (5 checks).
- **Chunk 3 build notes (DONE):** `residents.js`: your own heroes who are not in your squad (Ember, Tide, Volt)
  live in the village as the real heroes: each has favourite places (Ember the yard and the ring, Tide the pond,
  Volt the tower, the board and the road), strolls slowly between them, and goes to the fire at night. Walk up and
  "Talk": they answer in their own voice (three lines each). Which of them are there depends on the squad you
  took to your last battle. Tests: group 30 (8 checks).
- **Not built yet from this plan (moved to a later "village polish" step):** chunk 4, a friendly spar with
  someone, and chunk 5, inviting someone as a guest teammate for a battle. Both need a new kind of opponent or ally
  (a clan member in a fight), which is bigger than the rest of the village; the village is fully playable without
  them (and `CLAUDE.md` lists them under Home Village, so they stay on the to-do list).

## Stage 12 plan: more enemies and surprises
**Goal:** the fights stop being "the same blob": Brutes, Spitters, Shielders and a rare Golden Gloom, introduced
one at a time in Chapter 1's rounds with a tip from Pip. (Plan written on Sonnet from `CLAUDE.md`'s
"Villains and enemies".)
- **Enemy kinds, in one place.** `gloom.js` stays the little Gloomling; a new `src/enemies.js` makes the other kinds
  with the same shape (so darts, superpowers, combos and the waves treat them all alike). A wave's list can now say
  "nature:brute" (a type and a kind); plain "nature" still means a Gloomling.
- **Brute:** big, slow and tough (about 2x the size, 4x the health, half the speed); a bump hurts twice as much and
  shoves you back. Tip: hit it from far, keep moving.
- **Spitter:** small, fragile, keeps its distance and spits slow goo balls you can step out of. Tip: chase it or
  duck round the goo.
- **Shielder:** carries a glowing bubble that protects the Glooms near it (they take almost no damage) until it is
  hit by the type that beats its own; then the bubble pops. This is where swapping to the right hero really
  matters.
- **Golden Gloom (rare surprise):** shiny and fast, runs away from you, gives lots of XP and a shower of
  gold when caught; it escapes after 15 seconds. A banner and a word from Pip when it shows up.
- **Where they come in (Chapter 1):** round 3 adds Brutes, round 4 adds Spitters and one Shielder, round 5 has
  all of them with the boss; a Golden Gloom can appear in any round. The first time you meet each kind, Pip says
  what it is.
- **Not in this stage:** the mystery visitor (a hidden hero who helps mid-round) needs new heroes to recruit
  (Cinder, Frost, Gale, Thorn...), so it waits for them; and the combos Wildfire, Vortex Blast and Shatter need
  those heroes too.
- **Chunks:** 1 the framework and the Brute; 2 the Spitter; 3 the Shielder; 4 the Golden Gloom; 5 using them in
  the rounds, Pip's tips, tests on both pages, republish.
- **New file:** `src/enemies.js` (the new kinds). `heroes-data.js` gets the numbers (`ENEMIES`).

## Known problems and untested things
- **Not tested on a real phone:** touch feel, real frame rate, pinch-zoom on
  iPhones, how hard the fight is, how the conversation box reads, and whether
  48 letters a second feels right. Difficulty numbers are in `src/heroes-data.js`.
- The prologue has a Skip button; the win and knocked-out conversations do not
  (you tap through them). Closing the page mid-prologue replays it next visit
  (progress is saved when the prologue ends).
- **Nobody has listened to the sound yet.** Claude cannot hear: the effects and songs
  were checked by measuring (every note's pitch, timing, loudness, clicks, clipping),
  not by ear. The flute is made of plain tones, breath and an echo, so it will sound
  like a synthetic flute, not a real one. Please say what sounds wrong (too loud,
  too quiet, too sharp, annoying). The numbers to change are in `src/audio.js`
  (effects) and `src/music.js` / `src/music-data.js` (music).
- Sound only starts after the first tap on the title screen (a browser rule).
- Open differences from `CLAUDE.md`: no Awakenings or secret aura forms yet
  (Stages 14 and 15); only Gloomlings so far (no Brutes, Spitters, Shielders or the
  Golden Gloom: Stage 12); Rook is only a name on the Rankings board and the other
  11 heroes are not made yet; Ember, Tide and Volt all join after the first win (the
  story gates them in Stages 9 and 13); the other combos (Wildfire, Vortex Blast,
  Shatter) need heroes that come later; the squad screen asks "pick 3 of 4". The
  other heroes on the Rankings board have a fixed Power (they do not grow yet), and
  the squad screen will need scrolling once there are more than a handful of heroes.
- **Village, against `CLAUDE.md`:** done: the isle, the places (yard, ring, pond, campfire square, Hall,
  tower, notice board), random clan members with name, type, Power, aura, look and personality, walk
  up and talk, the Hall starts battles, 14 people at about 136 draw calls. Not yet (Stage 11): the clan's daily
  life, the day-and-night rhythm, sparring and guest teammates, your own heroes wandering about, the isles
  from the tower. Not planned yet: the village growing with each saved isle, Colourfolk, surprises. The aura
  is simpler than the heroes' (no rising sparks).
- Overdrive and the Rankings are tested by the automatic tests, not by hand on a
  phone: how long 6 seconds of Overdrive feels, and how fast the meter fills (about
  30 hits), are guesses (`src/overdrive.js`).
- `sky.js` and `prologue.js` are new files that were not in the first plan
  (the director was told in the Stage 4 plan).
- Trees only grow along the far side of the island.
