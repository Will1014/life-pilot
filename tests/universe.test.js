import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  LATTICES, cellAt, cellIndex, consumerResource, conway, createUniverse, nearestCell, population,
  randomRule, rng, stepUniverse, toPlane, wrapPoint,
} from "../src/universe.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/parity.json", import.meta.url)));

function fromFixture(c, { lattice = LATTICES[c.lattice], transpose = false } = {}) {
  const rule = {
    name: c.name, ke: c.ke, n: c.n,
    speciesTable: Uint8Array.from(c.speciesTable), envTable: Uint8Array.from(c.envTable),
  };
  const [w, h] = transpose ? [c.rows, c.cols] : [c.cols, c.rows];
  const u = createUniverse({ lattice, rule, w, h, envPeriod: c.envPeriod });
  u.species.set(c.species[0]);
  u.env.set(c.env[0]);
  return u;
}

// Generation at which a run first disagrees with the Python history, or -1.
function firstMismatch(c, options) {
  const u = fromFixture(c, options);
  for (let t = 1; t < c.species.length; t++) {
    stepUniverse(u);
    if (!u.species.every((v, i) => v === c.species[t][i]) || !u.env.every((v, i) => v === c.env[t][i])) return t;
  }
  return -1;
}

for (const c of fixture.cases) {
  test(`steps exactly as coupled.py: ${c.name}`, () => {
    const moved = c.species.some((g, t) => t > 0 && g.some((v, i) => v !== c.species[0][i]));
    assert.ok(moved, "fixture must actually change, or matching it proves nothing");
    assert.equal(firstMismatch(c), -1);
  });
}

test("parity check catches the likely indexing mistakes (null)", () => {
  // If a deliberately wrong engine still matched the fixture, the parity tests
  // above would not be checking what they claim to. Rotating an offset set is no
  // use here: a square neighbourhood rotates onto itself.
  const mirroredHex = { ...LATTICES.hex, offsets: [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]] };
  for (const c of fixture.cases) {
    assert.notEqual(firstMismatch(c, { transpose: true }), -1, `${c.name}, rows and columns swapped`);
    if (c.lattice === "hex") assert.notEqual(firstMismatch(c, { lattice: mirroredHex }), -1, `${c.name}, shear mirrored`);
  }
});

test("consumer-resource tables match the Python generator", () => {
  for (const c of fixture.cases.filter((x) => x.name.includes("consumer"))) {
    const [coloniseAt, regrowAt] = c.lattice === "hex" ? [2, 1] : [1, 2];
    const rule = consumerResource(c.ke, c.n, coloniseAt, regrowAt);
    assert.deepEqual([...rule.speciesTable], c.speciesTable, c.name);
    assert.deepEqual([...rule.envTable], c.envTable, c.name);
  }
});

function lifeUniverse(cells) {
  const u = createUniverse({ lattice: "square8", rule: conway(), w: 10, h: 10, occupancy: 0 });
  for (const [r, q] of cells) u.species[cellIndex(u, r, q)] = 1;
  return u;
}

const live = (u) => [...u.species.keys()].filter((i) => u.species[i]).sort((a, b) => a - b);

test("Conway: a blinker oscillates with period 2", () => {
  const u = lifeUniverse([[5, 3], [5, 4], [5, 5]]);
  const start = live(u);
  stepUniverse(u);
  assert.deepEqual(live(u), [4 * 10 + 4, 5 * 10 + 4, 6 * 10 + 4]);
  stepUniverse(u);
  assert.deepEqual(live(u), start);
});

test("Conway: a glider moves one cell diagonally every 4 generations", () => {
  const glider = [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]];
  const u = lifeUniverse(glider);
  for (let i = 0; i < 4; i++) stepUniverse(u);
  const moved = lifeUniverse(glider.map(([r, q]) => [r + 1, q + 1]));
  assert.deepEqual(live(u), live(moved));
});

test("hex neighbours sit at unit distance, and only they do", () => {
  const L = LATTICES.hex;
  const o = toPlane(L, 0, 0);
  for (const [dr, dq] of L.offsets) {
    const p = toPlane(L, dr, dq);
    assert.ok(Math.abs(Math.hypot(p.x - o.x, p.y - o.y) - 1) < 1e-9);
  }
  for (const [dr, dq] of [[1, 1], [-1, -1]]) {
    const p = toPlane(L, dr, dq);
    assert.ok(Math.hypot(p.x - o.x, p.y - o.y) > 1.5, "the excluded diagonals are not neighbours");
  }
});

test("each cell centre maps back to its own cell, on every lattice", () => {
  for (const L of Object.values(LATTICES)) {
    for (let r = -3; r < 9; r++) {
      for (let q = -3; q < 9; q++) {
        const p = toPlane(L, r, q);
        assert.deepEqual(nearestCell(L, p.x + 0.2, p.y - 0.2), [r, q], `${L.name} ${r},${q}`);
      }
    }
  }
});

test("wrapping the ship's position never changes which cell it is over", () => {
  const random = rng(3);
  for (const lattice of Object.keys(LATTICES)) {
    const u = createUniverse({ lattice, rule: consumerResource(3, LATTICES[lattice].offsets.length), w: 20, h: 14 });
    for (let k = 0; k < 500; k++) {
      const x = (random() - 0.5) * 200;
      const y = (random() - 0.5) * 200;
      const p = wrapPoint(u, x, y);
      assert.equal(cellAt(u, p.x, p.y), cellAt(u, x, y), `${lattice} ${x},${y}`);
    }
  }
});

test("a universe is reproducible from its seeds", () => {
  const make = () => createUniverse({ lattice: "hex", rule: randomRule(3, 6, rng(9)), w: 30, h: 30, occupancy: 0.3, seed: 4 });
  const a = make();
  const b = make();
  for (let i = 0; i < 20; i++) { stepUniverse(a); stepUniverse(b); }
  assert.deepEqual(a.species, b.species);
  assert.deepEqual(a.env, b.env);
  assert.ok(population(a) > 0);
});

test("a rule built for one lattice is refused on another", () => {
  assert.throws(() => createUniverse({ lattice: "hex", rule: conway() }), /neighbours/);
});
