#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from skill_manager.api import create_server
from skill_manager.application import ApplicationService
from skill_manager.application.read_model_service import ReadModelService

from tests.support import create_fake_home_spec, create_fixture_marketplace_service, seed_mixed_fixture


def main() -> int:
    with TemporaryDirectory(prefix="skill-manager-e2e-") as temp_dir:
        spec = create_fake_home_spec(Path(temp_dir))
        runner = seed_mixed_fixture(spec)
        env = dict(os.environ)
        env.update(spec.env())
        service = ApplicationService(
            ReadModelService.from_environment(env, command_runner=runner),
            marketplace=create_fixture_marketplace_service(),
        )
        server = create_server(
            service,
            host="127.0.0.1",
            port=4173,
            frontend_dist=REPO_ROOT / "frontend" / "dist",
        )
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            return 130
        finally:
            server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
