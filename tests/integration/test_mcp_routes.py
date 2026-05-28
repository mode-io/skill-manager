from __future__ import annotations

import json
import unittest
from pathlib import Path

from skill_manager.application.mcp.availability import McpAvailabilityResult
from skill_manager.application.mcp.stdio import parse_static_stdio_function
from skill_manager.application.mcp.store import McpServerSpec, McpSource
from skill_manager.errors import MutationError

from tests.support.app_harness import AppTestHarness


class FakeMcpMarketplace:
    """In-memory marketplace stub returning a deterministic Exa-like server."""

    def __init__(
        self,
        qualified_name: str = "exa",
        config_schema: dict[str, object] | None = None,
        *,
        is_remote: bool = True,
        deployment_url: str | None = "https://mcp.exa.ai",
        connections: list[dict[str, object]] | None = None,
        registry_server: dict[str, object] | None = None,
    ) -> None:
        self.qualified_name = qualified_name
        registry_server = registry_server or _registry_server_from_connections(
            qualified_name,
            deployment_url=deployment_url,
            connections=connections,
        )
        self._payload = {
            "qualifiedName": qualified_name,
            "displayName": "Exa Search" if qualified_name == "exa" else qualified_name.title(),
            "description": "Search the web",
            "iconUrl": None,
            "isRemote": is_remote,
            "deploymentUrl": deployment_url,
            "connections": connections
            if connections is not None
            else [
                {"kind": "http", "deploymentUrl": deployment_url, "configSchema": config_schema}
            ],
            "tools": [],
            "resources": [],
            "prompts": [],
            "registryServer": registry_server,
        }

    def detail(self, qualified_name: str):
        if qualified_name == self.qualified_name:
            return {key: value for key, value in self._payload.items() if key != "registryServer"}
        return None

    def install_detail(self, qualified_name: str):
        if qualified_name == self.qualified_name:
            return {
                "qualifiedName": self._payload["qualifiedName"],
                "displayName": self._payload["displayName"],
                "registryServer": self._payload["registryServer"],
            }
        return None


class _Container:
    """Wraps AppTestHarness and replaces the mcp marketplace catalog with a stub."""

    def __init__(
        self,
        harness: AppTestHarness,
        qualified_name: str = "exa",
        config_schema: dict[str, object] | None = None,
        *,
        is_remote: bool = True,
        deployment_url: str | None = "https://mcp.exa.ai",
        connections: list[dict[str, object]] | None = None,
        registry_server: dict[str, object] | None = None,
    ) -> None:
        self.harness = harness
        marketplace = FakeMcpMarketplace(
            qualified_name,
            config_schema,
            is_remote=is_remote,
            deployment_url=deployment_url,
            connections=connections,
            registry_server=registry_server,
        )
        harness.container.mcp_mutations.marketplace = marketplace
        harness.container.mcp_queries.marketplace = marketplace


class FakeMcpAvailabilityProbe:
    def __init__(self, status: str = "available", reason: str | None = None) -> None:
        self.status = status
        self.reason = reason
        self.probed: list[str] = []

    def probe(self, spec: McpServerSpec) -> McpAvailabilityResult:
        self.probed.append(spec.name)
        return McpAvailabilityResult(status=self.status, reason=self.reason)


def _registry_server_from_connections(
    qualified_name: str,
    *,
    deployment_url: str | None,
    connections: list[dict[str, object]] | None,
) -> dict[str, object]:
    server: dict[str, object] = {
        "name": qualified_name,
        "title": "Exa Search" if qualified_name == "exa" else qualified_name.title(),
        "version": "1.0.0",
        "description": "Search the web",
    }
    first = connections[0] if connections else None
    if isinstance(first, dict) and str(first.get("kind") or first.get("type")).lower() == "stdio":
        stdio = parse_static_stdio_function(first.get("stdioFunction"))
        if stdio is None:
            raise AssertionError("test stdio fixture must include a static stdioFunction")
        package_ref = next((arg for arg in reversed(stdio.args) if not arg.startswith("-")), stdio.command)
        server["packages"] = [
            {
                "registryType": "npm",
                "identifier": package_ref,
                "version": "1.0.0",
                "transport": {"type": "stdio"},
            }
        ]
        return server
    kind = "streamable-http"
    if isinstance(first, dict) and str(first.get("kind") or first.get("type")).lower() == "sse":
        kind = "sse"
    url = deployment_url or "https://mcp.example"
    server["remotes"] = [{"type": kind, "url": url}]
    return server


def _install(harness: AppTestHarness, name: str = "exa") -> None:
    harness.post_json("/api/mcp/servers", {"qualifiedName": name})


def _seed_manual_remote(harness: AppTestHarness, name: str = "remote") -> None:
    harness.container.mcp_store.upsert_from_spec(
        McpServerSpec(
            name=name,
            display_name="Remote",
            source=McpSource.manual(name),
            transport="http",
            url="https://mcp.example.com",
        )
    )
    harness.container.mcp_read_models.invalidate()


