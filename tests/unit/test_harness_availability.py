from __future__ import annotations

import subprocess
import unittest
from unittest import mock

from skill_manager.harness.availability import any_command_is_available, command_is_available


class HarnessAvailabilityTests(unittest.TestCase):
    def test_multiple_probes_accept_first_working_windows_command(self) -> None:
        with mock.patch(
            "skill_manager.harness.availability.command_is_available",
            side_effect=lambda command, **_kwargs: command == "cursor",
        ) as probe_mock:
            available = any_command_is_available(
                ("cursor-agent", "cursor"),
                path_env="C:/bin",
                platform="windows",
            )

        self.assertTrue(available)
        self.assertEqual(
            [call.args[0] for call in probe_mock.call_args_list],
            ["cursor-agent", "cursor"],
        )

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

    def test_windows_discovery_accepts_slow_but_invokable_command(self) -> None:
        with (
            mock.patch(
                "skill_manager.harness.availability.shutil.which",
                return_value="C:/bin/hermes.exe",
            ),
            mock.patch(
                "skill_manager.harness.availability.subprocess.run",
                side_effect=subprocess.TimeoutExpired(["hermes", "--version"], timeout=3),
            ),
        ):
            available = command_is_available("hermes", path_env="C:/bin", platform="windows")

        self.assertTrue(available)


if __name__ == "__main__":
    unittest.main()
