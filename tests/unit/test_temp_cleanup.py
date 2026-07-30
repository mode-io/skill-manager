from __future__ import annotations

from pathlib import Path
from unittest import mock
import unittest

from tests.support.temp_cleanup import remove_temporary_tree


def windows_sharing_violation() -> PermissionError:
    error = PermissionError("file is in use")
    error.winerror = 32
    return error


class TemporaryCleanupTests(unittest.TestCase):
    def test_windows_sharing_violation_is_retried(self) -> None:
        with (
            mock.patch(
                "tests.support.temp_cleanup.shutil.rmtree",
                side_effect=[windows_sharing_violation(), None],
            ) as rmtree,
            mock.patch("tests.support.temp_cleanup.time.monotonic", side_effect=[0.0, 0.1]),
            mock.patch("tests.support.temp_cleanup.time.sleep") as sleep,
        ):
            remove_temporary_tree(
                Path("temporary"),
                timeout_seconds=1.0,
                os_name="nt",
            )

        self.assertEqual(rmtree.call_count, 2)
        sleep.assert_called_once_with(0.05)

    def test_non_windows_permission_error_is_not_retried(self) -> None:
        error = windows_sharing_violation()
        with (
            mock.patch(
                "tests.support.temp_cleanup.shutil.rmtree",
                side_effect=error,
            ) as rmtree,
            self.assertRaises(PermissionError),
        ):
            remove_temporary_tree(Path("temporary"), os_name="posix")

        rmtree.assert_called_once_with(Path("temporary"))

    def test_persistent_windows_sharing_violation_still_fails(self) -> None:
        error = windows_sharing_violation()
        with (
            mock.patch(
                "tests.support.temp_cleanup.shutil.rmtree",
                side_effect=error,
            ) as rmtree,
            mock.patch("tests.support.temp_cleanup.time.monotonic", side_effect=[0.0, 1.0]),
            self.assertRaises(PermissionError),
        ):
            remove_temporary_tree(
                Path("temporary"),
                timeout_seconds=0.5,
                os_name="nt",
            )

        rmtree.assert_called_once_with(Path("temporary"))


if __name__ == "__main__":
    unittest.main()
