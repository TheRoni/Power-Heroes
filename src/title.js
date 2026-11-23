// title.js: the title screen: the game's name, "tap to begin", a small box to change the hero's name, and "Start over" for
// someone who has saved progress. It waits for a tap (or Space / Enter), then hides itself and starts the story.
import { NOT_NAME } from './power.js';

export function createTitle() {
  const screen = document.getElementById('title');
  let start = null;   // what to do when the title screen is tapped

  // The hero's name: a small button showing it; tapping it opens a text box. "naming" is { name(), set(text) } (main.js).
  const nameRow = document.getElementById('title-name-row');
  const renameButton = document.getElementById('title-rename');
  const renameForm = document.getElementById('title-rename-form');
  const renameInput = document.getElementById('title-rename-input');
  let naming = null;
  function commitName() {   // the typed name counts (and is cleaned up: set() says what it became)
    if (!naming || renameForm.hidden) return;
    naming.set(renameInput.value);
    renameForm.hidden = true;
    renameButton.hidden = false;
    document.getElementById('title-rename-name').textContent = naming.name();
  }
  nameRow.addEventListener('pointerdown', (event) => event.stopPropagation());   // a tap here does not start the game...
  nameRow.addEventListener('keydown', (event) => event.stopPropagation());       // ...and typing here is not a game key (WASD, Space)
  renameButton.addEventListener('click', () => {
    renameInput.value = naming.name();
    renameButton.hidden = true;
    renameForm.hidden = false;
    renameInput.focus();
    renameInput.select();
  });
  renameInput.addEventListener('input', () => { renameInput.value = renameInput.value.replace(NOT_NAME, ''); });
  renameForm.addEventListener('submit', (event) => { event.preventDefault(); commitName(); });

  // The title screen waits for a tap (or Space / Enter), then hides itself and starts the story.
  function begin() {
    if (screen.hidden || !start) return;
    commitName();
    const go = start;
    start = null;
    screen.hidden = true;
    go();
  }
  screen.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    begin();
  });

  // "onReset" (optional) shows a small "Start over" button for someone who has saved progress; "nameBox" (optional) lets
  // them change the hero's name.
  function show(onStart, onReset = null, nameBox = null) {
    start = onStart;
    screen.hidden = false;
    naming = nameBox;
    nameRow.hidden = !naming;
    if (naming) {
      renameForm.hidden = true;
      renameButton.hidden = false;
      document.getElementById('title-rename-name').textContent = naming.name();
    }
    const reset = document.getElementById('title-reset');
    reset.hidden = !onReset;
    reset.onpointerdown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (onReset) onReset();
    };
  }
  function hide() {
    start = null;
    screen.hidden = true;
  }

  return { show, hide, begin, get shown() { return !screen.hidden; } };
}
