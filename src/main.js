// Browser shell: keyboard input, the frame loop and drawing.

import { createGame, score, tick, updateShip } from "./game.js";
import { get } from "./life.js";

const view = document.getElementById("view");
const ctx = view.getContext("2d");
const cells = document.createElement("canvas"); // one pixel per cell, scaled onto view
const cctx = cells.getContext("2d");
const mini = document.getElementById("minimap");
const mctx = mini.getContext("2d");
const css = getComputedStyle(document.documentElement);
const CELL = hexToRgb(css.getPropertyValue("--cell").trim());
const BG = hexToRgb(css.getPropertyValue("--bg").trim());

const CELL_PX = 8;
const SPEEDS = [2, 4, 6, 10, 15, 20, 30];
let speedIndex = 3; // Life generations per second
let paused = false;
let showMap = true;
let game = createGame(Date.now() % 1e9);
let lifeClock = 0;

const keys = new Set();
const input = () => ({
  left: keys.has("ArrowLeft") || keys.has("KeyA"),
  right: keys.has("ArrowRight") || keys.has("KeyD"),
  thrust: keys.has("ArrowUp") || keys.has("KeyW"),
  plough: keys.has("ShiftLeft") || keys.has("ShiftRight"),
  fire: keys.has("Space"),
});

addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === "KeyP") paused = !paused;
  if (e.code === "KeyM") mini.style.display = (showMap = !showMap) ? "" : "none";
  if (e.code === "KeyR") restart();
  if (e.key === "+" || e.key === "=") speedIndex = Math.min(SPEEDS.length - 1, speedIndex + 1);
  if (e.key === "-" || e.key === "_") speedIndex = Math.max(0, speedIndex - 1);
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

function restart() {
  game = createGame(Date.now() % 1e9);
  lifeClock = 0;
  document.getElementById("over").style.display = "none";
}

function resize() {
  view.width = innerWidth;
  view.height = innerHeight;
  cells.width = Math.ceil(innerWidth / CELL_PX) + 1;
  cells.height = Math.ceil(innerHeight / CELL_PX) + 1;
}
addEventListener("resize", resize);
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused && game.alive) {
    const controls = input();
    updateShip(game, controls, dt);
    lifeClock += dt * SPEEDS[speedIndex];
    while (lifeClock >= 1) {
      tick(game, controls);
      lifeClock -= 1;
    }
  }
  draw();
  requestAnimationFrame(frame);
}

function draw() {
  // Cells go onto a one-pixel-per-cell canvas, which is scaled onto the view
  // with the ship at the centre. The fractional offset keeps motion smooth.
  const w = cells.width;
  const h = cells.height;
  const camX = game.ship.x - view.width / CELL_PX / 2;
  const camY = game.ship.y - view.height / CELL_PX / 2;
  const ox = Math.floor(camX);
  const oy = Math.floor(camY);
  const img = cctx.createImageData(w, h);
  const px = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = get(game.world, ox + x, oy + y) ? CELL : BG;
      const i = (y * w + x) * 4;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
    }
  }
  cctx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cells, -(camX - ox) * CELL_PX, -(camY - oy) * CELL_PX, w * CELL_PX, h * CELL_PX);
  drawShip(view.width / 2, view.height / 2);
  if (showMap) drawMinimap();
  drawHud();
}

function drawShip(sx, sy) {
  const { angle } = game.ship;
  const ctl = input();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(CELL_PX, CELL_PX); // draw the ship in cell units
  ctx.rotate(angle);
  if (ctl.plough && game.alive) {
    ctx.strokeStyle = "rgba(79, 163, 209, 0.9)";
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.arc(0, 0, game.settings.hullRadius + 0.4, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (ctl.thrust && game.alive) {
    ctx.fillStyle = "#f2a541";
    ctx.beginPath();
    ctx.moveTo(-1.2, -0.5); ctx.lineTo(-2.4 - Math.random(), 0); ctx.lineTo(-1.2, 0.5);
    ctx.fill();
  }
  const hit = game.time - game.lastHit < 0.15;
  ctx.fillStyle = hit ? "#ffffff" : "#e4572e";
  ctx.beginPath();
  ctx.moveTo(1.8, 0); ctx.lineTo(-1.2, -1.1); ctx.lineTo(-0.6, 0); ctx.lineTo(-1.2, 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

let miniFrame = 0;
let miniImage = null;
function drawMinimap() {
  const { world } = game;
  if (miniFrame++ % 10 === 0 || !miniImage) {
    miniImage = mctx.createImageData(world.w, world.h);
    for (let i = 0; i < world.cells.length; i++) {
      const c = world.cells[i] ? CELL : BG;
      miniImage.data.set([c[0], c[1], c[2], 255], i * 4);
    }
  }
  mctx.putImageData(miniImage, 0, 0);
  mctx.fillStyle = "#e4572e";
  mctx.fillRect(Math.floor(game.ship.x) - 2, Math.floor(game.ship.y) - 2, 5, 5);
}

function drawHud() {
  const s = game.settings;
  document.getElementById("hull").style.width = `${(100 * game.hull) / s.maxHull}%`;
  document.getElementById("energy").style.width = `${(100 * game.energy) / s.maxEnergy}%`;
  document.getElementById("stats").innerHTML =
    `Time ${game.time.toFixed(1)}s · Sectors ${game.sectors.size} · Score ${score(game)}<br>` +
    `Generation ${game.generation} · Life ${SPEEDS[speedIndex]} gen/s${paused ? " · PAUSED" : ""}`;
  if (!game.alive) {
    document.getElementById("over").style.display = "grid";
    document.getElementById("final").textContent =
      `Survived ${game.time.toFixed(1)}s, explored ${game.sectors.size} sectors. Score ${score(game)}.`;
  }
}

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

requestAnimationFrame(frame);
