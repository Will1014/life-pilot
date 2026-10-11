# Life Pilot

Pilot a ship through Conway's Game of Life. The grid reacts to how you fly:
your exhaust seeds new life, gliders you fire reshape the field, and
ploughing through cells clears a path at a cost. Survive and explore.

An offshoot of [cellular-automata](https://github.com/Will1014/cellular-automata).

## Play

Open `index.html` through any static web server (ES modules do not load from
`file://`):

```bash
npm run serve   # then open http://localhost:8000
```

Or run it through Streamlit, which inlines the modules into one page:

```bash
pip install -r requirements.txt
streamlit run streamlit_app.py
```

| Key | Action |
| --- | --- |
| ← → (or A D) | Turn |
| ↑ (or W) | Thrust. The exhaust seeds live cells in your wake |
| Space | Fire a glider along the nearest diagonal. Costs energy |
| Shift | Plough: erase cells you touch instead of taking damage. Costs energy |
| + / − | Life speed, 2 to 30 generations per second |
| P, M, R | Pause, toggle map, restart |

Live cells under the hull cost hull points each generation. Energy
regenerates. Score is seconds survived plus 25 per new 32×32 sector explored.

## Module map

| File | Purpose |
| --- | --- |
| `src/life.js` | Life on a torus, patterns, glider orientation, seeded RNG |
| `src/game.js` | Ship physics and the four mechanics, browser-free and tested |
| `src/main.js` | Keyboard, frame loop, drawing, HUD, minimap |
| `streamlit_app.py` | Streamlit wrapper that inlines the modules into one page |

## Tests

```bash
npm test
```

## Known limitations

- Keyboard only; no touch controls yet.
- Balance (damage, energy costs, soup density) is a first pass.
- The world is 256 × 256 cells and wraps at the edges.
