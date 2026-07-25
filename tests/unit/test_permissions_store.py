from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.permissions.store import PermissionSpec, PermissionStore


def _spec(perm_id: str = "test-perm", **overrides) -> PermissionSpec:
    base = dict(
        id=perm_id,
        decision="allow",
        scope="shell",
        pattern="git push",
        description="A test permission",
    )
    base.update(overrides)
    return PermissionSpec(**base)


class PermissionStoreTests(unittest.TestCase):
    def test_upsert_then_list(self) -> None:
        with TemporaryDirectory() as tmp:
            store = PermissionStore(Path(tmp) / "manifest.json")
            store.upsert_managed(_spec("perm1"))
            store.upsert_managed(_spec("perm2", scope="file_read", pattern="~/.zshrc"))

            entries = store.list_managed()

            self.assertEqual({entry.id for entry in entries}, {"perm1", "perm2"})

    def test_upsert_replaces_existing(self) -> None:
        with TemporaryDirectory() as tmp:
            store = PermissionStore(Path(tmp) / "manifest.json")
            store.upsert_managed(_spec("perm1", pattern="git push"))
            store.upsert_managed(_spec("perm1", pattern="git commit"))

            entries = store.list_managed()

            self.assertEqual(len(entries), 1)
            self.assertEqual(entries[0].pattern, "git commit")

    def test_get_returns_none_when_missing(self) -> None:
        with TemporaryDirectory() as tmp:
            store = PermissionStore(Path(tmp) / "manifest.json")

            self.assertIsNone(store.get_managed("perm1"))

    def test_remove_returns_false_when_missing(self) -> None:
        with TemporaryDirectory() as tmp:
            store = PermissionStore(Path(tmp) / "manifest.json")

            self.assertFalse(store.remove("perm1"))

    def test_remove_returns_true_and_drops_entry(self) -> None:
        with TemporaryDirectory() as tmp:
            store = PermissionStore(Path(tmp) / "manifest.json")
            store.upsert_managed(_spec("perm1"))

            self.assertTrue(store.remove("perm1"))
            self.assertEqual(store.list_managed(), ())

    def test_revision_changes_when_payload_differs(self) -> None:
        with TemporaryDirectory() as tmp:
            store = PermissionStore(Path(tmp) / "manifest.json")
            store.upsert_managed(_spec("perm1"))
            stored = store.get_managed("perm1")
            assert stored is not None

            store.upsert_managed(_spec("perm1", pattern="git commit"))
            stored2 = store.get_managed("perm1")
            assert stored2 is not None

            self.assertTrue(stored.revision)
            self.assertNotEqual(stored.revision, stored2.revision)

    def test_manifest_is_valid_json(self) -> None:
        with TemporaryDirectory() as tmp:
            manifest_path = Path(tmp) / "manifest.json"
            store = PermissionStore(manifest_path)
            store.upsert_managed(_spec("perm1"))

            payload = json.loads(manifest_path.read_text(encoding="utf-8"))

            self.assertEqual(payload["version"], 1)
            self.assertEqual(len(payload["permissions"]), 1)
            self.assertEqual(payload["permissions"][0]["id"], "perm1")

    def test_manifest_issues_report_malformed_entries_without_dropping_valid_entries(self) -> None:
        with TemporaryDirectory() as tmp:
            manifest_path = Path(tmp) / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "permissions": [
                            {
                                "id": "valid",
                                "decision": "allow",
                                "scope": "shell",
                                "pattern": "git push",
                            },
                            {"decision": "allow", "scope": "Missing ID"},
                        ],
                    }
                ),
                encoding="utf-8",
            )
            store = PermissionStore(manifest_path)

            self.assertEqual([perm.id for perm in store.list_managed()], ["valid"])
            self.assertEqual(len(store.manifest_issues()), 1)


if __name__ == "__main__":
    unittest.main()
