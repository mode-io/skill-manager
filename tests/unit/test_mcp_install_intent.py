from __future__ import annotations

import unittest

from skill_manager.application.mcp.install_intent import (
    ManagedMcpRecord,
    RegistryInstallIntent,
)
from skill_manager.application.mcp.install_state import (
    install_config_status,
    resolve_enable_managed_spec,
)
from skill_manager.application.mcp.store import McpServerSpec, McpSource


def _detail() -> dict[str, object]:
    return {
        "qualifiedName": "ai.cueapi/mcp",
        "displayName": "CueAPI",
        "registryServer": {
            "name": "ai.cueapi/mcp",
            "title": "CueAPI",
            "version": "0.1.3",
            "packages": [
                {
                    "registryType": "npm",
                    "identifier": "@cueapi/mcp",
                    "version": "0.1.3",
                    "transport": {"type": "stdio"},
                    "environmentVariables": [
                        {"name": "CUEAPI_API_KEY", "isRequired": True, "isSecret": True},
                        {"name": "CUEAPI_BASE_URL", "default": "https://api.cueapi.ai"},
                        {"name": "OPTIONAL_TOKEN", "isSecret": True},
                    ],
                }
            ],
        },
    }


def _spec(env: tuple[tuple[str, str], ...] | None = None) -> McpServerSpec:
    return McpServerSpec(
        name="ai-cueapi-mcp",
        display_name="CueAPI",
        source=McpSource.marketplace("ai.cueapi/mcp"),
        transport="stdio",
        command="npx",
        args=("-y", "@cueapi/mcp@0.1.3"),
        env=env,
    )


class RegistryInstallIntentTests(unittest.TestCase):
    def test_config_status_uses_persisted_intent_values(self) -> None:
        intent = RegistryInstallIntent.create(
            qualified_name="ai.cueapi/mcp",
            option_key="package:npm:@cueapi/mcp:0.1.3",
            values={"CUEAPI_API_KEY": "cue-key"},
        )

        status = install_config_status(_detail(), _spec(env=None), intent)

        self.assertTrue(status.has_fields)
        self.assertEqual(status.missing_required, ())
        self.assertTrue(status.configured)

    def test_enable_merge_keeps_existing_optional_values(self) -> None:
        record = ManagedMcpRecord(
            spec=_spec(env=None),
            install_intent=RegistryInstallIntent.create(
                qualified_name="ai.cueapi/mcp",
                option_key="package:npm:@cueapi/mcp:0.1.3",
                values={
                    "CUEAPI_API_KEY": "cue-key",
                    "OPTIONAL_TOKEN": "saved-token",
                },
            ),
        )

        resolved = resolve_enable_managed_spec(_detail(), record, config={})

        self.assertEqual(
            resolved.spec.env_dict(),
            {
                "CUEAPI_API_KEY": "cue-key",
                "CUEAPI_BASE_URL": "https://api.cueapi.ai",
                "OPTIONAL_TOKEN": "saved-token",
            },
        )
        self.assertIsNotNone(resolved.install_intent)
        assert resolved.install_intent is not None
        self.assertEqual(resolved.install_intent.values_dict()["OPTIONAL_TOKEN"], "saved-token")

    def test_legacy_spec_only_record_gets_intent_on_enable_resolution(self) -> None:
        record = ManagedMcpRecord(
            spec=_spec(env=(("CUEAPI_API_KEY", "legacy-key"),)),
            install_intent=None,
        )

        resolved = resolve_enable_managed_spec(_detail(), record, config=None)

        self.assertIsNotNone(resolved.install_intent)
        assert resolved.install_intent is not None
        self.assertEqual(resolved.install_intent.option_key, "package:npm:@cueapi/mcp:0.1.3")
        self.assertEqual(resolved.install_intent.values_dict()["CUEAPI_API_KEY"], "legacy-key")


if __name__ == "__main__":
    unittest.main()
