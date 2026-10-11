# Life Pilot

Fly a ship through cellular automaton universes and watch them run. Each
universe is two layers on one lattice, a species and the ground it lives on,
and each layer steps by looking itself up in a rule table. The ship is a
viewer only. It cannot be harmed and it never touches either layer.

The companion to [cellular-automata](https://github.com/Will1014/cellular-automata),
where the two-layer model is built and studied. The game's engine is checked
step for step against that model's `coupled.py`.

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
| ↑ (or W) | Thrust |
| ↓ (or S) | Brake |
| 1-5 | Ship speed, 8 to 180 cells per second |
| + / − | Generations per second, 1 to 60 |
| P, M, H, R | Pause the universe, toggle map, toggle panel, rebuild |

The panel builds a new universe: consumer-resource, random tables or Conway's
Life, on a hexagonal or square lattice, with the number of ground levels, how
often the ground updates, starting occupancy and seeds. Random rule seeds
use the game's own generator, so they do not reproduce the same seed in the
Python app.

## Module map

| File | Purpose |
| --- | --- |
| `src/universe.js` | Lattices, rule tables, the two-layer step, plane geometry, seeded RNG |
| `src/game.js` | Ship physics and the generation clock, browser-free and tested |
| `src/main.js` | Keyboard, universe panel, frame loop, drawing, HUD, minimap |
| `tools/make_parity_fixture.py` | Records runs from `coupled.py` for the parity tests |
| `streamlit_app.py` | Streamlit wrapper that inlines the modules into one page |

## Tests

```bash
npm test
```

`tests/fixtures/parity.json` holds short runs recorded from the Python model.
Regenerate it with `python tools/make_parity_fixture.py` (needs the
cellular-automata package installed) whenever `coupled.py` changes.

## Known limitations

- Keyboard only; no touch controls yet.
- Rules are built in the panel. Loading a rule file exported from
  cellular-automata is planned, not built.
- The world is 256 × 256 cells and wraps at the edges.
