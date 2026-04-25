from __future__ import annotations

import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.application.mcp.store import McpServerSpec, McpServerStore, McpSource


def _spec(name: str = "exa", **overrides) -> McpServerSpec:
    base = dict(
        name=name,
        display_name=name.title(),
        source=McpSource.marketplace(f"@user/{name}"),
        transport="stdio",
        command="npx",
        args=("-y", f"{name}-mcp-server"),
        env=(("EXA_API_KEY", "secret"),),
    )
    base.update(overrides)
    return McpServerSpec(**base)


class McpServerStoreTests(unittest.TestCase):
    def test_upsert_then_list(self) -> None:
        with TemporaryDirectory() as tmp:
            store = McpServerStore(Path(tmp) / "manifest.json")
            store.upsert_from_spec(_spec("exa"))
            store.upsert_from_spec(_spec("context7", command="uvx", args=("context7-mcp",), env=None))

            entries = store.list_binding_specs()

            self.assertEqual({entry.name for entry in entries}, {"exa", "context7"})

    def test_upsert_replaces_existing(self) -> None:
        with TemporaryDirectory() as tmp:
            store = McpServerStore(Path(tmp) / "manifest.json")
            store.upsert_from_spec(_spec("exa", env=(("EXA_API_KEY", "old"),)))
            store.upsert_from_spec(_spec("exa", env=(("EXA_API_KEY", "new"),)))

            entries = store.list_binding_specs()

            self.assertEqual(len(entries), 1)
            self.assertEqual(dict(entries[0].env or ()), {"EXA_API_KEY": "new"})

    def test_get_returns_none_when_missing(self) -> None:
        with TemporaryDirectory() as tmp:
            store = McpServerStore(Path(tmp) / "manifest.json")

            self.assertIsNone(store.get_binding_spec("exa"))

    def test_remove_returns_false_when_missing(self) -> None:
        with TemporaryDirectory() as tmp:
            store = McpServerStore(Path(tmp) / "manifest.json")

            self.assertFalse(store.remove("exa"))

    def test_remove_returns_true_and_drops_entry(self) -> None:
        with TemporaryDirectory() as tmp:
            store = McpServerStore(Path(tmp) / "manifest.json")
            store.upsert_from_spec(_spec("exa"))

            self.assertTrue(store.remove("exa"))
            self.assertEqual(store.list_binding_specs(), ())

    def test_revision_changes_when_payload_differs(self) -> None:
        with TemporaryDirectory() as tmp:
            store = McpServerStore(Path(tmp) / "manifest.json")
            store.upsert_from_spec(_spec("exa"))
            stored = store.get_binding_spec("exa")
            assert stored is not None

            store.upsert_from_spec(_spec("exa", command="bunx"))
            stored2 = store.get_binding_spec("exa")
            assert stored2 is not None

            self.assertTrue(stored.revision)
            self.assertNotEqual(stored.revision, stored2.revision)

    def test_manifest_is_valid_json(self) -> None:
        with TemporaryDirectory() as tmp:
            manifest_path = Path(tmp) / "manifest.json"
            store = McpServerStore(manifest_path)
            store.upsert_from_spec(_spec("exa"))

            payload = json.loads(manifest_path.read_text(encoding="utf-8"))

            self.assertEqual(payload["version"], 5)
            self.assertEqual(len(payload["servers"]), 1)
            self.assertEqual(payload["servers"][0]["name"], "exa")

    def test_round_trip_http_spec_preserves_headers_cleartext(self) -> None:
        with TemporaryDirectory() as tmp:
            store = McpServerStore(Path(tmp) / "manifest.json")
            store.upsert_from_spec(
                McpServerSpec(
                    name="remote",
                    display_name="Remote",
                    source=McpSource.marketplace("@remote/server"),
                    transport="http",
                    url="https://mcp.example.com?api_key=literal",
                    headers=(("Authorization", "Bearer literal"),),
                )
            )

            loaded = store.get_binding_spec("remote")
            public = store.get_public_spec("remote")

            assert loaded is not None
            assert public is not None
            self.assertEqual(loaded.transport, "http")
            self.assertEqual(loaded.url, "https://mcp.example.com?api_key=literal")
            self.assertEqual(dict(loaded.headers or ()), {"Authorization": "Bearer literal"})
            self.assertEqual(public.to_dict(), loaded.to_dict())

    def test_reads_do_not_rewrite_legacy_manifest(self) -> None:
        with TemporaryDirectory() as tmp:
            manifest_path = Path(tmp) / "manifest.json"
            original = json.dumps(
                {
                    "version": 3,
                    "servers": [
                        {
                            "name": "exa",
                            "displayName": "Exa Search",
                            "source": {"kind": "marketplace", "locator": "exa"},
                            "transport": "http",
                            "url": "https://mcp.exa.ai",
                            "setupState": "missing",
                            "setupFields": [],
                        }
                    ],
                },
                indent=2,
            )
            manifest_path.write_text(original, encoding="utf-8")

            store = McpServerStore(manifest_path)
            managed = store.list_managed()
            binding = store.get_binding_spec("exa")

            self.assertEqual(len(managed), 1)
            assert binding is not None
            self.assertEqual(binding.url, "https://mcp.exa.ai")
            self.assertEqual(manifest_path.read_text(encoding="utf-8"), original)

    def test_manifest_issues_report_malformed_entries_without_dropping_valid_entries(self) -> None:
        with TemporaryDirectory() as tmp:
            manifest_path = Path(tmp) / "manifest.json"
            manifest_path.write_text(
                json.dumps(
                    {
                        "servers": [
                            {
                                "name": "valid",
                                "displayName": "Valid",
                                "source": {"kind": "manual", "locator": "valid"},
                                "transport": "http",
                                "url": "https://valid.example",
                            },
                            {"displayName": "Missing Name"},
                        ],
                    }
                ),
                encoding="utf-8",
            )
            store = McpServerStore(manifest_path)

            self.assertEqual([server.name for server in store.list_managed()], ["valid"])
            self.assertEqual(len(store.manifest_issues()), 1)


if __name__ == "__main__":
    unittest.main()
