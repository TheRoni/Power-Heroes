// story-data.js: every word of the story. Change the text here to change what the characters say.
// A scene line is [speaker, text]. The text can be { touch, keys } to say different things on a phone and on a computer.
// Keep lines short, warm and a bit funny.

export const CHAPTER = { number: 1, name: 'Sunmeadow' };

export const SPEAKERS = {
  pip: { name: 'Pip', color: '#ffd24a' },
  ember: { name: 'Ember', color: '#ff7a3c' },
};

// Scenes: conversations you tap through. The game waits while they play.
export const SCENES = {
  intro: [
    ['pip', 'Ember! Over here! Up here! Yes, the tiny glowing one!'],
    ['pip', 'Welcome to Sunmeadow. Greenest isle in the sky. Well. It was.'],
    ['pip', 'The Glooms came and started drinking the colour. Look at it. Grey as a soggy sock.'],
    ['ember', 'They picked the wrong isle.'],
    ['pip', "That's the spirit! Grey isles sink, you know. Splash. Very rude."],
    ['pip', {
      touch: "Drag on the left to run. Tap the flame to blast. I'll cheer from up here.",
      keys: "WASD to run. Space to blast. I'll cheer from up here.",
    }],
  ],
  win: [
    ['pip', 'LOOK AT THAT! Sunmeadow is green again!'],
    ['ember', 'Told you. Wrong isle.'],
    ['pip', 'The Heartlight just got brighter. I felt it. Tingly.'],
    ['pip', 'Odd, though. Those Glooms marched in rows. Like someone was leading them.'],
    ['pip', 'Anyway! Tidecove is next. Bring a towel.'],
  ],
  lose: [
    ['pip', 'Ember! Up! Up! ...Okay. That was a lot of Glooms.'],
    ['ember', "I'm fine. Mostly toast."],
    ['pip', "Shake it off. The island's still counting on you."],
  ],
};

// Bubbles: quick lines from Pip that float by while the fight carries on. One is picked at random.
export const BUBBLES = {
  wave1: ['Here they come! Try not to get bumped.', 'Incoming! Stay bouncy!'],
  wave2: ["More of them! Don't they have homes?", 'Round two! Ember, you are on fire. Literally.'],
  wave3: ['Final wave! Give it everything!', 'Last lot! Make it a big one!'],
  cleared: ['Nice! Catch your breath.', 'See the colour creeping back? Keep going!'],
  first: ["Look! A pop of colour! That's what you're fighting for."],
  hurt: ['Ouch! They pause after each bump. Use it!', 'Careful! Keep moving!'],
  low: ["Ember, you're running low! Dodge, don't dare!", 'Health is low! Run in circles. Dramatic circles.'],
  big: ['Ha! Toasted!', 'Three at once? Show-off!'],
};
