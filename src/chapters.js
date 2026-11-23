// chapters.js: the chapters, as data. Chapter 1, Sunmeadow, is five rounds, and the last one is the boss, General Bramble.
// A round says how many Gloomlings come in each wave and of which types (each wave goes through its list in turn), how
// strong they are next to your squad ("power": 1 is about as strong as you), a line that floats by as it starts ("intro",
// a key in story-data.js), and what the end screen says when you win it. Round 1 is the fight the game has always had.
import { WAVES } from './heroes-data.js';

const NEXT = 'Next round';

export const CHAPTERS = {
  1: {
    name: 'Sunmeadow',
    rounds: [
      {
        name: 'The Meadow', sizes: WAVES.sizes, types: WAVES.types, power: 1, intro: null,
        won: { title: 'Round 1 won!', text: 'The Meadow is green again.', button: NEXT },
      },
      {
        name: 'The Long Grass', sizes: [5, 7, 9], power: 1.1, intro: 'round2',
        types: [['nature'], ['nature', 'nature', 'storm'], ['nature', 'fire', 'nature', 'water']],
        won: { title: 'Round 2 won!', text: 'The Long Grass is green again.', button: NEXT },
      },
      {
        name: 'The Old Oak', sizes: [4, 6, 8, 10], power: 1.2, intro: 'round3',
        types: [['nature'], ['nature', 'storm'], ['nature', 'nature', 'water'], ['nature', 'fire', 'storm', 'nature']],
        won: { title: 'Round 3 won!', text: 'The Old Oak stands tall again.', button: NEXT },
      },
      {
        name: "Bramble's Shadow", sizes: [6, 8, 10, 12], power: 1.3, intro: 'round4',
        types: [['nature'], ['nature', 'storm'], ['nature', 'nature', 'water'], ['nature', 'storm', 'nature', 'fire']],
        won: { title: 'Round 4 won!', text: 'The thorns are gone. Something bigger is not.', button: NEXT },
      },
      {
        name: 'General Bramble', boss: 'bramble', sizes: [8, 10], power: 1.4, intro: 'round5',   // two waves, then the boss alone
        types: [['nature'], ['nature', 'storm']],
        won: { title: 'Isle saved!', text: 'Sunmeadow is green again.', button: 'Keep playing' },
      },
    ],
  },
};

export const ROUNDS = CHAPTERS[1].rounds.length;   // (Chapter 1 is the only chapter so far)
