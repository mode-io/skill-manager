from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.harness import create_default_adapters

from tests.support import create_fake_home_spec, seed_openclaw_cli_payload, seed_skill_package


class AdapterTests(unittest.TestCase):
    def test_default_adapters_discover_local_skills_and_ignore_openclaw_bundled_entries(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_skill_package(spec.home / ".codex" / "skills", "trace-lens", "Trace Lens")
            seed_skill_package(spec.openclaw_managed_root, "watch", "Workspace Watch")
            seed_openclaw_cli_payload(
                spec,
                skills=[
                    {
                        "id": "builtin-openclaw-observe",
                        "name": "Observe",
                        "source": "openclaw-bundled",
                    }
                ],
            )

            adapters = create_default_adapters(spec.env())
            scans = {scan.harness: scan for scan in (adapter.scan() for adapter in adapters)}
            statuses = {adapter.config.harness: adapter.status() for adapter in adapters}

            self.assertTrue(scans["codex"].detected)
            self.assertEqual(scans["codex"].skills[0].package.declared_name, "Trace Lens")
            self.assertTrue(scans["claude"].detected)
            self.assertEqual(scans["claude"].skills, ())
            self.assertTrue(scans["openclaw"].detected)
            self.assertEqual([skill.package.declared_name for skill in scans["openclaw"].skills], ["Workspace Watch"])
            self.assertEqual(scans["openclaw"].builtins, ())
            self.assertEqual(statuses["openclaw"].locations[0].label, "Config")
            self.assertEqual(statuses["openclaw"].locations[2].label, "Managed skills root")


if __name__ == "__main__":
    unittest.main()
