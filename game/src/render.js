// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. Warm bistro palette, food drawn as little vector
// icons so every dish looks worth serving. Text that holds a number is rebuilt
// only when the number changes, so a frame allocates nothing.
import { CHEF, COUNTER_Y, FIELD, FONT, GRILL, PALETTE, SHIFT_SECONDS, STATIONS } from './config.js';
import { RAW_PATTY } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const BOARD = { x: 16, y: 12, width: 760, height: 100 };
const TICKET = { width: 210, height: 84, gap: 12 };
const TIMER = { x: 1184, y: 56, radius: 38 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const comboLabel = cachedLabel('COMBO x');
  const servedLabel = cachedLabel('SERVED ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** CSS-pixel point on the canvas to logical playfield coordinates. */
  function toLogical(cssX, cssY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (cssX * scaleX - view.x) / view.scale,
      y: (cssY * scaleY - view.y) / view.scale,
    };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight = '') {
    const key = `${weight}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  // ---- food icons: each one drawn the same size everywhere, so a recipe reads
  // at a glance on a ticket, in the chef's hands and on the plate. ----
  function drawBun(ctx, x, y, s) {
    ctx.fillStyle = '#e8a854';
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.12, s * 0.5, s * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c078';
    ctx.beginPath();
    ctx.ellipse(x, y - s * 0.08, s * 0.5, s * 0.34, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#fff3d0';
    for (const [dx, dy] of [[-0.2, -0.22], [0.05, -0.3], [0.24, -0.18]]) {
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y + dy * s, s * 0.05, s * 0.03, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPatty(ctx, x, y, s, state) {
    const color = state === 'burnt' ? '#26211c' : state === 'raw' ? '#c97a6d' : '#7a4a28';
    ctx.fillStyle = color;
    roundRect(ctx, x - s * 0.52, y - s * 0.2, s * 1.04, s * 0.4, s * 0.16);
    ctx.fill();
    if (state !== 'burnt') {
      ctx.strokeStyle = state === 'raw' ? '#a85a50' : '#5d3418';
      ctx.lineWidth = Math.max(1, s * 0.05);
      for (const dx of [-0.28, 0, 0.28]) {
        ctx.beginPath();
        ctx.moveTo(x + dx * s, y - s * 0.16);
        ctx.lineTo(x + dx * s, y + s * 0.16);
        ctx.stroke();
      }
    }
  }

  function drawLettuce(ctx, x, y, s) {
    ctx.fillStyle = '#5da24a';
    ctx.beginPath();
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      ctx.ellipse(x + Math.cos(a) * s * 0.3, y + Math.sin(a) * s * 0.18, s * 0.26, s * 0.16, a, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = '#7cc465';
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.3, s * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTomato(ctx, x, y, s) {
    ctx.fillStyle = '#d94f3d';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0785f';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    for (const [dx, dy] of [[-0.14, 0], [0.14, 0], [0, -0.14], [0, 0.14]]) {
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y + dy * s, s * 0.06, s * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawCheese(ctx, x, y, s) {
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + s * 0.3);
    ctx.lineTo(x + s * 0.5, y + s * 0.3);
    ctx.lineTo(x + s * 0.5, y - s * 0.1);
    ctx.lineTo(x - s * 0.1, y - s * 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d9a521';
    for (const [dx, dy] of [[0.2, 0.12], [-0.05, 0.05], [0.32, -0.02]]) {
      ctx.beginPath();
      ctx.arc(x + dx * s, y + dy * s, s * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawIngredient(ctx, id, x, y, s, pattyState) {
    if (id === 'bun') drawBun(ctx, x, y, s);
    else if (id === 'patty') drawPatty(ctx, x, y, s, pattyState ?? 'cooked');
    else if (id === 'patty-raw') drawPatty(ctx, x, y, s, 'raw');
    else if (id === 'lettuce') drawLettuce(ctx, x, y, s);
    else if (id === 'tomato') drawTomato(ctx, x, y, s);
    else if (id === 'cheese') drawCheese(ctx, x, y, s);
  }

  // ---- the room ----
  function drawRoom(state) {
    // Wall and floor.
    context.fillStyle = PALETTE.wall;
    context.fillRect(0, 0, FIELD.width, 132);
    context.fillStyle = PALETTE.wallTrim;
    context.fillRect(0, 128, FIELD.width, 6);
    // Hanging lamps (the third stays clear of the stars).
    for (const lx of [240, 640, 980]) {
      context.strokeStyle = '#3a2a1c';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(lx, 0);
      context.lineTo(lx, 22);
      context.stroke();
      context.fillStyle = '#f2c94c';
      context.beginPath();
      context.moveTo(lx - 16, 34);
      context.lineTo(lx + 16, 34);
      context.lineTo(lx + 8, 18);
      context.lineTo(lx - 8, 18);
      context.closePath();
      context.fill();
      context.fillStyle = 'rgba(242,201,76,0.14)';
      context.beginPath();
      context.arc(lx, 60, 46, 0, Math.PI * 2);
      context.fill();
    }
    // Checker floor tiles.
    const tile = 64;
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 20; col += 1) {
        context.fillStyle = (row + col) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
        context.fillRect(col * tile, 134 + row * tile, tile, tile);
      }
    }
    context.fillStyle = PALETTE.floorLine;
    for (let row = 0; row < 7; row += 1) context.fillRect(0, 134 + row * tile, FIELD.width, 2);
    // A potted plant by the left wall and crates by the right, so the floor
    // is a kitchen and not an empty hall.
    context.fillStyle = '#5da24a';
    for (const [dx, dy, r] of [[0, -26, 16], [-14, -12, 12], [14, -12, 12], [0, -8, 14]]) {
      context.beginPath();
      context.arc(64 + dx, 216 + dy, r, 0, Math.PI * 2);
      context.fill();
    }
    context.fillStyle = '#a85f3c';
    context.beginPath();
    context.moveTo(48, 224);
    context.lineTo(80, 224);
    context.lineTo(76, 252);
    context.lineTo(52, 252);
    context.closePath();
    context.fill();
    context.fillStyle = '#8a5a34';
    context.fillRect(1196, 196, 52, 40);
    context.fillRect(1208, 156, 40, 40);
    context.strokeStyle = '#5f3d22';
    context.lineWidth = 2;
    context.strokeRect(1196, 196, 52, 40);
    context.strokeRect(1208, 156, 40, 40);
    // A small mat where the chef stands to work the counter.
    context.fillStyle = '#7a4a6e';
    roundRect(context, 520, 516, 240, 34, 10);
    context.fill();
    context.strokeStyle = '#a86a96';
    context.lineWidth = 3;
    roundRect(context, 528, 522, 224, 22, 7);
    context.stroke();
  }

  function patienceColor(frac) {
    if (frac > 0.5) return PALETTE.green;
    if (frac > 0.25) return PALETTE.amber;
    return PALETTE.red;
  }

  function drawOrderBoard(state, time) {
    context.fillStyle = PALETTE.board;
    roundRect(context, BOARD.x, BOARD.y, BOARD.width, BOARD.height, 12);
    context.fill();
    context.fillStyle = PALETTE.boardEdge;
    roundRect(context, BOARD.x, BOARD.y, BOARD.width, 10, 5);
    context.fill();
    text('ORDERS', BOARD.x + 16, BOARD.y + 26, 15, PALETTE.gold, 'left', '700 ');
    if (state.orders.length === 0) {
      text('No orders yet. The rush is coming...', BOARD.x + 96, BOARD.y + 58, 16, '#c9b49a', 'left');
      return;
    }
    for (let i = 0; i < state.orders.length; i += 1) {
      const order = state.orders[i];
      const x = BOARD.x + 92 + i * (TICKET.width + TICKET.gap);
      const y = BOARD.y + 10;
      const frac = Math.max(0, order.patience / order.patienceMax);
      const urgent = frac <= 0.25 && Math.floor(time * 4) % 2 === 0;
      context.save();
      context.translate(x + TICKET.width / 2, y + TICKET.height / 2);
      context.rotate((i - 1) * 0.012);
      context.translate(-TICKET.width / 2, -TICKET.height / 2);
      context.fillStyle = urgent ? '#ffe1d6' : PALETTE.ticket;
      roundRect(context, 0, 0, TICKET.width, TICKET.height, 8);
      context.fill();
      context.strokeStyle = '#d8c49a';
      context.lineWidth = 1.5;
      roundRect(context, 0, 0, TICKET.width, TICKET.height, 8);
      context.stroke();
      context.fillStyle = PALETTE.ticketInk;
      text(`#${order.id} ${order.recipe.name}`, 10, 22, 16, PALETTE.ticketInk, 'left', '700 ');
      // Recipe icons in a row.
      order.recipe.items.forEach((item, j) => {
        drawIngredient(context, item, 26 + j * 34, 48, 26);
      });
      // Patience bar.
      context.fillStyle = '#e5d9bd';
      roundRect(context, 10, 66, TICKET.width - 20, 9, 4);
      context.fill();
      context.fillStyle = patienceColor(frac);
      roundRect(context, 10, 66, (TICKET.width - 20) * frac, 9, 4);
      context.fill();
      context.restore();
    }
  }

  function drawTimer(state, time) {
    const frac = state.timeLeft / SHIFT_SECONDS;
    const low = state.timeLeft <= 30;
    const pulse = low ? 1 + 0.06 * Math.sin(time * 8) : 1;
    const r = TIMER.radius * pulse;
    context.save();
    context.translate(TIMER.x, TIMER.y);
    context.fillStyle = PALETTE.board;
    context.beginPath();
    context.arc(0, 0, r + 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.cream;
    context.beginPath();
    context.arc(0, 0, r, 0, Math.PI * 2);
    context.fill();
    // Sweep: the remaining shift, draining clockwise.
    context.fillStyle = low ? PALETTE.red : PALETTE.green;
    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, r - 4, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.cream;
    context.beginPath();
    context.arc(0, 0, r - 14, 0, Math.PI * 2);
    context.fill();
    const mm = Math.floor(state.timeLeft / 60);
    const ss = Math.floor(state.timeLeft % 60);
    text(`${mm}:${String(ss).padStart(2, '0')}`, 0, 7, 22, low ? PALETTE.red : PALETTE.ticketInk, 'center', '700 ');
    context.restore();
    text('SHIFT', TIMER.x, TIMER.y + r + 8, 12, PALETTE.text, 'center', '700 ');
  }

  function drawHud(state, time) {
    context.textBaseline = 'top';
    // Dark ink on the cream wall: the HUD must read at a glance.
    text(scoreLabel(state.score), 800, 22, 26, PALETTE.text, 'left', '700 ');
    text(`LEVEL ${state.level}`, 800, 56, 16, '#a87618', 'left', '700 ');
    if (state.combo >= 2) text(comboLabel(state.combo), 800, 80, 16, PALETTE.red, 'left', '700 ');
    // Stars top right, beside the timer.
    for (let i = 0; i < 3; i += 1) {
      const sx = 1060 + i * 30;
      const sy = 26;
      context.fillStyle = i < state.stars ? PALETTE.gold : '#5a4632';
      context.beginPath();
      for (let p = 0; p < 10; p += 1) {
        const a = -Math.PI / 2 + (p * Math.PI) / 5;
        const rad = p % 2 === 0 ? 12 : 5;
        const px = sx + Math.cos(a) * rad;
        const py = sy + Math.sin(a) * rad;
        if (p === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    }
    drawTimer(state, time);
  }

  // ---- the counter and its stations ----
  // `helpers` carries live answers from the world: the station in reach and the
  // order the plate matches, so the counter can highlight them.
  function drawCounter(state, time, helpers) {
    // Counter body.
    context.fillStyle = PALETTE.counterFront;
    context.fillRect(0, COUNTER_Y, FIELD.width, FIELD.height - COUNTER_Y);
    context.fillStyle = PALETTE.counterTop;
    context.fillRect(0, COUNTER_Y - 14, FIELD.width, 16);
    context.fillStyle = PALETTE.counterEdge;
    context.fillRect(0, COUNTER_Y + 2, FIELD.width, 3);

    for (const station of STATIONS) {
      const x = station.x;
      const y = COUNTER_Y;
      const near = helpers.nearest === station;
      if (near) {
        context.fillStyle = 'rgba(242,201,76,0.25)';
        roundRect(context, x - 52, y - 66, 104, 62, 10);
        context.fill();
      }
      context.fillStyle = PALETTE.board;
      roundRect(context, x - 46, y - 52, 92, 52, 8);
      context.fill();
      context.fillStyle = PALETTE.cream;
      text(station.label, x, y + 22, 12, PALETTE.cream, 'center', '700 ');
      if (station.kind === 'bin' || station.kind === 'fridge') {
        // A little pile of the ingredient, ready to grab.
        drawIngredient(context, station.kind === 'fridge' ? RAW_PATTY : station.item, x, y - 26, 34);
        drawIngredient(context, station.kind === 'fridge' ? RAW_PATTY : station.item, x - 18, y - 14, 24);
        drawIngredient(context, station.kind === 'fridge' ? RAW_PATTY : station.item, x + 18, y - 14, 24);
      } else if (station.kind === 'grill') {
        // Two grill slots with grates.
        context.fillStyle = PALETTE.grill;
        roundRect(context, x - 46, y - 50, 92, 46, 6);
        context.fill();
        context.strokeStyle = '#4a4f58';
        context.lineWidth = 2;
        for (let g = 0; g < 4; g += 1) {
          context.beginPath();
          context.moveTo(x - 42, y - 40 + g * 11);
          context.lineTo(x + 42, y - 40 + g * 11);
          context.stroke();
        }
        state.grill.forEach((slot, i) => {
          const sx = x - 23 + i * 46;
          if (slot.state === 'empty') return;
          if (slot.state === 'burnt') {
            drawPatty(context, sx, y - 26, 36, 'burnt');
            text('BURNT', sx, y - 52, 10, '#888', 'center', '700 ');
            return;
          }
          const done = slot.state === 'done';
          drawPatty(context, sx, y - 26, 36, done ? 'cooked' : 'raw');
          // Cook progress ring: fills as the patty cooks, glows gold when done.
          const frac = done ? 1 : slot.t / GRILL.cookSeconds;
          context.strokeStyle = done ? PALETTE.gold : PALETTE.grillHot;
          context.lineWidth = 4;
          context.beginPath();
          context.arc(sx, y - 26, 24, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
          context.stroke();
          if (done) text('READY', sx, y - 56, 11, PALETTE.gold, 'center', '700 ');
        });
      } else if (station.kind === 'plate') {
        // The assembly plate: a white plate holding the dish so far.
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.ellipse(x, y - 18, 44, 14, 0, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#dfe6ea';
        context.beginPath();
        context.ellipse(x, y - 20, 34, 10, 0, 0, Math.PI * 2);
        context.fill();
        state.plate.forEach((item, i) => {
          drawIngredient(context, item, x, y - 26 - i * 12, 30);
        });
        if (state.plate.length === 0) text('empty plate', x, y - 58, 11, PALETTE.muted, 'center');
      } else if (station.kind === 'pass') {
        // The serving window with its little bell.
        context.fillStyle = '#3a2a1c';
        roundRect(context, x - 46, y - 52, 92, 50, 8);
        context.fill();
        context.fillStyle = '#f7e3b0';
        roundRect(context, x - 38, y - 46, 76, 34, 6);
        context.fill();
        const match = helpers.matchingOrder;
        context.fillStyle = '#8a6d3b';
        context.beginPath();
        context.arc(x, y - 8, 10, Math.PI, 0);
        context.fill();
        context.fillRect(x - 2, y - 8, 4, 6);
        if (match) {
          text(`#${match.id} READY`, x, y - 62, 13, PALETTE.gold, 'center', '700 ');
        } else {
          text('serve here', x, y - 34, 11, '#8a6d3b', 'center');
        }
      } else if (station.kind === 'trash') {
        context.fillStyle = '#4a4f58';
        roundRect(context, x - 22, y - 48, 44, 44, 6);
        context.fill();
        context.fillStyle = '#2b2f36';
        roundRect(context, x - 26, y - 54, 52, 10, 4);
        context.fill();
      }
    }
  }

  function drawChef(state, time) {
    const chef = state.chef;
    const bob = chef.moving ? Math.sin(chef.walk) * 2.5 : Math.sin(time * 2) * 1;
    const x = chef.x;
    const y = chef.y + bob * 0.4;
    // Shadow.
    context.fillStyle = 'rgba(0,0,0,0.18)';
    context.beginPath();
    context.ellipse(x, chef.y + 34, 26, 7, 0, 0, Math.PI * 2);
    context.fill();
    // Legs, apron body, arms.
    context.fillStyle = PALETTE.chefPants;
    context.fillRect(x - 14, y + 12, 12, 20);
    context.fillRect(x + 2, y + 12, 12, 20);
    context.fillStyle = PALETTE.chefShirt;
    roundRect(context, x - 18, y - 14, 36, 30, 10);
    context.fill();
    context.fillStyle = PALETTE.chefApron;
    roundRect(context, x - 12, y - 8, 24, 24, 6);
    context.fill();
    context.fillStyle = PALETTE.chefSkin;
    context.beginPath();
    context.arc(x - 20, y - 2, 6, 0, Math.PI * 2);
    context.arc(x + 20, y - 2, 6, 0, Math.PI * 2);
    context.fill();
    // Head and toque.
    context.fillStyle = PALETTE.chefSkin;
    context.beginPath();
    context.arc(x, y - 24, 14, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.chefHat;
    roundRect(context, x - 13, y - 44, 26, 14, 7);
    context.fill();
    context.beginPath();
    context.arc(x - 8, y - 42, 7, 0, Math.PI * 2);
    context.arc(x, y - 46, 8, 0, Math.PI * 2);
    context.arc(x + 8, y - 42, 7, 0, Math.PI * 2);
    context.fill();
    // Eyes look the way the chef faces.
    context.fillStyle = '#2c2118';
    context.beginPath();
    context.arc(x - 5 + chef.face * 2, y - 25, 1.8, 0, Math.PI * 2);
    context.arc(x + 5 + chef.face * 2, y - 25, 1.8, 0, Math.PI * 2);
    context.fill();
    // What the hands hold, stacked above the toque.
    chef.carry.forEach((item, i) => {
      drawIngredient(context, item, x, y - 58 - i * 16, 26);
    });
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.color === 'steam') {
        context.fillStyle = PALETTE.steam;
        context.globalAlpha = alpha * 0.7;
      } else {
        context.fillStyle = p.color;
        context.globalAlpha = alpha;
      }
      context.beginPath();
      context.arc(p.x, p.y, p.size * alpha + 1, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawFloats(state) {
    for (const f of state.floats) {
      context.globalAlpha = Math.max(0, f.life / f.maxLife);
      text(f.text, f.x, f.y, 26, f.color, 'center', '700 ');
    }
    context.globalAlpha = 1;
  }

  function drawPanel(title, lines, prompt) {
    const width = 640;
    const height = 140 + lines.length * 32;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(36,26,18,0.88)';
    roundRect(context, x, y, width, height, 16);
    context.fill();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 2;
    roundRect(context, x, y, width, height, 16);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 66, 44, PALETTE.cream, 'center', '700 ');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 110 + i * 32, 20, '#d8c9ae', 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 28, 22, PALETTE.gold, 'center', '700 ');
  }

  const TITLE_LINES = [
    'Cook, stack and serve before patience runs out.',
    'Move with WASD or arrows, or click a station.',
    'Space or E uses the nearest station. P pauses.',
    'Menu: Classic, Cheesy, Garden, Sunrise, Double.',
    'Grill the patty golden. Never serve a burnt one.',
    '',
  ];
  const PAUSED_LINES = ['The orders will wait. The patties will not.'];
  const OVER_LINES = ['', '', ''];

  /** Paint one frame: the room, then the HUD or a panel for the screen. */
  function draw(state, screen, best, time, helpers = { nearest: null, matchingOrder: null }) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Trauma shake: the camera offset only, never the simulation. Summed sines,
    // so the same moment always shakes the same way (screenshots stay exact).
    const shake = state.trauma * state.trauma * 10;
    const sx = shake > 0.2 ? Math.sin(time * 39.7) * shake * 0.5 : 0;
    const sy = shake > 0.2 ? Math.cos(time * 31.3) * shake * 0.5 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx, view.y + sy);
    drawRoom(state);
    drawOrderBoard(state, time);
    drawHud(state, time);
    drawCounter(state, time, helpers);
    drawChef(state, time);
    drawParticles(state);
    drawFloats(state);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = best > 0 ? bestLabel(best) : 'First shift? The board is hungry.';
      drawPanel('SKILLET RUSH', TITLE_LINES, 'Press Space or click to start');
      return;
    }
    if (screen === SCREEN_PAUSED) drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = servedLabel(state.served) + ` dishes  •  ${state.missed} walked out`;
      OVER_LINES[2] = bestLabel(best);
      drawPanel(state.stars > 0 ? 'Shift complete!' : 'The kitchen closed early', OVER_LINES, 'Press Space or click to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toLogical };
}
