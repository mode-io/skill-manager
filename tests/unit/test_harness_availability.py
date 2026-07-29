from __future__ import annotations

import subprocess
import unittest
from unittest import mock

from skill_manager.harness.availability import command_is_available


class HarnessAvailabilityTests(unittest.TestCase):
    def test_unix_discovery_only_requires_path_resolution(self) -> None:
        with (
            mock.patch("skill_manager.harness.availability.shutil.which", return_value="/bin/codex"),
            mock.patch("skill_manager.harness.availability.subprocess.run") as run_mock,
        ):
            available = command_is_available("codex", path_env="/bin", platform="linux")

        self.assertTrue(available)
        run_mock.assert_not_called()

    def test_windows_discovery_requires_invokable_command(self) -> None:
        with (
            mock.patch(
                "skill_manager.harness.availability.shutil.which",
                return_value="C:/restricted/codex.exe",
            ),
            mock.patch(
                "skill_manager.harness.availability.subprocess.run",
                side_effect=PermissionError("access denied"),
            ),
        ):
            available = command_is_available("codex", path_env="C:/restricted", platform="windows")

        self.assertFalse(available)

    def test_windows_discovery_accepts_successful_version_probe(self) -> None:
        completed = subprocess.CompletedProcess(["codex", "--version"], 0)
        with (
            mock.patch(
                "skill_manager.harness.availability.shutil.which",
                return_value="C:/bin/codex.cmd",
            ),
            mock.patch(
                "skill_manager.harness.availability.subprocess.run",
                return_value=completed,
            ),
        ):
            available = command_is_available("codex", path_env="C:/bin", platform="windows")

        self.assertTrue(available)


if __name__ == "__main__":
    unittest.main()
