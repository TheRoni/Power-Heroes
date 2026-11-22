# Power Heroes: Progress

## Status
- Done: game bible (`CLAUDE.md`), this roadmap, **Stage 1** (movement),
  **Stage 2** (the first fight) and **Stage 3** (the story begins), all built
  and tested.
- Director feedback on Stage 1: it works on the phone, but it is "just moving
  on land". True, that was the plan. Stage 2 is where the game starts.
- Director approved the Stage 2 plan and asked for one-line updates, work
  split into chunks (one chunk per reply), and a "next" prompt after each.
- Director feedback on Stage 2: "It works." Then: "Just keep developing the
  game. Add a story. Go." So the story was built next (Stage 3), ahead of the squad.
- **Stage 3 is finished and republished to the Claude test link.** All 124
  automatic checks pass (19 Stage 1, 78 Stage 2, 27 story), on the normal page
  and on the Claude-wrapped page.
- **Next: Stage 4, the squad** (Tide and Volt, hero swapping, types and
  "SUPER!" hits, Shock Chain), with story scenes for meeting them. The
  director said "Go", so it is built in chunks, one chunk per reply.
- Rule note: "one file per reply" was paused for Stages 1, 2 and 3. For Stage 2
  the director chose chunks instead (a few related files per reply).

## How we work on usage
- **Opus:** planning each stage, reviewing, fixing hard problems.
- **Sonnet:** building stages from the written plans below. (Recommended
  default for coding.)
- **Haiku:** only simple content (names, dialogue lines, data tables).
- To build a stage: switch the session to Sonnet and say "Build Stage N".

## Director to-do (one time)
- [ ] Turn on GitHub Pages. Not needed for testing now (the private Claude
  link covers that), but Stage 6 needs it for offline play and installing on
  the home screen. Open this link in a normal
  web browser (not the GitHub app) while signed in to GitHub:
  https://github.com/TheRoni/power-heroes/settings/pages
  Under "Build and deployment": Source = **Deploy from a branch**,
  Branch = **main** with folder **/ (root)**, then **Save**. After a few
  minutes the game will be at `https://theroni.github.io/power-heroes/`.
  If it says Pages needs a public repository, switch the repository to
  Public first (Settings → General → bottom "Danger Zone" → Change visibility).

## Claude test link (private, for phone testing)
- A private copy of the game is published in Claude as "Power Heroes" (find it
  with the Artifact list). Only the director can open it. For the frame rate,
  add `#debug` to the end of the link. The link is not saved here because this
  repository is public.
- **It must be republished after every stage.** Claude wraps the page in its
  own `<html>`, so the published page is `index.html` with the `<title>` and
  viewport moved to the top and the stylesheets (`style.css`, `story.css`)
  placed inline. The game files (`src/*.js`, `lib/three.module.min.js`) are
  published beside it. Run the same
  browser checks on the wrapped page before publishing.
- Limits inside Claude: no offline mode and no home-screen install (service
  workers are blocked there). That is why Stage 6 needs GitHub Pages.

## Roadmap
Each stage ends with something playable on a phone.

### Vertical slice (smallest fun version)
- [x] **Stage 1: Arena and movement.** A 3D floating arena. Ember runs
  around with joystick or keyboard. Camera follows. Judge: does moving feel good?
  Built and tested in a browser. **Still to do: the director tries it on a phone.**
  - [x] 1. `lib/three.module.min.js` (checksum matched npm; drew a 3D cube in a browser)
  - [x] 2. `index.html` (28 lines)
  - [x] 3. `style.css` (113 lines)
  - [x] 4. `src/scene.js` (276 lines)
  - [x] 5. `src/input.js` (107 lines)
  - [x] 6. `src/hero.js` (159 lines)
  - [x] 7. `src/main.js` (81 lines)
