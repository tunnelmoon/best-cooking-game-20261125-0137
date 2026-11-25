// The screenshot scenes behind ?shot=start|play|serve|end. Each one plays the
// real rules forward from a fresh world, steered by a small scripted chef: it
// reads the oldest order, fetches what the plate still needs, minds the grill
// and serves, so every frame is what a short game really looks like and the
// same seed always gives the same frame.
import { GRILL, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 20;
const SERVE_LIMIT_SECONDS = 40;
const END_LIMIT_SECONDS = 200;
const CHEF_ROW_Y = 560;

/** A waypoint: walk to the station, use it once in reach, then idle a while. */
function waypoint(station, waitAfter = 0.2) {
  return { station, waitAfter };
}

/** The scripted chef: a tiny state machine over the world's real rules. */
function createBrain(world) {
  let plan = [];
  let current = null;
  let waitLeft = 0;

  function missingFor(order) {
    const missing = [...order.recipe.items];
    for (const item of world.state.plate) {
      const i = missing.indexOf(item);
      if (i !== -1) missing.splice(i, 1);
    }
    return missing;
  }

  function stationFor(item) {
    if (item === 'patty' || item === 'patty-raw') return 'fridge';
    return item; // bun, lettuce, tomato, cheese bins share the item's id
  }

  function computePlan() {
    const { orders, plate, grill, chef } = world.state;
    if (orders.length === 0) return [{ x: 640, y: 480, waitAfter: 2 }];
    const order = orders[0];
    const missing = missingFor(order);
    // The plate is finished: take it to the pass.
    if (missing.length === 0) return [waypoint('pass', 0.6)];
    // Something the hands hold belongs on the plate: place it first.
    for (const item of chef.carry) {
      if (missing.includes(item)) return [waypoint('plate', 0.2)];
    }
    // A cooked patty waits on the grill and the dish needs one: fetch it.
    if (missing.includes('patty')) {
      const doneSlot = grill.find((slot) => slot.state === 'done');
      if (doneSlot !== undefined) return [waypoint('grill', 0.2), waypoint('plate', 0.2)];
      const cookingSlot = grill.find((slot) => slot.state === 'cooking');
      if (cookingSlot !== undefined) {
        return [waypoint('grill', GRILL.cookSeconds - cookingSlot.t + 0.3)];
      }
      if (chef.carry.includes('patty-raw')) return [waypoint('grill', 0.2)];
      return [waypoint('fridge', 0.2), waypoint('grill', 0.2)];
    }
    // Any other missing ingredient: fetch it from its bin, then plate it.
    const next = missing[0];
    return [waypoint(stationFor(next), 0.2), waypoint('plate', 0.2)];
  }

  function next(dt) {
    if (waitLeft > 0) {
      waitLeft -= dt;
      return { move: { x: 0, y: 0 }, use: false };
    }
    if (current === null) {
      if (plan.length === 0) plan = computePlan();
      current = plan.shift() ?? null;
      if (current === null) return { move: { x: 0, y: 0 }, use: false };
    }
    const targetX = current.station ? world.stationById(current.station).x : current.x;
    const targetY = current.station ? CHEF_ROW_Y : current.y;
    const dx = targetX - world.state.chef.x;
    const dy = targetY - world.state.chef.y;
    if (Math.abs(dx) < 14 && Math.abs(dy) < 30) {
      const use = current.station !== null;
      waitLeft = current.waitAfter ?? 0;
      current = null;
      return { move: { x: 0, y: 0 }, use };
    }
    const length = Math.hypot(dx, dy);
    return { move: { x: dx / length, y: dy / length }, use: false };
  }

  return { next };
}

/** Play the brain forward for up to `seconds`, stopping early when `stopWhen` says so. */
function runBrain(world, seconds, stopWhen) {
  const brain = createBrain(world);
  const steps = Math.ceil(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const { move, use } = brain.next(STEP);
    const events = world.step(STEP, move, use, false);
    if (stopWhen !== undefined && stopWhen(world)) break;
    if (events & EVENT_OVER) break;
  }
}

/**
 * Set `world` to the named scene (start, play, serve or end) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'serve') {
    world.forceOrder('cheesy', 55);
    // Play until a plate is finished and matches its order, then hold the frame.
    runBrain(world, SERVE_LIMIT_SECONDS, (w) => w.matchingOrder() !== null);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    world.forceOrder('classic', 50);
    world.forceOrder('garden', 45);
    runBrain(world, END_LIMIT_SECONDS);
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  if (name === 'play') {
    world.forceOrder('classic', 52);
    world.forceOrder('garden', 44);
    runBrain(world, PLAY_SECONDS);
    return { screen: SCREEN_PLAY, best: world.state.score };
  }
  // start: a living kitchen behind the title panel — orders on the board, a
  // patty on the grill, a dish half built on the plate.
  world.forceOrder('classic', 48);
  world.forceOrder('cheesy', 40);
  world.forceOrder('garden', 36);
  world.state.plate = ['bun', 'lettuce'];
  world.state.grill[0].state = 'cooking';
  world.state.grill[0].t = 3;
  world.state.chef.x = 700;
  world.state.chef.y = CHEF_ROW_Y;
  world.state.chef.carry = ['cheese'];
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
