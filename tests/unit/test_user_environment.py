from __future__ import annotations

import os
import unittest
from unittest import mock

from skill_manager.user_environment import live_user_environment_value


def _user_scope(value: str | None):
    return mock.patch(
        "skill_manager.user_environment._windows_user_environment_value",
        return_value=value,
    )


class LiveUserEnvironmentTests(unittest.TestCase):
    def test_expands_environment_references_against_the_supplied_env(self) -> None:
        with _user_scope(r"%LOCALAPPDATA%\custom-hermes"):
            value = live_user_environment_value(
                "HERMES_HOME",
                {"LOCALAPPDATA": r"C:\Users\tester\AppData\Local"},
            )

        self.assertEqual(value, r"C:\Users\tester\AppData\Local\custom-hermes")

    def test_reference_lookup_ignores_case(self) -> None:
        with _user_scope(r"%localappdata%\hermes"):
            value = live_user_environment_value("HERMES_HOME", {"LOCALAPPDATA": "D:/data"})

        self.assertEqual(value, r"D:/data\hermes")

    def test_unknown_references_are_left_verbatim(self) -> None:
        with _user_scope(r"%NOT_SET%\hermes"):
            value = live_user_environment_value("HERMES_HOME", {})

        self.assertEqual(value, r"%NOT_SET%\hermes")

    def test_missing_user_scope_value_resolves_to_none(self) -> None:
        with _user_scope(None):
            self.assertIsNone(live_user_environment_value("HERMES_HOME", {}))

    @unittest.skipIf(os.name == "nt", "POSIX has no user-scoped environment registry")
    def test_posix_platforms_have_no_user_scope(self) -> None:
        self.assertIsNone(live_user_environment_value("HOME", {"HOME": "/home/tester"}))


if __name__ == "__main__":
    unittest.main()