class McpRoutesTests(unittest.TestCase):
    def test_list_servers_starts_empty(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/api/mcp/servers")
            assert isinstance(payload, dict)
            self.assertEqual(payload.get("entries"), [])
            # Columns reflect enabled harnesses (codex, claude, cursor, opencode, openclaw)
            cols = [col["harness"] for col in payload["columns"]]
            self.assertIn("codex", cols)
            self.assertIn("claude", cols)

    def test_install_resolves_registry_config_without_writing_harness(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            response = harness.post_json("/api/mcp/servers", {"qualifiedName": "exa"})
            self.assertTrue(response["ok"])
            self.assertEqual(response["server"]["name"], "exa")
            self.assertEqual(response["server"]["transport"], "http")
            self.assertEqual(response["server"]["url"], "https://mcp.exa.ai")

            # Central manifest contains it.
            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            names = [entry["name"] for entry in servers["entries"]]
            self.assertIn("exa", names)
            entry = next(item for item in servers["entries"] if item["name"] == "exa")
            self.assertEqual(entry["enabledStatus"], "disabled")

            detail = harness.get_json("/api/mcp/servers/exa")
            self.assertEqual(detail["enabledStatus"], "disabled")

            # Installing from the marketplace only updates Skill Manager's manifest.
            self.assertFalse((harness.spec.home / ".cursor" / "mcp.json").exists())
            self.assertFalse((harness.spec.home / ".claude.json").exists())
            self.assertFalse((harness.spec.home / ".codex" / "config.toml").exists())

    def test_install_without_target_harness_only_updates_manifest(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")

            response = harness.post_json("/api/mcp/servers", {"qualifiedName": "exa"})

            self.assertTrue(response["ok"])
            self.assertEqual(response["server"]["name"], "exa")
            servers = harness.get_json("/api/mcp/servers")
            entry = next(item for item in servers["entries"] if item["name"] == "exa")
            self.assertEqual(entry["enabledStatus"], "disabled")
            self.assertFalse((harness.spec.home / ".cursor" / "mcp.json").exists())
            self.assertFalse((harness.spec.home / ".claude.json").exists())

    def test_install_checks_availability_immediately(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            probe = FakeMcpAvailabilityProbe(status="available")
            harness.container.mcp_mutations.availability_probe = probe

            response = harness.post_json("/api/mcp/servers", {"qualifiedName": "exa"})

            self.assertTrue(response["ok"])
            self.assertEqual(probe.probed, ["exa"])
            detail = harness.get_json("/api/mcp/servers/exa")
            self.assertEqual(detail["availabilityStatus"], "available")
            self.assertEqual(detail["mcpStatus"]["kind"], "available")

    def test_list_servers_marks_mcp_disabled_when_no_addressable_harness_is_managed(self) -> None:
        with AppTestHarness() as harness:
            harness.container.mcp_store.upsert_from_spec(
                McpServerSpec(
                    name="remote",
                    display_name="Remote",
                    source=McpSource.manual("remote"),
                    transport="http",
                    url="https://mcp.example.com",
                )
            )
            harness.container.mcp_read_models.invalidate()

            servers = harness.get_json("/api/mcp/servers")
            entry = next(item for item in servers["entries"] if item["name"] == "remote")
            self.assertEqual(entry["enabledStatus"], "disabled")
            self.assertEqual(entry["mcpStatus"]["kind"], "unchecked")

    def test_list_servers_ignores_managed_bindings_on_non_addressable_harnesses_for_enabled_status(self) -> None:
        with AppTestHarness() as harness:
            harness.container.mcp_store.upsert_from_spec(
                McpServerSpec(
                    name="remote",
                    display_name="Remote",
                    source=McpSource.manual("remote"),
                    transport="http",
                    url="https://mcp.example.com",
                )
            )
            openclaw_cfg = harness.spec.home / ".openclaw" / "openclaw.json"
            openclaw_cfg.parent.mkdir(parents=True, exist_ok=True)
            openclaw_cfg.write_text(
                json.dumps({"mcp": {"remote": {"type": "remote", "url": "https://mcp.example.com"}}}),
                encoding="utf-8",
            )
            harness.container.mcp_read_models.invalidate()

            servers = harness.get_json("/api/mcp/servers")
            entry = next(item for item in servers["entries"] if item["name"] == "remote")
            self.assertEqual(entry["enabledStatus"], "disabled")
            self.assertEqual(entry["mcpStatus"]["kind"], "unchecked")

    def test_availability_check_updates_runtime_status(self) -> None:
        with AppTestHarness() as harness:
            probe = FakeMcpAvailabilityProbe(status="available")
            harness.container.mcp_queries.availability_probe = probe
            _seed_manual_remote(harness, name="remote")
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "cursor"})

            detail_before = harness.get_json("/api/mcp/servers/remote")
            self.assertEqual(detail_before["availabilityStatus"], "unavailable")
            self.assertEqual(detail_before["mcpStatus"]["kind"], "unchecked")
            self.assertIsNone(detail_before["mcpStatus"]["reason"])

            result = harness.post_json("/api/mcp/servers/remote/availability/check")
            self.assertTrue(result["ok"])
            self.assertEqual(result["availabilityStatus"], "available")
            self.assertEqual(probe.probed, ["remote"])

            detail_after = harness.get_json("/api/mcp/servers/remote")
            self.assertEqual(detail_after["availabilityStatus"], "available")
            self.assertEqual(detail_after["mcpStatus"]["kind"], "available")
            self.assertIsNone(detail_after["mcpStatus"]["reason"])

    def test_availability_cache_is_scoped_to_spec_revision(self) -> None:
        with AppTestHarness() as harness:
            probe = FakeMcpAvailabilityProbe(status="available")
            harness.container.mcp_queries.availability_probe = probe
            _seed_manual_remote(harness, name="remote")
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "cursor"})

            first = harness.post_json("/api/mcp/servers/remote/availability/check")
            self.assertEqual(first["availabilityStatus"], "available")

            harness.container.mcp_store.upsert_from_spec(
                McpServerSpec(
                    name="remote",
                    display_name="Remote",
                    source=McpSource.manual("remote"),
                    transport="http",
                    url="https://changed.example.com",
                )
            )
            harness.container.mcp_read_models.invalidate()
            harness.post_json(
                "/api/mcp/servers/remote/reconcile",
                {"sourceKind": "managed", "harnesses": ["cursor"]},
            )
            probe.status = "unavailable"
            probe.reason = "changed config failed"

            detail = harness.get_json("/api/mcp/servers/remote")
            self.assertEqual(detail["availabilityStatus"], "unavailable")
            self.assertIsNone(detail["availabilityReason"])
            self.assertEqual(detail["mcpStatus"]["kind"], "unchecked")
            self.assertIsNone(detail["mcpStatus"]["reason"])
            second = harness.post_json("/api/mcp/servers/remote/availability/check")
            self.assertEqual(second["availabilityStatus"], "unavailable")
            self.assertEqual(second["availabilityReason"], "changed config failed")
            self.assertEqual(probe.probed, ["remote", "remote"])
            detail_after_failure = harness.get_json("/api/mcp/servers/remote")
            self.assertEqual(detail_after_failure["mcpStatus"]["kind"], "connection_issue")
            self.assertEqual(detail_after_failure["mcpStatus"]["reason"], "changed config failed")

    def test_availability_check_runs_before_agent_enablement(self) -> None:
        with AppTestHarness() as harness:
            probe = FakeMcpAvailabilityProbe(status="available")
            harness.container.mcp_queries.availability_probe = probe
            _seed_manual_remote(harness, name="remote")

            result = harness.post_json("/api/mcp/servers/remote/availability/check")
            self.assertTrue(result["ok"])
            self.assertEqual(result["availabilityStatus"], "available")
            self.assertIsNone(result["availabilityReason"])
            self.assertEqual(probe.probed, ["remote"])

            detail_after = harness.get_json("/api/mcp/servers/remote")
            self.assertEqual(detail_after["enabledStatus"], "disabled")
            self.assertEqual(detail_after["availabilityStatus"], "available")
            self.assertIsNone(detail_after["availabilityReason"])
            self.assertEqual(detail_after["mcpStatus"]["kind"], "available")
            self.assertIsNone(detail_after["mcpStatus"]["reason"])

    def test_enable_writes_claude_code_config(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            response = harness.post_json("/api/mcp/servers", {"qualifiedName": "exa"})
            harness.post_json("/api/mcp/servers/exa/enable", {"harness": "claude"})
            self.assertTrue(response["ok"])
            self.assertEqual(response["server"]["name"], "exa")
            self.assertEqual(response["server"]["url"], "https://mcp.exa.ai")

            claude_cfg = json.loads((harness.spec.home / ".claude.json").read_text())
            project = claude_cfg
            self.assertEqual(
                project["mcpServers"]["exa"]["url"],
                "https://mcp.exa.ai",
            )
            self.assertEqual(project["mcpServers"]["exa"]["type"], "http")

            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            entry = next(item for item in servers["entries"] if item["name"] == "exa")
            states = {sighting["harness"]: sighting["state"] for sighting in entry["sightings"]}
            self.assertEqual(states["claude"], "managed")

    def test_enable_writes_to_target_harness_only(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            _install(harness)
            harness.post_json("/api/mcp/servers/exa/enable", {"harness": "claude"})

            claude_cfg = harness.spec.home / ".claude.json"
            self.assertTrue(claude_cfg.is_file())
            payload = json.loads(claude_cfg.read_text(encoding="utf-8"))
            self.assertIn("exa", payload["mcpServers"])
            self.assertEqual(payload["mcpServers"]["exa"]["url"], "https://mcp.exa.ai")

            # Other harnesses untouched
            self.assertFalse((harness.spec.home / ".codex" / "config.toml").exists())

    def test_disable_removes_from_harness_but_keeps_central(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            _install(harness)
            harness.post_json("/api/mcp/servers/exa/enable", {"harness": "cursor"})
            harness.post_json("/api/mcp/servers/exa/disable", {"harness": "cursor"})

            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            self.assertTrue(cursor_cfg.is_file())
            payload = json.loads(cursor_cfg.read_text(encoding="utf-8"))
            self.assertNotIn("exa", payload.get("mcpServers", {}))

            # Central retained
            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            self.assertIn("exa", [e["name"] for e in servers["entries"]])

    def test_set_harnesses_fan_out(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            _install(harness)
            response = harness.post_json(
                "/api/mcp/servers/exa/set-harnesses", {"target": "enabled"}
            )
            self.assertTrue(response["ok"])
            self.assertEqual(set(response["succeeded"]), {"codex", "claude", "cursor", "opencode", "openclaw"})

            # Verify each config file
            self.assertTrue((harness.spec.home / ".cursor" / "mcp.json").is_file())
            self.assertTrue((harness.spec.home / ".claude.json").is_file())
            self.assertTrue((harness.spec.home / ".codex" / "config.toml").is_file())
            self.assertTrue((harness.spec.home / ".opencode" / "opencode.jsonc").is_file())
            self.assertTrue((harness.spec.home / ".openclaw" / "openclaw.json").is_file())

    def test_uninstall_cleans_all_harnesses_and_central(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            _install(harness)
            harness.post_json("/api/mcp/servers/exa/set-harnesses", {"target": "enabled"})

            # urlopen with custom method — use AppTestHarness internals
            from urllib.request import Request, urlopen
            req = Request(f"{harness.base_url}/api/mcp/servers/exa", method="DELETE")
            with urlopen(req) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(payload["ok"])

            # Central gone
            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            self.assertEqual(servers["entries"], [])

            # All harness files cleaned of the entry
            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            self.assertNotIn("exa", cursor_cfg.get("mcpServers", {}))

    def test_install_unknown_qualified_name_returns_404(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            harness.post_json(
                "/api/mcp/servers",
                {"qualifiedName": "nonexistent"},
                expected_status=404,
            )

    def test_enable_does_not_update_manifest_when_target_harness_write_fails(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            harness.post_json("/api/mcp/servers", {"qualifiedName": "exa"})
            adapter = harness.container.mcp_read_models.find_adapter("cursor")
            assert adapter is not None

            def fail_enable(_spec: McpServerSpec) -> None:
                raise MutationError("cursor write failed", status=400)

            adapter.enable_server = fail_enable  # type: ignore[method-assign]

            harness.post_json(
                "/api/mcp/servers/exa/enable",
                {"harness": "cursor"},
                expected_status=400,
            )

            self.assertIsNotNone(harness.container.mcp_store.get_managed("exa"))
            cursor_config_path = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg = json.loads(cursor_config_path.read_text()) if cursor_config_path.exists() else {}
            self.assertNotIn("exa", cursor_cfg.get("mcpServers", {}))

    def test_marketplace_schema_metadata_does_not_change_observed_install(self) -> None:
        schema = {
            "type": "object",
            "required": ["browserbaseApiKey"],
            "properties": {
                "browserbaseApiKey": {
                    "type": "string",
                    "description": "Browserbase API key",
                    "x-from": {"query": "browserbaseApiKey"},
                }
            },
        }
        with AppTestHarness() as harness:
            _Container(harness, "browserbase", schema)
            install = harness.post_json("/api/mcp/servers", {"qualifiedName": "browserbase"})

            self.assertTrue(install["ok"])
            self.assertEqual(install["server"]["name"], "browserbase")
            self.assertEqual(install["server"]["url"], "https://mcp.exa.ai")
            self.assertFalse((harness.spec.home / ".cursor" / "mcp.json").exists())

    def test_install_defers_required_registry_environment_config(self) -> None:
        registry_server = {
            "name": "ai.cueapi/mcp",
            "title": "CueAPI",
            "version": "0.1.3",
            "description": "Schedule agent work",
            "packages": [
                {
                    "registryType": "npm",
                    "identifier": "@cueapi/mcp",
                    "version": "0.1.3",
                    "transport": {"type": "stdio"},
                    "environmentVariables": [
                        {"name": "CUEAPI_API_KEY", "isRequired": True, "isSecret": True}
                    ],
                }
            ],
        }
        with AppTestHarness() as harness:
            _Container(harness, "ai.cueapi/mcp", is_remote=False, registry_server=registry_server)
            probe = FakeMcpAvailabilityProbe(status="unavailable", reason="missing CUEAPI_API_KEY")
            harness.container.mcp_mutations.availability_probe = probe

            install = harness.post_json("/api/mcp/servers", {"qualifiedName": "ai.cueapi/mcp"})

            self.assertTrue(install["ok"])
            self.assertEqual(probe.probed, ["ai-cueapi-mcp"])
            self.assertIsNotNone(harness.container.mcp_store.get_managed("ai-cueapi-mcp"))
            self.assertFalse((harness.spec.home / ".cursor" / "mcp.json").exists())
            detail = harness.get_json("/api/mcp/servers/ai-cueapi-mcp")
            self.assertEqual(detail["installConfigStatus"]["hasFields"], True)
            self.assertEqual(detail["installConfigStatus"]["missingRequired"], ["CUEAPI_API_KEY"])
            self.assertEqual(detail["installConfigStatus"]["configured"], False)
            self.assertEqual(detail["mcpStatus"]["kind"], "needs_config")
            servers = harness.get_json("/api/mcp/servers")
            entry = next(item for item in servers["entries"] if item["name"] == "ai-cueapi-mcp")
            self.assertEqual(entry["installConfigStatus"]["missingRequired"], ["CUEAPI_API_KEY"])
            self.assertEqual(entry["mcpStatus"]["kind"], "needs_config")

    def test_enable_writes_registry_environment_config_to_target_harness(self) -> None:
        registry_server = {
            "name": "ai.cueapi/mcp",
            "title": "CueAPI",
            "version": "0.1.3",
            "description": "Schedule agent work",
            "packages": [
                {
                    "registryType": "npm",
                    "identifier": "@cueapi/mcp",
                    "version": "0.1.3",
                    "transport": {"type": "stdio"},
                    "environmentVariables": [
                        {"name": "CUEAPI_API_KEY", "isRequired": True, "isSecret": True},
                        {"name": "CUEAPI_BASE_URL", "default": "https://api.cueapi.ai"},
                    ],
                }
            ],
        }
        with AppTestHarness() as harness:
            _Container(harness, "ai.cueapi/mcp", is_remote=False, registry_server=registry_server)

            install = harness.post_json("/api/mcp/servers", {"qualifiedName": "ai.cueapi/mcp"})
            harness.post_json(
                "/api/mcp/servers/ai-cueapi-mcp/enable",
                {"harness": "cursor", "config": {"CUEAPI_API_KEY": "cue-key"}},
            )

            self.assertNotIn("CUEAPI_API_KEY", install["server"].get("env", {}))
            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            self.assertEqual(
                cursor_cfg["mcpServers"]["ai-cueapi-mcp"]["env"],
                {
                    "CUEAPI_API_KEY": "cue-key",
                    "CUEAPI_BASE_URL": "https://api.cueapi.ai",
                },
            )
            detail = harness.get_json("/api/mcp/servers/ai-cueapi-mcp")
            self.assertEqual(detail["installConfigStatus"]["missingRequired"], [])
            self.assertEqual(detail["installConfigStatus"]["configured"], True)

            harness.post_json(
                "/api/mcp/servers/ai-cueapi-mcp/enable",
                {"harness": "claude"},
            )
            claude_cfg = json.loads((harness.spec.home / ".claude.json").read_text())
            self.assertEqual(
                claude_cfg["mcpServers"]["ai-cueapi-mcp"]["env"],
                {
                    "CUEAPI_API_KEY": "cue-key",
                    "CUEAPI_BASE_URL": "https://api.cueapi.ai",
                },
            )

    def test_registry_install_accepts_required_config_when_enabling_harness(self) -> None:
        registry_server = {
            "name": "ai.cueapi/mcp",
            "title": "CueAPI",
            "version": "0.1.3",
            "description": "Schedule agent work",
            "packages": [
                {
                    "registryType": "npm",
                    "identifier": "@cueapi/mcp",
                    "version": "0.1.3",
                    "transport": {"type": "stdio"},
                    "environmentVariables": [
                        {"name": "CUEAPI_API_KEY", "isRequired": True, "isSecret": True},
                        {"name": "CUEAPI_BASE_URL", "default": "https://api.cueapi.ai"},
                    ],
                }
            ],
        }
        with AppTestHarness() as harness:
            _Container(harness, "ai.cueapi/mcp", is_remote=False, registry_server=registry_server)

            install = harness.post_json(
                "/api/mcp/servers",
                {"qualifiedName": "ai.cueapi/mcp"},
            )

            self.assertTrue(install["ok"])
            self.assertNotIn("CUEAPI_API_KEY", install["server"].get("env", {}))
            self.assertFalse((harness.spec.home / ".cursor" / "mcp.json").exists())

            harness.post_json(
                "/api/mcp/servers/ai-cueapi-mcp/enable",
                {"harness": "cursor", "config": {"CUEAPI_API_KEY": "cue-key"}},
            )

            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            self.assertEqual(
                cursor_cfg["mcpServers"]["ai-cueapi-mcp"]["env"],
                {
                    "CUEAPI_API_KEY": "cue-key",
                    "CUEAPI_BASE_URL": "https://api.cueapi.ai",
                },
            )

    def test_registry_install_rejects_enabling_required_config_without_values(self) -> None:
        registry_server = {
            "name": "ai.cueapi/mcp",
            "title": "CueAPI",
            "version": "0.1.3",
            "description": "Schedule agent work",
            "packages": [
                {
                    "registryType": "npm",
                    "identifier": "@cueapi/mcp",
                    "version": "0.1.3",
                    "transport": {"type": "stdio"},
                    "environmentVariables": [
                        {"name": "CUEAPI_API_KEY", "isRequired": True, "isSecret": True}
                    ],
                }
            ],
        }
        with AppTestHarness() as harness:
            _Container(harness, "ai.cueapi/mcp", is_remote=False, registry_server=registry_server)
            harness.post_json("/api/mcp/servers", {"qualifiedName": "ai.cueapi/mcp"})

            harness.post_json(
                "/api/mcp/servers/ai-cueapi-mcp/enable",
                {"harness": "cursor"},
                expected_status=400,
            )
            harness.post_json(
                "/api/mcp/servers/ai-cueapi-mcp/set-harnesses",
                {"target": "enabled"},
                expected_status=400,
            )
            self.assertFalse((harness.spec.home / ".cursor" / "mcp.json").exists())

    def test_enable_with_config_does_not_update_manifest_when_harness_write_fails(self) -> None:
        registry_server = {
            "name": "ai.cueapi/mcp",
            "title": "CueAPI",
            "version": "0.1.3",
            "description": "Schedule agent work",
            "packages": [
                {
                    "registryType": "npm",
                    "identifier": "@cueapi/mcp",
                    "version": "0.1.3",
                    "transport": {"type": "stdio"},
                    "environmentVariables": [
                        {"name": "CUEAPI_API_KEY", "isRequired": True, "isSecret": True}
                    ],
                }
            ],
        }
        with AppTestHarness() as harness:
            _Container(harness, "ai.cueapi/mcp", is_remote=False, registry_server=registry_server)
            harness.post_json("/api/mcp/servers", {"qualifiedName": "ai.cueapi/mcp"})
            adapter = harness.container.mcp_read_models.find_adapter("cursor")
            assert adapter is not None

            def fail_enable(_spec: McpServerSpec) -> None:
                raise MutationError("cursor write failed", status=400)

            adapter.enable_server = fail_enable  # type: ignore[method-assign]

            harness.post_json(
                "/api/mcp/servers/ai-cueapi-mcp/enable",
                {"harness": "cursor", "config": {"CUEAPI_API_KEY": "cue-key"}},
                expected_status=400,
            )

            managed = harness.container.mcp_store.get_managed("ai-cueapi-mcp")
            self.assertIsNotNone(managed)
            assert managed is not None
            self.assertNotIn("CUEAPI_API_KEY", managed.env_dict())

    def test_enable_all_with_config_updates_manifest_after_partial_success(self) -> None:
        registry_server = {
            "name": "ai.cueapi/mcp",
            "title": "CueAPI",
            "version": "0.1.3",
            "description": "Schedule agent work",
            "packages": [
                {
                    "registryType": "npm",
                    "identifier": "@cueapi/mcp",
                    "version": "0.1.3",
                    "transport": {"type": "stdio"},
                    "environmentVariables": [
                        {"name": "CUEAPI_API_KEY", "isRequired": True, "isSecret": True}
                    ],
                }
            ],
        }
        with AppTestHarness() as harness:
            _Container(harness, "ai.cueapi/mcp", is_remote=False, registry_server=registry_server)
            harness.post_json("/api/mcp/servers", {"qualifiedName": "ai.cueapi/mcp"})
            adapter = harness.container.mcp_read_models.find_adapter("cursor")
            assert adapter is not None

            def fail_enable(_spec: McpServerSpec) -> None:
                raise MutationError("cursor write failed", status=400)

            adapter.enable_server = fail_enable  # type: ignore[method-assign]

            response = harness.post_json(
                "/api/mcp/servers/ai-cueapi-mcp/set-harnesses",
                {"target": "enabled", "config": {"CUEAPI_API_KEY": "cue-key"}},
            )

            self.assertFalse(response["ok"])
            self.assertGreater(len(response["succeeded"]), 0)
            managed = harness.container.mcp_store.get_managed("ai-cueapi-mcp")
            self.assertIsNotNone(managed)
            assert managed is not None
            self.assertEqual(managed.env_dict()["CUEAPI_API_KEY"], "cue-key")

    def test_enable_all_with_config_leaves_manifest_when_every_write_fails(self) -> None:
        registry_server = {
            "name": "ai.cueapi/mcp",
            "title": "CueAPI",
            "version": "0.1.3",
            "description": "Schedule agent work",
            "packages": [
                {
                    "registryType": "npm",
                    "identifier": "@cueapi/mcp",
                    "version": "0.1.3",
                    "transport": {"type": "stdio"},
                    "environmentVariables": [
                        {"name": "CUEAPI_API_KEY", "isRequired": True, "isSecret": True}
                    ],
                }
            ],
        }
        with AppTestHarness() as harness:
            _Container(harness, "ai.cueapi/mcp", is_remote=False, registry_server=registry_server)
            harness.post_json("/api/mcp/servers", {"qualifiedName": "ai.cueapi/mcp"})

            def fail_enable(_spec: McpServerSpec) -> None:
                raise MutationError("write failed", status=400)

            for adapter in harness.container.mcp_read_models.enabled_writable_adapters():
                adapter.enable_server = fail_enable  # type: ignore[method-assign]

            response = harness.post_json(
                "/api/mcp/servers/ai-cueapi-mcp/set-harnesses",
                {"target": "enabled", "config": {"CUEAPI_API_KEY": "cue-key"}},
            )

            self.assertFalse(response["ok"])
            self.assertEqual(response["succeeded"], [])
            managed = harness.container.mcp_store.get_managed("ai-cueapi-mcp")
            self.assertIsNotNone(managed)
            assert managed is not None
            self.assertNotIn("CUEAPI_API_KEY", managed.env_dict())

    def test_optional_config_is_preserved_when_enabling_another_harness(self) -> None:
        registry_server = {
            "name": "ai.optional/mcp",
            "title": "Optional MCP",
            "version": "0.1.3",
            "description": "Optional env",
            "packages": [
                {
                    "registryType": "npm",
                    "identifier": "@optional/mcp",
                    "version": "0.1.3",
                    "transport": {"type": "stdio"},
                    "environmentVariables": [
                        {"name": "OPTIONAL_TOKEN", "isSecret": True}
                    ],
                }
            ],
        }
        with AppTestHarness() as harness:
            _Container(harness, "ai.optional/mcp", is_remote=False, registry_server=registry_server)
            harness.post_json("/api/mcp/servers", {"qualifiedName": "ai.optional/mcp"})

            detail_before = harness.get_json("/api/mcp/servers/ai-optional-mcp")
            self.assertEqual(detail_before["installConfigStatus"]["hasFields"], True)
            self.assertEqual(detail_before["installConfigStatus"]["missingRequired"], [])
            self.assertEqual(detail_before["installConfigStatus"]["configured"], True)

            harness.post_json(
                "/api/mcp/servers/ai-optional-mcp/enable",
                {"harness": "cursor", "config": {"OPTIONAL_TOKEN": "opt-token"}},
            )
            managed = harness.container.mcp_store.get_managed("ai-optional-mcp")
            self.assertIsNotNone(managed)
            assert managed is not None
            self.assertEqual(managed.env_dict()["OPTIONAL_TOKEN"], "opt-token")

            harness.post_json(
                "/api/mcp/servers/ai-optional-mcp/enable",
                {"harness": "claude"},
            )

            managed_after = harness.container.mcp_store.get_managed("ai-optional-mcp")
            self.assertIsNotNone(managed_after)
            assert managed_after is not None
            self.assertEqual(managed_after.env_dict()["OPTIONAL_TOKEN"], "opt-token")
            claude_cfg = json.loads((harness.spec.home / ".claude.json").read_text())
            self.assertEqual(
                claude_cfg["mcpServers"]["ai-optional-mcp"]["env"],
                {"OPTIONAL_TOKEN": "opt-token"},
            )

    def test_install_writes_registry_remote_headers_and_url_variables(self) -> None:
        registry_server = {
            "name": "ai.example/remote",
            "title": "Remote",
            "version": "1.0.0",
            "description": "Remote MCP",
            "remotes": [
                {
                    "type": "streamable-http",
                    "url": "https://api.example.com/{workspace}/mcp",
                    "variables": {"workspace": {"isRequired": True}},
                    "headers": [
                        {
                            "name": "Authorization",
                            "value": "Bearer {API_TOKEN}",
                            "variables": {"API_TOKEN": {"isRequired": True, "isSecret": True}},
                        }
                    ],
                }
            ],
        }
        with AppTestHarness() as harness:
            _Container(harness, "ai.example/remote", registry_server=registry_server)

            install = harness.post_json("/api/mcp/servers", {"qualifiedName": "ai.example/remote"})
            harness.post_json(
                "/api/mcp/servers/ai-example-remote/enable",
                {"harness": "cursor", "config": {"workspace": "acme", "API_TOKEN": "token-123"}},
            )

            self.assertEqual(install["server"]["url"], "https://api.example.com/{workspace}/mcp")
            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            self.assertEqual(
                cursor_cfg["mcpServers"]["ai-example-remote"]["headers"],
                {"Authorization": "Bearer token-123"},
            )

    def test_install_stores_the_registry_managed_key(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "@vendor/pkg")

            install = harness.post_json("/api/mcp/servers", {"qualifiedName": "@vendor/pkg"})

            self.assertEqual(install["server"]["name"], "vendor-pkg")
            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            self.assertIn("vendor-pkg", [entry["name"] for entry in servers["entries"]])
            self.assertFalse((harness.spec.home / ".cursor" / "mcp.json").exists())

    def test_static_stdio_marketplace_install_can_enable(self) -> None:
        with AppTestHarness() as harness:
            _Container(
                harness,
                "desktop",
                is_remote=False,
                deployment_url=None,
                connections=[
                    {
                        "kind": "stdio",
                        "stdioFunction": "(config) => ({ command: 'npx', args: ['-y', '@acme/desktop'] })",
                        "configSchema": {"type": "object", "properties": {}},
                    }
                ],
            )
            install = harness.post_json("/api/mcp/servers", {"qualifiedName": "desktop"})
            harness.post_json("/api/mcp/servers/desktop/enable", {"harness": "cursor"})
            self.assertEqual(install["server"]["transport"], "stdio")

            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            payload = cursor_cfg["mcpServers"]["desktop"]
            self.assertEqual(payload["command"], "npx")
            self.assertEqual(payload["args"], ["-y", "@acme/desktop@1.0.0"])

    def test_get_unknown_server_returns_404(self) -> None:
        with AppTestHarness() as harness:
            harness.get_json("/api/mcp/servers/missing", expected_status=404)

    # Identity-first unmanaged MCP flows and update compatibility -----------

    def test_unmanaged_by_server_dedupes_identical_entries_across_harnesses(self) -> None:
        with AppTestHarness() as harness:
            # Seed identical `context7` entries in cursor AND claude.
            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.parent.mkdir(parents=True, exist_ok=True)
            cursor_cfg.write_text(
                json.dumps(
                    {"mcpServers": {"context7": {"command": "uvx", "args": ["context7-mcp"]}}}
                )
            )
            claude_cfg = harness.spec.home / ".claude.json"
            claude_cfg.write_text(
                json.dumps(
                    {"mcpServers": {"context7": {"command": "uvx", "args": ["context7-mcp"]}}}
                )
            )

            response = harness.get_json("/api/mcp/unmanaged/by-server")
            assert isinstance(response, dict)
            servers = response["servers"]
            self.assertEqual(len(servers), 1)
            self.assertEqual(servers[0]["name"], "context7")
            self.assertTrue(servers[0]["identical"])
            harnesses_seen = {s["harness"] for s in servers[0]["sightings"]}
            self.assertEqual(harnesses_seen, {"cursor", "claude"})

    def test_unmanaged_by_server_marks_differing_payloads(self) -> None:
        with AppTestHarness() as harness:
            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.parent.mkdir(parents=True, exist_ok=True)
            cursor_cfg.write_text(
                json.dumps({"mcpServers": {"foo": {"url": "https://cursor.example"}}})
            )
            claude_cfg = harness.spec.home / ".claude.json"
            claude_cfg.write_text(
                json.dumps({"mcpServers": {"foo": {"url": "https://claude.example"}}})
            )
            response = harness.get_json("/api/mcp/unmanaged/by-server")
            assert isinstance(response, dict)
            self.assertFalse(response["servers"][0]["identical"])
            self.assertIsNone(response["servers"][0]["canonicalSpec"])

    def test_unmanaged_by_server_masks_secret_preview_fields(self) -> None:
        with AppTestHarness() as harness:
            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.parent.mkdir(parents=True, exist_ok=True)
            cursor_cfg.write_text(
                json.dumps(
                    {
                        "mcpServers": {
                            "secreted": {
                                "url": "https://api.example/mcp?api_key=live_secret_value",
                                "headers": {"Authorization": "Bearer live_secret_value"},
                            },
                            "secretenv": {
                                "command": "npx",
                                "args": ["-y", "secretenv"],
                                "env": {"EXA_API_KEY": "live_secret_value"},
                            }
                        }
                    }
                )
            )

            response = harness.get_json("/api/mcp/unmanaged/by-server")
            assert isinstance(response, dict)
            encoded = json.dumps(response)
            self.assertNotIn("live_secret_value", encoded)
            servers = {server["name"]: server for server in response["servers"]}
            remote = servers["secreted"]
            self.assertIn("api_key=%5Bredacted%5D", remote["canonicalSpec"]["url"])
            self.assertEqual(
                remote["sightings"][0]["spec"]["headers"]["Authorization"],
                "[redacted]",
            )
            stdio = servers["secretenv"]
            self.assertEqual(stdio["canonicalSpec"]["env"]["EXA_API_KEY"], "[redacted]")
            self.assertEqual(stdio["sightings"][0]["env"][0]["value"], "[redacted]")

    def test_adopt_identical_promotes_all_harnesses_in_one_call(self) -> None:
        with AppTestHarness() as harness:
            payload = {"command": "uvx", "args": ["context7-mcp"]}
            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.parent.mkdir(parents=True, exist_ok=True)
            cursor_cfg.write_text(json.dumps({"mcpServers": {"context7": payload}}))
            claude_cfg = harness.spec.home / ".claude.json"
            claude_cfg.write_text(json.dumps({"mcpServers": {"context7": payload}}))

            result = harness.post_json("/api/mcp/unmanaged/adopt", {"name": "context7"})
            assert isinstance(result, dict)
            self.assertTrue(result["ok"])
            self.assertEqual(set(result["succeeded"]), {"cursor", "claude"})

            # Central store has the server.
            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            self.assertIn("context7", [e["name"] for e in servers["entries"]])

    def test_adopt_differing_without_observed_harness_returns_409(self) -> None:
        with AppTestHarness() as harness:
            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.parent.mkdir(parents=True, exist_ok=True)
            cursor_cfg.write_text(
                json.dumps({"mcpServers": {"foo": {"url": "https://a.example"}}})
            )
            claude_cfg = harness.spec.home / ".claude.json"
            claude_cfg.write_text(
                json.dumps({"mcpServers": {"foo": {"url": "https://b.example"}}})
            )
            harness.post_json(
                "/api/mcp/unmanaged/adopt",
                {"name": "foo"},
                expected_status=409,
            )

    def test_adopt_differing_uses_selected_observed_harness(self) -> None:
        with AppTestHarness() as harness:
            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.parent.mkdir(parents=True, exist_ok=True)
            cursor_cfg.write_text(
                json.dumps({"mcpServers": {"foo": {"url": "https://cursor.example"}}})
            )
            claude_cfg = harness.spec.home / ".claude.json"
            claude_cfg.write_text(
                json.dumps({"mcpServers": {"foo": {"url": "https://claude.example"}}})
            )

            result = harness.post_json(
                "/api/mcp/unmanaged/adopt",
                {"name": "foo", "observedHarness": "claude"},
            )
            assert isinstance(result, dict)
            self.assertTrue(result["ok"])
            self.assertEqual(result["server"]["url"], "https://claude.example")

    def test_adopt_silently_enriches_when_marketplace_match_exists(self) -> None:
        from skill_manager.application.mcp.enrichment import MarketplaceLink

        with AppTestHarness() as harness:
            payload = {"command": "uvx", "args": ["context7-mcp"]}
            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.parent.mkdir(parents=True, exist_ok=True)
            cursor_cfg.write_text(json.dumps({"mcpServers": {"context7": payload}}))

            # Seed enrichment cache with a marketplace link for "context7".
            enrichment = harness.container.mcp_mutations.enrichment
            assert enrichment is not None
            enrichment._cache["context7"] = MarketplaceLink(  # noqa: SLF001
                qualified_name="@upstash/context7",
                display_name="Context7",
                icon_url="https://icon.example/ctx7.png",
                external_url="https://registry.modelcontextprotocol.io/?q=%40upstash%2Fcontext7",
                description="Docs MCP",
                is_remote=False,
                is_verified=True,
            )
            enrichment._popular_warmed = True  # noqa: SLF001 — skip network warm

            result = harness.post_json("/api/mcp/unmanaged/adopt", {"name": "context7"})
            assert isinstance(result, dict)
            self.assertTrue(result["ok"])
            # Silent enrichment: displayName and source upgraded automatically.
            self.assertEqual(result["server"]["displayName"], "Context7")
            self.assertEqual(result["server"]["source"]["kind"], "marketplace")
            self.assertEqual(result["server"]["source"]["locator"], "@upstash/context7")

    def test_disable_drifted_harness_removes_entry(self) -> None:
        with AppTestHarness() as harness:
            _seed_manual_remote(harness)
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "cursor"})

            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.write_text(
                json.dumps({"mcpServers": {"remote": {"url": "https://hand-edited.example"}}})
            )
            result = harness.post_json("/api/mcp/servers/remote/disable", {"harness": "cursor"})
            assert isinstance(result, dict)
            self.assertTrue(result["ok"])

            cursor_payload = json.loads(cursor_cfg.read_text())
            self.assertNotIn("remote", cursor_payload.get("mcpServers", {}))

    def test_set_harnesses_disabled_removes_managed_and_different_configs(self) -> None:
        with AppTestHarness() as harness:
            _seed_manual_remote(harness)
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "cursor"})
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "claude"})

            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.write_text(
                json.dumps({"mcpServers": {"remote": {"url": "https://hand-edited.example"}}})
            )

            result = harness.post_json(
                "/api/mcp/servers/remote/set-harnesses",
                {"target": "disabled"},
            )
            assert isinstance(result, dict)
            self.assertTrue(result["ok"])
            self.assertEqual(set(result["succeeded"]), {"cursor", "claude"})
            cursor_payload = json.loads(cursor_cfg.read_text())
            claude_payload = json.loads((harness.spec.home / ".claude.json").read_text())
            self.assertNotIn("remote", cursor_payload.get("mcpServers", {}))
            self.assertNotIn("remote", claude_payload.get("mcpServers", {}))

    def test_uninstall_removes_managed_and_different_configs_before_manifest(self) -> None:
        with AppTestHarness() as harness:
            _seed_manual_remote(harness)
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "cursor"})
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "claude"})

            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.write_text(
                json.dumps({"mcpServers": {"remote": {"url": "https://hand-edited.example"}}})
            )

            result = harness.delete_json("/api/mcp/servers/remote")
            assert isinstance(result, dict)
            self.assertTrue(result["ok"])
            self.assertEqual(set(result["succeeded"]), {"cursor", "claude"})

            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            self.assertEqual(servers["entries"], [])
            cursor_payload = json.loads(cursor_cfg.read_text())
            claude_payload = json.loads((harness.spec.home / ".claude.json").read_text())
            self.assertNotIn("remote", cursor_payload.get("mcpServers", {}))
            self.assertNotIn("remote", claude_payload.get("mcpServers", {}))

    def test_uninstall_keeps_manifest_when_harness_removal_fails(self) -> None:
        with AppTestHarness() as harness:
            _seed_manual_remote(harness)
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "cursor"})
            adapter = harness.container.mcp_read_models.find_adapter("cursor")
            assert adapter is not None

            def fail_disable(_name: str) -> None:
                raise RuntimeError("write failed")

            adapter.disable_server = fail_disable  # type: ignore[method-assign]

            result = harness.delete_json("/api/mcp/servers/remote")
            assert isinstance(result, dict)
            self.assertFalse(result["ok"])
            self.assertEqual(result["failed"][0]["harness"], "cursor")

            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            self.assertIn("remote", [entry["name"] for entry in servers["entries"]])

    def test_reconcile_managed_overwrites_different_entry_with_managed_config(self) -> None:
        with AppTestHarness() as harness:
            _seed_manual_remote(harness)
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "cursor"})

            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.write_text(
                json.dumps({"mcpServers": {"remote": {"url": "https://hand-edited.example"}}})
            )
            harness.container.mcp_read_models.invalidate()
            detail_before = harness.get_json("/api/mcp/servers/remote")
            self.assertEqual(detail_before["mcpStatus"]["kind"], "unchecked")
            self.assertIsNone(detail_before["mcpStatus"]["reason"])

            result = harness.post_json(
                "/api/mcp/servers/remote/reconcile",
                {"sourceKind": "managed", "harnesses": ["cursor"]},
            )
            assert isinstance(result, dict)
            self.assertTrue(result["ok"])

            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            self.assertEqual(cursor_cfg["mcpServers"]["remote"]["url"], "https://mcp.example.com")

    def test_reconcile_harness_config_replaces_managed_config_and_applies_to_current_bindings(self) -> None:
        with AppTestHarness() as harness:
            _seed_manual_remote(harness)
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "cursor"})
            harness.post_json("/api/mcp/servers/remote/enable", {"harness": "claude"})

            cursor_cfg = harness.spec.home / ".cursor" / "mcp.json"
            cursor_cfg.write_text(
                json.dumps({"mcpServers": {"remote": {"url": "https://hand-edited.example"}}})
            )
            result = harness.post_json(
                "/api/mcp/servers/remote/reconcile",
                {"sourceKind": "harness", "observedHarness": "cursor"},
            )
            assert isinstance(result, dict)
            self.assertTrue(result["ok"])
            self.assertEqual(result["server"]["url"], "https://hand-edited.example")
            self.assertEqual(set(result["succeeded"]), {"cursor", "claude"})

            detail = harness.get_json("/api/mcp/servers/remote")
            assert isinstance(detail, dict)
            self.assertEqual(detail["spec"]["url"], "https://hand-edited.example")
            claude_cfg = json.loads((harness.spec.home / ".claude.json").read_text())
            self.assertEqual(claude_cfg["mcpServers"]["remote"]["url"], "https://hand-edited.example")

    def test_get_server_includes_env_annotations(self) -> None:
        with AppTestHarness() as harness:
            harness.container.mcp_store.upsert_from_spec(
                McpServerSpec(
                    name="exa",
                    display_name="Exa",
                    source=McpSource.manual("exa"),
                    transport="stdio",
                    command="npx",
                    env=(("EXA_API_KEY", "long-secret-value-xxxx"),),
                )
            )
            harness.container.mcp_read_models.invalidate()
            detail = harness.get_json("/api/mcp/servers/exa")
            assert isinstance(detail, dict)
            env_rows = {row["key"]: row for row in detail["env"]}
            self.assertEqual(env_rows["EXA_API_KEY"]["value"], "[redacted]")
            self.assertFalse(env_rows["EXA_API_KEY"]["isEnvRef"])


if __name__ == "__main__":
    unittest.main()
