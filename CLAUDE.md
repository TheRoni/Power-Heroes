# Power Heroes: Game Bible

Working title. The director (the project owner) can rename it at any time.

## Purpose
A bright, fast, 3D arena game for phone and computer. You pick a squad of
heroes, each with a superpower, and defend floating islands from waves of
creatures. Choosing the right heroes, combining their powers, and growing
their power without limit is what makes it rewarding.

## Feel
- Fun first. Short rounds (about 2 to 4 minutes) that make you want "one more".
- Powers must feel strong: big effects, a small screen shake, a short
  freeze-frame on hits, and a satisfying sound.
- **Power you can see:** every hero glows with an aura that grows as they get
  stronger. A strong hero should look strong at a glance.
- **Surprise:** rare events, hidden characters, secret aura forms, and power
  combos the player discovers by experimenting.
- **Colour comes back:** each round starts with the island washed-out and
  grey (the Glooms drain colour). It returns as Glooms are beaten, and a win
  ends in full colour and confetti.
- Clear and readable on a small phone screen. Bold colours, simple shapes.
- Toy-like, cheerful low-poly look (chunky shapes, soft lighting, no gore).
- Every round gives a reward, even a lost one.

## Story
**Setting:** the Sky Isles, floating islands kept aloft and colourful by the
**Heartlight**, a giant crystal at the centre of the world.

**Problem:** shadow creatures called **Glooms** are draining the colour from
each isle. Grey isles start to sink.

**Arc (5 chapters, one isle each):**
1. **Sunmeadow** (Nature isle). Meet Pip and the first three heroes.
   Boss: **General Bramble**.
2. **Tidecove** (Water isle). A rival hero, **Rook**, shows up and competes.
   Boss: **General Undertow**.
3. **Stormspire** (Storm isle). Rook is beaten by the Glooms; you save him and
   he joins the squad. Boss: **General Static**.
4. **Cinderpeak** (Fire isle). Clues that the Glooms are led by a fallen hero.
   Boss: **General Scorch**.
5. **The Heartlight.** The villain is **Nyx**, the very first hero. She chased
   power with no limit, alone, and it hollowed her out into Shadow. You beat
   her as a team, and she can be redeemed and join you.

**Theme:** power grows without limit, but it means most when it is shared.
Nyx went alone; your squad wins together.

**After the story:** **The Rift**, an endless mode where waves and power keep
climbing forever.

**Writing style:** short, warm, a bit funny. One or two lines between rounds.
Never long speeches.

## Core rules
- **Squad:** before a round, pick 3 heroes.
- **Control:** you control one hero at a time. The other two wait on the bench.
  Swap at any moment (short cooldown to stop spam).
- **Basic attack:** automatic. The active hero attacks the nearest Gloom in range.
- **Superpower:** one button. Each hero has one superpower with a recharge time.
  It auto-aims at the nearest Gloom in range (or straight ahead if none is
  close), so one thumb is enough on a phone.
- **Overdrive:** hits fill a meter. When full, tap the active hero's portrait
  (or press E). For a few seconds the hero's power number jumps, the aura
  flares, and the superpower recharges faster.
- **Combos:** some powers react with each other (see Combos). Swapping heroes
  to set them up is the heart of good play.
- **Waves:** each round has several waves of Glooms, then it ends with a win.
  Chapter finales have a boss.
- **Health:** each hero has their own health. A knocked-out hero sits out the
  rest of the round. If all three are knocked out, the round is lost.
- **Gentle failure:** a lost round still gives some experience. Retry is one tap.
- **Rewards:** experience (XP) raises Power. Wins unlock heroes and story.

## Power
- Every hero and enemy has a **Power number** (for example, "Power 340").
- **No known limit.** Power keeps rising with XP. Each new step needs a bit
  more XP than the last, so growth stays steady instead of exploding.
- Power raises health, attack, and superpower strength.
- Enemies have Power too. The game shows your Power next to theirs, so you
  can tell at a glance who is stronger.
- **Power-up moment:** after a round, the number counts up with a sound and
  the aura flares. Crossing an aura tier gets a bigger celebration.

