# Power Heroes: Game Bible

Working title. The director (the project owner) can rename it at any time.

## Purpose
A bright, fast, 3D arena game for phone and computer. You pick a squad of
heroes, each with a superpower, and defend small floating arenas from waves of
creatures. Choosing the right heroes, and using their powers at the right
moment, is what wins.

## Feel
- Fun first. Short rounds (about 2 to 4 minutes) that make you want "one more".
- Powers must feel strong: big visual effects, a small screen shake, a short
  freeze-frame on hits, and a satisfying sound.
- Clear and readable on a small phone screen. Bold colours, simple shapes.
- Toy-like, cheerful low-poly look (chunky shapes, soft lighting, no gore).
- Every round gives a reward, even a lost one.

## Story (light)
The Sky Isles are floating islands full of colour. Creatures called **Glooms**
are draining that colour away. The heroes defend one isle at a time. Story is
told in one or two short lines between rounds, never long speeches.

## Core rules
- **Squad:** before a round, pick 3 heroes.
- **Control:** you control one hero at a time. The other two wait on the bench.
  You can swap at any moment (short cooldown to stop spam).
- **Basic attack:** automatic. The active hero attacks the nearest Gloom in range.
- **Superpower:** one button. Each hero has one superpower with a recharge time.
- **Waves:** each round has several waves of Glooms, then it ends with a win.
- **Health:** each hero has their own health. A knocked-out hero sits out the
  rest of the round. If all three are knocked out, the round is lost.
- **Gentle failure:** a lost round still gives some experience. Retry is one tap.
- **Rewards:** wins give experience (XP), which raises hero power levels, and
  unlock new heroes.

## Types
Every hero and every Gloom has one type. Types beat each other in a circle:

**Fire → Nature → Storm → Water → Fire**

- Fire burns Nature. Nature grounds Storm. Storm shocks Water. Water puts out Fire.
- Strong against: 1.5× damage, with a big "SUPER!" pop-up.
- Weak against: 0.67× damage, with a small grey "weak" pop-up.
- Everything else: normal damage.
- The type colour is always visible: Fire red-orange, Water blue,
  Storm yellow, Nature green.

## Power levels
- Each hero has a **power level from 1 to 5**, shown as stars.
- XP from rounds raises the level of the heroes you used.
- Each level raises health, attack, and superpower strength.
- At level 5 the superpower gets a visible upgrade (for example, a bigger area).

## Heroes
Planned roster: 8 heroes, 2 per type. **Bold** = in the first playable version.

| Hero | Type | Superpower |
|---|---|---|
| **Ember** | Fire | **Flame Wave:** a cone of fire in front of her |
| Cinder | Fire | Meteor: aim a spot, a meteor crashes down after a moment |
| **Tide** | Water | **Big Splash:** a ring wave that pushes Glooms away |
| Frost | Water | Ice Wall: a wall that blocks and slows Glooms |
| **Volt** | Storm | **Lightning Dash:** zips forward, shocking everything in the path |
| Gale | Storm | Tornado: pulls nearby Glooms together |
| Thorn | Nature | Root Snare: vines hold Glooms in place |
| Bloom | Nature | Healing Grove: heals the squad while standing in it |

## Glooms (enemies)
- Shadowy blob creatures tinted with their type colour.
- Kinds (added over time): Gloomling (small, fast), Brute (big, slow, tough),
  Spitter (attacks from range). The first playable version has Gloomlings only.

## Controls
- **Phone:** virtual joystick (left thumb) to move. Right side: one big
  Superpower button, plus 3 hero portraits to swap.
- **Computer:** WASD or Arrow keys to move. Space = Superpower.
  1, 2, 3 = swap hero.
- No scrolling, no accidental zoom, works in portrait and landscape.

## Technical decisions
- **3D engine: Three.js.** Free, the most widely used web 3D library, many
  examples, small download, runs well on phones.
  - Alternatives considered: Babylon.js (more built in, but heavier to load);
    PlayCanvas (has a visual editor, but ties the project to its website).
- The Three.js file is saved inside the project (in `lib/`), so the game never
  needs the internet after loading. One fixed version, never auto-updated.
- Plain HTML, CSS, and JavaScript. No build tools, no installs, no paid services.
- All 3D models are built from simple shapes in code. No model files.
- The only image files are app icons (needed for the phone home screen).
- Sound is made in code with the Web Audio API. No audio files.
  Sound starts only after the first tap. A Mute button is always available.
- **Offline and installable:** a web app manifest and a service worker
  (a small script that saves the game's files on the device).
- **Saving progress:** hero levels and unlocks are stored in the browser
  (localStorage). The game still works if storage is unavailable.
- **Hosting:** GitHub Pages (free), so the game opens on a phone from a web link.

## Folder structure (planned)
```
index.html            the page that starts the game
style.css             layout and on-screen buttons
manifest.webmanifest  app name and icons for the home screen
sw.js                 offline support (service worker)
icons/                app icons
lib/                  Three.js (saved copy)
src/                  the game code, one job per file
  main.js             starts everything, runs the game loop
  scene.js            camera, lights, arena
  input.js            joystick, buttons, keyboard
  heroes-data.js      hero stats, types, powers (numbers live here)
  hero.js             hero model, movement, attacks
  powers.js           superpower effects
  gloom.js            enemies
  waves.js            wave timing and round end
  types.js            type circle and damage rules
  ui.js               health bars, buttons, pop-ups, menus
  audio.js            synthesized sound
  save.js             saving levels and unlocks
```

## Working rules for Claude
- Plan each stage first. Wait for the director's approval, then build.
- Every stage ends with something playable on a phone.
- One file per reply. Keep files under about 300 lines.
- Ask before creating a new file.
- Explain in plain English. Explain jargon the first time.
- Keep the director informed about anything that changes how the game plays or feels.
- Update `PROGRESS.md` after each completed step.
- Save to GitHub after each completed step.
- After each step, check the work against this document and list mismatches.
- Say clearly what was tested and what could not be tested.
- Large or repetitive coding may be handed to a smaller, faster model with
  clear instructions. Claude reviews the result and tells the director.
