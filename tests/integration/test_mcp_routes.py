from __future__ import annotations

import json
import unittest
from pathlib import Path

from skill_manager.application.mcp.installers import McpInstallResult
from skill_manager.application.mcp.installers import SmitheryClientTarget
from skill_manager.application.mcp.mappers import get_mapper
from skill_manager.application.mcp.names import canonical_server_name
from skill_manager.application.mcp.stdio import parse_static_stdio_function
from skill_manager.application.mcp.store import McpServerSpec, McpSource

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
        source_name: str | None = None,
    ) -> None:
        self.qualified_name = qualified_name
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
        }

    def detail(self, qualified_name: str):
        if qualified_name == self.qualified_name:
            return self._payload
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
        source_name: str | None = None,
    ) -> None:
        self.harness = harness
        # Patch the in-memory mutation service to use the fake marketplace.
        marketplace = FakeMcpMarketplace(
            qualified_name,
            config_schema,
            is_remote=is_remote,
            deployment_url=deployment_url,
            connections=connections,
        )
        harness.container.mcp_mutations.marketplace = marketplace
        harness.container.mcp_mutations.install_provider = FakeMcpInstallProvider(
            harness,
            {
                qualified_name: _source_spec_from_marketplace_payload(
                    marketplace._payload,  # noqa: SLF001 - test stub data
                    qualified_name=qualified_name,
                    source_name=source_name,
                )
            },
        )


class FakeMcpInstallProvider:
    def __init__(self, harness: AppTestHarness, specs: dict[str, McpServerSpec]) -> None:
        self.harness = harness
        self.specs = specs

    def install_targets(self) -> tuple[SmitheryClientTarget, ...]:
        return (
            SmitheryClientTarget(harness="codex", smithery_client="codex", supported=True),
            SmitheryClientTarget(harness="claude", smithery_client="claude-code", supported=True),
            SmitheryClientTarget(harness="cursor", smithery_client="cursor", supported=True),
            SmitheryClientTarget(harness="opencode", smithery_client="opencode", supported=True),
            SmitheryClientTarget(
                harness="openclaw",
                smithery_client=None,
                supported=False,
                reason="Smithery does not provide an OpenClaw MCP installer target",
            ),
        )

    def install(self, *, qualified_name: str, source_harness: str) -> McpInstallResult:
        spec = self.specs[qualified_name]
        if source_harness == "claude":
            self._write_claude_code_project_scope(spec)
            return McpInstallResult(
                qualified_name=qualified_name,
                source_harness=source_harness,
                installer="fake",
                stdout="",
                stderr="",
            )
        adapter = self.harness.container.mcp_read_models.find_adapter(source_harness)
        if adapter is None:
            raise AssertionError(f"missing test adapter for {source_harness}")
        adapter.enable_server(spec)
        return McpInstallResult(
            qualified_name=qualified_name,
            source_harness=source_harness,
            installer="fake",
            stdout="",
            stderr="",
        )

    def _write_claude_code_project_scope(self, spec: McpServerSpec) -> None:
        path = self.harness.spec.home / ".claude.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        projects = payload.setdefault("projects", {})
        if not isinstance(projects, dict):
            projects = {}
            payload["projects"] = projects
        project_key = str(self.harness.spec.home.resolve())
        project = projects.setdefault(project_key, {})
        if not isinstance(project, dict):
            project = {}
            projects[project_key] = project
        servers = project.setdefault("mcpServers", {})
        if not isinstance(servers, dict):
            servers = {}
            project["mcpServers"] = servers
        servers[spec.name] = get_mapper("claude-code").spec_to_dict(spec)
        path.write_text(json.dumps(payload), encoding="utf-8")


def _source_spec_from_marketplace_payload(
    payload: dict[str, object],
    *,
    qualified_name: str,
    source_name: str | None = None,
) -> McpServerSpec:
    name = source_name or canonical_server_name(qualified_name)
    connections = payload.get("connections")
    first = connections[0] if isinstance(connections, list) and connections else {}
    first = first if isinstance(first, dict) else {}
    kind = str(first.get("kind") or first.get("type") or "http").lower()
    display_name = str(payload.get("displayName") or name)
    if kind == "stdio":
        stdio = parse_static_stdio_function(first.get("stdioFunction"))
        if stdio is None:
            raise AssertionError("test stdio fixture must include a static stdioFunction")
        return McpServerSpec(
            name=name,
            display_name=display_name,
            source=McpSource.marketplace(qualified_name),
            transport="stdio",
            command=stdio.command,
            args=stdio.args,
        )
    transport = "sse" if kind == "sse" else "http"
    url = str(first.get("deploymentUrl") or payload.get("deploymentUrl") or "https://mcp.example")
    return McpServerSpec(
        name=name,
        display_name=display_name,
        source=McpSource.marketplace(qualified_name),
        transport=transport,  # type: ignore[arg-type]
        url=url,
    )


