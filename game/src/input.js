// Keyboard and pointer input. Held keys steer the chef; one-shot presses (use a
// station, pause) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. A pointer press on
// the canvas steers the chef toward that point; if the press lands on a station,
// the chef uses it as soon as he is close enough.
export const ACTION_USE = 1;
export const ACTION_PAUSE = 2;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const USE = new Set(['Space', 'KeyE', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  // Where the pointer last pressed, in CSS pixels relative to the canvas, or null.
  let target = null;
  // True when the press should use a station once the chef is close enough.
  let useOnArrive = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (USE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_USE;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    up = false;
    down = false;
    left = false;
    right = false;
    target = null;
    useOnArrive = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    target = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    useOnArrive = true;
  });

  return {
    /** Steering from held keys: {x, y}, each -1, 0 or 1. */
    keys() {
      return { x: (right ? 1 : 0) - (left ? 1 : 0), y: (down ? 1 : 0) - (up ? 1 : 0) };
    },
    /** The pointer target in CSS pixels, or null. */
    pointerTarget() {
      return target;
    },
    /** Whether the press wants a station used on arrival. */
    useOnArrive() {
      return useOnArrive;
    },
    clearPointerTarget() {
      target = null;
      useOnArrive = false;
    },
    clearUseOnArrive() {
      useOnArrive = false;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
