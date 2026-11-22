// input.js: turns thumb drags and key presses into one "move" direction.
// The game reads move.x (left/right) and move.z (up/down on the screen).
// Both go from -1 to 1 and never add up to more than 1 in total,
// so moving diagonally is never faster than moving straight.

// Change these two numbers to change how the joystick feels.
const STICK_RADIUS = 48;   // how far (in pixels) you drag for full speed
const DEAD_ZONE = 0.12;    // tiny drags below this share of the radius are ignored

// Each key pushes in one direction: [left/right, up/down].
const KEY_DIRECTIONS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(stickElement, knobElement) {
  const move = { x: 0, z: 0 };   // the answer the game reads
  const keys = new Set();        // keyboard keys that are held down right now
  let stick = null;              // while a thumb is down: where it started and how far it is pushed

  // Works out the final direction from the keys and the joystick together.
  function refresh() {
    let x = 0, z = 0;
    for (const code of keys) {
      x += KEY_DIRECTIONS[code][0];
      z += KEY_DIRECTIONS[code][1];
    }
    if (stick) {
      x += stick.x;
      z += stick.y;
    }
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }   // keeps diagonals from being faster
    move.x = x;
    move.z = z;
  }

  // Moves the on-screen joystick and works out how hard it is being pushed.
  function updateStick(pointerX, pointerY) {
    let dx = pointerX - stick.originX;
    let dy = pointerY - stick.originY;
    const distance = Math.hypot(dx, dy);
    if (distance > STICK_RADIUS) {   // dragged past the edge: the ring follows the thumb
      const pull = (distance - STICK_RADIUS) / distance;
      stick.originX += dx * pull;
      stick.originY += dy * pull;
      dx = pointerX - stick.originX;
      dy = pointerY - stick.originY;
    }
    const length = Math.hypot(dx, dy) || 1;
    const strength = Math.min(length / STICK_RADIUS, 1);
    const scaled = strength < DEAD_ZONE ? 0 : (strength - DEAD_ZONE) / (1 - DEAD_ZONE);
    stick.x = (dx / length) * scaled;
    stick.y = (dy / length) * scaled;
    stickElement.style.transform = `translate(${stick.originX}px, ${stick.originY}px)`;
    knobElement.style.transform = `translate(${dx}px, ${dy}px)`;
    refresh();
  }

  function releaseStick() {
    stick = null;
    stickElement.classList.remove('active');
    refresh();
  }

  // Touch (or mouse): only the left half of the screen steers, and only one thumb at a time.
  window.addEventListener('pointerdown', (event) => {
    if (stick || event.clientX > window.innerWidth / 2) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    stick = { id: event.pointerId, originX: event.clientX, originY: event.clientY, x: 0, y: 0 };
    stickElement.classList.add('active');
    updateStick(event.clientX, event.clientY);
  });
  window.addEventListener('pointermove', (event) => {
    if (stick && event.pointerId === stick.id) updateStick(event.clientX, event.clientY);
  });
  const lifted = (event) => { if (stick && event.pointerId === stick.id) releaseStick(); };
  window.addEventListener('pointerup', lifted);
  window.addEventListener('pointercancel', lifted);

  // Keyboard: WASD and the arrow keys. "code" means the key's position, so it works on any keyboard layout.
  window.addEventListener('keydown', (event) => {
    if (!(event.code in KEY_DIRECTIONS)) return;
    event.preventDefault();
    keys.add(event.code);
    refresh();
  });
  window.addEventListener('keyup', (event) => {
    if (keys.delete(event.code)) refresh();
  });

  // Lets go of every key and the joystick. Used when the window loses focus, and when a conversation starts,
  // so Ember never keeps running by herself.
  function release() {
    keys.clear();
    if (stick) releaseStick();
    else refresh();
  }
  window.addEventListener('blur', release);

  // Stop the page from zooming, scrolling, or opening menus while you play.
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });

  return { move, release };
}
