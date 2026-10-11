"""Build the Streamlit bundle and check it is valid, self-contained JavaScript."""

import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from streamlit_app import bundle  # noqa: E402

page = bundle()
script = re.search(r'<script type="module">\n(.*)\n</script>', page, re.S).group(1)
assert not re.search(r"^\s*(import|export) ", script, re.M), "module syntax left in bundle"
with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as f:
    f.write(script)
subprocess.run(["node", "--check", f.name], check=True)
print("bundle ok:", len(script), "characters")
