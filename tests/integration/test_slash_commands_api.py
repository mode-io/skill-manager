from __future__ import annotations

import json
import unittest

from tests.support.app_harness import AppTestHarness


class SlashCommandApiTests(unittest.TestCase):
    def test_list_starts_empty_with_detected_targets(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/api/slash-commands")

            self.assertEqual(payload["commands"], [])
            target_ids = [target["id"] for target in payload["targets"]]
            self.assertEqual(target_ids, ["opencode", "claude", "cursor", "codex"])
            self.assertIn("codex", payload["defaultTargets"])
            self.assertTrue(all("enabled" in target for target in payload["targets"]))
            self.assertTrue(str(harness.spec.xdg_data_home / "skill-manager") in payload["storePath"])

    def test_create_update_sync_and_delete_command(self) -> None:
        with AppTestHarness() as harness:
            response = harness.post_json(
                "/api/slash-commands",
                {
                    "name": "code-review",
                    "description": "Review code",
                    "prompt": "Review:\n\n$ARGUMENTS",
                    "targets": ["codex"],
                },
            )

            codex_path = harness.spec.home / ".codex" / "prompts" / "code-review.md"
            self.assertTrue(response["ok"])
            self.assertTrue(codex_path.is_file())
            self.assertIn("$ARGUMENTS", codex_path.read_text(encoding="utf-8"))

            update = harness.put_json(
                "/api/slash-commands/code-review",
                {
                    "description": "Review code carefully",
                    "prompt": "Updated prompt\n$ARGUMENTS",
                    "targets": ["claude"],
                },
            )

            claude_path = harness.spec.home / ".claude" / "commands" / "code-review.md"
            self.assertTrue(update["ok"])
            self.assertFalse(codex_path.exists())
            self.assertTrue(claude_path.is_file())
            state_path = harness.spec.xdg_data_home / "skill-manager" / "slash-commands" / "sync-state.json"
            state = json.loads(state_path.read_text(encoding="utf-8"))
            self.assertEqual(set(state["commands"]["code-review"]), {"claude"})

            deleted = harness.delete_json("/api/slash-commands/code-review")

            self.assertTrue(deleted["ok"])
            self.assertFalse(claude_path.exists())
            self.assertFalse(
                (harness.spec.xdg_data_home / "skill-manager" / "slash-commands" / "commands" / "code-review.toml").exists()
            )

    def test_manual_file_conflict_is_returned_as_target_failure(self) -> None:
        with AppTestHarness() as harness:
            target = harness.spec.home / ".codex" / "prompts" / "code-review.md"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text("manual", encoding="utf-8")

            response = harness.post_json(
                "/api/slash-commands",
                {
                    "name": "code-review",
                    "description": "Review code",
                    "prompt": "$ARGUMENTS",
                    "targets": ["codex"],
                },
            )

            self.assertFalse(response["ok"])
            self.assertEqual(response["sync"][0]["status"], "blocked_manual_file")
            self.assertEqual(target.read_text(encoding="utf-8"), "manual")

    def test_invalid_name_returns_error_payload(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.post_json(
                "/api/slash-commands",
                {
                    "name": "CodeReview",
                    "description": "Review code",
                    "prompt": "$ARGUMENTS",
                    "targets": [],
                },
                expected_status=400,
            )

            self.assertIn("lowercase", payload["error"])

    def test_review_import_adopts_existing_target_file(self) -> None:
        with AppTestHarness() as harness:
            target = harness.spec.home / ".codex" / "prompts" / "code-review.md"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(
                "---\ndescription: Review code\n---\n\nReview:\n$ARGUMENTS\n",
                encoding="utf-8",
            )

            payload = harness.get_json("/api/slash-commands")
            self.assertEqual(len(payload["reviewCommands"]), 1)
            self.assertEqual(payload["reviewCommands"][0]["kind"], "unmanaged")
            self.assertEqual(payload["reviewCommands"][0]["actions"], ["import"])

            imported = harness.post_json(
                "/api/slash-commands/review/import",
                {"target": "codex", "name": "code-review"},
            )

            self.assertTrue(imported["ok"])
            updated = harness.get_json("/api/slash-commands")
            self.assertEqual([command["name"] for command in updated["commands"]], ["code-review"])
            self.assertEqual(updated["reviewCommands"], [])

    def test_drifted_target_can_be_restored_from_review(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/slash-commands",
                {
                    "name": "code-review",
                    "description": "Review code",
                    "prompt": "$ARGUMENTS",
                    "targets": ["codex"],
                },
            )
            target = harness.spec.home / ".codex" / "prompts" / "code-review.md"
            target.write_text("manual edit", encoding="utf-8")

            payload = harness.get_json("/api/slash-commands")
            self.assertEqual(payload["reviewCommands"][0]["kind"], "drifted")

            resolved = harness.post_json(
                "/api/slash-commands/review/resolve",
                {"target": "codex", "name": "code-review", "action": "restore_managed"},
            )

            self.assertTrue(resolved["ok"])
            self.assertIn("$ARGUMENTS", target.read_text(encoding="utf-8"))

    def test_missing_target_can_be_unbound(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/slash-commands",
                {
                    "name": "code-review",
                    "description": "Review code",
                    "prompt": "$ARGUMENTS",
                    "targets": ["codex"],
                },
            )
            target = harness.spec.home / ".codex" / "prompts" / "code-review.md"
            target.unlink()

            payload = harness.get_json("/api/slash-commands")
            self.assertEqual(payload["reviewCommands"][0]["kind"], "missing")

            resolved = harness.post_json(
                "/api/slash-commands/review/resolve",
                {"target": "codex", "name": "code-review", "action": "remove_binding"},
            )

            self.assertTrue(resolved["ok"])
            updated = harness.get_json("/api/slash-commands")
            self.assertEqual(updated["reviewCommands"], [])

    def test_opencode_and_cursor_render_using_declared_profiles(self) -> None:
        with AppTestHarness() as harness:
            response = harness.post_json(
                "/api/slash-commands",
                {
                    "name": "code-review",
                    "description": "Review code",
                    "prompt": "Review:\n$ARGUMENTS",
                    "targets": ["opencode", "cursor"],
                },
            )

            opencode_path = harness.spec.xdg_config_home / "opencode" / "commands" / "code-review.md"
            cursor_path = harness.spec.home / ".cursor" / "commands" / "code-review.md"
            opencode = opencode_path.read_text(encoding="utf-8")
            cursor = cursor_path.read_text(encoding="utf-8")

            self.assertTrue(response["ok"])
            self.assertTrue(opencode.startswith("---\ndescription:"))
            self.assertIn("Review:\n$ARGUMENTS", opencode)
            self.assertFalse(cursor.startswith("---"))
            self.assertTrue(cursor.startswith("Review code\n\nReview:\n$ARGUMENTS"))

    def test_drifted_target_can_be_unbound_without_deleting_file(self) -> None:
        with AppTestHarness() as harness:
            harness.post_json(
                "/api/slash-commands",
                {
                    "name": "code-review",
                    "description": "Review code",
                    "prompt": "$ARGUMENTS",
                    "targets": ["codex"],
                },
            )
            target = harness.spec.home / ".codex" / "prompts" / "code-review.md"
            target.write_text("manual edit", encoding="utf-8")

            payload = harness.get_json("/api/slash-commands")
            self.assertEqual(payload["reviewCommands"][0]["actions"], ["restore_managed", "adopt_target", "remove_binding"])

            resolved = harness.post_json(
                "/api/slash-commands/review/resolve",
                {"target": "codex", "name": "code-review", "action": "remove_binding"},
            )

            self.assertTrue(resolved["ok"])
            self.assertTrue(target.exists())
            updated = harness.get_json("/api/slash-commands")
            unmanaged = next(row for row in updated["reviewCommands"] if row["target"] == "codex")
            self.assertEqual(unmanaged["kind"], "unmanaged")
            self.assertEqual(unmanaged["actions"], ["adopt_target"])


if __name__ == "__main__":
    unittest.main()
