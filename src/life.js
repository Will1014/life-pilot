// Conway's Game of Life on a toroidal grid (edges wrap).
// A grid is { w, h, cells } with cells a Uint8Array, row-major, 1 = alive.

export const CONWAY = { birth: [3], survive: [2, 3] };

export function createGrid(w, h) {
  return { w, h, cells: new Uint8Array(w * h) };
}

export const wrap = (v, n) => ((v % n) + n) % n;

export function index(grid, x, y) {
  return wrap(y, grid.h) * grid.w + wrap(x, grid.w);
}

export function get(grid, x, y) {
  return grid.cells[index(grid, x, y)];
}

export function set(grid, x, y, value) {
  grid.cells[index(grid, x, y)] = value;
}

export function population(grid) {
  let n = 0;
  for (const c of grid.cells) n += c;
  return n;
}

// One generation. Returns a new grid; the input is not modified.
export function step(grid, rule = CONWAY, out = createGrid(grid.w, grid.h)) {
  const { w, h, cells } = grid;
  const born = new Uint8Array(9);
  const stays = new Uint8Array(9);
  for (const n of rule.birth) born[n] = 1;
  for (const n of rule.survive) stays[n] = 1;
  const next = out.cells;
  for (let y = 0; y < h; y++) {
    const up = ((y - 1 + h) % h) * w;
    const row = y * w;
    const down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const l = (x - 1 + w) % w;
      const r = (x + 1) % w;
      const n =
        cells[up + l] + cells[up + x] + cells[up + r] +
        cells[row + l] + cells[row + r] +
        cells[down + l] + cells[down + x] + cells[down + r];
      next[row + x] = cells[row + x] ? stays[n] : born[n];
    }
  }
  return out;
}

// Patterns are lists of [dx, dy] live-cell offsets. Screen coordinates:
// x grows right, y grows down.
export const PATTERNS = {
  // Travels one cell right and one cell down every 4 generations.
  glider: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  blinker: [[0, 0], [1, 0], [2, 0]],
  block: [[0, 0], [1, 0], [0, 1], [1, 1]],
};

// Orient the glider to travel toward (sx, sy), each +1 or -1.
export function gliderToward(sx, sy) {
  return PATTERNS.glider.map(([dx, dy]) => [sx > 0 ? dx : 2 - dx, sy > 0 ? dy : 2 - dy]);
}

export function stamp(grid, pattern, x, y, value = 1) {
  for (const [dx, dy] of pattern) set(grid, x + dx, y + dy, value);
}

// Deterministic PRNG (mulberry32), so runs can be replayed from a seed.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scatter soup patches: `patches` discs of random cells at the given density.
export function seedSoup(grid, random, { patches = 40, radius = 12, density = 0.35, clear = null } = {}) {
  for (let p = 0; p < patches; p++) {
    const cx = Math.floor(random() * grid.w);
    const cy = Math.floor(random() * grid.h);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius || random() > density) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (clear && torusDistance(grid, x, y, clear.x, clear.y) < clear.r) continue;
        set(grid, x, y, 1);
      }
    }
  }
}

export function torusDistance(grid, x1, y1, x2, y2) {
  let dx = Math.abs(wrap(x1, grid.w) - wrap(x2, grid.w));
  let dy = Math.abs(wrap(y1, grid.h) - wrap(y2, grid.h));
  dx = Math.min(dx, grid.w - dx);
  dy = Math.min(dy, grid.h - dy);
  return Math.hypot(dx, dy);
}
