from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.store import SharedStore, load_manifest

from tests.support.fake_home import create_fake_home_spec, seed_skill_package


class SharedStoreIngestTests(unittest.TestCase):
    def test_ingest_copies_package_and_updates_manifest(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            source = seed_skill_package(spec.home / ".codex" / "skills", "audit", "Audit Skill")
            store = SharedStore(spec.shared_store_root)
            dest = store.ingest(
                source_path=source,
                declared_name="Audit Skill",
                source_kind="centralized",
                source_locator="centralized:Audit Skill",
                source_ref="main",
                source_path_hint="skills/audit",
            )
            self.assertTrue(dest.is_dir())
            self.assertTrue((dest / "SKILL.md").is_file())
            manifest = load_manifest(store.manifest_path)
            self.assertEqual(len(manifest.entries), 1)
            self.assertEqual(manifest.entries[0].package_dir, "audit")
            self.assertEqual(manifest.entries[0].declared_name, "Audit Skill")
            self.assertEqual(manifest.entries[0].source_ref, "main")
            self.assertEqual(manifest.entries[0].source_path, "skills/audit")

    def test_ingest_refuses_existing_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_skill_package(spec.shared_store_root, "audit", "Existing")
            source = seed_skill_package(spec.home / ".codex" / "skills", "audit", "Audit Skill")
            store = SharedStore(spec.shared_store_root)
            with self.assertRaises(ValueError) as ctx:
                store.ingest(
                    source_path=source,
                    declared_name="Audit Skill",
                    source_kind="centralized",
                    source_locator="centralized:Audit Skill",
                )
            self.assertIn("already exists", str(ctx.exception))

    def test_ingest_creates_store_root_if_missing(self) -> None:
        with TemporaryDirectory() as temp_dir:
            source = seed_skill_package(Path(temp_dir) / "harness", "audit", "Audit Skill")
            missing_root = Path(temp_dir) / "new-store" / "shared"
            store = SharedStore(missing_root)
            dest = store.ingest(
                source_path=source,
                declared_name="Audit Skill",
                source_kind="centralized",
                source_locator="centralized:Audit Skill",
            )
            self.assertTrue(dest.is_dir())
            self.assertTrue(missing_root.is_dir())


class SharedStoreUpdateTests(unittest.TestCase):
    def test_update_replaces_changed_package(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store = SharedStore(spec.shared_store_root)
            source_v1 = seed_skill_package(Path(temp_dir) / "v1", "audit", "Audit", body="version 1")
            store.ingest(source_path=source_v1, declared_name="Audit", source_kind="github", source_locator="github:test/test/audit")
            source_v2 = seed_skill_package(Path(temp_dir) / "v2", "audit", "Audit", body="version 2")
            _, changed = store.update("audit", source_path=source_v2, source_ref="main", source_path_hint="skills/audit")
            self.assertTrue(changed)
            content = (spec.shared_store_root / "audit" / "SKILL.md").read_text()
            self.assertIn("version 2", content)
            manifest = load_manifest(store.manifest_path)
            self.assertEqual(len(manifest.entries), 1)
            self.assertEqual(manifest.entries[0].source_ref, "main")
            self.assertEqual(manifest.entries[0].source_path, "skills/audit")

    def test_update_noop_when_identical(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store = SharedStore(spec.shared_store_root)
            source = seed_skill_package(Path(temp_dir) / "original", "audit", "Audit", body="same content")
            store.ingest(source_path=source, declared_name="Audit", source_kind="github", source_locator="github:test/test/audit")
            source_copy = seed_skill_package(Path(temp_dir) / "copy", "audit", "Audit", body="same content")
            _, changed = store.update("audit", source_path=source_copy)
            self.assertFalse(changed)

    def test_update_refuses_missing_package(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store = SharedStore(spec.shared_store_root)
            source = seed_skill_package(Path(temp_dir) / "src", "audit", "Audit")
            with self.assertRaises(ValueError) as ctx:
                store.update("nonexistent", source_path=source)
            self.assertIn("not in store", str(ctx.exception))


class SharedStoreDeleteTests(unittest.TestCase):
    def test_delete_removes_package_and_manifest_entry(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store = SharedStore(spec.shared_store_root)
            source = seed_skill_package(Path(temp_dir) / "src", "audit", "Audit")
            store.ingest(
                source_path=source,
                declared_name="Audit",
                source_kind="github",
                source_locator="github:test/test/audit",
            )

            store.delete("audit")

            self.assertFalse((spec.shared_store_root / "audit").exists())
            manifest = load_manifest(store.manifest_path)
            self.assertEqual(manifest.entries, ())

    def test_delete_refuses_missing_package(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store = SharedStore(spec.shared_store_root)

            with self.assertRaises(ValueError) as ctx:
                store.delete("missing")

            self.assertIn("not in store", str(ctx.exception))

    def test_delete_refuses_package_missing_from_manifest(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_skill_package(spec.shared_store_root, "audit", "Audit")
            store = SharedStore(spec.shared_store_root)

            with self.assertRaises(ValueError) as ctx:
                store.delete("audit")

            self.assertIn("missing from manifest", str(ctx.exception))
            self.assertTrue((spec.shared_store_root / "audit").is_dir())
if __name__ == "__main__":
    unittest.main()
