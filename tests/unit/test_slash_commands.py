from __future__ import annotations

import json
import tomllib
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.slash_commands import (
    SlashCommand,
    SlashCommandMutationService,
    SlashCommandPathPolicy,
    SlashCommandPlanner,
    SlashCommandQueryService,
    SlashCommandReadModelService,
    SlashCommandStore,
    SlashCommandStorePaths,
    SlashCommandSyncStateStore,
    migrate_legacy_slash_commands,
    resolve_slash_targets,
)
from skill_manager.application.slash_commands.codecs import parse_slash_command_document, render_slash_command
from skill_manager.application.slash_commands.sync_state import SlashCommandSyncRecord, hash_file
from skill_manager.errors import MutationError
from skill_manager.harness import HarnessKernelService, HarnessSupportStore
from skill_manager.harness.resolution import resolve_context


def _services(home: Path, root: Path):
    settings = root / "settings.json"
    kernel = HarnessKernelService.from_environment(
        {"HOME": str(home), "XDG_CONFIG_HOME": str(home / ".config")},
        support_store=HarnessSupportStore(settings),
    )
    targets = resolve_slash_targets(kernel)
    store = SlashCommandStore(SlashCommandStorePaths(root=root / "app" / "slash-commands", commands_dir=root / "app" / "slash-commands" / "commands"))
    sync_state = SlashCommandSyncStateStore(root / "app" / "slash-commands" / "sync-state.json")
    path_policy = SlashCommandPathPolicy()
    read_models = SlashCommandReadModelService(store, sync_state, targets, path_policy)
    queries = SlashCommandQueryService(read_models)
    mutations = SlashCommandMutationService(
        store,
        sync_state,
        queries,
        read_models,
        SlashCommandPlanner(path_policy),
        targets,
    )
    return kernel, targets, store, sync_state, queries, mutations


