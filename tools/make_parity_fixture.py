"""Write tests/fixtures/parity.json from cellular-automata's coupled.py.

The game's universe engine must step exactly as the Python model does. This
records a few short runs from the Python side; tests/universe.test.js replays
them in JavaScript and compares every generation. Rerun it, with the
cellular-automata package installed, whenever coupled.py changes:

    python tools/make_parity_fixture.py
"""

import json
from pathlib import Path

import numpy as np

from cellular_automata.coupled import consumer_resource, random_coupled_rule, run_coupled
from cellular_automata.lattice import HEX_6, SQUARE_4, SQUARE_8

OUT = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "parity.json"

CASES = [
    # name, lattice key, offsets, ke, env_period, rule builder
    ("hex random", "hex", HEX_6, 3, 2, lambda ke, n: random_coupled_rule(ke, n, np.random.default_rng(11))),
    ("hex consumer-resource", "hex", HEX_6, 3, 1, lambda ke, n: consumer_resource(ke, n, 2, 1)),
    ("square8 random", "square8", SQUARE_8, 4, 3, lambda ke, n: random_coupled_rule(ke, n, np.random.default_rng(5))),
    ("square4 consumer-resource", "square4", SQUARE_4, 4, 1, lambda ke, n: consumer_resource(ke, n, 1, 2)),
]
ROWS, COLS, STEPS = 12, 16, 8  # rows differ from columns so a transposed index fails


def main() -> None:
    cases = []
    for i, (name, key, offsets, ke, period, build) in enumerate(CASES):
        n = len(offsets)
        rule = build(ke, n)
        rng = np.random.default_rng(100 + i)
        s0 = (rng.random((ROWS, COLS)) < 0.3).astype(np.uint8)
        e0 = rng.integers(0, ke, (ROWS, COLS)).astype(np.uint8)
        s_hist, e_hist = run_coupled(s0, e0, rule, offsets, STEPS, env_period=period)
        cases.append({
            "name": name, "lattice": key, "ke": ke, "n": n, "envPeriod": period,
            "rows": ROWS, "cols": COLS,
            "speciesTable": rule.species_table.ravel().tolist(),
            "envTable": rule.env_table.ravel().tolist(),
            "species": [g.ravel().tolist() for g in s_hist],
            "env": [g.ravel().tolist() for g in e_hist],
        })
    OUT.write_text(json.dumps({"source": "cellular_automata.coupled.run_coupled", "cases": cases}))
    print(f"wrote {len(cases)} cases to {OUT}")


if __name__ == "__main__":
    main()
