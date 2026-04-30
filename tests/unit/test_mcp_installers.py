from __future__ import annotations

import json
import unittest
from pathlib import Path

from skill_manager.application.mcp.installers import SmitheryCliInstallProvider
from skill_manager.errors import MutationError


class SmitheryCliInstallProviderTests(unittest.TestCase):
    def test_install_targets_include_all_observable_smithery_clients(self) -> None:
        provider = SmitheryCliInstallProvider()

        targets = {target.harness: target for target in provider.install_targets()}

        self.assertEqual(targets["codex"].smithery_client, "codex")
        self.assertEqual(targets["claude"].smithery_client, "claude-code")
        self.assertEqual(targets["cursor"].smithery_client, "cursor")
        self.assertEqual(targets["opencode"].smithery_client, "opencode")
        self.assertTrue(targets["claude"].supported)
        self.assertFalse(targets["openclaw"].supported)
        self.assertEqual(
            targets["openclaw"].reason,
            "Smithery does not provide an OpenClaw MCP installer target",
        )

    def test_unsupported_target_fails_before_running_cli(self) -> None:
        calls: list[list[str]] = []

        def runner(command, **_kwargs):  # noqa: ANN001
            calls.append(command)
            raise AssertionError("runner should not be called")

        provider = SmitheryCliInstallProvider(runner=runner)

        with self.assertRaises(MutationError):
            provider.install(qualified_name="exa", source_harness="openclaw")
        self.assertEqual(calls, [])

    def test_install_runs_smithery_cli_noninteractively_with_analytics_opt_out(self) -> None:
        calls: list[dict[str, object]] = []

        def runner(command, **kwargs):  # noqa: ANN001
            env = kwargs["env"]
            settings_path = Path(env["SMITHERY_CONFIG_PATH"]) / "settings.json"
            calls.append(
                {
                    "command": command,
                    "input": kwargs["input"],
                    "env": env,
                    "settings": json.loads(settings_path.read_text(encoding="utf-8")),
                }
            )

            class Result:
                returncode = 0
                stdout = ""
                stderr = ""

            return Result()

        provider = SmitheryCliInstallProvider(runner=runner)

        result = provider.install(qualified_name="exa", source_harness="codex")

        self.assertEqual(result.installer, "smithery")
        self.assertEqual(calls[0]["command"], [
            "npx",
            "-y",
            "@smithery/cli@latest",
            "mcp",
            "add",
            "exa",
            "--client",
            "codex",
            "--config",
            "{}",
        ])
        self.assertEqual(calls[0]["input"], "")
        env = calls[0]["env"]
        self.assertEqual(env["NO_COLOR"], "1")
        self.assertIn("SMITHERY_CONFIG_PATH", env)
        settings = calls[0]["settings"]
        self.assertFalse(settings["analyticsConsent"])
        self.assertTrue(settings["askedConsent"])


if __name__ == "__main__":
    unittest.main()