- [x] **Stage 2: First fight.** Gloomlings come in 3 waves. Auto-attack,
  health bars, Flame Wave superpower, hit effects, win and lose screens.
  - [x] Chunk 1: enemies that fight back (`heroes-data.js`, `gloom.js`, `ui.js`; health, hit flash and knock-out in `hero.js`). 23 checks pass.
  - [x] Chunk 2: fire power (`powers.js`: fireballs, Flame Wave, the button, sparks). 23 more checks pass.
  - [x] Chunk 3: waves, win and lose (`waves.js`; banner, end screens, retry). 21 more checks pass.
  - [x] Chunk 4: polish (screen shake, freeze-frame, colour returns, confetti). 12 more checks pass. Everything re-tested and the Claude test link republished.
- [x] **Stage 3: The story begins.** Pip, the guide, and Chapter 1 told in
  short conversations and one-liners. Built and tested (27 checks). New files:
  `story-data.js`, `story.js`, `pip.js`, `story.css`.
- [ ] **Stage 4: The squad.** Tide and Volt join (with story scenes). Hero
  swap, type damage with "SUPER!" pop-ups, first combo (Shock Chain).
- [ ] **Stage 5: Power and auras.** Power numbers, XP, power-up screen,
  auras Spark/Glow/Blaze, Overdrive, saving progress.
- [ ] **Stage 6: Sound and phone app.** Synthesized sound and music, Mute,
  title screen, icons, offline play, install to home screen.

### The adventure
- [ ] **Stage 7: Chapter 1, Sunmeadow.** 5 rounds, Thorn unlock, General
  Bramble boss, more story. (Pip and the story system already exist from Stage 3.)
- [ ] **Stage 8: Home Village, first version.** Walkable village,
  10 random clan members with auras, Hero Hall to start battles.
- [ ] **Stage 9: Village life.** Daily activities, day and night, talk,
  spar, guest teammates, up to 30 clan members.
- [ ] **Stage 10: More enemies and surprises.** Brute, Spitter, Shielder,
  Golden Gloom, mystery visitor, more combos.
- [ ] **Stage 11: Chapters 2 and 3.** Tidecove and Stormspire, Rook,
  more heroes, two bosses.
- [ ] **Stage 12: Chapters 4 and 5.** Cinderpeak and the Heartlight, Nyx,
  Awakening, Surge and Radiant auras.
- [ ] **Stage 13: The Rift and secrets.** Endless mode, hidden aura forms,
  Light heroes, final polish.

## Stage 1 plan (approved and built)
**Goal:** open the link on a phone, see a 3D island arena, move Ember around.

**New files (7):**
1. `lib/three.module.min.js`: a saved copy of Three.js, version 0.170.0,
   downloaded from the official npm package. Not written by hand.
2. `index.html`: the page. Viewport set to block zoom and scrolling.
   Loads `src/main.js` as a module (a JavaScript file that can load others).
   Contains the joystick area.
3. `style.css`: full-screen canvas, no scrolling, joystick look
   (a translucent circle with a smaller knob), safe-area padding for notches.
4. `src/main.js`: creates the renderer, scene, Ember, and input, then runs
   the game loop (update and draw every frame, using time since the last
   frame so speed is the same on every device). Resizes with the screen.
5. `src/scene.js`: sky-blue background, soft sun and fill light, a round
   floating island (grass top, rocky underside), a few rocks and trees at the
   edge, simple shadows. Camera angled from above and behind, following
   Ember smoothly. Zoomed so the arena fits both portrait and landscape.
6. `src/input.js`: one shared "move direction" (x, z) from two sources.
   Phone: joystick appears where the left thumb touches the left half of the
   screen. Keyboard: WASD and Arrow keys. Diagonals are not faster.
7. `src/hero.js`: Ember built from simple shapes (rounded body, head, eyes,
   flame-shaped hair in red-orange). Accelerates and slows smoothly, turns to
   face where she moves, small bounce while running, stays inside the island
   edge.

**Feel targets:** quick, responsive, a bit springy. No stutter on a phone.

**Tests:** load in a headless browser (a browser running without a screen)
at phone and desktop sizes, take screenshots, check there are no errors,
simulate key presses and confirm Ember moves. Cannot test: real touch feel
and real phone speed. The director tests those.

