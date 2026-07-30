from __future__ import annotations

import json
import subprocess
import tomllib
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from skill_manager.application.mcp import FileBackedMcpAdapter
from skill_manager.application.mcp.store import McpServerSpec, McpServerStore, McpSource
from skill_manager.errors import MutationError
from skill_manager.harness import HarnessKernelService, HarnessSupportStore
from ruamel.yaml import YAML


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

def _load_yaml(path: Path) -> dict[str, object]:
    payload = YAML(typ="safe").load(path.read_text(encoding="utf-8"))
    return payload if isinstance(payload, dict) else {}


def _adapter(
    harness: str,
    *,
    home: Path,
    xdg_config_home: Path | None = None,
) -> FileBackedMcpAdapter:
    env = {
        "HOME": str(home),
        "USERPROFILE": str(home),
        "LOCALAPPDATA": str(home / "AppData" / "Local"),
        "XDG_CONFIG_HOME": str(xdg_config_home or (home / ".config")),
        "SKILL_MANAGER_HERMES_HOME": str(home / ".hermes"),
        "HERMES_HOME": str(home / ".hermes"),
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

    def test_codex_scan_excludes_desktop_owned_node_repl(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("codex", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                """
[mcp_servers.node_repl]
command = "C:\\\\Users\\\\tester\\\\AppData\\\\Local\\\\OpenAI\\\\Codex\\\\runtimes\\\\node_repl.exe"
args = []

[mcp_servers.node_repl.env]
CODEX_CLI_PATH = "C:\\\\Codex\\\\codex.exe"
NODE_REPL_NODE_PATH = "C:\\\\Codex\\\\node.exe"
SKY_CUA_NATIVE_PIPE_DIRECTORY = "\\\\\\\\.\\\\pipe\\\\codex-test"

[mcp_servers.user-server]
command = "npx"
args = ["-y", "user-mcp"]
""".lstrip(),
                encoding="utf-8",
            )

            scan = adapter.scan(())

            self.assertEqual([entry.name for entry in scan.entries], ["user-server"])

    def test_codex_scan_keeps_user_defined_node_repl_without_desktop_fingerprint(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("codex", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                """
[mcp_servers.node_repl]
command = "node_repl"
args = ["--user-config"]
""".lstrip(),
                encoding="utf-8",
            )

            scan = adapter.scan(())

            self.assertEqual([entry.name for entry in scan.entries], ["node_repl"])

    def test_codex_scan_keeps_managed_node_repl_even_with_desktop_fingerprint(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            store.upsert_from_spec(
                McpServerSpec(
                    name="node_repl",
                    display_name="Node REPL",
                    source=McpSource.manual("node_repl"),
                    transport="stdio",
                    command="C:\\Codex\\node_repl.exe",
                    env=(
                        ("CODEX_CLI_PATH", "C:\\Codex\\codex.exe"),
                        ("NODE_REPL_NODE_PATH", "C:\\Codex\\node.exe"),
                        ("SKY_CUA_NATIVE_PIPE_DIRECTORY", "\\\\.\\pipe\\codex-test"),
                    ),
                )
            )
            adapter = _adapter("codex", home=home)
            adapter.enable_server(store.get_binding_spec("node_repl"))  # type: ignore[arg-type]

            scan = adapter.scan(store.list_binding_specs())

            self.assertEqual([entry.name for entry in scan.entries], ["node_repl"])
            self.assertEqual(scan.entries[0].state, "managed")

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

    def test_enable_and_disable_round_trip_for_hermes_yaml(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("hermes", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                "model: test-model\nmcp_servers:\n  existing:\n    command: ls\n",
                encoding="utf-8",
            )

            adapter.enable_server(_spec())
            payload = _load_yaml(adapter.config_path)
            self.assertEqual(payload["model"], "test-model")
            self.assertEqual(payload["mcp_servers"]["existing"]["command"], "ls")
            self.assertEqual(payload["mcp_servers"]["exa"]["command"], "npx")
            self.assertEqual(payload["mcp_servers"]["exa"]["env"], {"KEY": "value"})

            adapter.disable_server("exa")
            payload = _load_yaml(adapter.config_path)
            self.assertIn("existing", payload["mcp_servers"])
            self.assertNotIn("exa", payload["mcp_servers"])

    def test_hermes_yaml_round_trip_preserves_comments_and_existing_format(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("hermes", home=home)
            adapter.config_path.parent.mkdir(parents=True, exist_ok=True)
            adapter.config_path.write_text(
                """# top-level comment
model: "test-model"  # inline model comment

# keep this block comment
mcp_servers:
  # existing server comment
  existing:
    command: ls  # command comment
    args: ["-la"]  # flow-style args comment

# unrelated block comment
profiles:
  default: true  # profile comment
""",
                encoding="utf-8",
            )

            adapter.enable_server(_spec())
            enabled_text = adapter.config_path.read_text(encoding="utf-8")

            self.assertIn("# top-level comment", enabled_text)
            self.assertIn("# inline model comment", enabled_text)
            self.assertIn("# keep this block comment", enabled_text)
            self.assertIn("# existing server comment", enabled_text)
            self.assertIn("# command comment", enabled_text)
            self.assertIn("# flow-style args comment", enabled_text)
            self.assertIn("# unrelated block comment", enabled_text)
            self.assertIn("# profile comment", enabled_text)
            self.assertIn("exa:", enabled_text)
            self.assertIn('model: "test-model"', enabled_text)

            adapter.disable_server("exa")
            disabled_text = adapter.config_path.read_text(encoding="utf-8")

            self.assertNotIn("  exa:", disabled_text)
            self.assertIn("# top-level comment", disabled_text)
            self.assertIn("# existing server comment", disabled_text)
            self.assertIn("# command comment", disabled_text)
            self.assertIn("# unrelated block comment", disabled_text)
            self.assertIn("existing:", disabled_text)

    def test_hermes_yaml_http_uses_headers_and_sse_transport(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("hermes", home=home)

            adapter.enable_server(
                McpServerSpec(
                    name="remote",
                    display_name="Remote",
                    source=McpSource.marketplace("@remote/server"),
                    transport="sse",
                    url="https://mcp.example.com/sse",
                    headers=(("Authorization", "Bearer token"),),
                )
            )

            payload = _load_yaml(adapter.config_path)
            remote = payload["mcp_servers"]["remote"]
            self.assertEqual(remote["url"], "https://mcp.example.com/sse")
            self.assertEqual(remote["transport"], "sse")
            self.assertEqual(remote["headers"], {"Authorization": "Bearer token"})

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

    def test_openclaw_slow_mcp_probe_remains_writable(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            adapter = _adapter("openclaw", home=home)
            with (
                mock.patch(
                    "skill_manager.application.mcp.adapters.shutil.which",
                    return_value=r"C:\bin\openclaw.CMD",
                ),
                mock.patch(
                    "skill_manager.harness.availability.subprocess.run",
                    side_effect=subprocess.TimeoutExpired(
                        [r"C:\bin\openclaw.CMD", "mcp", "--help"],
                        timeout=5,
                    ),
                ),
            ):
                status = adapter.status()

            self.assertTrue(status.installed)
            self.assertTrue(status.mcp_writable)
            self.assertIsNone(status.mcp_unavailable_reason)

    def test_has_binding_after_enable(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            adapter = _adapter("cursor", home=home)

            self.assertFalse(adapter.has_binding("exa"))
            adapter.enable_server(_spec())
            self.assertTrue(adapter.has_binding("exa"))

    def test_claude_scans_unsupported_source_project_scoped_servers(self) -> None:
        with TemporaryDirectory() as tmp:
            home = Path(tmp)
            store = McpServerStore(home / "manifest.json")
            store.upsert_from_spec(
                McpServerSpec(
                    name="exa",
                    display_name="Exa",
                    source=McpSource.marketplace("exa"),
                    transport="http",
                    url="https://mcp.unsupported-source.example/exa/mcp",
                )
            )
            adapter = _adapter("claude", home=home)
            adapter.config_path.write_text(
                json.dumps(
                    {
                        "projects": {
                            str(home.resolve()): {
                                "mcpServers": {
                                    "exa": {"type": "http", "url": "https://mcp.unsupported-source.example/exa/mcp"}
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
                                    "exa": {"type": "http", "url": "https://mcp.unsupported-source.example/exa/mcp"}
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
