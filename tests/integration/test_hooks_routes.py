from __future__ import annotations

import json
import unittest
from pathlib import Path

import tomli_w
import tomllib

from tests.support.app_harness import AppTestHarness


class HookRoutesTests(unittest.TestCase):
    def test_list_all_harnesses_present(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/api/hooks")
            self.assertEqual(payload["entries"], [])
            harness_names = {col["harness"] for col in payload["columns"]}
            # All unified hook harnesses must be surfaced in columns
            self.assertIn("claude", harness_names)
            self.assertIn("codex", harness_names)
            self.assertIn("cursor", harness_names)
            self.assertIn("opencode", harness_names)
            self.assertIn("agy", harness_names)

    def test_create_and_delete_hook(self) -> None:
        with AppTestHarness() as harness:
            response = harness.post_json(
                "/api/hooks",
                {
                    "id": "my-hook",
                    "event": "pre_tool_use",
                    "command": "echo hello",
                    "match": "shell",
                    "timeout": 30,
                    "description": "Say hello",
                },
            )
            self.assertTrue(response["ok"])
            self.assertEqual(response["hook"]["id"], "my-hook")
            self.assertEqual(response["hook"]["event"], "pre_tool_use")
            self.assertEqual(response["hook"]["match"], "shell")

            # Check listing contains it
            payload = harness.get_json("/api/hooks")
            entry_ids = [entry["id"] for entry in payload["entries"]]
            self.assertIn("my-hook", entry_ids)

            # Get details
            detail = harness.get_json("/api/hooks/my-hook")
            self.assertEqual(detail["id"], "my-hook")

            # Delete
            deleted = harness.delete_json("/api/hooks/my-hook")
            self.assertTrue(deleted["ok"])

            # Check listing is empty again
            payload2 = harness.get_json("/api/hooks")
            self.assertEqual(payload2["entries"], [])

    def test_enable_and_disable_across_harnesses(self) -> None:
        with AppTestHarness() as harness:
            # Create a managed hook
            harness.post_json(
                "/api/hooks",
                {
                    "id": "my-hook",
                    "event": "pre_tool_use",
                    "command": "echo hello",
                    "match": "shell",
                    "timeout": 30,
                    "description": "Say hello",
                },
            )

            # 1. Enable on Claude
            enabled = harness.post_json(
                "/api/hooks/my-hook/enable",
                {"harness": "claude"},
            )
            self.assertTrue(enabled["ok"])

            settings_path = harness.spec.home / ".claude" / "settings.json"
            self.assertTrue(settings_path.is_file())
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertEqual(settings["hooks"]["PreToolUse"][0]["hooks"][0]["id"], "my-hook")

            # 2. Enable on Codex
            enabled_codex = harness.post_json(
                "/api/hooks/my-hook/enable",
                {"harness": "codex"},
            )
            self.assertTrue(enabled_codex["ok"])

            codex_path = harness.spec.home / ".codex" / "config.toml"
            self.assertTrue(codex_path.is_file())
            with open(codex_path, "rb") as f:
                codex_cfg = tomllib.load(f)
            self.assertEqual(codex_cfg["hooks"]["PreToolUse"][0]["hooks"][0]["id"], "my-hook")

            # 3. Enable on Cursor
            enabled_cursor = harness.post_json(
                "/api/hooks/my-hook/enable",
                {"harness": "cursor"},
            )
            self.assertTrue(enabled_cursor["ok"])

            cursor_path = harness.spec.home / ".cursor" / "hooks.json"
            self.assertTrue(cursor_path.is_file())
            cursor_cfg = json.loads(cursor_path.read_text(encoding="utf-8"))
            self.assertEqual(cursor_cfg["hooks"]["beforeShellExecution"][0]["command"], "echo hello")

            # Disable on all three
            self.assertTrue(harness.post_json("/api/hooks/my-hook/disable", {"harness": "claude"})["ok"])
            self.assertTrue(harness.post_json("/api/hooks/my-hook/disable", {"harness": "codex"})["ok"])
            self.assertTrue(harness.post_json("/api/hooks/my-hook/disable", {"harness": "cursor"})["ok"])

            # Verify files are cleaned up or empty
            self.assertNotIn("hooks", json.loads(settings_path.read_text(encoding="utf-8")))
            self.assertNotIn("hooks", json.loads(cursor_path.read_text(encoding="utf-8")))

    def test_opencode_argv_wrapping_routing(self) -> None:
        with AppTestHarness() as harness:
            # OpenCode only supports stop and file_write post_tool_use
            harness.post_json(
                "/api/hooks",
                {
                    "id": "opencode-hook",
                    "event": "stop",
                    "command": "npm run build",
                    "description": "build on stop",
                },
            )

            # Enable on OpenCode
            enabled = harness.post_json(
                "/api/hooks/opencode-hook/enable",
                {"harness": "opencode"},
            )
            self.assertTrue(enabled["ok"])

            opencode_path = harness.spec.home / ".opencode" / "opencode.jsonc"
            self.assertTrue(opencode_path.is_file())
            opencode_cfg = json.loads(opencode_path.read_text(encoding="utf-8"))
            self.assertEqual(
                opencode_cfg["experimental"]["hook"]["session_completed"][0]["command"],
                ["/bin/sh", "-c", "npm run build"],
            )

    def test_antigravity_name_keyed_routing(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/hooks",
                {
                    "id": "agy-hook",
                    "event": "stop",
                    "command": "git push",
                    "description": "push on stop",
                },
            )

            # Enable on Antigravity (agy)
            enabled = harness.post_json(
                "/api/hooks/agy-hook/enable",
                {"harness": "agy"},
            )
            self.assertTrue(enabled["ok"])

            agy_path = harness.spec.home / ".gemini" / "config" / "hooks.json"
            self.assertTrue(agy_path.is_file())
            agy_cfg = json.loads(agy_path.read_text(encoding="utf-8"))
            self.assertIn("agy-hook", agy_cfg)
            self.assertTrue(agy_cfg["agy-hook"]["enabled"])
            self.assertEqual(agy_cfg["agy-hook"]["Stop"][0]["command"], "git push")


if __name__ == "__main__":
    unittest.main()
