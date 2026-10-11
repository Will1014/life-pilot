import assert from "node:assert/strict";
import { test } from "node:test";

import { SHIP, createGame, setSpeed, tick, updateShip } from "../src/game.js";
import { consumerResource, createUniverse, stepUniverse } from "../src/universe.js";

const IDLE = { left: false, right: false, thrust: false, brake: false };
const CONFIG = { lattice: "hex", rule: consumerResource(3, 6, 2, 1), w: 64, h: 64, occupancy: 0.05, seed: 2 };

const fly = (game, input, seconds) => {
  for (let i = 0; i < seconds * 60; i++) updateShip(game, input, 1 / 60);
};

test("thrust moves the ship along its heading", () => {
  const game = createGame(CONFIG);
  const y0 = game.ship.y;
  fly(game, { ...IDLE, thrust: true }, 0.2);
  assert.ok(game.ship.y < y0 - 0.5, "ship starts pointing up, so y should fall");
});

test("each speed setting caps the ship at its own top speed", () => {
  for (let s = 0; s < SHIP.speeds.length; s++) {
    const game = createGame(CONFIG);
    setSpeed(game, s);
    fly(game, { ...IDLE, thrust: true }, 3);
    const speed = Math.hypot(game.ship.vx, game.ship.vy);
    assert.ok(Math.abs(speed - SHIP.speeds[s]) < 1e-6, `setting ${s + 1}: ${speed}`);
  }
});

test("the brake stops the ship faster than drag alone", () => {
  const coast = createGame(CONFIG);
  const brake = createGame(CONFIG);
  for (const g of [coast, brake]) { setSpeed(g, 4); fly(g, { ...IDLE, thrust: true }, 2); }
  fly(coast, IDLE, 0.5);
  fly(brake, { ...IDLE, brake: true }, 0.5);
  assert.ok(Math.hypot(brake.ship.vx, brake.ship.vy) < Math.hypot(coast.ship.vx, coast.ship.vy) / 3);
});

test("the ship has no effect on the universe", () => {
  const game = createGame(CONFIG);
  const alone = createUniverse(CONFIG);
  setSpeed(game, 4);
  for (let gen = 0; gen < 40; gen++) {
    fly(game, { ...IDLE, thrust: true, left: gen % 3 === 0, brake: gen % 7 === 0 }, 0.1);
    tick(game);
    stepUniverse(alone);
  }
  assert.deepEqual(game.universe.species, alone.species);
  assert.deepEqual(game.universe.env, alone.env);
});
