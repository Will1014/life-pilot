// The ship and the clock, independent of the browser. The ship is a viewer: it
// cannot be harmed and it never touches either layer of the universe.
// main.js handles the keyboard and drawing; everything here runs under Node.

import { createUniverse, stepUniverse, wrapPoint } from "./universe.js";

export const SHIP = {
  turnRate: 3.2, // radians per second
  drag: 0.6, // fraction of velocity lost per second
  brake: 4, // extra fraction lost per second while braking
  speeds: [8, 20, 45, 90, 180], // top speed per setting, cells per second
  acceleration: 1.5, // top speeds per second
};

export function createGame(config) {
  const universe = createUniverse(config);
  const centre = wrapPoint(universe, universe.w / 2, universe.h / 2);
  return {
    config,
    universe,
    ship: { x: centre.x, y: centre.y, vx: 0, vy: 0, angle: -Math.PI / 2 },
    speedSetting: 1,
    time: 0,
  };
}

export function setSpeed(game, setting) {
  game.speedSetting = Math.max(0, Math.min(SHIP.speeds.length - 1, setting));
}

export const topSpeed = (game) => SHIP.speeds[game.speedSetting];

// Continuous movement, called every animation frame.
// input: { left, right, thrust, brake }
export function updateShip(game, input, dt) {
  const ship = game.ship;
  const top = topSpeed(game);
  game.time += dt;
  if (input.left) ship.angle -= SHIP.turnRate * dt;
  if (input.right) ship.angle += SHIP.turnRate * dt;
  if (input.thrust) {
    ship.vx += Math.cos(ship.angle) * top * SHIP.acceleration * dt;
    ship.vy += Math.sin(ship.angle) * top * SHIP.acceleration * dt;
  }
  const keep = Math.max(0, 1 - (SHIP.drag + (input.brake ? SHIP.brake : 0)) * dt);
  ship.vx *= keep;
  ship.vy *= keep;
  const speed = Math.hypot(ship.vx, ship.vy);
  if (speed > top) {
    ship.vx *= top / speed;
    ship.vy *= top / speed;
  }
  const p = wrapPoint(game.universe, ship.x + ship.vx * dt, ship.y + ship.vy * dt);
  ship.x = p.x;
  ship.y = p.y;
}

// One generation of the universe. The ship plays no part in it.
export function tick(game) {
  stepUniverse(game.universe);
}