### Aura tiers
| Tier | Power | Look |
|---|---|---|
| Spark | 0+ | faint glow at the feet |
| Glow | 100+ | soft light around the body |
| Blaze | 300+ | flickering aura in the type colour, rising particles |
| Surge | 1,000+ | glowing ring on the ground, hair or edges light up |
| Radiant | 3,000+ | bright halo, light trail when moving |
| ??? | hidden | secret forms the player discovers. Never listed in the game. |

### Awakening
At certain Power milestones, a hero's superpower **evolves** into a stronger
form with a new name and look (for example, Flame Wave becomes Phoenix Wave).
The milestones are not shown in advance. It should feel like a surprise.

## Types
**Main circle: Fire → Nature → Storm → Water → Fire**
- Fire burns Nature. Nature grounds Storm. Storm shocks Water. Water puts out Fire.
- Strong against: 1.5× damage, with a big "SUPER!" pop-up.
- Weak against: 0.67× damage, with a small grey "weak" pop-up.
- Everything else: normal damage.
- Colours: Fire red-orange, Water blue, Storm yellow, Nature green.

**Rare types (outside the circle):**
- **Light** (gold-white): a few secret heroes.
- **Shadow** (deep purple): Nyx and her strongest Glooms.
- Light and Shadow deal 1.5× damage to each other, and normal damage to the rest.

## Heroes
Planned roster: 15, unlocked over the story. **Bold** = in the first playable version.

| Hero | Type | Superpower | Style |
|---|---|---|---|
| **Ember** | Fire | **Flame Wave:** a cone of fire | area |
| Cinder | Fire | Meteor: aim a spot, it crashes down after a moment | aimed blast |
| Fuse | Fire | Bomb Toss: sticky bombs that pop in a chain | traps |
| **Tide** | Water | **Big Splash:** a ring wave that pushes Glooms away and soaks them | crowd control |
| Frost | Water | Ice Wall: blocks and slows Glooms | defence |
| Mist | Water | Fog Cloak: turns invisible; the next hit is huge | sneak |
| **Volt** | Storm | **Lightning Dash:** zips forward, shocking everything in the path | speed |
| Gale | Storm | Tornado: pulls nearby Glooms together | gather |
| Echo | Storm | Thunderclap: stuns everything nearby | stun |
| Thorn | Nature | Root Snare: vines hold Glooms in place | trap |
| Bloom | Nature | Healing Grove: heals the squad while standing in it | support |
| Boulder | Nature | Quake: the ground cracks in a line | heavy hitter |
| Rook | Storm | Copycat: copies the last superpower used | rival, joins in chapter 3 |
| Halo | Light | Sunburst: a blinding flash that hits the whole arena | secret |
| Nyx | Shadow | Eclipse: darkens the arena; her attacks grow stronger | joins after the finale |

## Combos
Shown with a name pop-up the first time they are found.
- **Soaked + lightning = Shock Chain:** lightning jumps between wet Glooms.
- **Vines + fire = Wildfire:** rooted Glooms burn longer.
- **Tornado + any blast = Vortex Blast:** gathered Glooms take bonus damage.
- **Ice + quake = Shatter:** frozen Glooms break for big damage.
- More to discover. Not all are listed in the game.

## Villains and enemies
**Glooms** are shadowy blob creatures tinted with their type colour.
- Gloomling: small and bouncy, a bit slower than Ember (speed 3 against her 7)
  so the first fights are gentle. (First playable version: Gloomlings only.)
- Brute: big, slow, tough.
- Spitter: attacks from range.
- Shielder: protects nearby Glooms until hit by the right type.
- **Golden Gloom (rare surprise):** shiny, runs away, drops lots of XP.

**Bosses:** General Bramble, General Undertow, General Static,
General Scorch, and Nyx. Each has a special attack pattern and a short taunt.

## Other characters (NPCs)
- **Pip:** a tiny floating light-sprite. Guide and comic relief. Gives tips
  and short story lines.
- **Keeper Marlo:** the old guardian of the Heartlight. Gives story and wisdom.
- **Colourfolk:** small villagers you rescue. Saved villagers cheer at the
  arena's edge, and sometimes throw healing fruit or power-ups into the fight.
- **Mystery visitor (surprise):** sometimes a hidden hero appears mid-round to
  help. Finish the round to recruit them.

