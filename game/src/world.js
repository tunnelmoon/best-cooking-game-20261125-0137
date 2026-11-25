// Skillet Rush rules and state, with no drawing and no browser in it: the chef,
// the order board, the grill, the assembly plate, hands, score, timer and stars.
// step() advances one fixed step and returns what happened as bit flags, so the
// caller can react (sound, shake) without the world knowing about screens.
import {
  CHEF, COUNTER_Y, FIELD, GRILL, INGREDIENTS, LEVEL_MAX, LEVEL_SECONDS,
  ORDERS, RECIPES, SCORE, SHIFT_SECONDS, STARS, STATIONS,
} from './config.js';
import { pick } from './random.js';

export const EVENT_PICKUP = 1;
export const EVENT_PLACE = 2;
export const EVENT_GRILL_START = 4;
export const EVENT_COOK_DONE = 8;
export const EVENT_SERVE = 16;
export const EVENT_WRONG = 32;
export const EVENT_MISS = 64;
export const EVENT_TRASH = 128;
export const EVENT_OVER = 256;

/** Raw patty from the fridge; a cooked one is simply 'patty'. */
export const RAW_PATTY = 'patty-raw';

function sameMultiset(a, b) {
  if (a.length !== b.length) return false;
  const counts = new Map();
  for (const item of a) counts.set(item, (counts.get(item) ?? 0) + 1);
  for (const item of b) {
    const left = counts.get(item) ?? 0;
    if (left === 0) return false;
    counts.set(item, left - 1);
  }
  return true;
}

