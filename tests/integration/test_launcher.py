from __future__ import annotations

import os
from pathlib import Path
import subprocess
import socket
import sys
from tempfile import TemporaryDirectory
import time
import unittest
from urllib.request import urlopen

from tests.support import create_fake_home_spec


class LauncherTests(unittest.TestCase):
    def test_launcher_boots_local_server_without_frontend_bundle(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            env = dict(os.environ)
            env.update(spec.env())
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                port = int(sock.getsockname()[1])
            process = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "skill_manager",
                    "--port",
                    str(port),
                    "--no-open-browser",
                    "--frontend-dist",
                    str(Path(temp_dir) / "missing-dist"),
                ],
                cwd=Path(__file__).resolve().parents[2],
                env=env,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            try:
                deadline = time.time() + 5.0
                while True:
                    try:
                        with urlopen(f"http://127.0.0.1:{port}/api/health") as response:
                            self.assertEqual(response.status, 200)
                            break
                    except Exception:  # noqa: BLE001
                        if time.time() >= deadline:
                            raise
                        time.sleep(0.2)
                with urlopen(f"http://127.0.0.1:{port}/") as response:
                    self.assertEqual(response.status, 200)
                    html = response.read().decode("utf-8")
                    self.assertIn("Frontend build missing", html)
            finally:
                process.terminate()
                process.wait(timeout=5)


if __name__ == "__main__":
    unittest.main()
