# Power Heroes: Progress

## Status
- Done: game bible (`CLAUDE.md`), this roadmap, **Stage 1 built and tested** (all 7 files).
- **Now: waiting for the director to try Stage 1** and say how the movement feels.
- **Next: the Stage 2 plan (first fight)**, written for approval before any building.
- Rule note: "one file per reply" was paused for Stage 1 (the director said
  "up to you", and Claude chose to build the rest in one go to save usage).
  Ask the director again at the Stage 2 plan.

## How we work on usage
- **Opus:** planning each stage, reviewing, fixing hard problems.
- **Sonnet:** building stages from the written plans below. (Recommended
  default for coding.)
- **Haiku:** only simple content (names, dialogue lines, data tables).
- To build a stage: switch the session to Sonnet and say "Build Stage N".

## Director to-do (one time)
- [ ] Turn on GitHub Pages so the game opens on your phone. Not urgent:
  nothing is playable until Stage 1 is finished. Open this link in a normal
  web browser (not the GitHub app) while signed in to GitHub:
  https://github.com/TheRoni/power-heroes/settings/pages
  Under "Build and deployment": Source = **Deploy from a branch**,
  Branch = **main** with folder **/ (root)**, then **Save**. After a few
  minutes the game will be at `https://theroni.github.io/power-heroes/`.
  If it says Pages needs a public repository, switch the repository to
  Public first (Settings → General → bottom "Danger Zone" → Change visibility).

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
- [ ] **Stage 2: First fight.** Gloomlings come in 3 waves. Auto-attack,
  health bars, Flame Wave superpower, hit effects, win and lose screens.
- [ ] **Stage 3: The squad.** Tide and Volt join. Hero swap, type damage
  with "SUPER!" pop-ups, first combo (Shock Chain).
- [ ] **Stage 4: Power and auras.** Power numbers, XP, power-up screen,
  auras Spark/Glow/Blaze, Overdrive, saving progress.
- [ ] **Stage 5: Sound and phone app.** Synthesized sound and music, Mute,
  title screen, icons, offline play, install to home screen.

### The adventure
- [ ] **Stage 6: Chapter 1, Sunmeadow.** Pip, story lines, 5 rounds,
  Thorn unlock, General Bramble boss.
- [ ] **Stage 7: Home Village, first version.** Walkable village,
  10 random clan members with auras, Hero Hall to start battles.
- [ ] **Stage 8: Village life.** Daily activities, day and night, talk,
  spar, guest teammates, up to 30 clan members.
- [ ] **Stage 9: More enemies and surprises.** Brute, Spitter, Shielder,
  Golden Gloom, mystery visitor, more combos.
- [ ] **Stage 10: Chapters 2 and 3.** Tidecove and Stormspire, Rook,
  more heroes, two bosses.
- [ ] **Stage 11: Chapters 4 and 5.** Cinderpeak and the Heartlight, Nyx,
  Awakening, Surge and Radiant auras.
- [ ] **Stage 12: The Rift and secrets.** Endless mode, hidden aura forms,
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
- Added `?debug` (end of the web address) to show the frame rate.
- Added scenery: floating rocks, drifting clouds, swaying grass, flowers.

## Known problems and untested things
- **Not tested (needs a real phone):** how the touch controls feel, real
  frame rate, and whether pinch-zoom is fully blocked on iPhones.
- GitHub Pages is not turned on yet, so there is no web link to play from
  (see the director to-do above).
- The test browser has no graphics card, so its frame-rate numbers mean nothing.
- Trees only grow along the far side of the island. Nothing blocks Ember
  except the island edge.
