// The alphabet soup in the hero: pasta letters carried by a small fluid
// simulation of the broth. Plain arithmetic with no DOM, so it runs the same
// in the browser and in tests.
//
// The broth that moves is the unit disc, centred on the origin with y pointing
// down, as on screen. Distances are in its radii, time in seconds and angles
// in degrees, clockwise.

export type SoupLetter = {
  char: string;
  x: number;
  y: number;
  angle: number;
};

// Every letter once, then enough again to spell SOUP PARTY, then a few vowels.
const SOUP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ" + "SOUPPARTY" + "AEEIO";

/** Half the room a letter keeps to itself. */
export const LETTER_RADIUS = 0.1;
/**
 * How far from the centre a letter may drift. Nearly all the way: broth that
 * could go where letters could not would leave them heaped at the edge.
 */
export const LETTER_LIMIT = 0.96;

// The broth is a grid of cells across the bowl's bounding square, with a
// one-cell border. Cells outside the disc are the bowl and never move.
const GRID = 28;
const SIZE = GRID + 2;
const CELL = 2 / GRID;
const PRESSURE_PASSES = 16;
/** Over-relaxation: each pass goes this far past its own estimate. */
const PRESSURE_REACH = 1.7;

/** The longest step taken at once; a slower frame just slows the soup. */
const MAX_STEP = 1 / 30;
/** Seconds for a current to fall to about a third of its speed. */
const SETTLE_TIME = 1.5;
/** Seconds a letter takes to pick up the turning of the broth around it. */
const LETTER_TURN_LAG = 0.3;
const OVERLAP_EASE = 0.04;

/** How far around the pointer the broth is dragged along. */
const STIR_RADIUS = 0.2;
const STIR_GRIP = 0.04;
const MAX_STIR_SPEED = 5;
const MIN_STIR_STEP = 1 / 240;

// Below these the soup is taken to be still: a pixel or two a second.
const REST_SPEED = 0.01;
const REST_SPIN = 0.6;
const REST_OVERLAP = 0.002;

const DEGREES = 180 / Math.PI;

export type Soup = {
  letters: number;
  x: Float64Array;
  y: Float64Array;
  angle: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  spin: Float64Array;
  /** Indices of the cells inside the bowl. */
  cells: Int32Array;
  wet: Uint8Array;
  u: Float32Array;
  v: Float32Array;
  nextU: Float32Array;
  nextV: Float32Array;
  pressure: Float32Array;
  divergence: Float32Array;
};

// Small seeded generator (mulberry32). Integer arithmetic only, so the server
// and every browser lay the letters out identically.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scatters letters across the bowl, loosely but without overlaps. The same
 * arguments always give the same soup.
 */
export function layoutSoupLetters(chars = SOUP_CHARS, seed = 4): SoupLetter[] {
  const next = random(seed);
  const order = Array.from(chars);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const letters: SoupLetter[] = [];
  for (const char of order) {
    // The roomiest of a few random spots, so letters spread out without
    // forming a pattern.
    let x = 0;
    let y = 0;
    let room = -1;
    for (let attempt = 0; attempt < 16 || room < 4 * LETTER_RADIUS ** 2; attempt++) {
      if (attempt === 400) {
        throw new Error("The bowl is too full.");
      }
      const px = (next() * 2 - 1) * LETTER_LIMIT;
      const py = (next() * 2 - 1) * LETTER_LIMIT;
      if (px * px + py * py > LETTER_LIMIT ** 2) {
        continue;
      }
      let nearest = Infinity;
      for (const other of letters) {
        nearest = Math.min(nearest, (other.x - px) ** 2 + (other.y - py) ** 2);
      }
      if (nearest > room) {
        x = px;
        y = py;
        room = nearest;
      }
    }
    letters.push({
      char,
      x: Math.round(x * 1000) / 1000,
      y: Math.round(y * 1000) / 1000,
      angle: Math.round(next() * 360) - 180,
    });
  }
  return letters;
}

export function createSoup(letters: readonly SoupLetter[]): Soup {
  const wet = new Uint8Array(SIZE * SIZE);
  const cells: number[] = [];
  for (let j = 1; j <= GRID; j++) {
    for (let i = 1; i <= GRID; i++) {
      const x = (i - 0.5) * CELL - 1;
      const y = (j - 0.5) * CELL - 1;
      if (x * x + y * y < 1) {
        wet[i + j * SIZE] = 1;
        cells.push(i + j * SIZE);
      }
    }
  }

  return {
    letters: letters.length,
    x: Float64Array.from(letters, (letter) => letter.x),
    y: Float64Array.from(letters, (letter) => letter.y),
    angle: Float64Array.from(letters, (letter) => letter.angle),
    vx: new Float64Array(letters.length),
    vy: new Float64Array(letters.length),
    spin: new Float64Array(letters.length),
    cells: Int32Array.from(cells),
    wet,
    u: new Float32Array(SIZE * SIZE),
    v: new Float32Array(SIZE * SIZE),
    nextU: new Float32Array(SIZE * SIZE),
    nextV: new Float32Array(SIZE * SIZE),
    pressure: new Float32Array(SIZE * SIZE),
    divergence: new Float32Array(SIZE * SIZE),
  };
}

