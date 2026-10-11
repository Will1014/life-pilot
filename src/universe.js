// A universe is two layers on one lattice, after coupled.py in cellular-automata:
//
//   species: 0 empty, 1 occupied
//   environment: levels 0 .. ke-1 (0 is poorest)
//
// Each layer steps by looking itself up in a table, so this file holds no rule
// logic of its own, only the lookup:
//
//   speciesTable[own_species, own_env, occupied_neighbours]     -> 0/1
//   envTable[own_env, own_species, sum_of_neighbour_env_levels] -> 0..ke-1
//
// Tables are flat Uint8Arrays in that index order (numpy's C order), so a
// table exported from Python can be loaded as it is.
//
// Lattices are periodic. A hex grid uses axial coordinates, the same sheared
// array as lattice.py. Cells are indexed [row r][column q]; offsets are (dr, dq).

export const ROW_HEIGHT = Math.sqrt(3) / 2;

export const LATTICES = {
  hex: { name: "Hexagonal", hex: true, offsets: [[0, 1], [0, -1], [1, 0], [-1, 0], [1, -1], [-1, 1]] },
  square8: {
    name: "Square (8)", hex: false,
    offsets: [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]],
  },
  square4: { name: "Square (4)", hex: false, offsets: [[-1, 0], [1, 0], [0, -1], [0, 1]] },
};

export const mod = (v, n) => ((v % n) + n) % n;

// Deterministic PRNG (mulberry32), so a universe can be rebuilt from its seed.
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

// --- Rules ----------------------------------------------------------------------

export function tableSizes(ke, n) {
  return { species: 2 * ke * (n + 1), env: ke * 2 * (n * (ke - 1) + 1) };
}

export function validateRule(rule) {
  const { ke, n, speciesTable, envTable } = rule;
  const sizes = tableSizes(ke, n);
  if (speciesTable.length !== sizes.species) throw new Error(`species table has ${speciesTable.length} entries, expected ${sizes.species}`);
  if (envTable.length !== sizes.env) throw new Error(`environment table has ${envTable.length} entries, expected ${sizes.env}`);
  if (speciesTable.some((v) => v > 1) || envTable.some((v) => v >= ke)) throw new Error("table output out of range");
}

// Port of consumer_resource() in coupled.py. Occupied cells use up their ground
// one level per environment update; empty ground regrows one level when its
// neighbours' levels sum to at least regrowAt; a species colonises top-level
// ground next to coloniseAt occupied cells, and dies on the poorest ground.
export function consumerResource(ke, n, coloniseAt = 1, regrowAt = 1) {
  const sizes = tableSizes(ke, n);
  const m = n * (ke - 1) + 1;
  const speciesTable = new Uint8Array(sizes.species);
  for (let e = 0; e < ke; e++) {
    for (let c = 0; c <= n; c++) {
      speciesTable[(1 * ke + e) * (n + 1) + c] = e > 0 ? 1 : 0;
      speciesTable[(0 * ke + e) * (n + 1) + c] = e === ke - 1 && c >= coloniseAt ? 1 : 0;
    }
  }
  const envTable = new Uint8Array(sizes.env);
  for (let e = 0; e < ke; e++) {
    for (let total = 0; total < m; total++) {
      envTable[(e * 2 + 1) * m + total] = Math.max(e - 1, 0);
      envTable[(e * 2 + 0) * m + total] = total >= regrowAt ? Math.min(e + 1, ke - 1) : e;
    }
  }
  return { name: "Consumer-resource", ke, n, speciesTable, envTable };
}

// Every table entry drawn at random. The game's generator differs from numpy's,
// so a rule seed here does not reproduce the same seed in the Python app.
export function randomRule(ke, n, random) {
  const sizes = tableSizes(ke, n);
  const speciesTable = Uint8Array.from({ length: sizes.species }, () => (random() < 0.5 ? 1 : 0));
  const envTable = Uint8Array.from({ length: sizes.env }, () => Math.floor(random() * ke));
  return { name: "Random tables", ke, n, speciesTable, envTable };
}

// A Life-like rule is the special case with one environment level that never
// changes. Conway's Life is birth on 3, survival on 2 or 3, on the square (8).
export function lifeLike(n, birth, survive, name = "Life-like") {
  const speciesTable = new Uint8Array(2 * (n + 1));
  for (const c of birth) speciesTable[c] = 1;
  for (const c of survive) speciesTable[n + 1 + c] = 1;
  return { name, ke: 1, n, speciesTable, envTable: new Uint8Array(2) };
}

