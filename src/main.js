// Browser shell: keyboard input, the universe panel, the frame loop and drawing.

import { SHIP, createGame, setSpeed, tick, topSpeed, updateShip } from "./game.js";
import {
  LATTICES, ROW_HEIGHT, cellAt, cellIndex, consumerResource, conway, mod, planeSize, population,
  randomRule, rng, toPlane,
} from "./universe.js";

const view = document.getElementById("view");
const ctx = view.getContext("2d");
const mini = document.getElementById("minimap");
const mctx = mini.getContext("2d");
const panel = document.getElementById("panel");
const css = getComputedStyle(document.documentElement);
const BG = hexToRgb(css.getPropertyValue("--bg").trim());
const GROUND = hexToRgb(css.getPropertyValue("--ground").trim());
const SPECIES = hexToRgb(css.getPropertyValue("--species").trim());

const CELL_PX = 9; // screen pixels between neighbouring cell centres
const GEN_RATES = [1, 2, 4, 6, 10, 15, 20, 30, 60]; // generations per second
const OCCUPANCY = { consumer: 0.05, random: 0.3, conway: 0.3 };
let rateIndex = 4;
let paused = false;
let showMap = true;
let game = null;
let clock = 0;
let groundColours = [];

// --- Universe panel -----------------------------------------------------------------

const field = (id) => document.getElementById(id);
const intField = (id) => Math.max(0, Math.floor(Number(field(id).value) || 0));

function readConfig() {
  const kind = field("rule").value;
  const latticeKey = kind === "conway" ? "square8" : field("lattice").value;
  const n = LATTICES[latticeKey].offsets.length;
  const ke = Math.min(6, Math.max(2, intField("ke")));
  let rule;
  if (kind === "conway") rule = conway();
  else if (kind === "random") rule = randomRule(ke, n, rng(intField("ruleSeed")));
  else {
    const coloniseAt = Math.min(n, Math.max(1, intField("coloniseAt")));
    const regrowAt = Math.min(n * (ke - 1), intField("regrowAt"));
    rule = consumerResource(ke, n, coloniseAt, regrowAt);
  }
  return {
    lattice: latticeKey,
    rule,
    envPeriod: kind === "conway" ? 1 : Math.max(1, intField("envPeriod")),
    occupancy: Math.min(1, Math.max(0, Number(field("occupancy").value) || 0)),
    seed: intField("seed"),
  };
}

function showFields() {
  const kind = field("rule").value;
  for (const el of panel.querySelectorAll("[data-for]")) {
    el.style.display = el.dataset.for.split(" ").includes(kind) ? "" : "none";
  }
  field("lattice").disabled = kind === "conway";
  if (kind === "conway") field("lattice").value = "square8";
}

function build() {
  const previous = game;
  game = createGame(readConfig());
  if (previous) setSpeed(game, previous.speedSetting);
  clock = 0;
  const { ke } = game.universe.rule;
  groundColours = Array.from({ length: ke }, (_, e) => mix(BG, GROUND, ke > 1 ? e / (ke - 1) : 0));
  const plane = planeSize(game.universe);
  mini.width = Math.round(plane.w);
  mini.height = Math.round(plane.h);
  miniImage = null;
}

field("rule").addEventListener("change", () => {
  field("occupancy").value = OCCUPANCY[field("rule").value];
  showFields();
});
panel.addEventListener("submit", (e) => {
  e.preventDefault();
  build();
  document.activeElement.blur(); // hand the keyboard back to the ship
});

// --- Keyboard ------------------------------------------------------------------------

const keys = new Set();
const input = () => ({
  left: keys.has("ArrowLeft") || keys.has("KeyA"),
  right: keys.has("ArrowRight") || keys.has("KeyD"),
  thrust: keys.has("ArrowUp") || keys.has("KeyW"),
  brake: keys.has("ArrowDown") || keys.has("KeyS"),
});

addEventListener("keydown", (e) => {
  if (e.target.closest && e.target.closest("#panel")) return; // typing in the panel
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === "KeyP") paused = !paused;
  if (e.code === "KeyM") mini.style.display = (showMap = !showMap) ? "" : "none";
  if (e.code === "KeyH") panel.style.display = panel.style.display === "none" ? "" : "none";
  if (e.code === "KeyR") build();
  if (/^Digit[1-5]$/.test(e.code)) setSpeed(game, Number(e.code.slice(5)) - 1);
  if (e.key === "+" || e.key === "=") rateIndex = Math.min(GEN_RATES.length - 1, rateIndex + 1);
  if (e.key === "-" || e.key === "_") rateIndex = Math.max(0, rateIndex - 1);
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
view.addEventListener("mousedown", () => document.activeElement.blur());

// --- Frame loop -----------------------------------------------------------------------

function resize() {
  view.width = innerWidth;
  view.height = innerHeight;
}
addEventListener("resize", resize);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateShip(game, input(), dt); // the ship flies on while the universe is paused
  if (!paused) {
    clock += dt * GEN_RATES[rateIndex];
    while (clock >= 1) {
      tick(game);
      clock -= 1;
    }
  }
  draw();
  requestAnimationFrame(frame);
}

// --- Drawing --------------------------------------------------------------------------

// Cell outlines in screen pixels, centred on the cell. Hex cells are pointy-top
// with unit spacing between centres; both are drawn slightly oversize so
// neighbouring cells meet without hairline gaps.
const HEX_RADIUS = (1 / Math.sqrt(3)) * 1.04;
const HEX_CORNERS = [...Array(6).keys()].map((k) => {
  const a = Math.PI / 6 + (k * Math.PI) / 3;
  return [Math.cos(a), Math.sin(a)];
});

