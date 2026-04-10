#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from skill_manager.application import build_backend_container
from skill_manager.runtime.server import serve_foreground

from tests.support.fake_home import create_fake_home_spec, seed_mixed_fixture
from tests.support.marketplace_fixture import create_fixture_marketplace_service


def main() -> int:
    with TemporaryDirectory(prefix="skill-manager-e2e-") as temp_dir:
        spec = create_fake_home_spec(Path(temp_dir))
        seed_mixed_fixture(spec)
        env = dict(os.environ)
        env.update(spec.env())
        container = build_backend_container(
            env,
            marketplace_catalog=create_fixture_marketplace_service(),
        )
        return serve_foreground(
            container,
            host="127.0.0.1",
            port=4173,
            frontend_dist=REPO_ROOT / "frontend" / "dist",
            open_browser=False,
        )


if __name__ == "__main__":
    raise SystemExit(main())
