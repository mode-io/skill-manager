from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.harness import SubprocessCommandRunner, create_default_adapters

from tests.support import create_fake_home_spec, seed_builtin_catalog, seed_skill_package
from tests.support.command_runner import StubCommandRunner


class AdapterTests(unittest.TestCase):
    def test_subprocess_command_runner_handles_missing_binary(self) -> None:
        result = SubprocessCommandRunner().run(("definitely-not-a-real-skill-manager-command",))
        self.assertEqual(result.returncode, 127)
        self.assertIn("definitely-not-a-real-skill-manager-command", result.stderr)

    def test_filesystem_and_config_adapters_discover_skills_and_builtins(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            seed_skill_package(spec.home / ".codex" / "skills", "trace-lens", "Trace Lens")
            seed_skill_package(spec.xdg_config_home / "openclaw" / "skills", "watch", "Workspace Watch")
            seed_builtin_catalog(
                spec.xdg_config_home / "openclaw" / "builtins.json",
                [{"id": "builtin-openclaw-console", "name": "Console View"}],
            )

            adapters = create_default_adapters(spec.env(), command_runner=StubCommandRunner())
            scans = {scan.harness: scan for scan in (adapter.scan() for adapter in adapters)}

            self.assertTrue(scans["codex"].detected)
            self.assertEqual(scans["codex"].skills[0].package.declared_name, "Trace Lens")
            self.assertFalse(scans["claude"].detected)
            self.assertEqual(scans["openclaw"].builtins[0].declared_name, "Console View")
            self.assertTrue(any(item.startswith("builtins:") for item in scans["openclaw"].detection_details))

    def test_gemini_adapter_uses_command_runner_when_available(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            gemini_skill = seed_skill_package(spec.xdg_config_home / "gemini" / "skills", "guide", "Gemini Guide")
            runner = StubCommandRunner()
            runner.add_json_result(
                ("gemini", "skills", "list", "--json"),
                {
                    "skills": [{"path": str(gemini_skill), "scope": "user"}],
                    "builtins": [{"id": "builtin-scout", "name": "Scout"}],
                },
            )
            adapters = create_default_adapters(spec.env(), command_runner=runner)
            gemini = next(adapter for adapter in adapters if adapter.config.harness == "gemini")
            scan = gemini.scan()
            self.assertTrue(scan.detected)
            self.assertEqual(scan.skills[0].package.declared_name, "Gemini Guide")
            self.assertEqual(scan.builtins[0].declared_name, "Scout")
            self.assertEqual(scan.detection_details, ("command:gemini skills list --json",))

    def test_gemini_adapter_reports_missing_command_as_warning_issue(self) -> None:
        with TemporaryDirectory() as temp_dir:
            spec = create_fake_home_spec(Path(temp_dir))
            adapters = create_default_adapters(spec.env(), command_runner=StubCommandRunner())
            gemini = next(adapter for adapter in adapters if adapter.config.harness == "gemini")
            scan = gemini.scan()
            self.assertFalse(scan.detected)
            self.assertTrue(scan.issues)
            self.assertIn("missing stub", scan.issues[0])


if __name__ == "__main__":
    unittest.main()
