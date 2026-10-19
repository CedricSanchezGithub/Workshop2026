import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("node") is None, reason="Node.js absent")
def test_markdown_renderer():
    r = subprocess.run(["node", "--test", str(Path(__file__).with_name("markdown.test.mjs"))],
                       capture_output=True, text=True, timeout=60)
    assert r.returncode == 0, r.stdout + r.stderr
