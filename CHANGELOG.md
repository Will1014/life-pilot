# Changelog

All notable changes are recorded here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
semantic versioning as described in CONTRIBUTING.md.

## [Unreleased]

### Changed
- The ship is now an explorer only: no hull, energy, exhaust, gliders,
  plough or score. It cannot be harmed and does not affect the universe.
- The world is a two-layer universe (species and ground) stepped by rule
  tables, in place of Conway's Life alone. Conway's Life remains as one rule.

### Added
- Hexagonal lattice, alongside square (8) and square (4).
- Consumer-resource and random-table rules, with a panel to build universes.
- Five ship speed settings and a brake.
- Parity tests that replay runs recorded from cellular-automata's `coupled.py`.

### Removed
- `src/life.js`, replaced by `src/universe.js`.


### Added
- Life on a 256 × 256 torus with a seeded soup and a clear start area.
- Ship with turn, thrust, drag and wrap-around.
- Exhaust that seeds live cells, hull damage from live cells, gliders
  fired along the nearest diagonal, and ploughing that erases cells for energy.
- Survival and exploration score, HUD, minimap, adjustable Life speed.
- Streamlit wrapper (`streamlit_app.py`) for hosting on Streamlit Cloud.
- Tests for Life correctness and each mechanic, run under Node.
