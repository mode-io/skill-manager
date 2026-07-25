from __future__ import annotations

import json
import tomllib
import unittest
from pathlib import Path

import tomli_w

from tests.support.app_harness import AppTestHarness


class PermissionRoutesTests(unittest.TestCase):
    def test_list_all_harnesses_present(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/api/permissions")
            self.assertEqual(payload["entries"], [])
            harness_names = {col["harness"] for col in payload["columns"]}
            # Priority harnesses must be surfaced in columns
            self.assertIn("claude", harness_names)
            self.assertIn("codex", harness_names)
            self.assertIn("agy", harness_names)

    def test_create_and_delete_permission(self) -> None:
        with AppTestHarness() as harness:
            response = harness.post_json(
                "/api/permissions",
                {
                    "id": "my-perm",
                    "decision": "allow",
                    "scope": "shell",
                    "pattern": "git push",
                    "description": "Say hello",
                },
            )
            self.assertTrue(response["ok"])
            self.assertEqual(response["permission"]["id"], "my-perm")
            self.assertEqual(response["permission"]["decision"], "allow")
            self.assertEqual(response["permission"]["scope"], "shell")
            self.assertEqual(response["permission"]["pattern"], "git push")

            # Check listing contains it
            payload = harness.get_json("/api/permissions")
            entry_ids = [entry["id"] for entry in payload["entries"]]
            self.assertIn("my-perm", entry_ids)

            # Get details
            detail = harness.get_json("/api/permissions/my-perm")
            self.assertEqual(detail["id"], "my-perm")

            # Delete
            deleted = harness.delete_json("/api/permissions/my-perm")
            self.assertTrue(deleted["ok"])

            # Check listing is empty again
            payload2 = harness.get_json("/api/permissions")
            self.assertEqual(payload2["entries"], [])

    def test_enable_and_disable_across_harnesses(self) -> None:
        with AppTestHarness() as harness:
            # Create a managed permission
            harness.post_json(
                "/api/permissions",
                {
                    "id": "my-perm",
                    "decision": "allow",
                    "scope": "shell",
                    "pattern": "git push",
                    "description": "Allow pushing",
                },
            )

            # 1. Enable on Claude
            enabled = harness.post_json(
                "/api/permissions/my-perm/enable",
                {"harness": "claude"},
            )
            self.assertTrue(enabled["ok"])

            settings_path = harness.spec.home / ".claude" / "settings.json"
            self.assertTrue(settings_path.is_file())
            settings = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertIn("Bash(git push)", settings["permissions"]["allow"])

            # 2. Enable on Antigravity
            enabled_agy = harness.post_json(
                "/api/permissions/my-perm/enable",
                {"harness": "agy"},
            )
            self.assertTrue(enabled_agy["ok"])

            agy_path = harness.spec.home / ".gemini" / "antigravity-cli" / "settings.json"
            self.assertTrue(agy_path.is_file())
            agy_settings = json.loads(agy_path.read_text(encoding="utf-8"))
            self.assertIn("command(git push)", agy_settings["permissions"]["allow"])

            # Create filesystem permission for Codex
            harness.post_json(
                "/api/permissions",
                {
                    "id": "my-file-perm",
                    "decision": "allow",
                    "scope": "file_read",
                    "pattern": "~/.zshrc",
                    "description": "Read zshrc",
                },
            )

            # 3. Enable on Codex
            enabled_codex = harness.post_json(
                "/api/permissions/my-file-perm/enable",
                {"harness": "codex"},
            )
            self.assertTrue(enabled_codex["ok"])

            codex_path = harness.spec.home / ".codex" / "config.toml"
            self.assertTrue(codex_path.is_file())
            with open(codex_path, "rb") as f:
                codex_cfg = tomllib.load(f)
            self.assertEqual(codex_cfg["permissions"]["skill-manager"]["filesystem"]["~/.zshrc"], "read")

            # Disable on all three
            self.assertTrue(harness.post_json("/api/permissions/my-perm/disable", {"harness": "claude"})["ok"])
            self.assertTrue(harness.post_json("/api/permissions/my-perm/disable", {"harness": "agy"})["ok"])
            self.assertTrue(harness.post_json("/api/permissions/my-file-perm/disable", {"harness": "codex"})["ok"])

            # Verify files are cleaned up or empty
            self.assertNotIn("permissions", json.loads(settings_path.read_text(encoding="utf-8")))
            self.assertNotIn("permissions", json.loads(agy_path.read_text(encoding="utf-8")))
            with open(codex_path, "rb") as f:
                codex_cfg2 = tomllib.load(f)
            self.assertNotIn("permissions", codex_cfg2)


    def test_unmanaged_rule_is_readable_and_promotable(self) -> None:
        with AppTestHarness() as harness:
            # Seed an unmanaged rule directly in the Claude config.
            claude_path = harness.spec.home / ".claude" / "settings.json"
            claude_path.parent.mkdir(parents=True, exist_ok=True)
            claude_path.write_text(
                json.dumps({"permissions": {"allow": ["Bash(git status)"]}}),
                encoding="utf-8",
            )

            payload = harness.get_json("/api/permissions")
            entry = next(
                e for e in payload["entries"]
                if e.get("spec") and e["spec"].get("pattern") == "git status"
            )
            # Bug regression: unmanaged entries must carry a parsed spec and a
            # human-readable name, not a bare "manual:<hash>" id.
            self.assertEqual(entry["kind"], "unmanaged")
            self.assertEqual(entry["spec"]["decision"], "allow")
            self.assertEqual(entry["spec"]["scope"], "shell")
            self.assertNotEqual(entry["displayName"], entry["id"])
            self.assertIn("git status", entry["displayName"])

            # Promote it into the managed manifest.
            promoted = harness.post_json(
                f"/api/permissions/{entry['id']}/promote",
                {},
            )
            self.assertTrue(promoted["ok"])
            self.assertEqual(promoted["permission"]["scope"], "shell")
            self.assertEqual(promoted["permission"]["pattern"], "git status")

            # The existing Claude binding is now reclassified as managed,
            # without rewriting the harness config.
            payload2 = harness.get_json("/api/permissions")
            entry2 = next(e for e in payload2["entries"] if e["id"] == entry["id"])
            self.assertEqual(entry2["kind"], "managed")
            states = {s["harness"]: s["state"] for s in entry2["sightings"]}
            self.assertEqual(states.get("claude"), "managed")


if __name__ == "__main__":
    unittest.main()
