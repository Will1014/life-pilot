"""Serve Life Pilot inside Streamlit.

Streamlit embeds HTML in a sandboxed frame that cannot fetch the separate
module files, so the three modules are inlined into one script. The game
itself is unchanged; index.html still works on any static host.
"""

import re
from pathlib import Path

import streamlit as st

ROOT = Path(__file__).resolve().parent
MODULES = ["src/life.js", "src/game.js", "src/main.js"]  # dependency order
SCRIPT_TAG = '<script type="module" src="src/main.js"></script>'


def bundle() -> str:
    parts = []
    for module in MODULES:
        text = (ROOT / module).read_text()
        text = re.sub(r'^import [^;]+ from "[^"]+";\n', "", text, flags=re.M)
        text = re.sub(r"^export ", "", text, flags=re.M)
        parts.append(f"// ---- {module}\n{text}")
    page = (ROOT / "index.html").read_text()
    if SCRIPT_TAG not in page:
        raise RuntimeError("index.html no longer loads src/main.js as expected")
    return page.replace(SCRIPT_TAG, '<script type="module">\n' + "\n".join(parts) + "\n</script>")


if __name__ == "__main__":
    st.set_page_config(page_title="Life Pilot", layout="wide")
    st.caption("Click the game once so it receives the keyboard.")
    st.iframe(bundle(), height=780)  # our own page from this repo, not user input