**What was tested (18 checks, all passed, no errors in the browser console):**
keyboard movement (WASD and arrows), top speed, slowing down, diagonals not
faster, island edge (cannot leave, slides along it), losing window focus,
resizing, touch joystick (left half only, analog strength, dead zone, lifting
the thumb), screenshots in phone portrait, phone landscape, and desktop.
Light on the graphics side: about 50 draw calls and 16,000 triangles.

**Changes and additions compared with the plan:**
- The camera keeps at least 12 x 11 units of ground in view on any screen
  shape (so Ember stays big on a phone), instead of fitting the whole island.
  It follows 80% of the way to Ember and drifts slightly ahead of her.
- The joystick ring follows the thumb if you drag past its edge, so changing
  direction is quick.
- Added a short hint at the bottom that fades after you start moving.
- Added `?debug` (or `#debug`) at the end of the web address to show the frame rate.
- Added scenery: floating rocks, drifting clouds, swaying grass, flowers.

## Stage 2 plan: First fight (approved, being built)
**Goal:** a short fight you can win or lose, with Ember's first superpower.
Stage 1 was only movement. This is where the game starts.

**What the player does:**
- Run around as now. Ember automatically throws a fireball at the nearest
  Gloomling in range (range 7, one every 0.7 s, 10 damage).
- Tap the big **Flame Wave** button (bottom right; Space on a keyboard): a cone
  of fire in front of her, 6 long and about 100 degrees wide, 45 damage, pushes
  Gloomlings back. It recharges in 5 s, shown as a ring on the button.
- Beat 3 waves of Gloomlings: 4, then 6, then 8. A banner shows "Wave 1" and so
  on. The next wave starts 1.5 s after the last Gloomling falls.
- Win: "Isle saved!" with a Play again button. Lose: "Knocked out" with a Try
  again button. One tap, full reset. No timer.

**Gloomlings:** small dark-violet blobs with glowing eyes. 30 health, speed 3
(Ember runs at 7, so she can always get away: a gentle first fight). They run
at Ember and bump her for 8 damage, then pause 1 s. A short flash warns before
each bump. They appear on the island rim, one every second.

**Ember:** 100 health. A bar floats over her head and another sits in the
corner of the screen. At 0 she is knocked out.

**Feel:**
- Gloomlings flash white when hit and burst into sparks of colour when they fall.
- Floating damage numbers.
- A small screen shake and a 60 ms freeze-frame when the Flame Wave lands, and a
  smaller shake when Ember is hit.
- The island starts washed-out and grey. Its colour returns with every Gloomling
  defeated (the story: Glooms drain colour).

**New files (5, need approval):**
1. `src/heroes-data.js`: Ember's numbers (health, attack, Flame Wave). All tuning lives here.
2. `src/gloom.js`: the Gloomling's look and behaviour.
3. `src/powers.js`: the fireball and the Flame Wave (look and damage).
4. `src/waves.js`: wave timing, spawning, win and lose.
5. `src/ui.js`: health bars, the Flame Wave button, banners, damage numbers, end screens.

**Existing files that change:** `index.html` (HUD elements), `style.css` (HUD
styling), `src/main.js` (connects everything, screen shake), `src/hero.js`
(health, hit flash, knocked-out pose).

**Tests (automatic, in a browser):** Gloomlings spawn and chase; fireballs
fire by themselves and do damage; Flame Wave hits only what is in the cone, has
a cooldown, and works from Space and from a touch on the button (without
steering the joystick); health bars; 3 waves end in the win screen; being
knocked out shows the lose screen; both retry buttons reset everything; no
errors. Cannot test: how hard or fun it feels on a real phone. The director
judges that. Afterwards the Claude test link is republished.

**Build notes (changes from the plan):**
- `scene.js` also changes a little: it shares the camera angle so floating
  health bars face the camera.
- The temporary spawner in `main.js` is gone: `waves.js` now runs the round
  (wave 1 after a 0.6 s pause, a 1.5 s break between waves, Gloomlings appear
  one a second on the rim and away from Ember).
