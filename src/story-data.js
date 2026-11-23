// story-data.js: every word of the story. Change the text here to change what the characters say. (The full story is in STORY.md.)
// A scene is a list of steps. A line is [speaker, text]. The text can be { touch, keys } to say different things on a
// phone and on a computer, and a third item names a "cue": something that happens when the line appears.
// A step like { wait: 'move', hint } hands the game back to the player until they have done what the lesson asked.
// { wait: 'arrive' } (no hint) pauses the talk while a character runs in.
// {power} in a line is Sol's Power right now ({next} is one more), and {name} is the name the player gave the hero (Sol).
// { music: 'marlo', fade: 2 } changes the song (the names are in music-data.js) and carries straight on.
// Keep lines short, warm and a bit funny.

export const CHAPTER = { number: 1, name: 'Sunmeadow' };
export const PROLOGUE = { name: 'Prologue', subtitle: 'The Falling Star' };

export const SPEAKERS = {
  marlo: { name: 'Marlo', color: '#9fb8d8', pitch: 0.55 },   // pitch: how high the little typing blips sound
  sol: { name: '{name}', color: '#fff3c8', pitch: 1 },
  pip: { name: 'Pip', color: '#ffd24a', pitch: 1.9 },
  ember: { name: 'Ember', color: '#ff7a3c', pitch: 1.3 },
  bramble: { name: 'General Bramble', color: '#8fd45a', pitch: 0.45 },
  gardener: { name: 'Bramble', color: '#c9e8a0', pitch: 0.95 },   // himself again, after the fight
};

