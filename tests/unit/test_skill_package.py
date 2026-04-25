from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.application.skills.identity import SourceDescriptor
from skill_manager.application.skills.package import (
    SkillParseError,
    fingerprint_package,
    parse_skill_manifest_text,
    parse_skill_package,
)

from tests.support.fake_home import seed_skill_package


class SkillParsingTests(unittest.TestCase):
    def test_parse_skill_manifest_text_extracts_core_frontmatter(self) -> None:
        manifest = parse_skill_manifest_text(
            "---\nname: Manifest Skill\ndescription: A canonical description\nsource_kind: github\nsource_locator: github:mode-io/skills/manifest-skill\n---\n\n# Manifest Skill\n"
        )
        self.assertEqual(manifest.declared_name, "Manifest Skill")
        self.assertEqual(manifest.description, "A canonical description")
        self.assertEqual(manifest.source_kind, "github")
        self.assertEqual(manifest.source_locator, "github:mode-io/skills/manifest-skill")

    def test_parse_skill_manifest_text_normalizes_wrapping_quotes_for_scalar_metadata(self) -> None:
        manifest = parse_skill_manifest_text(
            "---\nname: \"Quoted Skill\"\ndescription: \"A canonical description\"\nsource_kind: \"github\"\nsource_locator: \"github:mode-io/skills/quoted-skill\"\n---\n\n# Ignored fallback heading\n"
        )
        self.assertEqual(manifest.declared_name, "Quoted Skill")
        self.assertEqual(manifest.description, "A canonical description")
        self.assertEqual(manifest.source_kind, "github")
        self.assertEqual(manifest.source_locator, "github:mode-io/skills/quoted-skill")

    def test_parse_skill_manifest_text_preserves_inner_quotes(self) -> None:
        manifest = parse_skill_manifest_text(
            "---\nname: Inner Quotes\ndescription: 'Use the \"fast\" path for browser automation.'\n---\n\n# Inner Quotes\n"
        )
        self.assertEqual(manifest.description, 'Use the "fast" path for browser automation.')

    def test_parse_skill_manifest_text_preserves_mismatched_quotes(self) -> None:
        manifest = parse_skill_manifest_text(
            "---\nname: Odd Quotes\ndescription: \"Leading quote only\n---\n\n# Odd Quotes\n"
        )
        self.assertEqual(manifest.description, '"Leading quote only')

    def test_parse_skill_package_uses_frontmatter_name_and_source_metadata(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            package_root = seed_skill_package(
                root,
                "audit-skill",
                "Audit Skill",
                support_files={"docs/readme.txt": "fixture"},
                source_kind="github",
                source_locator="github:mode-io/audit-skill",
            )
            package = parse_skill_package(
                package_root,
                default_source=SourceDescriptor(kind="shared-store", locator="shared-store:audit-skill"),
            )
            self.assertEqual(package.declared_name, "Audit Skill")
            self.assertIn("docs/readme.txt", package.relative_files)
            self.assertEqual(package.source.kind, "github")
            self.assertEqual(package.source.locator, "github:mode-io/audit-skill")

    def test_fingerprint_changes_when_supporting_file_changes(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            package_root = seed_skill_package(root, "policy-kit", "Policy Kit", support_files={"notes.txt": "first"})
            first, _ = fingerprint_package(package_root)
            (package_root / "notes.txt").write_text("second", encoding="utf-8")
            second, _ = fingerprint_package(package_root)
            self.assertNotEqual(first, second)

    def test_parse_skill_package_rejects_missing_skill_md(self) -> None:
        with TemporaryDirectory() as temp_dir:
            root = Path(temp_dir) / "broken"
            root.mkdir(parents=True, exist_ok=True)
            with self.assertRaises(SkillParseError):
                parse_skill_package(
                    root,
                    default_source=SourceDescriptor(kind="shared-store", locator="fixture:broken"),
                )


    def test_parse_extracts_single_line_description(self) -> None:
        with TemporaryDirectory() as temp_dir:
            package_root = seed_skill_package(
                Path(temp_dir), "my-skill", "My Skill", description="A short description",
            )
            package = parse_skill_package(
                package_root, default_source=SourceDescriptor(kind="shared-store", locator="fixture:test"),
            )
            self.assertEqual(package.description, "A short description")

    def test_parse_extracts_single_line_description_without_wrapping_quotes(self) -> None:
        with TemporaryDirectory() as temp_dir:
            package_root = Path(temp_dir) / "quoted-desc"
            package_root.mkdir()
            (package_root / "SKILL.md").write_text(
                "---\nname: Quoted Description\ndescription: \"A short quoted description\"\n---\n\n# Quoted Description\n",
                encoding="utf-8",
            )
            package = parse_skill_package(
                package_root, default_source=SourceDescriptor(kind="shared-store", locator="fixture:test"),
            )
            self.assertEqual(package.description, "A short quoted description")

    def test_parse_extracts_multiline_block_scalar_description(self) -> None:
        with TemporaryDirectory() as temp_dir:
            package_root = Path(temp_dir) / "multi"
            package_root.mkdir()
            (package_root / "SKILL.md").write_text(
                "---\nname: Multi\ndescription: >-\n  First line of\n  the description.\n---\n\n# Multi\n",
                encoding="utf-8",
            )
            package = parse_skill_package(
                package_root, default_source=SourceDescriptor(kind="shared-store", locator="fixture:test"),
            )
            self.assertEqual(package.description, "First line of the description.")

    def test_parse_defaults_missing_description_to_empty(self) -> None:
        with TemporaryDirectory() as temp_dir:
            package_root = seed_skill_package(Path(temp_dir), "no-desc", "No Desc")
            package = parse_skill_package(
                package_root, default_source=SourceDescriptor(kind="shared-store", locator="fixture:test"),
            )
            self.assertEqual(package.description, "")


if __name__ == "__main__":
    unittest.main()
