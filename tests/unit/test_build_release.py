from __future__ import annotations

from unittest import mock
import unittest

from scripts import build_release


class BuildReleaseTests(unittest.TestCase):
    def test_resolve_executable_uses_path_resolution(self) -> None:
        with mock.patch(
            "scripts.build_release.shutil.which",
            return_value="C:/Program Files/nodejs/npm.cmd",
        ) as which:
            executable = build_release.resolve_executable("npm")

        self.assertEqual(executable, "C:/Program Files/nodejs/npm.cmd")
        which.assert_called_once_with("npm")

    def test_resolve_executable_reports_missing_command(self) -> None:
        with (
            mock.patch("scripts.build_release.shutil.which", return_value=None),
            self.assertRaisesRegex(FileNotFoundError, "required executable.*npm"),
        ):
            build_release.resolve_executable("npm")

    def test_frontend_build_runs_resolved_npm_entrypoint(self) -> None:
        with (
            mock.patch(
                "scripts.build_release.resolve_executable",
                return_value="/toolchain/bin/npm",
            ),
            mock.patch("scripts.build_release.run") as run,
        ):
            build_release.build_frontend(skip=False)

        run.assert_called_once_with(["/toolchain/bin/npm", "run", "build"])


if __name__ == "__main__":
    unittest.main()