def _install(harness: AppTestHarness, name: str = "exa") -> None:
    harness.post_json("/api/mcp/servers", {"qualifiedName": name, "sourceHarness": "cursor"})


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

    def test_marketplace_install_targets_are_backend_owned(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            payload = harness.get_json("/api/marketplace/mcp/install-targets")
            assert isinstance(payload, dict)
            targets = {target["harness"]: target for target in payload["targets"]}

            self.assertEqual(targets["codex"]["smitheryClient"], "codex")
            self.assertEqual(targets["claude"]["smitheryClient"], "claude-code")
            self.assertEqual(targets["cursor"]["smitheryClient"], "cursor")
            self.assertEqual(targets["opencode"]["smitheryClient"], "opencode")
            self.assertTrue(targets["claude"]["supported"])
            self.assertFalse(targets["openclaw"]["supported"])
            self.assertEqual(
                targets["openclaw"]["reason"],
                "Smithery does not provide an OpenClaw MCP installer target",
            )

    def test_install_delegates_to_source_harness_then_imports_raw_spec(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            response = harness.post_json(
                "/api/mcp/servers", {"qualifiedName": "exa", "sourceHarness": "cursor"}
            )
            self.assertTrue(response["ok"])
            self.assertEqual(response["server"]["name"], "exa")
            self.assertEqual(response["server"]["transport"], "http")
            self.assertEqual(response["server"]["url"], "https://mcp.exa.ai")

            # Central manifest contains it.
            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            names = [entry["name"] for entry in servers["entries"]]
            self.assertIn("exa", names)

            # The source harness was written by the native installer; others are untouched.
            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            self.assertEqual(cursor_cfg["mcpServers"]["exa"]["url"], "https://mcp.exa.ai")
            self.assertFalse((harness.spec.home / ".claude.json").exists())
            self.assertFalse((harness.spec.home / ".codex" / "config.toml").exists())

    def test_install_can_import_claude_code_project_scoped_config(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "exa")
            response = harness.post_json(
                "/api/mcp/servers", {"qualifiedName": "exa", "sourceHarness": "claude"}
            )
            self.assertTrue(response["ok"])
            self.assertEqual(response["server"]["name"], "exa")
            self.assertEqual(response["server"]["url"], "https://mcp.exa.ai")

            claude_cfg = json.loads((harness.spec.home / ".claude.json").read_text())
            self.assertNotIn("mcpServers", claude_cfg)
            project = claude_cfg["projects"][str(harness.spec.home.resolve())]
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
            # All five harnesses should have written
            self.assertEqual(set(response["succeeded"]), {"codex", "claude", "opencode", "openclaw"})

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
                {"qualifiedName": "nonexistent", "sourceHarness": "cursor"},
                expected_status=404,
            )

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
            install = harness.post_json(
                "/api/mcp/servers",
                {"qualifiedName": "browserbase", "sourceHarness": "cursor"},
            )

            self.assertTrue(install["ok"])
            self.assertEqual(install["server"]["name"], "browserbase")
            self.assertEqual(install["server"]["url"], "https://mcp.exa.ai")
            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            self.assertEqual(
                cursor_cfg["mcpServers"]["browserbase"]["url"],
                "https://mcp.exa.ai",
            )

    def test_install_stores_the_observed_source_harness_key(self) -> None:
        with AppTestHarness() as harness:
            _Container(harness, "@vendor/pkg", source_name="vendor-package")

            install = harness.post_json(
                "/api/mcp/servers",
                {"qualifiedName": "@vendor/pkg", "sourceHarness": "cursor"},
            )

            self.assertEqual(install["server"]["name"], "vendor-package")
            servers = harness.get_json("/api/mcp/servers")
            assert isinstance(servers, dict)
            self.assertIn("vendor-package", [entry["name"] for entry in servers["entries"]])
            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            self.assertIn("vendor-package", cursor_cfg["mcpServers"])

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
            install = harness.post_json(
                "/api/mcp/servers",
                {"qualifiedName": "desktop", "sourceHarness": "cursor"},
            )
            self.assertEqual(install["server"]["transport"], "stdio")

            cursor_cfg = json.loads((harness.spec.home / ".cursor" / "mcp.json").read_text())
            payload = cursor_cfg["mcpServers"]["desktop"]
            self.assertEqual(payload["command"], "npx")
            self.assertEqual(payload["args"], ["-y", "@acme/desktop"])

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

    def test_unmanaged_by_server_returns_raw_preview_fields(self) -> None:
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
            self.assertIn("live_secret_value", encoded)
            servers = {server["name"]: server for server in response["servers"]}
            remote = servers["secreted"]
            self.assertIn("api_key=live_secret_value", remote["canonicalSpec"]["url"])
            self.assertEqual(
                remote["sightings"][0]["spec"]["headers"]["Authorization"],
                "Bearer live_secret_value",
            )
            stdio = servers["secretenv"]
            self.assertEqual(stdio["canonicalSpec"]["env"]["EXA_API_KEY"], "live_secret_value")
            self.assertEqual(stdio["sightings"][0]["env"][0]["value"], "live_secret_value")

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

    def test_adopt_differing_without_source_harness_returns_409(self) -> None:
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

    def test_adopt_differing_uses_selected_source_harness(self) -> None:
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
                {"name": "foo", "sourceHarness": "claude"},
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
                external_url="https://smithery.ai/server/@upstash/context7",
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
                {"sourceKind": "harness", "sourceHarness": "cursor"},
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
            self.assertEqual(env_rows["EXA_API_KEY"]["value"], "long-secret-value-xxxx")
            self.assertFalse(env_rows["EXA_API_KEY"]["isEnvRef"])


if __name__ == "__main__":
    unittest.main()