class SlashCommandStoreTests(unittest.TestCase):
    def test_command_toml_round_trips_three_fields(self) -> None:
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            store = SlashCommandStore(
                SlashCommandStorePaths(root=root / "slash-commands", commands_dir=root / "slash-commands" / "commands")
            )
            command = SlashCommand(
                name="code-review",
                description="Review code",
                prompt="Review:\n\n$ARGUMENTS",
            )

            store.create_command(command)
            loaded = store.require_command("code-review")

            self.assertEqual(loaded, command)
            payload = tomllib.loads(store.command_path("code-review").read_text(encoding="utf-8"))
            self.assertEqual(payload["name"], "code-review")
            self.assertEqual(payload["prompt"], "Review:\n\n$ARGUMENTS")

    def test_invalid_command_name_is_rejected(self) -> None:
        with TemporaryDirectory() as tmp:
            store = SlashCommandStore(
                SlashCommandStorePaths(root=Path(tmp) / "slash-commands", commands_dir=Path(tmp) / "slash-commands" / "commands")
            )

            with self.assertRaises(MutationError):
                store.create_command(SlashCommand(name="Code_Review", description="d", prompt="p"))

    def test_codecs_match_target_shapes(self) -> None:
        command = SlashCommand(name="code-review", description="Review code", prompt="Prompt\n$ARGUMENTS")

        frontmatter = render_slash_command(command, "frontmatter_markdown")
        cursor = render_slash_command(command, "cursor_plaintext")

        self.assertTrue(frontmatter.startswith("---\ndescription:"))
        self.assertIn("$ARGUMENTS", frontmatter)
        self.assertFalse(cursor.startswith("---"))
        self.assertTrue(cursor.startswith("Review code"))

    def test_frontmatter_codec_round_trips_special_prompt_content(self) -> None:
        command = SlashCommand(
            name="code-review",
            description='Review: "quoted" code',
            prompt="First line\n\nUse $ARGUMENTS and $1.\nLiteral dollars stay as $$.",
        )

        rendered = render_slash_command(command, "frontmatter_markdown")
        parsed = parse_slash_command_document(command.name, rendered, "frontmatter_markdown")

        self.assertEqual(parsed, command)

    def test_plain_markdown_codec_uses_first_content_line_as_description(self) -> None:
        parsed = parse_slash_command_document(
            "code-review",
            "\nReview code\n\nReview:\n$ARGUMENTS\n",
            "cursor_plaintext",
        )

        self.assertEqual(parsed.description, "Review code")
        self.assertEqual(parsed.prompt, "Review:\n$ARGUMENTS")

    def test_malformed_frontmatter_review_row_has_no_unsafe_action(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            target = home / ".codex" / "prompts" / "broken.md"
            target.parent.mkdir(parents=True)
            target.write_text("---\ndescription: Broken\n\nPrompt\n", encoding="utf-8")
            *_unused, _store, _sync_state, queries, _mutations = _services(home, Path(tmp))

            row = queries.list_commands()["reviewCommands"][0]

            self.assertEqual(row["name"], "broken")
            self.assertEqual(row["actions"], [])
            self.assertIn("missing closing", row["error"])

    def test_default_targets_are_enabled_existing_tool_roots(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            (home / ".claude").mkdir(parents=True)
            (home / ".codex").mkdir(parents=True)

            kernel, targets, *_ = _services(home, Path(tmp))

            defaults = {target.id for target in targets if target.default_selected}
            self.assertEqual(defaults, {"claude", "codex"})
            self.assertEqual(set(kernel.enabled_harness_ids_for_family("slash_commands")), {"opencode", "claude", "cursor", "codex"})

    def test_disabled_harness_is_excluded_from_target_actions(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            settings = Path(tmp) / "settings.json"
            HarnessSupportStore(settings).set_enabled("codex", False)
            kernel = HarnessKernelService.from_environment(
                {"HOME": str(home), "XDG_CONFIG_HOME": str(home / ".config")},
                support_store=HarnessSupportStore(settings),
            )

            targets = resolve_slash_targets(kernel)
            codex = next(target for target in targets if target.id == "codex")

            self.assertFalse(codex.enabled)

    def test_sync_refuses_to_overwrite_untracked_manual_file(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            manual = home / ".codex" / "prompts" / "code-review.md"
            manual.parent.mkdir(parents=True)
            manual.write_text("manual", encoding="utf-8")
            *_unused, store, _sync_state, _queries, mutations = _services(home, Path(tmp))
            store.create_command(SlashCommand(name="code-review", description="d", prompt="$ARGUMENTS"))

            result = mutations.sync_command("code-review", targets=["codex"])

            self.assertFalse(result["ok"])
            self.assertEqual(result["sync"][0]["status"], "blocked_manual_file")
            self.assertEqual(manual.read_text(encoding="utf-8"), "manual")

    def test_sync_writes_hash_state_and_delete_removes_tracked_file(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            (home / ".codex").mkdir(parents=True)
            *_unused, store, sync_state, _queries, mutations = _services(home, Path(tmp))
            store.create_command(SlashCommand(name="code-review", description="d", prompt="$ARGUMENTS"))

            result = mutations.sync_command("code-review", targets=["codex"])

            output = home / ".codex" / "prompts" / "code-review.md"
            self.assertTrue(result["ok"])
            self.assertTrue(output.is_file())
            record = sync_state.load()["code-review"]["codex"]
            self.assertEqual(record.content_hash, hash_file(output))

            deleted = mutations.delete_command("code-review")
            self.assertTrue(deleted["ok"])
            self.assertFalse(output.exists())
            self.assertFalse(store.command_path("code-review").exists())

    def test_tracked_modified_file_reports_drift_and_blocks_delete(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            (home / ".codex").mkdir(parents=True)
            *_unused, store, _sync_state, queries, mutations = _services(home, Path(tmp))
            store.create_command(SlashCommand(name="code-review", description="d", prompt="$ARGUMENTS"))
            mutations.sync_command("code-review", targets=["codex"])
            output = home / ".codex" / "prompts" / "code-review.md"
            output.write_text("manual edit", encoding="utf-8")

            payload = queries.list_commands()
            command = payload["commands"][0]
            drifted = next(entry for entry in command["syncTargets"] if entry["target"] == "codex")
            delete = mutations.delete_command("code-review")

            self.assertEqual(drifted["status"], "drifted")
            self.assertFalse(delete["ok"])
            self.assertEqual(delete["sync"][0]["status"], "blocked_modified_file")
            self.assertTrue(store.command_path("code-review").exists())

    def test_missing_tracked_file_can_be_restored_or_unbound(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            (home / ".codex").mkdir(parents=True)
            *_unused, store, sync_state, queries, mutations = _services(home, Path(tmp))
            store.create_command(SlashCommand(name="code-review", description="d", prompt="$ARGUMENTS"))
            mutations.sync_command("code-review", targets=["codex"])
            output = home / ".codex" / "prompts" / "code-review.md"
            output.unlink()

            payload = queries.list_commands()
            self.assertEqual(payload["reviewCommands"][0]["kind"], "missing")
            restored = mutations.resolve_review_command(target="codex", name="code-review", action="restore_managed")
            self.assertTrue(restored["ok"])
            self.assertTrue(output.exists())

            output.unlink()
            unbound = mutations.resolve_review_command(target="codex", name="code-review", action="remove_binding")
            self.assertTrue(unbound["ok"])
            self.assertNotIn("code-review", sync_state.load())

    def test_drifted_tracked_file_can_be_unbound_without_deleting_harness_file(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            (home / ".codex").mkdir(parents=True)
            *_unused, store, sync_state, queries, mutations = _services(home, Path(tmp))
            store.create_command(SlashCommand(name="code-review", description="d", prompt="$ARGUMENTS"))
            mutations.sync_command("code-review", targets=["codex"])
            output = home / ".codex" / "prompts" / "code-review.md"
            output.write_text("manual edit", encoding="utf-8")

            review = queries.list_commands()["reviewCommands"]
            self.assertEqual(review[0]["actions"], ["restore_managed", "adopt_target", "remove_binding"])
            unbound = mutations.resolve_review_command(target="codex", name="code-review", action="remove_binding")

            self.assertTrue(unbound["ok"])
            self.assertTrue(output.exists())
            self.assertNotIn("code-review", sync_state.load())

    def test_tracked_paths_must_stay_under_target_output_dir(self) -> None:
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            home = root / "home"
            (home / ".codex").mkdir(parents=True)
            *_unused, store, sync_state, queries, mutations = _services(home, root)
            store.create_command(SlashCommand(name="code-review", description="d", prompt="$ARGUMENTS"))
            outside = root / "outside.md"
            outside.write_text("outside", encoding="utf-8")
            sync_state.add_target(
                "code-review",
                SlashCommandSyncRecord(
                    target="codex",
                    path=outside,
                    content_hash=hash_file(outside),
                    render_format="frontmatter_markdown",
                ),
            )

            payload = queries.list_commands()
            delete = mutations.delete_command("code-review")

            codex_entry = next(entry for entry in payload["commands"][0]["syncTargets"] if entry["target"] == "codex")
            self.assertEqual(codex_entry["status"], "failed")
            self.assertFalse(delete["ok"])
            self.assertTrue(outside.exists())

    def test_sync_rewrites_stored_binding_path_not_default_manual_file(self) -> None:
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            home = root / "home"
            prompt_dir = home / ".codex" / "prompts"
            prompt_dir.mkdir(parents=True)
            tracked = prompt_dir / "tracked-code-review.md"
            tracked.write_text("---\ndescription: Old\n---\n\nOld prompt\n", encoding="utf-8")
            default = prompt_dir / "code-review.md"
            default.write_text("manual default file", encoding="utf-8")
            *_unused, store, sync_state, _queries, mutations = _services(home, root)
            store.create_command(SlashCommand(name="code-review", description="d", prompt="$ARGUMENTS"))
            sync_state.add_target(
                "code-review",
                SlashCommandSyncRecord(
                    target="codex",
                    path=tracked,
                    content_hash=hash_file(tracked),
                    render_format="frontmatter_markdown",
                ),
            )

            result = mutations.sync_command("code-review", targets=["codex"])

            self.assertTrue(result["ok"])
            self.assertEqual(default.read_text(encoding="utf-8"), "manual default file")
            self.assertIn("$ARGUMENTS", tracked.read_text(encoding="utf-8"))
            self.assertEqual(
                sync_state.load()["code-review"]["codex"].path,
                tracked.resolve(strict=False),
            )

    def test_import_and_same_name_review_conflict_are_explicit(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp) / "home"
            target_file = home / ".cursor" / "commands" / "code-review.md"
            target_file.parent.mkdir(parents=True)
            target_file.write_text("Review code\n\nReview:\n$ARGUMENTS\n", encoding="utf-8")
            *_unused, store, _sync_state, queries, mutations = _services(home, Path(tmp))

            imported = mutations.import_unmanaged_command(target="cursor", name="code-review")
            self.assertTrue(imported["ok"])
            self.assertEqual(store.require_command("code-review").description, "Review code")

            other = home / ".codex" / "prompts" / "code-review.md"
            other.parent.mkdir(parents=True)
            other.write_text("---\ndescription: Codex copy\n---\n\nPrompt\n", encoding="utf-8")
            review = queries.list_commands()["reviewCommands"]
            conflict = next(row for row in review if row["target"] == "codex")
            self.assertEqual(conflict["kind"], "unmanaged")
            self.assertEqual(conflict["actions"], ["adopt_target"])
            with self.assertRaises(MutationError):
                mutations.import_unmanaged_command(target="codex", name="code-review")

    def test_legacy_yaml_and_sync_state_migrate_once(self) -> None:
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            home = root / "home"
            legacy_commands = home / ".slash-command-manager" / "commands"
            legacy_commands.mkdir(parents=True)
            legacy_commands.joinpath("code-review.yaml").write_text(
                'name: "code-review"\ndescription: "Review code"\nprompt: |\n  $ARGUMENTS\n',
                encoding="utf-8",
            )
            target = home / ".codex" / "prompts" / "code-review.md"
            target.parent.mkdir(parents=True)
            target.write_text("---\ndescription: Review code\n---\n\n$ARGUMENTS\n", encoding="utf-8")
            (home / ".slash-command-manager" / "sync-state.json").write_text(
                json.dumps({"code-review": {"codex": str(target)}}),
                encoding="utf-8",
            )
            kernel, targets, store, sync_state, *_ = _services(home, root)

            migrate_legacy_slash_commands(
                command_store=store,
                sync_state_store=sync_state,
                context=resolve_context({"HOME": str(home), "XDG_CONFIG_HOME": str(home / ".config")}),
                targets=targets,
            )
            migrate_legacy_slash_commands(
                command_store=store,
                sync_state_store=sync_state,
                context=kernel.context,
                targets=targets,
            )

            self.assertTrue(store.command_path("code-review").is_file())
            state_payload = json.loads(sync_state.path.read_text(encoding="utf-8"))
            self.assertEqual(state_payload["version"], 2)
            self.assertEqual(
                state_payload["commands"]["code-review"]["codex"]["contentHash"],
                hash_file(target),
            )


if __name__ == "__main__":
    unittest.main()
