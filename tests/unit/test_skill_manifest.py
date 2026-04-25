from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.application.skills.manifest import (
    SkillStoreEntry,
    SkillStoreManifest,
    load_skill_store_manifest as load_manifest,
    write_skill_store_manifest as write_manifest,
)


class SkillStoreManifestTests(unittest.TestCase):
    def test_manifest_round_trip(self) -> None:
        with TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            manifest = SkillStoreManifest(
                entries=(
                    SkillStoreEntry(
                        package_dir="shared-audit",
                        declared_name="Shared Audit",
                        source_kind="github",
                        source_locator="github:mode-io/shared-audit",
                        revision="abc123",
                        source_ref="main",
                        source_path="skills/shared-audit",
                    ),
                )
            )
            write_manifest(manifest_path, manifest)
            loaded = load_manifest(manifest_path)
            self.assertEqual(loaded, manifest)

    def test_load_manifest_handles_missing_file(self) -> None:
        with TemporaryDirectory() as temp_dir:
            loaded = load_manifest(Path(temp_dir) / "missing.json")
            self.assertEqual(loaded.entries, ())


if __name__ == "__main__":
    unittest.main()
