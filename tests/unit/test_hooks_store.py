from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.hooks.store import HookSpec, HookStore


def _spec(hook_id: str = "test-hook", **overrides) -> HookSpec:
    base = dict(
        id=hook_id,
        event="pre_tool_use",
        command="echo hello",
        match="shell",
        timeout=10,
        description="A test hook",
    )
    base.update(overrides)
    return HookSpec(**base)


class HookStoreTests(unittest.TestCase):
    def test_upsert_then_list(self) -> None:
        with TemporaryDirectory() as tmp:
            store = HookStore(Path(tmp) / "manifest.json")
            store.upsert_managed(_spec("hook1"))
            store.upsert_managed(_spec("hook2", event="post_tool_use", command="echo post"))

            entries = store.list_managed()

            self.assertEqual({entry.id for entry in entries}, {"hook1", "hook2"})

    def test_upsert_replaces_existing(self) -> None:
        with TemporaryDirectory() as tmp:
            store = HookStore(Path(tmp) / "manifest.json")
            store.upsert_managed(_spec("hook1", command="old command"))
            store.upsert_managed(_spec("hook1", command="new command"))

            entries = store.list_managed()

            self.assertEqual(len(entries), 1)
            self.assertEqual(entries[0].command, "new command")

    def test_get_returns_none_when_missing(self) -> None:
        with TemporaryDirectory() as tmp:
            store = HookStore(Path(tmp) / "manifest.json")

            self.assertIsNone(store.get_managed("hook1"))

    def test_remove_returns_false_when_missing(self) -> None:
        with TemporaryDirectory() as tmp:
            store = HookStore(Path(tmp) / "manifest.json")

            self.assertFalse(store.remove("hook1"))

    def test_remove_returns_true_and_drops_entry(self) -> None:
        with TemporaryDirectory() as tmp:
            store = HookStore(Path(tmp) / "manifest.json")
            store.upsert_managed(_spec("hook1"))

            self.assertTrue(store.remove("hook1"))
            self.assertEqual(store.list_managed(), ())

    def test_revision_changes_when_payload_differs(self) -> None:
        with TemporaryDirectory() as tmp:
            store = HookStore(Path(tmp) / "manifest.json")
            store.upsert_managed(_spec("hook1"))
            stored = store.get_managed("hook1")
            assert stored is not None

            store.upsert_managed(_spec("hook1", command="echo changed"))
            stored2 = store.get_managed("hook1")
            assert stored2 is not None

            self.assertTrue(stored.revision)
            self.assertNotEqual(stored.revision, stored2.revision)

    def test_manifest_is_valid_json(self) -> None:
        with TemporaryDirectory() as tmp:
            manifest_path = Path(tmp) / "manifest.json"
            store = HookStore(manifest_path)
            store.upsert_managed(_spec("hook1"))

            payload = json.loads(manifest_path.read_text(encoding="utf-8"))

            self.assertEqual(payload["version"], 1)
            self.assertEqual(len(payload["hooks"]), 1)
            self.assertEqual(payload["hooks"][0]["id"], "hook1")

    def test_manifest_issues_report_malformed_entries_without_dropping_valid_entries(self) -> None:
        with TemporaryDirectory() as tmp:
            manifest_path = Path(tmp) / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "hooks": [
                            {
                                "id": "valid",
                                "event": "PreToolUse",
                                "command": "echo valid",
                            },
                            {"event": "Missing ID"},
                        ],
                    }
                ),
                encoding="utf-8",
            )
            store = HookStore(manifest_path)

            self.assertEqual([hook.id for hook in store.list_managed()], ["valid"])
            self.assertEqual(len(store.manifest_issues()), 1)


if __name__ == "__main__":
    unittest.main()