/** Sets the whole bowl turning, in degrees a second. */
export function swirlSoup(soup: Soup, rate: number) {
  const { cells, u, v } = soup;
  for (let n = 0; n < cells.length; n++) {
    const cell = cells[n];
    const i = cell % SIZE;
    const j = (cell - i) / SIZE;
    u[cell] = (-rate / DEGREES) * ((j - 0.5) * CELL - 1);
    v[cell] = (rate / DEGREES) * ((i - 0.5) * CELL - 1);
  }
}

/**
 * Drags the broth along a stroke from one point to another that took
 * `seconds`. Broth near the stroke takes up its speed; broth further away is
 * left to follow.
 */
export function stirSoup(
  soup: Soup,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  seconds: number,
) {
  const dt = Math.max(seconds, MIN_STIR_STEP);
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  if (length === 0) {
    return;
  }
  const speed = Math.min(length / dt, MAX_STIR_SPEED);
  const stirU = (dx / length) * speed;
  const stirV = (dy / length) * speed;
  const grip = 1 - Math.exp(-dt / STIR_GRIP);

  const { cells, u, v } = soup;
  for (let n = 0; n < cells.length; n++) {
    const cell = cells[n];
    const i = cell % SIZE;
    const x = (i - 0.5) * CELL - 1;
    const y = ((cell - i) / SIZE - 0.5) * CELL - 1;
    // Distance from the cell to the nearest point of the stroke.
    const along = Math.min(
      Math.max(((x - fromX) * dx + (y - fromY) * dy) / (length * length), 0),
      1,
    );
    const offX = x - fromX - along * dx;
    const offY = y - fromY - along * dy;
    const hold = grip * Math.exp(-(offX * offX + offY * offY) / STIR_RADIUS ** 2);
    u[cell] += (stirU - u[cell]) * hold;
    v[cell] += (stirV - v[cell]) * hold;
  }
}

// The broth carries its own motion along, slowing as it goes.
function advect(soup: Soup, dt: number) {
  const { cells, u, v, nextU, nextV } = soup;
  const reach = dt / CELL;
  const keep = Math.exp(-dt / SETTLE_TIME);
  for (let n = 0; n < cells.length; n++) {
    const cell = cells[n];
    const i = cell % SIZE;
    const j = (cell - i) / SIZE;
    const x = Math.min(Math.max(i - reach * u[cell], 0.5), GRID + 0.5);
    const y = Math.min(Math.max(j - reach * v[cell], 0.5), GRID + 0.5);
    const i0 = Math.floor(x);
    const j0 = Math.floor(y);
    const fx = x - i0;
    const fy = y - j0;
    const a = i0 + j0 * SIZE;
    const b = a + SIZE;
    nextU[cell] =
      keep *
      ((1 - fx) * ((1 - fy) * u[a] + fy * u[b]) +
        fx * ((1 - fy) * u[a + 1] + fy * u[b + 1]));
    nextV[cell] =
      keep *
      ((1 - fx) * ((1 - fy) * v[a] + fy * v[b]) +
        fx * ((1 - fy) * v[a + 1] + fy * v[b + 1]));
  }
  soup.u = nextU;
  soup.v = nextV;
  soup.nextU = u;
  soup.nextV = v;
}

// Broth does not compress: what flows into a cell flows out again. This is
// what turns a straight stroke into eddies and sends broth round the bowl
// rather than through its wall. Returns the square of the fastest speed left.
function conserve(soup: Soup) {
  const { cells, wet, u, v, pressure, divergence } = soup;
  for (let n = 0; n < cells.length; n++) {
    const cell = cells[n];
    divergence[cell] =
      -0.5 * CELL * (u[cell + 1] - u[cell - 1] + v[cell + SIZE] - v[cell - SIZE]);
  }
  // The pressure is worked out by successive approximation, starting from the
  // last step's, which is nearly right already.
  for (let pass = 0; pass < PRESSURE_PASSES; pass++) {
    for (let n = 0; n < cells.length; n++) {
      const cell = cells[n];
      // The bowl's own cells push back exactly as hard as they are pushed, so
      // only the broth's count.
      const open = wet[cell - 1] + wet[cell + 1] + wet[cell - SIZE] + wet[cell + SIZE];
      pressure[cell] +=
        PRESSURE_REACH *
        ((divergence[cell] +
          pressure[cell - 1] +
          pressure[cell + 1] +
          pressure[cell - SIZE] +
          pressure[cell + SIZE]) /
          (open || 1) -
          pressure[cell]);
    }
  }
  let fastest = 0;
  for (let n = 0; n < cells.length; n++) {
    const cell = cells[n];
    const here = pressure[cell];
    const left = wet[cell - 1] ? pressure[cell - 1] : here;
    const right = wet[cell + 1] ? pressure[cell + 1] : here;
    const above = wet[cell - SIZE] ? pressure[cell - SIZE] : here;
    const below = wet[cell + SIZE] ? pressure[cell + SIZE] : here;
    u[cell] -= (0.5 * (right - left)) / CELL;
    v[cell] -= (0.5 * (below - above)) / CELL;
    fastest = Math.max(fastest, u[cell] * u[cell] + v[cell] * v[cell]);
  }
  return fastest;
}

