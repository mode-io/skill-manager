from __future__ import annotations

import json
import unittest

from tests.support.app_harness import AppTestHarness


class SlashCommandApiTests(unittest.TestCase):
    def test_list_starts_empty_with_detected_targets(self) -> None:
        with AppTestHarness() as harness:
            (harness.spec.home / ".config" / "opencode").mkdir(parents=True)

            payload = harness.get_json("/api/slash-commands")

            self.assertEqual(payload["commands"], [])
            target_ids = [target["id"] for target in payload["targets"]]
            self.assertEqual(target_ids, ["opencode", "claude", "cursor", "codex"])
            self.assertIn("codex", payload["defaultTargets"])

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
            state = json.loads((harness.spec.home / ".slash-command-manager" / "sync-state.json").read_text())
            self.assertEqual(set(state["code-review"]), {"claude"})

            deleted = harness.delete_json("/api/slash-commands/code-review")

            self.assertTrue(deleted["ok"])
            self.assertFalse(claude_path.exists())
            self.assertFalse((harness.spec.home / ".slash-command-manager" / "commands" / "code-review.yaml").exists())

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
            self.assertEqual(payload["reviewCommands"][0]["name"], "code-review")

            imported = harness.post_json(
                "/api/slash-commands/review/import",
                {"target": "codex", "name": "code-review"},
            )

            self.assertTrue(imported["ok"])
            updated = harness.get_json("/api/slash-commands")
            self.assertEqual([command["name"] for command in updated["commands"]], ["code-review"])
            self.assertEqual(updated["reviewCommands"], [])

if __name__ == "__main__":
    unittest.main()
