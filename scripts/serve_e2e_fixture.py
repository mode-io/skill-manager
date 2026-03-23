#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from skill_manager.launcher import main as launch

from tests.support import create_fake_home_spec, seed_mixed_fixture


def main() -> int:
    with TemporaryDirectory(prefix="skill-manager-e2e-") as temp_dir:
        spec = create_fake_home_spec(Path(temp_dir))
        seed_mixed_fixture(spec)
        os.environ.update(spec.env())
        return launch(
            [
                "--host",
                "127.0.0.1",
                "--port",
                "4173",
                "--no-open-browser",
                "--frontend-dist",
                str(REPO_ROOT / "frontend" / "dist"),
            ]
        )


if __name__ == "__main__":
    raise SystemExit(main())
