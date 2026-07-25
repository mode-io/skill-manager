from __future__ import annotations

import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.skills.manifest import (
    SkillStoreEntry,
    SkillStoreManifest,
)
from skill_manager.application.skills.manifest import (
    load_skill_store_manifest as load_manifest,
)
from skill_manager.application.skills.manifest import (
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

    def test_manifest_round_trip_with_origin(self) -> None:
        with TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            manifest = SkillStoreManifest(
                entries=(
                    SkillStoreEntry(
                        package_dir="policy-kit",
                        declared_name="Policy Kit",
                        source_kind="centralized",
                        source_locator="centralized:Policy Kit",
                        revision="def456",
                        origin_harness="opencode",
                    ),
                )
            )

            write_manifest(manifest_path, manifest)
            loaded = load_manifest(manifest_path)

            self.assertEqual(loaded, manifest)
            payload = manifest_path.read_text(encoding="utf-8")
            self.assertIn('"originHarness": "opencode"', payload)

    def test_load_legacy_manifest_defaults_to_no_origin(self) -> None:
        with TemporaryDirectory() as temp_dir:
            manifest_path = Path(temp_dir) / "manifest.json"
            manifest_path.write_text(
                '{"entries":[{"packageDir":"legacy","declaredName":"Legacy","sourceKind":"github",'
                '"sourceLocator":"github:mode-io/legacy","revision":"abc"}]}',
                encoding="utf-8",
            )

            loaded = load_manifest(manifest_path)
            entry = loaded.entries[0]

            self.assertIsNone(entry.origin_harness)

    def test_load_manifest_handles_missing_file(self) -> None:
        with TemporaryDirectory() as temp_dir:
            loaded = load_manifest(Path(temp_dir) / "missing.json")
            self.assertEqual(loaded.entries, ())


if __name__ == "__main__":
    unittest.main()