// Scenes: conversations you tap through. The game waits while they play (except during a lesson).
export const SCENES = {
  prologue: [
    { music: 'marlo', fade: 2.5 },   // the falling star's song gives way to Marlo's theme
    ['marlo', 'Power 1. ...No. Look at it climb.', 'power-climb'],
    ['sol', '...Where am I?'],
    ['marlo', "Sunmeadow, in the Sky Isles. You fell out of the sky, so I'll call you {name}."],
    ['pip', "I'm Pip! Guide, translator, snack-finder. That's Marlo. Very old. Very wise. Very TALL."],
    ['marlo', 'Pip talks a lot. You will get used to it.'],
    ['marlo', 'Everyone here chases Power. The bigger your number, the brighter your glow.'],
    ['pip', "Mine is 3. Marlo's is 9,999. It's an old number. Don't ask."],
    ['marlo', 'Lesson one. Walk. Feet first, glory later.'],
    { wait: 'move', hint: {
      touch: 'Drag on the left side to walk into the glowing ring.',
      keys: 'Use W A S D (or the arrow keys) to walk into the glowing ring.',
    } },
    ['marlo', 'Good. Lesson two: hit something. Your light fires by itself, so just get close.'],
    { wait: 'strike', hint: 'Get close to the training Gloomling. Your light darts fire by themselves.' },
    ['pip', 'Look at that! Power {power} for the newcomer!'],
    ['marlo', 'Last lesson. Every hero has one big power. Yours is Starburst.'],
    { wait: 'power', hint: {
      touch: 'Tap the star button to burst all three.',
      keys: 'Press Space to burst all three.',
    } },
    ['pip', 'Did you SEE that? Power {power}!'],
    ['marlo', 'I saw. Faster than anyone I have taught.'],
    ['marlo', "Everyone in the Sky Isles chases Power. Most never ask what it's for."],
    ['sol', "What's it for?"],
    ['marlo', 'Ask me again at sunrise. Rest now, {name}. The Glooms come with the light.'],
  ],
  win: [
    ['pip', 'LOOK AT THAT! Sunmeadow is green again!'],
    ['marlo', 'Well fought, {name}. Your number jumped. I felt it from the hill.'],
    { wait: 'arrive' },   // Ember runs in from the edge of the island; her line comes when she gets there
    ['ember', "So YOU'RE the falling star. Power 120. You?"],
    ['sol', '{power}? Maybe {next}. It keeps changing.'],
    ['ember', '{power}?! I trained a whole year for my 120. ...Rematch tomorrow?'],
    ['pip', 'Ember is the brightest young hero on Sunmeadow. Also very easy to annoy.'],
    ['ember', "I'm not annoyed. I'm... competitive."],
    { music: 'lullaby', fade: 3 },   // the first time we hear the song that runs through the whole game
    ['marlo', 'Everyone here wants more. So did I. So did she.'],
    ['sol', 'Who is she?'],
    ['marlo', "...Not yet, {name}. When this isle is safe, I'll tell you."],
  ],
  // The closing conversations after rounds 2 to 5 of Chapter 1 (Ember has already joined: no new introductions).
  win2: [
    { music: 'sunmeadow', fade: 2 },
    ['pip', 'Another patch of green! Marlo, are we winning?'],
    ['marlo', 'We are not losing. At my age, that counts.'],
  ],
  win3: [
    { music: 'sunmeadow', fade: 2 },
    ['marlo', 'The oak is breathing again. Look at the leaves.'],
    ['pip', "I'm going to hug the tree."],
    ['marlo', 'Not now, Pip. Something is watching from the hedge.'],
  ],
  win4: [
    { music: 'marlo', fade: 2 },
    ['marlo', 'Did you feel that? The ground. Something big is walking this isle.'],
    ['pip', 'Big? How big? Marlo-sized? Please say Marlo-sized.'],
    ['marlo', 'Bigger. Rest, {name}. Tomorrow we meet him.'],
  ],
  // General Bramble, beaten and himself again: he says his last words and fades away (boss.js). The fight waits for them.
  bossDown: [
    { music: 'lullaby-sorrow', fade: 2.5 },
    ['gardener', '...The hedge. The meadow. I used to water these roots.'],
    ['gardener', 'She promised us more. We just wanted to matter.'],
    ['marlo', '...Matter. Yes. So did we all.'],
  ],
  // The night at the campfire after round 5: Marlo plays the flute, tells about Lyra, and a memory shard comes out of the fire.
  // (The words in quotes after a line are cues: they make the fire, the shard and the picture happen. See campfire.js.)
  campfire: [
    { music: 'lullaby', fade: 3 },
    ['pip', 'A fire! My favourite thing that is not a snack.'],
    ['ember', 'My fire is hotter.'],
    ['pip', 'Your fire is a personality.'],
    ['marlo', 'Quiet, both of you. I am going to play something.', 'flute'],
    ['marlo', 'I wrote it for my daughter. Lyra.'],
    ['sol', 'Where is she?'],
    ['marlo', 'I do not know. That is the whole of the story.'],
    ['marlo', 'She used to fall asleep before the second verse. Every time.', 'shard-rise'],
    ['pip', '...Marlo. Something is glowing.'],
    ['marlo', 'A memory shard. The fire gives them up when the song is true.', 'vision'],
    ['marlo', '...There she is. On my shoulders. She thought she could touch the stars.'],
    ['sol', "She's beautiful."],
    ['marlo', 'Take it, {name}. It is the first piece. There are more.', 'shard-take'],
    ['marlo', 'Now sleep. Tidecove is next.'],
  ],
  win5: [
    { music: 'sunmeadow', fade: 3 },
    ['pip', 'He turned back into a PERSON. A gardener! With a LEAF in his hair!'],
    ['marlo', 'Bramble. He tended these hedges, once. Before the Rift.'],
    ['sol', 'The Rift?'],
    ['marlo', "Tonight, {name}. By the fire. I promised you a story."],
  ],
  // Ordinary rounds, after the chapter (and in the tests): no new introductions.
  winAgain: [
    { music: 'sunmeadow', fade: 2 },
    ['pip', 'Green again! I stopped worrying. Almost.'],
    ['marlo', 'Good. Rest your legs. The Glooms always come back.'],
  ],
  lose: [
    { music: 'marlo', fade: 2 },
    ['marlo', 'Up, {name}. Slowly. Heroes fall. Falling is the easy part.'],
    ['pip', 'You were SO close! Probably! Eighty percent close!'],
    ['marlo', 'Again. The island is still waiting.'],
  ],
};

