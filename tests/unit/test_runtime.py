from __future__ import annotations

from pathlib import Path
import socket
from tempfile import TemporaryDirectory
import unittest

from skill_manager.runtime.assets import resolve_frontend_dist
from skill_manager.runtime.server import choose_port
from skill_manager.runtime.state import RuntimeState, clear_runtime_state, load_runtime_state, write_runtime_state


class RuntimeTests(unittest.TestCase):
    def test_runtime_state_roundtrip_uses_override_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            env = {"SKILL_MANAGER_STATE_DIR": temp_dir}
            state = RuntimeState(
                pid=1234,
                host="127.0.0.1",
                port=8123,
                base_url="http://127.0.0.1:8123",
                version="0.1.0",
                executable="/tmp/skill-manager",
                started_at=1.23,
            )

            write_runtime_state(state, env)
            restored = load_runtime_state(env)

            self.assertEqual(restored, state)
            clear_runtime_state(env)
            self.assertIsNone(load_runtime_state(env))

    def test_explicit_missing_frontend_dist_does_not_fall_back(self) -> None:
        with TemporaryDirectory() as temp_dir:
            missing = Path(temp_dir) / "missing-dist"
            self.assertIsNone(resolve_frontend_dist(missing))

    def test_choose_port_returns_an_ephemeral_port_when_preferred_is_busy(self) -> None:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1", 0))
            busy_port = int(sock.getsockname()[1])
            chosen = choose_port("127.0.0.1", busy_port)

        self.assertNotEqual(chosen, busy_port)
        self.assertGreater(chosen, 0)


if __name__ == "__main__":
    unittest.main()
