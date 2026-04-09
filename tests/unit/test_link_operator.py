from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.harness.link_operator import LinkOperator, LinkResult, MutationError

from tests.support import create_fake_home_spec, seed_skill_package


class LinkOperatorTests(unittest.TestCase):
    def test_link_creates_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            operator = LinkOperator()
            result = operator.link_shared(package_path=package, harness_skills_root=spec.home / ".codex" / "skills")
            self.assertEqual(result.action, "created")
            link = spec.home / ".codex" / "skills" / "audit"
            self.assertTrue(link.is_symlink())
            self.assertEqual(link.resolve(), package.resolve())

    def test_link_idempotent_when_already_linked(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            skills_root = spec.home / ".codex" / "skills"
            operator = LinkOperator()
            operator.link_shared(package_path=package, harness_skills_root=skills_root)
            result = operator.link_shared(package_path=package, harness_skills_root=skills_root)
            self.assertEqual(result.action, "already_linked")

    def test_link_refuses_real_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            seed_skill_package(spec.home / ".codex" / "skills", "audit", "Local Audit")
            operator = LinkOperator()
            with self.assertRaises(MutationError) as ctx:
                operator.link_shared(package_path=package, harness_skills_root=spec.home / ".codex" / "skills")
            self.assertIn("real directory", str(ctx.exception))

    def test_link_refuses_foreign_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            other = seed_skill_package(Path(temp_dir) / "other-store", "audit", "Other Audit")
            skills_root = spec.home / ".codex" / "skills"
            (skills_root / "audit").symlink_to(other.resolve())
            operator = LinkOperator()
            with self.assertRaises(MutationError) as ctx:
                operator.link_shared(package_path=package, harness_skills_root=skills_root)
            self.assertIn("points to", str(ctx.exception))

    def test_link_creates_parent_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            package = seed_skill_package(Path(temp_dir) / "store", "audit", "Audit")
            missing_root = Path(temp_dir) / "new-harness" / "skills"
            operator = LinkOperator()
            result = operator.link_shared(package_path=package, harness_skills_root=missing_root)
            self.assertEqual(result.action, "created")
            self.assertTrue((missing_root / "audit").is_symlink())

    def test_unlink_removes_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            skills_root = spec.home / ".codex" / "skills"
            (skills_root / "audit").symlink_to(package.resolve())
            operator = LinkOperator()
            result = operator.unlink_shared(package_dir="audit", harness_skills_root=skills_root)
            self.assertEqual(result.action, "removed")
            self.assertFalse((skills_root / "audit").exists())

    def test_unlink_idempotent_when_absent(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            operator = LinkOperator()
            result = operator.unlink_shared(package_dir="missing", harness_skills_root=spec.home / ".codex" / "skills")
            self.assertEqual(result.action, "already_absent")

    def test_unlink_refuses_real_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_skill_package(spec.home / ".codex" / "skills", "audit", "Local Audit")
            operator = LinkOperator()
            with self.assertRaises(MutationError) as ctx:
                operator.unlink_shared(package_dir="audit", harness_skills_root=spec.home / ".codex" / "skills")
            self.assertIn("not a symlink", str(ctx.exception))


class ReplaceWithLinkTests(unittest.TestCase):
    def test_replace_removes_dir_and_creates_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            harness_pkg = seed_skill_package(spec.home / ".codex" / "skills", "audit", "Audit")
            operator = LinkOperator()
            result = operator.replace_with_link(existing_dir=harness_pkg, target_path=store_pkg)
            self.assertEqual(result.action, "created")
            self.assertTrue(harness_pkg.is_symlink())
            self.assertEqual(harness_pkg.resolve(), store_pkg.resolve())

    def test_replace_idempotent_when_already_linked(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            link = spec.home / ".codex" / "skills" / "audit"
            link.symlink_to(store_pkg.resolve())
            operator = LinkOperator()
            result = operator.replace_with_link(existing_dir=link, target_path=store_pkg)
            self.assertEqual(result.action, "already_linked")

    def test_replace_refuses_missing_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            operator = LinkOperator()
            with self.assertRaises(MutationError) as ctx:
                operator.replace_with_link(
                    existing_dir=spec.home / ".codex" / "skills" / "missing",
                    target_path=store_pkg,
                )
            self.assertIn("does not exist", str(ctx.exception))

    def test_replace_refuses_foreign_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            other = seed_skill_package(Path(temp_dir) / "other", "audit", "Other")
            link = spec.home / ".codex" / "skills" / "audit"
            link.symlink_to(other.resolve())
            operator = LinkOperator()
            with self.assertRaises(MutationError) as ctx:
                operator.replace_with_link(existing_dir=link, target_path=store_pkg)
            self.assertIn("points to", str(ctx.exception))


class MaterializeSharedLinkTests(unittest.TestCase):
    def test_materialize_restores_real_directory_from_shared_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit", body="shared version")
            link = spec.home / ".codex" / "skills" / "audit"
            link.symlink_to(store_pkg.resolve())

            operator = LinkOperator()
            result = operator.materialize_shared_link(existing_link=link, source_path=store_pkg)

            self.assertEqual(result.action, "created")
            self.assertTrue(link.is_dir())
            self.assertFalse(link.is_symlink())
            self.assertIn("shared version", (link / "SKILL.md").read_text(encoding="utf-8"))

    def test_materialize_refuses_real_directory_targets(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            local_pkg = seed_skill_package(spec.home / ".codex" / "skills", "audit", "Audit", body="local")

            operator = LinkOperator()
            with self.assertRaises(MutationError) as ctx:
                operator.materialize_shared_link(existing_link=local_pkg, source_path=store_pkg)

            self.assertIn("not a symlink", str(ctx.exception))

    def test_materialize_refuses_foreign_symlink_targets(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            other_pkg = seed_skill_package(Path(temp_dir) / "other-store", "audit", "Other")
            link = spec.home / ".codex" / "skills" / "audit"
            link.symlink_to(other_pkg.resolve())

            operator = LinkOperator()
            with self.assertRaises(MutationError) as ctx:
                operator.materialize_shared_link(existing_link=link, source_path=store_pkg)

            self.assertIn("points to", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
