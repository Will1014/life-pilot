import assert from "node:assert/strict";
import { test } from "node:test";

import { createGame, fireGlider, hullCells, score, tick, updateShip } from "../src/game.js";
import { createGrid, get, population, set } from "../src/life.js";

const IDLE = { left: false, right: false, thrust: false, plough: false, fire: false };

function emptyGame() {
  const game = createGame(1);
  game.world = createGrid(game.settings.worldW, game.settings.worldH);
  game.spare = createGrid(game.settings.worldW, game.settings.worldH);
  return game;
}

test("start area is clear so the ship is not hit on spawn", () => {
  const game = createGame(7);
  for (const [x, y] of hullCells(game)) assert.equal(get(game.world, x, y), 0);
});

test("thrust moves the ship along its heading", () => {
  const game = emptyGame();
  const y0 = game.ship.y;
  for (let i = 0; i < 60; i++) updateShip(game, { ...IDLE, thrust: true }, 1 / 60);
  assert.ok(game.ship.y < y0 - 1, "ship starts pointing up, so y should fall");
});

test("exhaust seeds live cells behind the ship", () => {
  const game = emptyGame();
  game.settings = { ...game.settings, exhaustPerTick: 20 };
  tick(game, { ...IDLE, thrust: true });
  assert.ok(population(game.world) > 0, "the wake should leave life behind");
  const below = [...Array(8).keys()].some((d) =>
    [-1, 0, 1].some((dx) => get(game.world, Math.floor(game.ship.x) + dx, Math.floor(game.ship.y) + 2 + d)));
  assert.ok(below, "ship points up, so its wake is below it");
});

test("touching live cells damages the hull", () => {
  const game = emptyGame();
  const x = Math.floor(game.ship.x);
  const y = Math.floor(game.ship.y);
  // A block is stable, so it is still there after the Life step.
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(game.world, x + dx, y + dy, 1);
  tick(game, IDLE);
  assert.ok(game.hull < game.settings.maxHull);
});

test("ploughing erases cells for energy instead of taking damage", () => {
  const game = emptyGame();
  const x = Math.floor(game.ship.x);
  const y = Math.floor(game.ship.y);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(game.world, x + dx, y + dy, 1);
  tick(game, { ...IDLE, plough: true });
  assert.equal(game.hull, game.settings.maxHull);
  assert.ok(game.energy < game.settings.maxEnergy);
  for (const [cx, cy] of hullCells(game)) assert.equal(get(game.world, cx, cy), 0);
});

test("firing a glider stamps five cells, costs energy and respects cooldown", () => {
  const game = emptyGame();
  assert.equal(fireGlider(game), true);
  assert.equal(population(game.world), 5);
  assert.equal(game.energy, game.settings.maxEnergy - game.settings.gliderCost);
  assert.equal(fireGlider(game), false, "cooldown blocks an immediate second shot");
});

test("hull reaching zero ends the run", () => {
  const game = emptyGame();
  game.hull = 1;
  const x = Math.floor(game.ship.x);
  const y = Math.floor(game.ship.y);
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(game.world, x + dx, y + dy, 1);
  tick(game, IDLE);
  assert.equal(game.alive, false);
});

test("exploring new sectors raises the score", () => {
  const game = emptyGame();
  const before = score(game);
  game.ship.vx = game.settings.maxSpeed;
  for (let i = 0; i < 300; i++) updateShip(game, IDLE, 1 / 60);
  assert.ok(game.sectors.size > 1);
  assert.ok(score(game) > before);
});
