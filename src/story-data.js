// story-data.js: every word of the story. Change the text here to change what the characters say. (The full story is in STORY.md.)
// A scene is a list of steps. A line is [speaker, text]. The text can be { touch, keys } to say different things on a
// phone and on a computer, and a third item names a "cue": something that happens when the line appears.
// A step like { wait: 'move', hint } hands the game back to the player until they have done what the lesson asked.
// { wait: 'arrive' } (no hint) pauses the talk while a character runs in.
// { music: 'marlo', fade: 2 } changes the song (the names are in music-data.js) and carries straight on.
// Keep lines short, warm and a bit funny.

export const CHAPTER = { number: 1, name: 'Sunmeadow' };
export const PROLOGUE = { name: 'Prologue', subtitle: 'The Falling Star' };

export const SPEAKERS = {
  marlo: { name: 'Marlo', color: '#9fb8d8', pitch: 0.55 },   // pitch: how high the little typing blips sound
  sol: { name: 'Sol', color: '#fff3c8', pitch: 1 },
  pip: { name: 'Pip', color: '#ffd24a', pitch: 1.9 },
  ember: { name: 'Ember', color: '#ff7a3c', pitch: 1.3 },
};

// Scenes: conversations you tap through. The game waits while they play (except during a lesson).
export const SCENES = {
  prologue: [
    { music: 'marlo', fade: 2.5 },   // the falling star's song gives way to Marlo's theme
    ['marlo', 'Power 1. ...No. Look at it climb.', 'power-climb'],
    ['sol', '...Where am I?'],
    ['marlo', "Sunmeadow, in the Sky Isles. You fell out of the sky, so I'll call you Sol."],
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
    ['pip', 'Look at that! Power 9 for the newcomer!'],
    ['marlo', 'Last lesson. Every hero has one big power. Yours is Starburst.'],
    { wait: 'power', hint: {
      touch: 'Tap the star button to burst all three.',
      keys: 'Press Space to burst all three.',
    } },
    ['pip', 'Did you SEE that? Power 12!'],
    ['marlo', 'I saw. Faster than anyone I have taught.'],
    ['marlo', "Everyone in the Sky Isles chases Power. Most never ask what it's for."],
    ['sol', "What's it for?"],
    ['marlo', 'Ask me again at sunrise. Rest now, Sol. The Glooms come with the light.'],
  ],
  win: [
    ['pip', 'LOOK AT THAT! Sunmeadow is green again!'],
    ['marlo', 'Well fought, Sol. Your number jumped. I felt it from the hill.'],
    { wait: 'arrive' },   // Ember runs in from the edge of the island; her line comes when she gets there
    ['ember', "So YOU'RE the falling star. Power 120. You?"],
    ['sol', 'Fourteen? Maybe fifteen. It keeps changing.'],
    ['ember', 'Fifteen. I trained a whole year for my 120. ...Rematch tomorrow?'],
    ['pip', 'Ember is the brightest young hero on Sunmeadow. Also very easy to annoy.'],
    ['ember', "I'm not annoyed. I'm... competitive."],
    { music: 'lullaby', fade: 3 },   // the first time we hear the song that runs through the whole game
    ['marlo', 'Everyone here wants more. So did I. So did she.'],
    ['sol', 'Who is she?'],
    ['marlo', '...Another night, Sol. Tidecove is next.'],
  ],
  // Later rounds (Ember has already joined): no new introductions.
  winAgain: [
    { music: 'sunmeadow', fade: 2 },
    ['pip', 'Green again! I stopped worrying. Almost.'],
    ['marlo', 'Good. Rest your legs. The Glooms always come back.'],
  ],
  lose: [
    { music: 'marlo', fade: 2 },
    ['marlo', 'Up, Sol. Slowly. Heroes fall. Falling is the easy part.'],
    ['pip', 'You were SO close! Probably! Eighty percent close!'],
    ['marlo', 'Again. The island is still waiting.'],
  ],
};

// Bubbles: quick lines that float by while the fight carries on. One is picked at random.
// A plain line is Pip's. { who: 'marlo', text } is Marlo's.
export const BUBBLES = {
  wave1: ['Here they come! Try not to get bumped.', 'Incoming! Stay bouncy!', { who: 'marlo', text: 'Keep moving. A hero who stands still is a statue.' }],
  wave2: ['More of them! Your Power is climbing. I can feel it.', "Round two! Don't they have homes?", { who: 'marlo', text: "Good. Don't let the number go to your head." }],
  wave3: ['Final wave! Give it everything!', 'Last lot! Make it a big one!', { who: 'marlo', text: 'Everything, Sol. Then a little more.' }],
  cleared: ['Nice! Catch your breath.', 'See the colour creeping back? Keep going!', { who: 'marlo', text: 'Colour follows courage.' }],
  first: ["Look! A pop of colour! That's what you're fighting for."],
  hurt: ['Ouch! They pause after each bump. Use it!', 'Careful! Keep moving!', { who: 'marlo', text: 'Every hero gets hit. Heroes get up.' }],
  low: ["Sol, you're running low! Dodge, don't dare!", 'Health is low! Run in circles. Dramatic circles.'],
  big: ['Whoa! Three at once? Show-off!', 'That Starburst was at least Power 20!'],
};
