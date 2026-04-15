from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.harness import create_default_drivers

from tests.support.fake_home import create_fake_home_spec, seed_skill_package


class AdapterTests(unittest.TestCase):
    def test_default_adapters_report_installation_and_global_skill_discovery(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_skill_package(spec.codex_legacy_root, "trace-lens", "Trace Lens")
            seed_skill_package(spec.openclaw_managed_root, "watch", "Workspace Watch")

            drivers = create_default_drivers(spec.env())
            scans = {scan.harness: scan for scan in (driver.scan() for driver in drivers)}
            statuses = {driver.harness: driver.status() for driver in drivers}

            self.assertTrue(scans["codex"].installed)
            self.assertEqual(scans["codex"].skills[0].package.declared_name, "Trace Lens")
            self.assertTrue(scans["claude"].installed)
            self.assertEqual(scans["claude"].skills, ())
            self.assertTrue(scans["openclaw"].installed)
            self.assertEqual([skill.package.declared_name for skill in scans["openclaw"].skills], ["Workspace Watch"])
            self.assertEqual(scans["openclaw"].builtins, ())
            self.assertEqual(statuses["openclaw"].locations[0].label, "Managed skills root")
            self.assertEqual(statuses["openclaw"].locations[1].label, "Personal agent skills root")

    def test_missing_openclaw_cli_reports_not_installed_even_when_root_exists(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir), seed_openclaw_state=False)

            drivers = create_default_drivers(spec.env())
            scans = {scan.harness: scan for scan in (driver.scan() for driver in drivers)}
            statuses = {driver.harness: driver.status() for driver in drivers}

            self.assertFalse(scans["openclaw"].installed)
            self.assertEqual(scans["openclaw"].skills, ())
            self.assertFalse(statuses["openclaw"].installed)
            self.assertEqual(
                statuses["openclaw"].locations[0].path,
                spec.openclaw_managed_root,
            )

    def test_installed_harness_remains_installed_when_canonical_root_is_missing(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            spec.codex_root.rmdir()

            drivers = create_default_drivers(spec.env())
            scans = {scan.harness: scan for scan in (driver.scan() for driver in drivers)}
            statuses = {driver.harness: driver.status() for driver in drivers}

            self.assertTrue(scans["codex"].installed)
            self.assertTrue(statuses["codex"].installed)
            self.assertFalse(statuses["codex"].locations[0].present)
            self.assertEqual(statuses["codex"].locations[0].path, spec.codex_root)


if __name__ == "__main__":
    unittest.main()