function addCell(path, hex, sx, sy, scale) {
  if (hex) {
    const r = HEX_RADIUS * scale * CELL_PX;
    path.moveTo(sx + HEX_CORNERS[0][0] * r, sy + HEX_CORNERS[0][1] * r);
    for (let k = 1; k < 6; k++) path.lineTo(sx + HEX_CORNERS[k][0] * r, sy + HEX_CORNERS[k][1] * r);
    path.closePath();
  } else {
    const half = (scale * CELL_PX) / 2 + 0.25;
    path.rect(sx - half, sy - half, 2 * half, 2 * half);
  }
}

function draw() {
  const u = game.universe;
  const L = u.lattice;
  const { x: camX, y: camY } = game.ship;
  const halfW = view.width / CELL_PX / 2 + 1;
  const halfH = view.height / CELL_PX / 2 + 1;
  // Ground fills each cell; an occupied cell gets a smaller species cell on top,
  // so both layers stay visible.
  const groundPaths = groundColours.map(() => new Path2D());
  const speciesPath = new Path2D();
  const rowStep = L.hex ? ROW_HEIGHT : 1;
  const rMin = Math.floor((camY - halfH) / rowStep);
  const rMax = Math.ceil((camY + halfH) / rowStep);
  for (let r = rMin; r <= rMax; r++) {
    const shift = L.hex ? r / 2 : 0;
    for (let q = Math.floor(camX - halfW - shift); q <= Math.ceil(camX + halfW - shift); q++) {
      const i = cellIndex(u, r, q);
      const p = toPlane(L, r, q);
      const sx = (p.x - camX) * CELL_PX + view.width / 2;
      const sy = (p.y - camY) * CELL_PX + view.height / 2;
      const e = u.env[i];
      if (e > 0) addCell(groundPaths[e], L.hex, sx, sy, 1);
      if (u.species[i]) addCell(speciesPath, L.hex, sx, sy, u.rule.ke > 1 ? 0.62 : 1);
    }
  }
  ctx.fillStyle = rgb(BG);
  ctx.fillRect(0, 0, view.width, view.height);
  groundPaths.forEach((path, e) => {
    if (e === 0) return;
    ctx.fillStyle = rgb(groundColours[e]);
    ctx.fill(path);
  });
  ctx.fillStyle = rgb(SPECIES);
  ctx.fill(speciesPath);
  drawShip(view.width / 2, view.height / 2);
  if (showMap) drawMinimap();
  drawHud();
}

function drawShip(sx, sy) {
  const ctl = input();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.scale(CELL_PX, CELL_PX); // draw the ship in cell units
  ctx.rotate(game.ship.angle);
  if (ctl.thrust) {
    ctx.fillStyle = "#f2a541";
    ctx.beginPath();
    ctx.moveTo(-1.2, -0.5); ctx.lineTo(-2.4 - Math.random(), 0); ctx.lineTo(-1.2, 0.5);
    ctx.fill();
  }
  ctx.fillStyle = css.getPropertyValue("--ship").trim();
  ctx.strokeStyle = rgb(BG);
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(1.8, 0); ctx.lineTo(-1.2, -1.1); ctx.lineTo(-0.6, 0); ctx.lineTo(-1.2, 1.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// The minimap shows the whole torus as a rectangle, one pixel per unit of plane.
let miniFrame = 0;
let miniImage = null;
function drawMinimap() {
  const u = game.universe;
  if (miniFrame++ % 10 === 0 || !miniImage) {
    miniImage = mctx.createImageData(mini.width, mini.height);
    for (let y = 0; y < mini.height; y++) {
      for (let x = 0; x < mini.width; x++) {
        const i = cellAt(u, x + 0.5, y + 0.5);
        const c = u.species[i] ? SPECIES : groundColours[u.env[i]];
        miniImage.data.set([c[0], c[1], c[2], 255], (y * mini.width + x) * 4);
      }
    }
  }
  mctx.putImageData(miniImage, 0, 0);
  mctx.fillStyle = css.getPropertyValue("--ship").trim();
  const mx = Math.floor(mod(game.ship.x, mini.width));
  const my = Math.floor(game.ship.y);
  mctx.fillRect(mx - 2, my - 2, 5, 5);
}

function drawHud() {
  const u = game.universe;
  const cells = u.w * u.h;
  let ground = 0;
  for (const e of u.env) ground += e;
  const lines = [
    `${u.rule.name} · ${u.lattice.name} · ${u.w} × ${u.h}`,
    `Generation ${u.generation} · ${GEN_RATES[rateIndex]} gen/s${paused ? " · PAUSED" : ""}`,
    `Occupied ${((100 * population(u)) / cells).toFixed(1)}%` +
      (u.rule.ke > 1 ? ` · Mean ground ${(ground / cells).toFixed(2)} of ${u.rule.ke - 1}` : ""),
    `Ship speed ${game.speedSetting + 1} of ${SHIP.speeds.length} (${topSpeed(game)} cells/s)`,
  ];
  document.getElementById("stats").innerHTML = lines.join("<br>");
}

// --- Colour helpers ---------------------------------------------------------------------

function hexToRgb(hex) {
  const v = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

function mix(a, b, t) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

function rgb(c) {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

resize();
showFields();
build();
requestAnimationFrame(frame);