## Home Village (open world)
A calm, free-roaming 3D village on its own floating isle. It is your clan's
home and the place between battles. No enemies, no timer.

- **Walk anywhere** with the same controls as battle.
- **Clan members:** randomly created characters, each with a name, type,
  Power number, aura, look, and personality. You can see who is strong at a
  glance by their aura.
- **They live their own lives:** training at dummies, sparring each other
  (with real power effects), fishing, cooking, chatting, napping, showing off.
  Simple daily rhythm: busier by day, campfire gathering at night.
- **Interact:** walk up and tap to talk (one short line), challenge to a
  friendly spar, or invite them as a guest teammate for a battle.
- **Your heroes live here too** and wander when not in your squad.
- **The village grows:** each isle you save brings new buildings, rescued
  Colourfolk, and stronger clan members.
- **Places:** training yard, sparring ring, campfire square, pond,
  Hero Hall (pick your squad and start battles), lookout tower (see the isles).
- **Surprises:** a wandering stranger with an unusually huge aura, a Golden
  Gloom sneaking through, clan members who Awaken in front of you.
- **Random characters** are built in code from mix-and-match parts (body
  shape, hair, hat, colours, accessories). No model files.
- **Phone performance:** about 20 to 30 clan members at once, and characters
  far from the camera use simpler shapes.

## Controls
- **Phone:** a joystick appears under the left thumb (left half of the
  screen) to move; its ring follows the thumb if you drag past the edge. Right side: a big
  Superpower button, plus 3 hero portraits to swap (tap the glowing active
  portrait for Overdrive).
- **Computer:** WASD or Arrow keys to move. Space = Superpower.
  1, 2, 3 = swap hero. E = Overdrive.
- No scrolling, no accidental zoom, works in portrait and landscape.

## Technical decisions
- **3D engine: Three.js.** Free, the most widely used web 3D library, many
  examples, small download, runs well on phones.
  - Alternatives considered: Babylon.js (more built in, but heavier to load);
    PlayCanvas (has a visual editor, but ties the project to its website).
- The Three.js file is saved inside the project (in `lib/`), so the game never
  needs the internet after loading. One fixed version, never auto-updated.
- Plain HTML, CSS, and JavaScript. No build tools, no installs, no paid services.
- All 3D models and auras are built from simple shapes and particles in code.
  No model files.
- The only image files are app icons (needed for the phone home screen).
- Sound is made in code with the Web Audio API. No audio files.
  Sound starts only after the first tap. A Mute button is always available.
- **Offline and installable:** a web app manifest and a service worker
  (a small script that saves the game's files on the device).
- **Saving progress:** Power, unlocks, and story progress are stored in the
  browser (localStorage). The game still works if storage is unavailable.
- **Hosting:** GitHub Pages (free), so the game opens on a phone from a web link.
- **Big numbers:** Power is shown in short form when large (12.4K, 3.1M).
- **Camera:** angled from above and behind, follows the hero smoothly. It
  always keeps about 12 x 11 units of ground in view, so heroes stay big on
  phones in both portrait and landscape.
- **Debug mode:** add `?debug` (or `#debug`) to the web address to show the frame rate.
  The automatic tests use it too.

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
  combos.js           power reactions
  aura.js             aura visuals by tier
  power.js            Power, XP, and growth maths
  gloom.js            enemies
  waves.js            wave timing and round end
  types.js            type circle and damage rules
  story-data.js       story lines, chapters, characters
  village.js          the Home Village world and places
  clan.js             clan member behaviour (daily activities)
  character-gen.js    random names, looks, types, Power
  ui.js               health bars, buttons, pop-ups, menus
  audio.js            synthesized sound
  save.js             saving progress
```

## Working rules for Claude
- Plan each stage first. Wait for the director's approval, then build.
- Every stage ends with something playable on a phone.
- Build small first: the first playable version stays tiny, and features are
  added one stage at a time.
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
- **Models (to protect the director's usage allowance):** Opus plans each
  stage and fixes hard problems. Sonnet builds from the written plan. Haiku
  handles only simple repetitive content (name lists, dialogue lines, data
  tables). The director switches models with `/model`.
