from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from urllib.request import urlopen

from tests.support.fake_home import create_fake_home_spec


class CliRuntimeTests(unittest.TestCase):
    def test_start_status_and_stop_manage_one_owned_instance(self) -> None:
        with TemporaryDirectory(prefix="skill-manager-cli-") as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            state_dir = Path(temp_dir) / "runtime-state"
            env = dict(os.environ)
            env.update(spec.env())

            start = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "skill_manager",
                    "start",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "0",
                    "--state-dir",
                    str(state_dir),
                    "--no-open-browser",
                ],
                cwd=Path(__file__).resolve().parents[2],
                env=env,
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            self.assertEqual(start.returncode, 0, start.stderr)

            runtime_state = json.loads((state_dir / "runtime.json").read_text(encoding="utf-8"))
            with urlopen(f"{runtime_state['base_url']}/api/health") as response:
                self.assertEqual(response.status, 200)

            status = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "skill_manager",
                    "status",
                    "--state-dir",
                    str(state_dir),
                ],
                cwd=Path(__file__).resolve().parents[2],
                env=env,
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            self.assertEqual(status.returncode, 0, status.stderr)
            self.assertIn(runtime_state["base_url"], status.stdout)

            restart = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "skill_manager",
                    "start",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "0",
                    "--state-dir",
                    str(state_dir),
                    "--no-open-browser",
                ],
                cwd=Path(__file__).resolve().parents[2],
                env=env,
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            self.assertEqual(restart.returncode, 0, restart.stderr)
            self.assertIn("already running", restart.stdout)

            stop = subprocess.run(
                [
                    sys.executable,
                    "-m",
                    "skill_manager",
                    "stop",
                    "--state-dir",
                    str(state_dir),
                ],
                cwd=Path(__file__).resolve().parents[2],
                env=env,
                capture_output=True,
                text=True,
                timeout=15,
                check=False,
            )
            self.assertEqual(stop.returncode, 0, stop.stderr)
            self.assertFalse((state_dir / "runtime.json").exists())


if __name__ == "__main__":
    unittest.main()
