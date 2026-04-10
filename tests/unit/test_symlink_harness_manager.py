from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.errors import MutationError
from skill_manager.harness.managers import SymlinkHarnessManager

from tests.support.fake_home import create_fake_home_spec, seed_skill_package


class SymlinkHarnessManagerTests(unittest.TestCase):
    def test_enable_creates_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            manager.enable_shared_package(package)

            link = spec.home / ".codex" / "skills" / "audit"
            self.assertTrue(link.is_symlink())
            self.assertEqual(link.resolve(), package.resolve())

    def test_enable_is_idempotent_when_already_linked(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            manager.enable_shared_package(package)
            manager.enable_shared_package(package)

            self.assertTrue((spec.home / ".codex" / "skills" / "audit").is_symlink())

    def test_enable_refuses_real_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            seed_skill_package(spec.home / ".codex" / "skills", "audit", "Local Audit")
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            with self.assertRaises(MutationError) as ctx:
                manager.enable_shared_package(package)

            self.assertIn("real directory", str(ctx.exception))

    def test_enable_refuses_foreign_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            other = seed_skill_package(Path(temp_dir) / "other-store", "audit", "Other Audit")
            (spec.home / ".codex" / "skills" / "audit").symlink_to(other.resolve())
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            with self.assertRaises(MutationError) as ctx:
                manager.enable_shared_package(package)

            self.assertIn("points to", str(ctx.exception))

    def test_enable_creates_parent_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            package = seed_skill_package(Path(temp_dir) / "store", "audit", "Audit")
            manager = SymlinkHarnessManager(Path(temp_dir) / "new-harness" / "skills")

            manager.enable_shared_package(package)

            self.assertTrue((Path(temp_dir) / "new-harness" / "skills" / "audit").is_symlink())

    def test_disable_removes_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            skills_root = spec.home / ".codex" / "skills"
            (skills_root / "audit").symlink_to(package.resolve())
            manager = SymlinkHarnessManager(skills_root)

            manager.disable_shared_package("audit")

            self.assertFalse((skills_root / "audit").exists())

    def test_disable_is_idempotent_when_absent(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            manager.disable_shared_package("missing")

            self.assertFalse((spec.home / ".codex" / "skills" / "missing").exists())

    def test_disable_refuses_real_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_skill_package(spec.home / ".codex" / "skills", "audit", "Local Audit")
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            with self.assertRaises(MutationError) as ctx:
                manager.disable_shared_package("audit")

            self.assertIn("not a symlink", str(ctx.exception))

    def test_adopt_local_copy_replaces_dir_with_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            harness_pkg = seed_skill_package(spec.home / ".codex" / "skills", "audit", "Audit")
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            manager.adopt_local_copy(harness_pkg, store_pkg)

            self.assertTrue(harness_pkg.is_symlink())
            self.assertEqual(harness_pkg.resolve(), store_pkg.resolve())

    def test_adopt_local_copy_is_idempotent_when_already_linked(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            link = spec.home / ".codex" / "skills" / "audit"
            link.symlink_to(store_pkg.resolve())
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            manager.adopt_local_copy(link, store_pkg)

            self.assertTrue(link.is_symlink())

    def test_adopt_local_copy_refuses_missing_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            with self.assertRaises(MutationError) as ctx:
                manager.adopt_local_copy(spec.home / ".codex" / "skills" / "missing", store_pkg)

            self.assertIn("does not exist", str(ctx.exception))

    def test_adopt_local_copy_refuses_foreign_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            other = seed_skill_package(Path(temp_dir) / "other", "audit", "Other")
            link = spec.home / ".codex" / "skills" / "audit"
            link.symlink_to(other.resolve())
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            with self.assertRaises(MutationError) as ctx:
                manager.adopt_local_copy(link, store_pkg)

            self.assertIn("points to", str(ctx.exception))

    def test_materialize_restores_real_directory_from_shared_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit", body="shared version")
            link = spec.home / ".codex" / "skills" / "audit"
            link.symlink_to(store_pkg.resolve())
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            manager.materialize_binding("audit", store_pkg)

            self.assertTrue(link.is_dir())
            self.assertFalse(link.is_symlink())
            self.assertIn("shared version", (link / "SKILL.md").read_text(encoding="utf-8"))

    def test_materialize_refuses_real_directory_targets(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            seed_skill_package(spec.home / ".codex" / "skills", "audit", "Audit", body="local")
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            with self.assertRaises(MutationError) as ctx:
                manager.materialize_binding("audit", store_pkg)

            self.assertIn("not a symlink", str(ctx.exception))

    def test_materialize_refuses_foreign_symlink_targets(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.shared_store_root, "audit", "Audit")
            other_pkg = seed_skill_package(Path(temp_dir) / "other-store", "audit", "Other")
            (spec.home / ".codex" / "skills" / "audit").symlink_to(other_pkg.resolve())
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")

            with self.assertRaises(MutationError) as ctx:
                manager.materialize_binding("audit", store_pkg)

            self.assertIn("points to", str(ctx.exception))

    def test_has_binding_detects_real_directory_and_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            manager = SymlinkHarnessManager(spec.home / ".codex" / "skills")
            self.assertFalse(manager.has_binding("audit"))

            seed_skill_package(spec.home / ".codex" / "skills", "audit", "Audit")
            self.assertTrue(manager.has_binding("audit"))


if __name__ == "__main__":
    unittest.main()
