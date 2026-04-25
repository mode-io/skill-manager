from __future__ import annotations

import json
import tomllib
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.mcp import FileBackedMcpAdapter
from skill_manager.application.mcp.store import McpServerSpec, McpServerStore, McpSource
from skill_manager.errors import MutationError
from skill_manager.harness import HarnessKernelService, HarnessSupportStore


def _spec(name: str = "exa") -> McpServerSpec:
    return McpServerSpec(
        name=name,
        display_name=name.title(),
        source=McpSource.marketplace(f"@user/{name}"),
        transport="stdio",
        command="npx",
        args=("-y", f"{name}-mcp-server"),
        env=(("KEY", "value"),),
    )


def _adapter(
    harness: str,
    *,
    home: Path,
    xdg_config_home: Path | None = None,
) -> FileBackedMcpAdapter:
    env = {
        "HOME": str(home),
        "XDG_CONFIG_HOME": str(xdg_config_home or (home / ".config")),
        "PATH": "",
    }
    kernel = HarnessKernelService.from_environment(
        env,
        support_store=HarnessSupportStore(home / "settings.json"),
    )
    binding = next(
        binding for binding in kernel.bindings_for_family("mcp") if binding.definition.harness == harness
    )
    return FileBackedMcpAdapter(
        definition=binding.definition,
        profile=binding.profile,
        context=kernel.context,
    )


