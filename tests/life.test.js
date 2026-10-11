import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PATTERNS, createGrid, get, gliderToward, population, rng, stamp, step, torusDistance,
} from "../src/life.js";

function live(grid) {
  const out = [];
  for (let y = 0; y < grid.h; y++) for (let x = 0; x < grid.w; x++) if (get(grid, x, y)) out.push(`${x},${y}`);
  return out.sort();
}

function run(grid, n) {
  for (let i = 0; i < n; i++) grid = step(grid);
  return grid;
}

test("block is a still life", () => {
  const g = createGrid(10, 10);
  stamp(g, PATTERNS.block, 4, 4);
  assert.deepEqual(live(run(g, 5)), live(g));
});

test("blinker oscillates with period 2", () => {
  const g = createGrid(10, 10);
  stamp(g, PATTERNS.blinker, 3, 5);
  const one = run(g, 1);
  assert.notDeepEqual(live(one), live(g));
  assert.deepEqual(live(one), ["4,4", "4,5", "4,6"]);
  assert.deepEqual(live(run(g, 2)), live(g));
});

for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
  test(`glider toward (${sx},${sy}) moves one cell diagonally every 4 generations`, () => {
    const g = createGrid(20, 20);
    stamp(g, gliderToward(sx, sy), 8, 8);
    const after = run(g, 4);
    const shifted = live(g).map((c) => {
      const [x, y] = c.split(",").map(Number);
      return `${x + sx},${y + sy}`;
    }).sort();
    assert.deepEqual(live(after), shifted);
  });
}

test("glider wraps around the torus and survives", () => {
  const g = createGrid(12, 12);
  stamp(g, gliderToward(1, 1), 0, 0);
  // 48 generations = 12 diagonal cells = one full lap of a 12-wide torus.
  assert.deepEqual(live(run(g, 48)), live(g));
});

test("step does not modify its input", () => {
  const g = createGrid(8, 8);
  stamp(g, PATTERNS.blinker, 2, 2);
  const before = live(g);
  step(g);
  assert.deepEqual(live(g), before);
});

test("rng is deterministic for a seed", () => {
  const a = rng(42);
  const b = rng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});

test("torus distance takes the short way round", () => {
  const g = createGrid(100, 100);
  assert.equal(torusDistance(g, 1, 0, 99, 0), 2);
  assert.equal(population(g), 0);
});
