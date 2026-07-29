from __future__ import annotations

import unittest

from skill_manager.harness.catalog import supported_harness_definitions


class HarnessCatalogTests(unittest.TestCase):
    def test_cursor_uses_native_editor_command_as_windows_fallback(self) -> None:
        cursor = next(
            definition
            for definition in supported_harness_definitions()
            if definition.harness == "cursor"
        )

        self.assertEqual(
            cursor.install_probes_for("windows"),
            ("cursor-agent", "cursor"),
        )
        self.assertEqual(
            cursor.install_probes_for("linux"),
            ("cursor-agent",),
        )
        self.assertEqual(
            cursor.install_probes_for("macos"),
            ("cursor-agent",),
        )


if __name__ == "__main__":
    unittest.main()