class FileBackedMcpAdapterTests(unittest.TestCase):
    def test_classifies_managed_when_content_matches(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            store.upsert_from_spec(_spec("exa"))
            adapter = _adapter("cursor", home=home)

            adapter.enable_server(store.get_binding_spec("exa"))  # type: ignore[arg-type]
            scan = adapter.scan(store.list_binding_specs())

            states = {entry.name: entry.state for entry in scan.entries}
            self.assertEqual(states.get("exa"), "managed")

    def test_classifies_drifted_when_user_edits_entry(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            store.upsert_from_spec(_spec("exa"))
            adapter = _adapter("cursor", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                json.dumps(
                    {"mcpServers": {"exa": {"command": "npx", "args": ["different"]}}}
                ),
                encoding="utf-8",
            )

            scan = adapter.scan(store.list_binding_specs())
            states = {entry.name: entry.state for entry in scan.entries}
            self.assertEqual(states.get("exa"), "drifted")

        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            store.upsert_from_spec(_spec("exa"))
            adapter = _adapter("cursor", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                json.dumps(
                    {"mcpServers": {"exa": {"headers": {"Authorization": "Bearer x"}}}}
                ),
                encoding="utf-8",
            )

            scan = adapter.scan(store.list_binding_specs())
            drifted = next(entry for entry in scan.entries if entry.name == "exa")
            self.assertEqual(drifted.state, "drifted")
            self.assertIsNotNone(drifted.parse_issue)

    def test_classifies_unmanaged_when_no_central_spec(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            adapter = _adapter("cursor", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                json.dumps({"mcpServers": {"legacy-foo": {"command": "ls"}}}),
                encoding="utf-8",
            )

            scan = adapter.scan(store.list_binding_specs())
            unmanaged = [entry for entry in scan.entries if entry.state == "unmanaged"]
            self.assertEqual(len(unmanaged), 1)
            self.assertEqual(unmanaged[0].name, "legacy-foo")

    def test_managed_spec_with_no_binding_is_missing(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            store.upsert_from_spec(_spec("exa"))
            adapter = _adapter("cursor", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(json.dumps({"mcpServers": {}}), encoding="utf-8")

            scan = adapter.scan(store.list_binding_specs())
            states = {entry.name: entry.state for entry in scan.entries}
            self.assertEqual(states.get("exa"), "missing")

    def test_enable_preserves_non_mcp_keys_for_json(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            adapter = _adapter("cursor", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                json.dumps(
                    {
                        "models": ["gpt-5"],
                        "mcpServers": {"existing": {"command": "ls"}},
                    }
                ),
                encoding="utf-8",
            )

            adapter.enable_server(_spec())
            payload = json.loads(adapter.config_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["models"], ["gpt-5"])
            self.assertIn("existing", payload["mcpServers"])
            self.assertIn("exa", payload["mcpServers"])

    def test_enable_uses_opencode_nested_subtree(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            xdg_config_home = home / ".config"
            store = McpServerStore(home / "manifest.json")
            adapter = _adapter("opencode", home=home, xdg_config_home=xdg_config_home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                json.dumps(
                    {
                        "models": ["x"],
                        "mcp": {"other": {"type": "local", "command": ["ls"]}},
                    }
                ),
                encoding="utf-8",
            )

            adapter.enable_server(_spec())
            payload = json.loads(adapter.config_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["models"], ["x"])
            self.assertIn("other", payload["mcp"])
            self.assertIn("exa", payload["mcp"])
            self.assertEqual(payload["mcp"]["exa"]["type"], "local")

    def test_enable_and_disable_round_trip_for_toml(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            adapter = _adapter("codex", home=home)

            adapter.enable_server(_spec())
            payload = tomllib.loads(adapter.config_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["mcp_servers"]["exa"]["command"], "npx")
            self.assertNotIn("transport", payload["mcp_servers"]["exa"])

            adapter.disable_server("exa")
            payload = tomllib.loads(adapter.config_path.read_text(encoding="utf-8"))
            self.assertEqual(payload.get("mcp_servers", {}), {})

    def test_cursor_writes_explicit_type_for_stdio_and_http(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("cursor", home=home)

            adapter.enable_server(_spec())
            payload = json.loads(adapter.config_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["mcpServers"]["exa"]["type"], "stdio")

            adapter.enable_server(
                McpServerSpec(
                    name="remote",
                    display_name="Remote",
                    source=McpSource.marketplace("@remote/server"),
                    transport="http",
                    url="https://mcp.example.com",
                )
            )
            payload = json.loads(adapter.config_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["mcpServers"]["remote"]["type"], "http")

    def test_claude_writes_explicit_type_for_http(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("claude", home=home)

            adapter.enable_server(
                McpServerSpec(
                    name="remote",
                    display_name="Remote",
                    source=McpSource.marketplace("@remote/server"),
                    transport="http",
                    url="https://mcp.example.com",
                )
            )
            payload = json.loads(adapter.config_path.read_text(encoding="utf-8"))
            self.assertEqual(payload["mcpServers"]["remote"]["type"], "http")

    def test_enable_removes_opencode_duplicate_from_xdg_config(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            xdg_config_home = home / ".config"
            adapter = _adapter("opencode", home=home, xdg_config_home=xdg_config_home)
            official_path = xdg_config_home / "opencode" / "opencode.json"
            official_path.parent.mkdir(parents=True, exist_ok=True)
            official_path.write_text(
                json.dumps(
                    {
                        "mcp": {
                            "exa": {
                                "type": "remote",
                                "url": "https://old.example.com",
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )

            adapter.enable_server(_spec())

            canonical = json.loads(adapter.config_path.read_text(encoding="utf-8"))
            official = json.loads(official_path.read_text(encoding="utf-8"))
            self.assertIn("exa", canonical["mcp"])
            self.assertNotIn("mcp", official)

    def test_disable_removes_opencode_from_all_discovery_paths(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            xdg_config_home = home / ".config"
            adapter = _adapter("opencode", home=home, xdg_config_home=xdg_config_home)
            adapter.enable_server(_spec())
            official_path = xdg_config_home / "opencode" / "opencode.json"
            official_path.parent.mkdir(parents=True, exist_ok=True)
            official_path.write_text(
                json.dumps({"mcp": {"exa": {"type": "local", "command": ["npx"]}}}),
                encoding="utf-8",
            )

            adapter.disable_server("exa")

            canonical = json.loads(adapter.config_path.read_text(encoding="utf-8"))
            official = json.loads(official_path.read_text(encoding="utf-8"))
            self.assertNotIn("mcp", canonical)
            self.assertNotIn("mcp", official)

    def test_openclaw_without_mcp_command_is_not_writable(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("openclaw", home=home)

            status = adapter.status()
            self.assertFalse(status.mcp_writable)
            self.assertIn("OpenClaw", status.mcp_unavailable_reason or "")
            with self.assertRaises(MutationError):
                adapter.enable_server(_spec())

    def test_has_binding_after_enable(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            adapter = _adapter("cursor", home=home)

            self.assertFalse(adapter.has_binding("exa"))
            adapter.enable_server(_spec())
            self.assertTrue(adapter.has_binding("exa"))

    def test_claude_scans_smithery_project_scoped_servers(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            store.upsert_from_spec(
                McpServerSpec(
                    name="exa",
                    display_name="Exa",
                    source=McpSource.marketplace("exa"),
                    transport="http",
                    url="https://server.smithery.ai/exa/mcp",
                )
            )
            adapter = _adapter("claude", home=home)
            adapter.config_path.write_text(
                json.dumps(
                    {
                        "projects": {
                            str(home.resolve()): {
                                "mcpServers": {
                                    "exa": {"type": "http", "url": "https://server.smithery.ai/exa/mcp"}
                                }
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )

            scan = adapter.scan(store.list_binding_specs())
            states = {entry.name: entry.state for entry in scan.entries}
            self.assertEqual(states.get("exa"), "managed")
            self.assertTrue(adapter.has_binding("exa"))

    def test_claude_disable_removes_project_scoped_servers(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("claude", home=home)
            adapter.config_path.write_text(
                json.dumps(
                    {
                        "projects": {
                            str(home.resolve()): {
                                "mcpServers": {
                                    "exa": {"type": "http", "url": "https://server.smithery.ai/exa/mcp"}
                                }
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )

            adapter.disable_server("exa")

            payload = json.loads(adapter.config_path.read_text(encoding="utf-8"))
            project = payload["projects"][str(home.resolve())]
            self.assertNotIn("mcpServers", project)

    def test_invalid_json_raises_mutation_error(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            adapter = _adapter("cursor", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text("{not json", encoding="utf-8")

            with self.assertRaises(MutationError):
                adapter.enable_server(_spec())

    def test_scan_reports_malformed_config_without_raising(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            store.upsert_from_spec(_spec("exa"))
            adapter = _adapter("cursor", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text("{not json", encoding="utf-8")

            scan = adapter.scan(store.list_binding_specs())

            self.assertIn("not valid JSON", scan.scan_issue or "")
            states = {entry.name: entry.state for entry in scan.entries}
            self.assertEqual(states["exa"], "missing")


if __name__ == "__main__":
    unittest.main()