- A win is shown 1.2 s after the last Gloomling falls, and "Knocked out" 1.5 s
  after Ember goes down. Both end screens ignore taps for the first 0.8 s, so a
  mashed Space or button cannot skip them. Space or Enter also press the button.
- Polish (chunk 4): a small camera shake when the Flame Wave goes off (0.12),
  when it lands (0.22) and when Ember is hit (0.16, bigger when she goes down).
  A 60 ms freeze-frame the first time a Flame Wave lands. The island starts
  under a grey veil (strength 0.6) that fades as Gloomlings are beaten, so a win
  ends in full colour. Confetti shoots up when a wave is cleared (a big burst
  after the last). With "reduce motion" switched on there is no shaking.
- Not in the plan, added: the confetti, and the "Get ready…" and
  "Wave 2 coming…" notes in the corner.
- Style note: `style.css` is at 295 lines. If it grows past about 300, trim it
  or ask the director before splitting it into a second file.
- The Flame Wave **auto-aims** at the nearest Gloomling within range (so one
  thumb is enough on a phone) and fires straight ahead if none is close.
- A fireball only taps a Gloomling (0.3 units). The Flame Wave shoves 3 units
  and stuns it briefly, which cancels a bump that was about to land.
- The on-screen hint moved up to make room for the Flame Wave button.
- Bug found by the tests and fixed: the button did not glow "ready" again.

## Stage 3: The story begins (director: "Add a story. Go.")
**Goal:** the game tells a story, in short, warm, funny lines.

**Built:**
- **Pip**, a glowing light-sprite guide, flies in and hovers beside Ember.
- **Opening:** the chapter title ("Sunmeadow", "Chapter 1"), then a 6-line
  conversation. The first wave starts when it ends. "Play again" skips it.
- **Bubbles:** one-liners from Pip during the fight: each wave, the first
  colour pop, the first bump, low health, a big Flame Wave, a cleared wave.
- **Win and knocked-out conversations** (5 and 3 lines) come before the end
  screens. The win scene hints at the bigger story: someone is leading the
  Glooms, and Tidecove is next.
- All the words are in `src/story-data.js`. Lines can differ on a phone and a
  computer (the last opening line explains the controls).

**New files (4):** `src/story-data.js`, `src/story.js`, `src/pip.js`, `story.css`.
`index.html` links the new stylesheet, and `input.js` gained `release()`.

**Roadmap change:** the story foundation moved here from the old Stage 6, so
every later stage number went up by one.

**Notes:**
- A conversation pauses the game. Space, Enter and any tap go on to the next
  line, and movement keys and the Flame Wave do nothing until it ends. The
  first press finishes a line, the next goes on. Presses in the first quarter
  second are ignored.
- Pip's wave comments wait 1.2 s so they do not land on the wave banner.
- The hint at the bottom steps aside while people talk.
- The test files were updated: they skip the opening (`story.skip()`), because
  it now comes first.

## Known problems and untested things
- **Not tested (needs a real phone):** how the touch controls feel, real
  frame rate, and whether pinch-zoom is fully blocked on iPhones.
- GitHub Pages is not turned on yet. The private Claude test link is used for
  phone testing instead (see above).
- The test browser has no graphics card, so its frame-rate numbers mean nothing.
- **Stage 3 not tested on a real phone:** how the conversation box and Pip's
  bubbles read on a small screen, and whether 48 letters a second feels right.
  There is no skip button yet: the opening plays once per visit.
- **Stage 2 not tested on a real phone:** how hard or fun the fight feels, how
  the Flame Wave button sits under a thumb, and the real frame rate. Every
  number that sets the difficulty is in `src/heroes-data.js`.
- Differences from `CLAUDE.md` that are still open: no sound yet (Stage 5);
  Gloomlings have no type yet, so there is no "SUPER!" (Stage 3); only one hero,
  so no swapping (Stage 3); no Power numbers, auras or Overdrive (Stage 4).
- Trees only grow along the far side of the island. Nothing blocks Ember
  except the island edge.