export function createWorld(random) {
  const chef = { x: FIELD.width / 2, y: 480, carry: [], face: 1, walk: 0, moving: false };
  const grill = [];
  for (let slot = 0; slot < GRILL.slots; slot += 1) grill.push({ state: 'empty', t: 0 });
  const state = {
    chef,
    orders: [],
    grill,
    plate: [],
    score: 0,
    combo: 0,
    served: 0,
    missed: 0,
    stars: STARS,
    elapsed: 0,
    timeLeft: SHIFT_SECONDS,
    level: 1,
    spawnTimer: 4,
    particles: [],
    floats: [],
    trauma: 0,
    over: false,
    nextOrderId: 1,
  };

  function reset() {
    chef.x = FIELD.width / 2;
    chef.y = 480;
    chef.carry = [];
    chef.face = 1;
    chef.walk = 0;
    chef.moving = false;
    for (const slot of grill) {
      slot.state = 'empty';
      slot.t = 0;
    }
    state.orders = [];
    state.plate = [];
    state.score = 0;
    state.combo = 0;
    state.served = 0;
    state.missed = 0;
    state.stars = STARS;
    state.elapsed = 0;
    state.timeLeft = SHIFT_SECONDS;
    state.level = 1;
    state.spawnTimer = 4;
    state.particles = [];
    state.floats = [];
    state.trauma = 0;
    state.over = false;
    state.nextOrderId = 1;
  }

  function level() {
    return Math.min(LEVEL_MAX, 1 + Math.floor(state.elapsed / LEVEL_SECONDS));
  }

  function spawnOrder() {
    const pool = RECIPES.filter((recipe) => recipe.level <= state.level);
    const recipe = pick(random, pool);
    const patience = ORDERS.patienceSeconds[state.level - 1];
    state.orders.push({
      id: state.nextOrderId,
      recipe,
      patience,
      patienceMax: patience,
      born: state.elapsed,
    });
    state.nextOrderId += 1;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const power = speed * (0.4 + random() * 0.6);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * power,
        vy: Math.sin(angle) * power - speed * 0.4,
        life: 0.5 + random() * 0.4,
        maxLife: 0.9,
        size: 3 + random() * 4,
        color,
      });
    }
  }

  function floatText(x, y, text, color) {
    state.floats.push({ x, y, text, life: 1.1, maxLife: 1.1, color });
  }

  /** The station the chef stands close enough to use, or null. */
  function nearestStation() {
    let best = null;
    let bestDist = Infinity;
    for (const station of STATIONS) {
      const dx = Math.abs(chef.x - station.x);
      const dy = Math.abs(COUNTER_Y - chef.y);
      if (dx <= CHEF.reachX && dy <= CHEF.reachY && dx + dy < bestDist) {
        best = station;
        bestDist = dx + dy;
      }
    }
    return best;
  }

  function matchingOrder() {
    for (const order of state.orders) {
      if (sameMultiset(state.plate, order.recipe.items)) return order;
    }
    return null;
  }

  function useStation() {
    const station = nearestStation();
    if (station === null) return 0;
    let events = 0;
    if (station.kind === 'bin' || station.kind === 'fridge') {
      const item = station.kind === 'fridge' ? RAW_PATTY : station.item;
      if (chef.carry.length < CHEF.carryMax) {
        chef.carry.push(item);
        events |= EVENT_PICKUP;
        burst(station.x, COUNTER_Y - 30, '#f2c94c', 4, 60);
      }
      return events;
    }
    if (station.kind === 'grill') {
      const rawIndex = chef.carry.indexOf(RAW_PATTY);
      const emptySlot = grill.find((slot) => slot.state === 'empty');
      if (rawIndex !== -1 && emptySlot !== undefined) {
        chef.carry.splice(rawIndex, 1);
        emptySlot.state = 'cooking';
        emptySlot.t = 0;
        events |= EVENT_GRILL_START;
        return events;
      }
      const doneSlot = grill.find((slot) => slot.state === 'done');
      if (doneSlot !== undefined && chef.carry.length < CHEF.carryMax) {
        doneSlot.state = 'empty';
        doneSlot.t = 0;
        chef.carry.push('patty');
        events |= EVENT_PICKUP;
        return events;
      }
      const burntSlot = grill.find((slot) => slot.state === 'burnt');
      if (burntSlot !== undefined) {
        burntSlot.state = 'empty';
        burntSlot.t = 0;
        burst(station.x, COUNTER_Y - 40, '#555', 10, 70);
        events |= EVENT_TRASH;
      }
      return events;
    }
    if (station.kind === 'plate') {
      if (chef.carry.length > 0) {
        state.plate.push(chef.carry.pop());
        events |= EVENT_PLACE;
        return events;
      }
      if (state.plate.length > 0 && chef.carry.length < CHEF.carryMax) {
        chef.carry.push(state.plate.pop());
        events |= EVENT_PICKUP;
      }
      return events;
    }
    if (station.kind === 'pass') {
      if (state.plate.length === 0) return 0;
      const order = matchingOrder();
      if (order === null) {
        state.combo = 0;
        state.trauma = Math.min(1, state.trauma + 0.5);
        events |= EVENT_WRONG;
        return events;
      }
      const tip = Math.round(SCORE.tipMax * (order.patience / order.patienceMax));
      const multiplier = Math.min(SCORE.comboCap, 1 + state.combo * SCORE.comboStep);
      const points = Math.round((SCORE.base + tip) * multiplier);
      state.score += points;
      state.combo += 1;
      state.served += 1;
      state.orders.splice(state.orders.indexOf(order), 1);
      state.plate = [];
      burst(station.x, COUNTER_Y - 50, '#f2c94c', 16, 140);
      burst(station.x, COUNTER_Y - 50, '#5da24a', 10, 110);
      floatText(station.x, COUNTER_Y - 90, `+${points}`, '#f2c94c');
      if (state.combo >= 2) floatText(station.x, COUNTER_Y - 120, `COMBO x${state.combo}`, '#fff8e7');
      events |= EVENT_SERVE;
      return events;
    }
    if (station.kind === 'trash') {
      if (chef.carry.length > 0) {
        chef.carry = [];
        events |= EVENT_TRASH;
      } else if (state.plate.length > 0) {
        state.plate = [];
        events |= EVENT_TRASH;
      }
      return events;
    }
    return 0;
  }

  /**
   * One fixed step. `move` is {x, y} in -1..1. `usePressed` uses the nearest
   * station. With `demo` set the shift clock and patience are frozen, so the
   * title screen can run a living kitchen behind its panel.
   */
  function step(dt, move, usePressed, demo = false) {
    let events = 0;
    if (state.over) return events;

    // Move the chef.
    const length = Math.hypot(move.x, move.y);
    const nx = length > 0 ? move.x / length : 0;
    const ny = length > 0 ? move.y / length : 0;
    chef.moving = length > 0;
    if (chef.moving) {
      chef.x = Math.min(CHEF.maxX, Math.max(CHEF.minX, chef.x + nx * CHEF.speed * dt));
      chef.y = Math.min(CHEF.maxY, Math.max(CHEF.minY, chef.y + ny * CHEF.speed * dt));
      if (nx !== 0) chef.face = nx > 0 ? 1 : -1;
      chef.walk += dt * 11;
    }

    if (usePressed) events |= useStation();

    // The grill cooks, dings when done, burns when forgotten.
    for (const slot of grill) {
      if (slot.state === 'cooking') {
        slot.t += dt;
        if (slot.t >= GRILL.cookSeconds) {
          slot.state = 'done';
          slot.t = 0;
          events |= EVENT_COOK_DONE;
        }
      } else if (slot.state === 'done') {
        slot.t += dt;
        if (slot.t >= GRILL.doneSeconds) {
          slot.state = 'burnt';
          slot.t = 0;
          burst(736, COUNTER_Y - 40, '#666', 8, 50);
        }
      }
    }

    // Orders arrive on the board.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && state.orders.length < ORDERS.max) {
      spawnOrder();
      state.spawnTimer = ORDERS.spawnSeconds[state.level - 1] * (0.85 + random() * 0.3);
    }

    if (!demo) {
      state.elapsed += dt;
      state.timeLeft = Math.max(0, SHIFT_SECONDS - state.elapsed);
      state.level = level();
      // Patience drains; an order that runs out walks out angry.
      for (let i = state.orders.length - 1; i >= 0; i -= 1) {
        const order = state.orders[i];
        order.patience -= dt;
        if (order.patience <= 0) {
          state.orders.splice(i, 1);
          state.missed += 1;
          state.combo = 0;
          state.stars -= 1;
          state.trauma = Math.min(1, state.trauma + 0.4);
          events |= EVENT_MISS;
          if (state.stars <= 0) {
            state.over = true;
            events |= EVENT_OVER;
          }
        }
      }
      if (state.timeLeft <= 0 && !state.over) {
        state.over = true;
        events |= EVENT_OVER;
      }
    }

    // Steam puffs off a cooking patty, now and then.
    for (const slot of grill) {
      if (slot.state === 'cooking' && random() < dt * 6) {
        state.particles.push({
          x: 736 + (random() - 0.5) * 40,
          y: COUNTER_Y - 46,
          vx: (random() - 0.5) * 12,
          vy: -34 - random() * 20,
          life: 0.8,
          maxLife: 0.8,
          size: 5 + random() * 5,
          color: 'steam',
        });
      }
    }

    // Particles and floating scores drift and fade.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 12 * dt;
      p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floats.length - 1; i >= 0; i -= 1) {
      const f = state.floats[i];
      f.y -= 42 * dt;
      f.life -= dt;
      if (f.life <= 0) state.floats.splice(i, 1);
    }
    if (state.trauma > 0) state.trauma = Math.max(0, state.trauma - dt * 1.6);

    return events;
  }

  reset();
  return {
    state, reset, step, useStation, nearestStation, matchingOrder,
    /** The station with this id, for the screenshot autopilot. */
    stationById(id) {
      return STATIONS.find((station) => station.id === id) ?? null;
    },
    /** A fresh order of the given recipe, for staged screenshots. */
    forceOrder(recipeId, patience) {
      const recipe = RECIPES.find((r) => r.id === recipeId);
      if (!recipe) return null;
      const order = {
        id: state.nextOrderId,
        recipe,
        patience: patience ?? ORDERS.patienceSeconds[0],
        patienceMax: patience ?? ORDERS.patienceSeconds[0],
        born: state.elapsed,
      };
      state.nextOrderId += 1;
      state.orders.push(order);
      return order;
    },
    ingredientName(id) {
      return INGREDIENTS[id]?.name ?? id;
    },
  };
}
