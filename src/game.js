// Game state and rules, independent of the browser. main.js handles the
// keyboard and drawing; everything here can run and be tested under Node.

import { createGrid, get, gliderToward, rng, seedSoup, set, stamp, step, wrap } from "./life.js";

export const SETTINGS = {
  worldW: 256,
  worldH: 256,
  turnRate: 3.2, // radians per second
  thrust: 18, // cells per second squared
  drag: 0.6, // fraction of velocity lost per second
  maxSpeed: 22, // cells per second
  hullRadius: 1.2, // cells
  maxHull: 100,
  damagePerCell: 4, // hull lost per live cell touched, per Life tick
  maxEnergy: 100,
  energyRegen: 12, // per second
  ploughCostPerCell: 1.5, // energy per cell erased
  gliderCost: 20,
  gliderCooldown: 0.35, // seconds
  exhaustPerTick: 3, // cells seeded behind the ship per Life tick while thrusting
  sectorSize: 32, // cells; exploring counts distinct sectors visited
};

export function createGame(seed = 1, settings = SETTINGS) {
  const random = rng(seed);
  const world = createGrid(settings.worldW, settings.worldH);
  const start = { x: settings.worldW / 2, y: settings.worldH / 2 };
  seedSoup(world, random, { clear: { ...start, r: 18 } });
  return {
    settings,
    random,
    world,
    spare: createGrid(settings.worldW, settings.worldH),
    ship: { x: start.x, y: start.y, vx: 0, vy: 0, angle: -Math.PI / 2 },
    hull: settings.maxHull,
    energy: settings.maxEnergy,
    cooldown: 0,
    time: 0,
    generation: 0,
    sectors: new Set([sectorOf(start.x, start.y, settings)]),
    alive: true,
    lastHit: -1,
  };
}

function sectorOf(x, y, s) {
  return `${Math.floor(wrap(x, s.worldW) / s.sectorSize)},${Math.floor(wrap(y, s.worldH) / s.sectorSize)}`;
}

export function score(game) {
  return Math.floor(game.time) + 25 * (game.sectors.size - 1);
}

// Cells whose centres lie within the hull radius of the ship.
export function hullCells(game) {
  const { x, y } = game.ship;
  const r = game.settings.hullRadius;
  const cells = [];
  for (let cy = Math.floor(y - r); cy <= Math.ceil(y + r); cy++) {
    for (let cx = Math.floor(x - r); cx <= Math.ceil(x + r); cx++) {
      if ((cx + 0.5 - x) ** 2 + (cy + 0.5 - y) ** 2 <= r * r) cells.push([cx, cy]);
    }
  }
  return cells;
}

// Continuous movement, called every animation frame.
// input: { left, right, thrust, plough, fire }
export function updateShip(game, input, dt) {
  if (!game.alive) return;
  const s = game.settings;
  const ship = game.ship;
  game.time += dt;
  if (input.left) ship.angle -= s.turnRate * dt;
  if (input.right) ship.angle += s.turnRate * dt;
  if (input.thrust) {
    ship.vx += Math.cos(ship.angle) * s.thrust * dt;
    ship.vy += Math.sin(ship.angle) * s.thrust * dt;
  }
  const keep = Math.max(0, 1 - s.drag * dt);
  ship.vx *= keep;
  ship.vy *= keep;
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > s.maxSpeed) {
    ship.vx *= s.maxSpeed / speed;
    ship.vy *= s.maxSpeed / speed;
  }
  ship.x = wrap(ship.x + ship.vx * dt, s.worldW);
  ship.y = wrap(ship.y + ship.vy * dt, s.worldH);
  game.sectors.add(sectorOf(ship.x, ship.y, s));
  game.energy = Math.min(s.maxEnergy, game.energy + s.energyRegen * dt);
  game.cooldown = Math.max(0, game.cooldown - dt);
  if (input.fire) fireGlider(game);
}

// Launch a glider ahead of the ship, along the diagonal nearest its heading.
export function fireGlider(game) {
  const s = game.settings;
  if (game.cooldown > 0 || game.energy < s.gliderCost) return false;
  const sx = Math.cos(game.ship.angle) >= 0 ? 1 : -1;
  const sy = Math.sin(game.ship.angle) >= 0 ? 1 : -1;
  const x = Math.floor(game.ship.x + sx * 4) - 1;
  const y = Math.floor(game.ship.y + sy * 4) - 1;
  stamp(game.world, gliderToward(sx, sy), x, y);
  game.energy -= s.gliderCost;
  game.cooldown = s.gliderCooldown;
  return true;
}

// One Life generation plus the ship's effects on it, in this order:
// exhaust seeds the wake, Life steps, then the hull meets what is there.
export function tick(game, input) {
  if (!game.alive) return;
  const s = game.settings;
  const ship = game.ship;
  if (input.thrust) {
    for (let i = 0; i < s.exhaustPerTick; i++) {
      const back = 2 + game.random() * 2.5;
      const spread = (game.random() - 0.5) * 1.2;
      const a = ship.angle + Math.PI + spread;
      set(game.world, Math.floor(ship.x + Math.cos(a) * back), Math.floor(ship.y + Math.sin(a) * back), 1);
    }
  }
  const next = step(game.world, undefined, game.spare);
  game.spare = game.world;
  game.world = next;
  game.generation += 1;

  let touched = 0;
  for (const [cx, cy] of hullCells(game)) {
    if (!get(game.world, cx, cy)) continue;
    if (input.plough && game.energy >= s.ploughCostPerCell) {
      set(game.world, cx, cy, 0);
      game.energy -= s.ploughCostPerCell;
    } else {
      touched += 1;
    }
  }
  if (touched) {
    game.hull = Math.max(0, game.hull - touched * s.damagePerCell);
    game.lastHit = game.time;
    if (game.hull === 0) game.alive = false;
  }
}