const flow = { u: 0, v: 0 };

// The broth's velocity at a point, into `flow`. The bowl's cells are still,
// so the broth slows towards the wall.
function readFlow(soup: Soup, x: number, y: number) {
  const gx = Math.min(Math.max((x + 1) / CELL + 0.5, 0), SIZE - 1.001);
  const gy = Math.min(Math.max((y + 1) / CELL + 0.5, 0), SIZE - 1.001);
  const i0 = Math.floor(gx);
  const j0 = Math.floor(gy);
  const fx = gx - i0;
  const fy = gy - j0;
  const a = i0 + j0 * SIZE;
  const b = a + SIZE;
  const { u, v } = soup;
  flow.u =
    (1 - fx) * ((1 - fy) * u[a] + fy * u[b]) +
    fx * ((1 - fy) * u[a + 1] + fy * u[b + 1]);
  flow.v =
    (1 - fx) * ((1 - fy) * v[a] + fy * v[b]) +
    fx * ((1 - fy) * v[a + 1] + fy * v[b + 1]);
}

// Returns whether any letter is still on the move.
function moveLetters(soup: Soup, dt: number) {
  const { letters, x, y, angle, vx, vy, spin } = soup;
  const turn = 1 - Math.exp(-dt / LETTER_TURN_LAG);
  let moving = false;

  for (let n = 0; n < letters; n++) {
    // A letter goes where the broth goes: its inertia is the broth's. The
    // broth is read half a step ahead, which keeps a letter on a curved
    // current instead of slowly working outwards to the wall.
    readFlow(soup, x[n], y[n]);
    readFlow(soup, x[n] + 0.5 * dt * flow.u, y[n] + 0.5 * dt * flow.v);
    vx[n] = flow.u;
    vy[n] = flow.v;

    // It turns at half the broth's curl around it, as anything afloat does,
    // though not at once.
    readFlow(soup, x[n] + CELL, y[n]);
    let curl = flow.v;
    readFlow(soup, x[n] - CELL, y[n]);
    curl -= flow.v;
    readFlow(soup, x[n], y[n] + CELL);
    curl -= flow.u;
    readFlow(soup, x[n], y[n] - CELL);
    curl += flow.u;
    spin[n] += ((curl / (4 * CELL)) * DEGREES - spin[n]) * turn;

    x[n] += vx[n] * dt;
    y[n] += vy[n] * dt;
    angle[n] += spin[n] * dt;
    moving ||=
      vx[n] * vx[n] + vy[n] * vy[n] > REST_SPEED ** 2 ||
      Math.abs(spin[n]) > REST_SPIN;
  }

  // Letters that have drifted onto each other ease apart.
  const ease = 1 - Math.exp(-dt / OVERLAP_EASE);
  for (let a = 0; a < letters; a++) {
    for (let b = a + 1; b < letters; b++) {
      const dx = x[b] - x[a];
      const dy = y[b] - y[a];
      const gap = dx * dx + dy * dy;
      if (gap >= 4 * LETTER_RADIUS ** 2) {
        continue;
      }
      const distance = Math.sqrt(gap);
      const overlap = 2 * LETTER_RADIUS - distance;
      const push = 0.5 * overlap * ease;
      const nx = distance > 0 ? dx / distance : 1;
      const ny = distance > 0 ? dy / distance : 0;
      x[a] -= nx * push;
      y[a] -= ny * push;
      x[b] += nx * push;
      y[b] += ny * push;
      moving ||= overlap > REST_OVERLAP;
    }
  }

  // The bowl keeps them in.
  for (let n = 0; n < letters; n++) {
    const distance = Math.hypot(x[n], y[n]);
    if (distance > LETTER_LIMIT) {
      x[n] *= LETTER_LIMIT / distance;
      y[n] *= LETTER_LIMIT / distance;
    }
  }

  return moving;
}

/**
 * Moves the soup on by `seconds`. Returns whether anything is still moving;
 * once nothing is, there is nothing to do until the soup is stirred again.
 */
export function stepSoup(soup: Soup, seconds: number): boolean {
  const dt = Math.min(seconds, MAX_STEP);
  if (!(dt > 0)) {
    return true;
  }
  advect(soup, dt);
  const flowing = conserve(soup) > REST_SPEED ** 2;
  return moveLetters(soup, dt) || flowing;
}