// What the people of the village say when you talk to them: three lines for each kind of person. {power} is their own Power.
export const CLAN_LINES = {
  proud: ["Power {power}. Not that I'm counting.", 'Stand back. My aura needs room.', 'Number one is only a matter of time.'],
  shy: ['Oh! Hello. Sorry. Hello.', "I'm only Power {power}. You can look, though.", 'Your glow is... very loud.'],
  cheerful: ['Great day for getting stronger!', 'Have you tried the pond? Very wet. Ten out of ten.', 'I love it when the grass is green!'],
  sleepy: ['...Was I standing? I was napping standing up.', 'Power is mostly resting. I read that somewhere.', 'Five more minutes. Or five more Power.'],
  serious: ['Training is a promise to your future self.', 'Power {power}. Slow and steady.', 'A good hero checks their boots.'],
  jokey: ['Why did the Gloom cross the meadow? To get hit!', 'My aura is called Mild Breeze. It tickles.', "I'd tell you a Power joke, but it's over 9,999."],
  curious: ['How do you glow like that? Does it tickle?', 'Did you really fall out of the sky?', 'Is it true Marlo plays the flute at night?'],
  grumpy: ['Hmph. Newcomers.', "Don't touch the dummies. They're mine.", 'Power {power}. I earned every number.'],
};

// What your own heroes say when they live in the village and you talk to them. {power} is their Power.
export const HERO_LINES = {
  ember: ["Power {power}. Rematch tomorrow. Or today. I'm free.", 'Training? Obviously. Come on.', 'My fire is hotter than your light. Fact.'],
  tide: ['The pond is calmer than the sea. I miss the sea.', 'Slow is smooth. Smooth is strong.', "You're loud. In a good way."],
  volt: ["I timed it: that's your fastest walk yet.", 'Records! I love records. Beat mine.', 'Faster. Faster. ...Not you. Me.'],
};

// Bubbles: quick lines that float by while the fight carries on. One is picked at random.
// A plain line is Pip's. { who: 'marlo', text } is Marlo's.
export const BUBBLES = {
  wave1: ['Here they come! Try not to get bumped.', 'Incoming! Stay bouncy!', { who: 'marlo', text: 'Keep moving. A hero who stands still is a statue.' }],
  wave2: ['More of them! Your Power is climbing. I can feel it.', "Round two! Don't they have homes?", { who: 'marlo', text: "Good. Don't let the number go to your head." }],
  wave4: ['Wave four! Is that even allowed?', { who: 'marlo', text: 'The last ones are the stubborn ones.' }],
  wave3: ['Final wave! Give it everything!', 'Last lot! Make it a big one!', { who: 'marlo', text: 'Everything, {name}. Then a little more.' }],
  round2: ['Round two! The grass is taller here. Things hide in it. Probably bugs. Possibly worse.', { who: 'marlo', text: 'Ember fights beside you now. A squad is stronger than a star.' }],
  round3: ['That old oak is looking grey. Poor tree. Defend the tree!', { who: 'marlo', text: 'The Glooms drink the colour from the oldest things first.' }],
  round4: ['Is it just me, or is the grass getting... pointy?', { who: 'marlo', text: 'Thorns. Something old is waking in the hedge.' }],
  round5: [{ who: 'marlo', text: 'Stay close, {name}. This one has a name.' }, 'A NAME? Names are worse than numbers!'],
  bramble_spawn: [{ who: 'bramble', text: 'Little light. You are in MY meadow.' }, { who: 'bramble', text: 'Every seed in this isle answers to me.' }],
  bramble_enrage: [{ who: 'bramble', text: 'More! Give me MORE!' }, { who: 'bramble', text: 'She promised me more than this!' }],
  village: ['Home! Smell that? Soup. Or Gloom. Mostly soup.', { who: 'marlo', text: 'Our clan lives here. Walk about. Nothing bites in the village.' }],
  cleared: ['Nice! Catch your breath.', 'See the colour creeping back? Keep going!', { who: 'marlo', text: 'Colour follows courage.' }],
  first: ["Look! A pop of colour! That's what you're fighting for."],
  hurt: ['Ouch! They pause after each bump. Use it!', 'Careful! Keep moving!', { who: 'marlo', text: 'Every hero gets hit. Heroes get up.' }],
  low: ["{name}, you're running low! Dodge, don't dare!", 'Health is low! Run in circles. Dramatic circles.'],
  big: ['Whoa! Three at once? Show-off!', 'That Starburst was at least Power 20!'],
  super: ['SUPER! Fire > Nature > Storm > Water > Fire. Swap to the right hero!'],
  swapTip: [{ touch: 'Tap a portrait to swap heroes!', keys: 'Press 1, 2 or 3 (or tap a portrait) to swap heroes!' }],
  combo: ['Wet plus lightning? That is a Shock Chain!'],
};
