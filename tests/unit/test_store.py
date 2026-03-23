from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.store import SharedStore, load_manifest

from tests.support import create_fake_home_spec, seed_skill_package


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
            )
            self.assertTrue(dest.is_dir())
            self.assertTrue((dest / "SKILL.md").is_file())
            manifest = load_manifest(store.manifest_path)
            self.assertEqual(len(manifest.entries), 1)
            self.assertEqual(manifest.entries[0].package_dir, "audit")
            self.assertEqual(manifest.entries[0].declared_name, "Audit Skill")

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


if __name__ == "__main__":
    unittest.main()
