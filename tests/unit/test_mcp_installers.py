from __future__ import annotations

import unittest

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


if __name__ == "__main__":
    unittest.main()
