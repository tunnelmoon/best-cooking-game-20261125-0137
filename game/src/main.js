// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play,
// paused and game over.
//
// ?seed=N fixes the order pattern. ?shot=start|play|serve|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, FIELD, STATIONS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_COOK_DONE, EVENT_GRILL_START, EVENT_MISS, EVENT_OVER, EVENT_PICKUP, EVENT_PLACE, EVENT_SERVE, EVENT_TRASH, EVENT_WRONG } from './world.js';
import { ACTION_PAUSE, ACTION_USE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** A pointer press counts as "use this station" when it lands on the counter row. */
const STATION_ZONE = { yTop: 560, halfWidth: 60 };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const helpers = { nearest: null, matchingOrder: world.matchingOrder() };
  let painted = 0;
  function paint() {
    // One fixed moment, so both paints are the same picture.
    renderer.draw(world.state, scene.screen, scene.best, 2.5, helpers);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastTickSecond = -1;
  // The last pointer target the loop has seen, so a fresh press can be judged.
  let seenTarget = null;
  let pointerWantsUse = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    lastTickSecond = -1;
    screen = SCREEN_PLAY;
    announce('Playing. Serve every order before its patience runs out.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.over();
    announce(`Shift over. Score ${world.state.score}. Best ${best}.`);
  }

  function playEvents(events) {
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_PLACE) audio.place();
    if (events & EVENT_GRILL_START) audio.sizzle();
    if (events & EVENT_COOK_DONE) audio.cooked();
    if (events & EVENT_SERVE) audio.serve();
    if (events & EVENT_WRONG) audio.wrong();
    if (events & EVENT_MISS) audio.miss();
    if (events & EVENT_TRASH) audio.place();
    if (events & EVENT_OVER) endGame();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_USE && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      audio.unlock();
      startGame();
      return { use: false };
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
      return { use: false };
    }
    if (actions & (ACTION_PAUSE | ACTION_USE) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
      return { use: false };
    }
    return { use: Boolean(actions & ACTION_USE) && screen === SCREEN_PLAY };
  }

  /** Where the chef should walk this frame, from keys or the pointer target. */
  function steering() {
    const keys = input.keys();
    if (keys.x !== 0 || keys.y !== 0) {
      input.clearPointerTarget();
      seenTarget = null;
      pointerWantsUse = false;
      return { x: keys.x, y: keys.y };
    }
    const target = input.pointerTarget();
    if (target === null) return { x: 0, y: 0 };
    if (target !== seenTarget) {
      seenTarget = target;
      // A press on the counter row, near a station, wants that station used.
      const logical = renderer.toLogical(target.x, target.y);
      pointerWantsUse = logical.y >= STATION_ZONE.yTop
        && STATIONS.some((station) => Math.abs(logical.x - station.x) <= STATION_ZONE.halfWidth);
    }
    const logical = renderer.toLogical(target.x, target.y);
    const dx = logical.x - world.state.chef.x;
    const dy = logical.y - world.state.chef.y;
    if (Math.hypot(dx, dy) < 12) {
      input.clearPointerTarget();
      seenTarget = null;
      return { x: 0, y: 0 };
    }
    const length = Math.hypot(dx, dy);
    return { x: dx / length, y: dy / length };
  }

  function step() {
    // Actions first: on the title screen this is the only place the start
    // press is ever read, so it must run before the title early-return.
    const { use } = handleActions();
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    const move = steering();
    const nearest = world.nearestStation();
    const pointerUse = pointerWantsUse && nearest !== null;
    if (pointerUse) {
      pointerWantsUse = false;
      input.clearUseOnArrive();
    }
    const events = world.step(STEP, move, use || pointerUse, false);
    // The last ten seconds tick, so the timer can be felt.
    const whole = Math.ceil(world.state.timeLeft);
    if (whole !== lastTickSecond) {
      lastTickSecond = whole;
      if (whole <= 10 && whole > 0) audio.tick();
    }
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      handleActions();
    }
    const helpers = {
      nearest: screen === SCREEN_PLAY ? world.nearestStation() : null,
      matchingOrder: world.matchingOrder(),
    };
    renderer.draw(world.state, screen, best, now / 1000, helpers);
  }

  // Leaving the tab pauses a running game rather than letting orders walk out unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Skillet Rush. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
