from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.application.skills.adapters import build_skills_adapters
from skill_manager.errors import MutationError
from skill_manager.harness import HarnessKernelService, HarnessSupportStore

from tests.support.fake_home import create_fake_home_spec, seed_skill_package


def _adapter(harness: str, spec) :
    kernel = HarnessKernelService.from_environment(
        spec.env(),
        support_store=HarnessSupportStore(spec.root / "settings.json"),
    )
    return next(adapter for adapter in build_skills_adapters(kernel) if adapter.harness == harness)


class SkillsAdapterTests(unittest.TestCase):
    def test_adapter_scans_discovery_roots_and_reports_installation(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_skill_package(spec.codex_legacy_root, "trace-lens", "Trace Lens")
            seed_skill_package(spec.openclaw_managed_root, "watch", "Workspace Watch")

            codex = _adapter("codex", spec)
            claude = _adapter("claude", spec)
            openclaw = _adapter("openclaw", spec)

            codex_scan = codex.scan()
            claude_scan = claude.scan()
            openclaw_scan = openclaw.scan()

            self.assertTrue(codex_scan.installed)
            self.assertEqual(codex_scan.skills[0].package.declared_name, "Trace Lens")
            self.assertTrue(claude_scan.installed)
            self.assertEqual(claude_scan.skills, ())
            self.assertTrue(openclaw_scan.installed)
            self.assertEqual(
                [skill.package.declared_name for skill in openclaw_scan.skills],
                ["Workspace Watch"],
            )

    def test_adapter_reports_missing_cli_as_not_installed(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir), seed_openclaw_state=False)

            openclaw = _adapter("openclaw", spec)

            self.assertFalse(openclaw.status().installed)
            self.assertEqual(openclaw.scan().skills, ())

    def test_enable_creates_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.skills_store_root, "audit", "Audit")
            codex = _adapter("codex", spec)

            codex.enable_shared_package(package)

            link = spec.codex_root / "audit"
            self.assertTrue(link.is_symlink())
            self.assertEqual(link.resolve(), package.resolve())

    def test_enable_refuses_real_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            package = seed_skill_package(spec.skills_store_root, "audit", "Audit")
            seed_skill_package(spec.codex_root, "audit", "Local Audit")
            codex = _adapter("codex", spec)

            with self.assertRaises(MutationError) as ctx:
                codex.enable_shared_package(package)

            self.assertIn("real directory", str(ctx.exception))

    def test_adopt_local_copy_replaces_dir_with_symlink(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(spec.skills_store_root, "audit", "Audit")
            harness_pkg = seed_skill_package(spec.codex_root, "audit", "Audit")
            codex = _adapter("codex", spec)

            codex.adopt_local_copy(harness_pkg, store_pkg)

            self.assertTrue(harness_pkg.is_symlink())
            self.assertEqual(harness_pkg.resolve(), store_pkg.resolve())

    def test_materialize_binding_restores_real_directory(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            store_pkg = seed_skill_package(
                spec.skills_store_root,
                "audit",
                "Audit",
                body="shared version",
            )
            link = spec.codex_root / "audit"
            link.symlink_to(store_pkg.resolve())
            codex = _adapter("codex", spec)

            codex.materialize_binding("audit", store_pkg)

            self.assertTrue(link.is_dir())
            self.assertFalse(link.is_symlink())
            self.assertIn("shared version", (link / "SKILL.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
