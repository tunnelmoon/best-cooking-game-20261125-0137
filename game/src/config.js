// Skillet Rush: every tuning number, colour, recipe and station in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

// One dinner shift, in seconds. Level rises every 30 s; the rush gets faster.
export const SHIFT_SECONDS = 150;
export const LEVEL_SECONDS = 30;
export const LEVEL_MAX = 5;

// The chef walks the kitchen floor and steps up to the counter to work a station.
export const CHEF = {
  radius: 26,
  speed: 440,
  // How close the chef must stand to a station to use it.
  reachX: 92,
  reachY: 150,
  // Hands hold at most this many items at once.
  carryMax: 3,
  // Floor area the chef can walk (top of the counter is the lower edge).
  minX: 40,
  maxX: FIELD.width - 40,
  minY: 150,
  maxY: 606,
};

// Ingredients, by id. `cookable` means it must visit the grill before it can be plated.
export const INGREDIENTS = {
  bun: { name: 'Bun', cookable: false },
  patty: { name: 'Patty', cookable: true },
  lettuce: { name: 'Lettuce', cookable: false },
  tomato: { name: 'Tomato', cookable: false },
  cheese: { name: 'Cheese', cookable: false },
};

// A dish is a multiset of ingredients: the plate matches an order when it holds
// exactly these items, in any stacking order. Patties on a plate are always cooked.
export const RECIPES = [
  { id: 'classic', name: 'Classic', items: ['bun', 'patty', 'lettuce'], level: 1 },
  { id: 'cheesy', name: 'Cheesy', items: ['bun', 'patty', 'cheese'], level: 1 },
  { id: 'garden', name: 'Garden', items: ['bun', 'lettuce', 'tomato', 'cheese'], level: 2 },
  { id: 'sunrise', name: 'Sunrise', items: ['bun', 'patty', 'tomato', 'cheese'], level: 3 },
  { id: 'double', name: 'Double', items: ['bun', 'patty', 'patty', 'cheese'], level: 3 },
];

// The grill turns a raw patty golden, then burns it if it is forgotten.
export const GRILL = {
  slots: 2,
  cookSeconds: 6,
  doneSeconds: 6,
};

// Orders: at most this many tickets on the board at once.
export const ORDERS = {
  max: 3,
  // Seconds between new orders, by level (level 1 first, level 5 last).
  spawnSeconds: [15, 13, 11, 9, 8],
  // Seconds of patience a fresh order carries, by level.
  patienceSeconds: [58, 52, 46, 40, 36],
};

// Scoring: a served dish pays its base plus a tip that shrinks as patience runs
// out, times a combo multiplier that grows with every serve in a row.
export const SCORE = {
  base: 100,
  tipMax: 100,
  comboStep: 0.1,
  comboCap: 2,
};

export const STARS = 3;

// Stations along the counter, left to right. Each one is used with Space/E or a
// click when the chef stands close enough.
export const STATIONS = [
  { id: 'bun', label: 'BUNS', x: 92, kind: 'bin', item: 'bun' },
  { id: 'lettuce', label: 'LETTUCE', x: 212, kind: 'bin', item: 'lettuce' },
  { id: 'tomato', label: 'TOMATO', x: 332, kind: 'bin', item: 'tomato' },
  { id: 'cheese', label: 'CHEESE', x: 452, kind: 'bin', item: 'cheese' },
  { id: 'fridge', label: 'FRIDGE', x: 572, kind: 'fridge', item: 'patty' },
  { id: 'grill', label: 'GRILL', x: 736, kind: 'grill' },
  { id: 'plate', label: 'PLATE', x: 902, kind: 'plate' },
  { id: 'pass', label: 'SERVE', x: 1052, kind: 'pass' },
  { id: 'trash', label: 'TRASH', x: 1192, kind: 'trash' },
];

// The counter's top edge: stations sit on it, the chef stands just in front.
export const COUNTER_Y = 648;

export const PALETTE = {
  backdrop: '#241a12',
  wall: '#f3e2c2',
  wallTrim: '#e0c79a',
  floorA: '#c96f4a',
  floorB: '#b85f3e',
  floorLine: '#a34f31',
  board: '#4a3226',
  boardEdge: '#6b4a34',
  ticket: '#fff8e7',
  ticketInk: '#3a2a1c',
  counterTop: '#8a5a34',
  counterFront: '#5f3d22',
  counterEdge: '#a97a4c',
  chefSkin: '#f2c89b',
  chefHat: '#fffaf0',
  chefShirt: '#3f6fb5',
  chefApron: '#f5f0e6',
  chefPants: '#2e3440',
  text: '#2c2118',
  cream: '#fff8e7',
  muted: '#8b7d68',
  gold: '#f2c94c',
  green: '#5da24a',
  red: '#d94f3d',
  amber: '#e8a13a',
  grill: '#2b2f36',
  grillHot: '#e2703a',
  steam: 'rgba(255,255,255,0.55)',
  panel: 'rgba(36,26,18,0.92)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'skillet-rush.best';
