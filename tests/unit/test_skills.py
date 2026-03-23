from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.domain import SourceDescriptor, SkillParseError, fingerprint_package, parse_skill_package

from tests.support import seed_skill_package


class SkillParsingTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