export const conway = () => lifeLike(8, [3], [2, 3], "Conway's Life");

// --- Universe -------------------------------------------------------------------

export function createUniverse({ lattice, rule, w = 256, h = 256, envPeriod = 1, occupancy = 0.05, seed = 1 }) {
  const L = typeof lattice === "string" ? LATTICES[lattice] : lattice;
  if (rule.n !== L.offsets.length) throw new Error(`rule expects ${rule.n} neighbours, lattice has ${L.offsets.length}`);
  validateRule(rule);
  const size = w * h;
  const n = L.offsets.length;
  const neighbours = new Int32Array(size * n);
  for (let r = 0; r < h; r++) {
    for (let q = 0; q < w; q++) {
      const base = (r * w + q) * n;
      L.offsets.forEach(([dr, dq], k) => {
        neighbours[base + k] = mod(r + dr, h) * w + mod(q + dq, w);
      });
    }
  }
  const random = rng(seed);
  const species = new Uint8Array(size);
  const env = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    species[i] = random() < occupancy ? 1 : 0;
    env[i] = Math.floor(random() * rule.ke);
  }
  return {
    lattice: L, rule, w, h, envPeriod, neighbours, species, env,
    spareSpecies: new Uint8Array(size), spareEnv: new Uint8Array(size), generation: 0,
  };
}

// One synchronous step of both layers; both read the state before the step.
// The environment updates on generations that are multiples of envPeriod.
export function stepUniverse(u) {
  const { species, env, neighbours, rule } = u;
  const { ke, n, speciesTable, envTable } = rule;
  const m = n * (ke - 1) + 1;
  const updateEnv = (u.generation + 1) % u.envPeriod === 0;
  const nextSpecies = u.spareSpecies;
  const nextEnv = u.spareEnv;
  for (let i = 0; i < species.length; i++) {
    let occupied = 0;
    let ground = 0;
    for (let k = i * n, end = k + n; k < end; k++) {
      const j = neighbours[k];
      occupied += species[j];
      ground += env[j];
    }
    const s = species[i];
    const e = env[i];
    nextSpecies[i] = speciesTable[(s * ke + e) * (n + 1) + occupied];
    nextEnv[i] = updateEnv ? envTable[(e * 2 + s) * m + ground] : e;
  }
  u.spareSpecies = species;
  u.spareEnv = env;
  u.species = nextSpecies;
  u.env = nextEnv;
  u.generation += 1;
  return u;
}

export function population(u) {
  let total = 0;
  for (const s of u.species) total += s;
  return total;
}

// --- Geometry -------------------------------------------------------------------
// The plane uses unit spacing between neighbouring cell centres. Hex centres
// follow hex_centres() in lattice.py: x = q + r/2, y = r * sqrt(3)/2.

export function cellIndex(u, r, q) {
  return mod(r, u.h) * u.w + mod(q, u.w);
}

export function toPlane(lattice, r, q) {
  return lattice.hex ? { x: q + r / 2, y: r * ROW_HEIGHT } : { x: q, y: r };
}

// The cell whose centre is nearest to (x, y), as unwrapped [r, q].
export function nearestCell(lattice, x, y) {
  if (!lattice.hex) return [Math.round(y) + 0, Math.round(x) + 0];
  const fr = y / ROW_HEIGHT;
  const fq = x - fr / 2;
  const fs = -fq - fr;
  let q = Math.round(fq);
  let r = Math.round(fr);
  const s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return [r + 0, q + 0]; // + 0 turns -0 into 0
}

export function cellAt(u, x, y) {
  const [r, q] = nearestCell(u.lattice, x, y);
  return cellIndex(u, r, q);
}

// Bring a point back into the fundamental cell of the torus without changing
// which cell it is over.
export function wrapPoint(u, x, y) {
  if (!u.lattice.hex) return { x: mod(x, u.w), y: mod(y, u.h) };
  const r = mod(y / ROW_HEIGHT, u.h);
  const q = mod(x - y / ROW_HEIGHT / 2, u.w);
  return { x: q + r / 2, y: r * ROW_HEIGHT };
}

// The torus also tiles a rectangle this wide and tall, used for the minimap.
export function planeSize(u) {
  return { w: u.w, h: u.lattice.hex ? u.h * ROW_HEIGHT : u.h };
}
