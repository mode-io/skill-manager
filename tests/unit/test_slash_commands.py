from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.slash_commands import (
    SlashCommand,
    SlashCommandMutationService,
    SlashCommandQueryService,
    SlashCommandStore,
    SlashCommandStorePaths,
)
from skill_manager.application.slash_commands.renderers import GENERATED_MARKER, render_slash_command
from skill_manager.application.slash_commands.targets import resolve_slash_targets
from skill_manager.errors import MutationError
from skill_manager.harness.resolution import resolve_context


def _store(root: Path) -> SlashCommandStore:
    return SlashCommandStore(
        SlashCommandStorePaths(
            root=root,
            commands_dir=root / "commands",
            sync_state_path=root / "sync-state.json",
        )
    )


class SlashCommandStoreTests(unittest.TestCase):
    def test_command_yaml_round_trips_three_fields(self) -> None:
        with TemporaryDirectory() as tmp:
            store = _store(Path(tmp) / ".slash-command-manager")
            command = SlashCommand(
                name="code-review",
                description="审查当前代码",
                prompt="请审查以下内容：\n\n$ARGUMENTS",
            )

            store.create_command(command)
            loaded = store.require_command("code-review")

            self.assertEqual(loaded, command)
            payload = store.command_path("code-review").read_text(encoding="utf-8")
            self.assertIn("name: \"code-review\"", payload)
            self.assertIn("prompt: |", payload)
            self.assertIn("$ARGUMENTS", payload)

    def test_invalid_command_name_is_rejected(self) -> None:
        with TemporaryDirectory() as tmp:
            store = _store(Path(tmp) / ".slash-command-manager")

            with self.assertRaises(MutationError):
                store.create_command(SlashCommand(name="Code_Review", description="d", prompt="p"))

    def test_renderers_match_target_shapes(self) -> None:
        command = SlashCommand(name="code-review", description="审查当前代码", prompt="Prompt\n$ARGUMENTS")

        codex = render_slash_command(command, "codex")
        cursor = render_slash_command(command, "cursor")

        self.assertTrue(codex.startswith("---\ndescription:"))
        self.assertNotIn(GENERATED_MARKER, codex)
        self.assertIn("$ARGUMENTS", codex)
        self.assertFalse(cursor.startswith("---"))
        self.assertNotIn(GENERATED_MARKER, cursor)
        self.assertTrue(cursor.startswith("审查当前代码"))
        self.assertIn("审查当前代码", cursor)

    def test_default_targets_are_existing_tool_roots(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            (home / ".claude").mkdir(parents=True)
            (home / ".codex").mkdir(parents=True)

            targets = resolve_slash_targets(resolve_context({"HOME": str(home)}))

            defaults = {target.id for target in targets if target.default_selected}
            self.assertEqual(defaults, {"claude", "codex"})

    def test_sync_refuses_to_overwrite_manual_file(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            root = home / ".slash-command-manager"
            (home / ".codex" / "prompts").mkdir(parents=True)
            manual = home / ".codex" / "prompts" / "code-review.md"
            manual.write_text("manual", encoding="utf-8")
            store = _store(root)
            targets = resolve_slash_targets(resolve_context({"HOME": str(home)}))
            queries = SlashCommandQueryService(store, targets)
            mutations = SlashCommandMutationService(store, queries, targets)
            store.create_command(SlashCommand(name="code-review", description="d", prompt="$ARGUMENTS"))

            result = mutations.sync_command("code-review", targets=["codex"])

            self.assertFalse(result["ok"])
            self.assertEqual(result["sync"][0]["status"], "blocked_manual_file")
            self.assertEqual(manual.read_text(encoding="utf-8"), "manual")

    def test_sync_writes_and_updates_state(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            root = home / ".slash-command-manager"
            (home / ".codex").mkdir(parents=True)
            store = _store(root)
            targets = resolve_slash_targets(resolve_context({"HOME": str(home)}))
            queries = SlashCommandQueryService(store, targets)
            mutations = SlashCommandMutationService(store, queries, targets)
            store.create_command(SlashCommand(name="code-review", description="d", prompt="$ARGUMENTS"))

            result = mutations.sync_command("code-review", targets=["codex"])

            output = home / ".codex" / "prompts" / "code-review.md"
            self.assertTrue(result["ok"])
            self.assertTrue(output.is_file())
            state = json.loads((root / "sync-state.json").read_text(encoding="utf-8"))
            self.assertEqual(state["code-review"]["codex"], str(output))

    def test_review_commands_discovers_unmanaged_target_files(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            root = home / ".slash-command-manager"
            target_file = home / ".codex" / "prompts" / "code-review.md"
            target_file.parent.mkdir(parents=True)
            target_file.write_text(
                "---\ndescription: Review code\n---\n\nReview:\n$ARGUMENTS\n",
                encoding="utf-8",
            )
            store = _store(root)
            targets = resolve_slash_targets(resolve_context({"HOME": str(home)}))
            queries = SlashCommandQueryService(store, targets)

            rows = queries.review_commands()

            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]["name"], "code-review")
            self.assertEqual(rows[0]["target"], "codex")
            self.assertEqual(rows[0]["description"], "Review code")

    def test_import_unmanaged_command_creates_source_and_records_existing_file(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            root = home / ".slash-command-manager"
            target_file = home / ".cursor" / "commands" / "code-review.md"
            target_file.parent.mkdir(parents=True)
            target_file.write_text("Review code\n\nReview:\n$ARGUMENTS\n", encoding="utf-8")
            store = _store(root)
            targets = resolve_slash_targets(resolve_context({"HOME": str(home)}))
            queries = SlashCommandQueryService(store, targets)
            mutations = SlashCommandMutationService(store, queries, targets)

            result = mutations.import_unmanaged_command(target="cursor", name="code-review")

            self.assertTrue(result["ok"])
            self.assertEqual(store.require_command("code-review").description, "Review code")
            state = json.loads((root / "sync-state.json").read_text(encoding="utf-8"))
            self.assertEqual(state["code-review"]["cursor"], str(target_file))
            self.assertEqual(queries.review_commands(), [])

if __name__ == "__main__":
    unittest.main()
