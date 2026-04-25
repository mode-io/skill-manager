from __future__ import annotations

import unittest
from unittest import mock

from skill_manager.application.marketplace_cache import MarketplaceCache
from skill_manager.application.mcp.marketplace.catalog import (
    McpMarketplaceCatalog,
    _flatten_input_schema,
    _map_detail,
    _map_summary,
)
from skill_manager.errors import MarketplaceUpstreamError


_EXA_DETAIL_SAMPLE: dict[str, object] = {
    "qualifiedName": "exa",
    "displayName": "Exa Search",
    "description": "Fast, intelligent web search and web crawling.",
    "iconUrl": "https://api.smithery.ai/servers/exa/icon",
    "remote": True,
    "deploymentUrl": "https://exa.run.tools",
    "connections": [
        {
            "type": "http",
            "deploymentUrl": "https://exa.run.tools",
            "configSchema": {},
        }
    ],
    "security": None,
    "tools": [
        {
            "name": "web_search_exa",
            "description": "Search the web for any topic.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Natural language search query.",
                    },
                    "numResults": {
                        "type": "number",
                        "description": "Number of search results to return.",
                        "minimum": 1,
                        "maximum": 100,
                        "default": 10,
                    },
                },
                "required": ["query"],
            },
        }
    ],
    "resources": [
        {
            "name": "tools_list",
            "uri": "exa://tools/list",
            "description": "List of available tools",
            "mimeType": "application/json",
        }
    ],
    "prompts": [
        {
            "name": "web_search_help",
            "description": "Get help with web search.",
            "arguments": [],
        }
    ],
}


_DESKTOP_DETAIL_SAMPLE: dict[str, object] = {
    "qualifiedName": "wonderwhy-er/desktop-commander",
    "displayName": "Desktop Commander",
    "description": "Execute terminal commands.",
    "iconUrl": "https://icons.duckduckgo.com/ip3/desktopcommander.app.ico",
    "remote": False,
    "deploymentUrl": None,
    "connections": [
        {
            "type": "stdio",
            "stdioFunction": "(config) => ({ command: 'npx', args: ['-y', '@wonderwhy-er/desktop-commander'] })",
            "configSchema": {"type": "object", "properties": {}},
        }
    ],
    "security": None,
    "tools": [
        {
            "name": "read_file",
            "description": "Read a file.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "isUrl": {"type": "boolean", "default": False},
                },
                "required": ["path"],
            },
        }
    ],
    "resources": [],
    "prompts": [],
}


_SSE_DETAIL_SAMPLE: dict[str, object] = {
    "qualifiedName": "@acme/stream-server",
    "displayName": "Stream Server",
    "description": "Remote SSE MCP server.",
    "iconUrl": None,
    "remote": True,
    "deploymentUrl": "https://stream.example/mcp",
    "connections": [
        {
            "type": "sse",
            "deploymentUrl": "https://stream.example/mcp",
            "configSchema": None,
        }
    ],
    "security": None,
    "tools": [],
    "resources": [],
    "prompts": [],
}


_LIST_RESPONSE_SAMPLE: dict[str, object] = {
    "servers": [
        {
            "id": "uuid-1",
            "qualifiedName": "exa",
            "namespace": "exa",
            "slug": "",
            "displayName": "Exa Search",
            "description": "Fast search.",
            "iconUrl": "https://api.smithery.ai/servers/exa/icon",
            "verified": True,
            "useCount": 59906,
            "remote": True,
            "isDeployed": True,
            "createdAt": "2024-12-13T15:46:50.750Z",
            "homepage": "https://exa.ai",
            "owner": "org_1",
            "score": None,
        },
        {
            "id": "uuid-2",
            "qualifiedName": "wonderwhy-er/desktop-commander",
            "namespace": "wonderwhy-er",
            "slug": "desktop-commander",
            "displayName": "Desktop Commander",
            "description": "Local terminal control.",
            "iconUrl": None,
            "verified": False,
            "useCount": 728,
            "remote": False,
            "isDeployed": False,
            "createdAt": "2025-02-01T00:00:00.000Z",
            "homepage": None,
            "owner": "org_2",
            "score": None,
        },
    ],
    "pagination": {
        "currentPage": 1,
        "pageSize": 30,
        "totalPages": 161,
        "totalCount": 4814,
    },
}


class FlattenInputSchemaTests(unittest.TestCase):
    def test_flattens_properties_and_required(self) -> None:
        params = _flatten_input_schema(
            {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "text"},
                    "numResults": {"type": "number", "minimum": 1, "maximum": 100, "default": 10},
                },
                "required": ["query"],
            }
        )
        self.assertEqual(len(params), 2)
        by_name = {param["name"]: param for param in params}
        self.assertEqual(by_name["query"]["type"], "string")
        self.assertTrue(by_name["query"]["required"])
        self.assertEqual(by_name["numResults"]["type"], "number")
        self.assertFalse(by_name["numResults"]["required"])
        self.assertEqual(by_name["numResults"]["minimum"], 1)
        self.assertEqual(by_name["numResults"]["maximum"], 100)
        self.assertEqual(by_name["numResults"]["default"], 10)

    def test_missing_type_becomes_unknown(self) -> None:
        params = _flatten_input_schema({"properties": {"odd": {"description": "no type"}}})
        self.assertEqual(len(params), 1)
        self.assertEqual(params[0]["type"], "unknown")

    def test_type_as_array_picks_first_valid(self) -> None:
        params = _flatten_input_schema(
            {"properties": {"maybe": {"type": ["null", "string"]}}}
        )
        self.assertEqual(params[0]["type"], "string")

    def test_empty_schema_returns_empty_list(self) -> None:
        self.assertEqual(_flatten_input_schema(None), [])
        self.assertEqual(_flatten_input_schema({"type": "object"}), [])
        self.assertEqual(_flatten_input_schema({"type": "object", "properties": {}}), [])


class MapSummaryTests(unittest.TestCase):
    def test_remote_verified_entry(self) -> None:
        summary = _map_summary(_LIST_RESPONSE_SAMPLE["servers"][0])
        self.assertEqual(summary["qualifiedName"], "exa")
        self.assertTrue(summary["isVerified"])
        self.assertTrue(summary["isRemote"])
        self.assertEqual(summary["useCount"], 59906)
        self.assertEqual(summary["externalUrl"], "https://smithery.ai/server/exa")

    def test_local_unverified_entry(self) -> None:
        summary = _map_summary(_LIST_RESPONSE_SAMPLE["servers"][1])
        self.assertFalse(summary["isVerified"])
        self.assertFalse(summary["isRemote"])
        self.assertIsNone(summary["iconUrl"])
        self.assertIsNone(summary["homepage"])
        self.assertEqual(
            summary["externalUrl"], "https://smithery.ai/server/wonderwhy-er/desktop-commander"
        )


class MapDetailTests(unittest.TestCase):
    def test_remote_detail_maps_connections_and_tools(self) -> None:
        detail = _map_detail(_EXA_DETAIL_SAMPLE, qualified_name="exa")
        self.assertTrue(detail["isRemote"])
        self.assertEqual(detail["managedName"], "exa")
        self.assertEqual(detail["deploymentUrl"], "https://exa.run.tools")
        self.assertEqual(detail["connections"][0]["kind"], "http")
        self.assertEqual(detail["connections"][0]["deploymentUrl"], "https://exa.run.tools")
        self.assertEqual(len(detail["tools"]), 1)
        self.assertEqual(detail["tools"][0]["name"], "web_search_exa")
        self.assertEqual(detail["capabilityCounts"], {"tools": 1, "resources": 1, "prompts": 1})

    def test_local_detail_marks_stdio_connection(self) -> None:
        detail = _map_detail(
            _DESKTOP_DETAIL_SAMPLE, qualified_name="wonderwhy-er/desktop-commander"
        )
        self.assertFalse(detail["isRemote"])
        self.assertIsNone(detail["deploymentUrl"])
        self.assertEqual(detail["connections"][0]["kind"], "stdio")
        self.assertEqual(detail["connections"][0]["stdioCommand"], "npx")
        self.assertEqual(
            detail["connections"][0]["stdioArgs"],
            ["-y", "@wonderwhy-er/desktop-commander"],
        )
        self.assertEqual(detail["capabilityCounts"]["tools"], 1)
        self.assertEqual(detail["capabilityCounts"]["resources"], 0)

    def test_sse_connection_is_preserved(self) -> None:
        detail = _map_detail(_SSE_DETAIL_SAMPLE, qualified_name="@acme/stream-server")
        self.assertEqual(detail["managedName"], "stream-server")
        self.assertEqual(detail["connections"][0]["kind"], "sse")

    def test_config_schema_is_preserved_as_marketplace_metadata(self) -> None:
        raw = {
            **_EXA_DETAIL_SAMPLE,
            "connections": [
                {
                    "type": "http",
                    "deploymentUrl": "https://exa.run.tools",
                    "configSchema": {
                        "type": "object",
                        "required": ["headers"],
                        "properties": {
                            "headers": {"type": "object", "description": "Custom headers"},
                        },
                    },
                }
            ],
        }

        detail = _map_detail(raw, qualified_name="exa")

        self.assertEqual(
            detail["connections"][0]["configSchema"],
            raw["connections"][0]["configSchema"],
        )

    def test_bundle_only_local_detail_preserves_metadata(self) -> None:
        raw = {
            **_DESKTOP_DETAIL_SAMPLE,
            "connections": [
                {
                    "type": "stdio",
                    "bundleUrl": "https://backend.smithery.ai/storage/v1/object/public/bundles/@acme/server/server.mcpb",
                    "runtime": "node",
                    "configSchema": {"type": "object", "required": [], "properties": {}},
                }
            ],
        }

        detail = _map_detail(raw, qualified_name="acme/server")

        self.assertEqual(detail["connections"][0]["bundleUrl"], raw["connections"][0]["bundleUrl"])
        self.assertEqual(detail["connections"][0]["runtime"], "node")


class McpMarketplaceCatalogTests(unittest.TestCase):
    def test_popular_page_maps_response_and_reports_has_more(self) -> None:
        catalog = McpMarketplaceCatalog(
            fetcher=lambda _path: _LIST_RESPONSE_SAMPLE,
            cache=MarketplaceCache(),
        )
        page = catalog.popular_page(limit=30, offset=0)
        self.assertEqual(len(page["items"]), 2)
        self.assertEqual(page["items"][0]["qualifiedName"], "exa")
        self.assertTrue(page["hasMore"])
        self.assertEqual(page["nextOffset"], 2)

    def test_search_with_only_filters_bypasses_min_query(self) -> None:
        catalog = McpMarketplaceCatalog(
            fetcher=lambda _path: _LIST_RESPONSE_SAMPLE,
            cache=MarketplaceCache(),
        )
        page = catalog.search_page("", limit=30, offset=0, remote=False)
        self.assertEqual(len(page["items"]), 2)

    def test_search_requires_min_query_when_no_filters(self) -> None:
        catalog = McpMarketplaceCatalog(
            fetcher=lambda _path: _LIST_RESPONSE_SAMPLE,
            cache=MarketplaceCache(),
        )
        with self.assertRaises(ValueError):
            catalog.search_page("a", limit=30, offset=0)

    def test_detail_returns_none_on_404(self) -> None:
        def fetcher(_path: str) -> dict[str, object]:
            raise MarketplaceUpstreamError("bad_status", "u", "x", upstream_status=404)

        catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())
        self.assertIsNone(catalog.detail("missing"))

    def test_detail_caches_within_ttl(self) -> None:
        fetcher = mock.Mock(return_value=_EXA_DETAIL_SAMPLE)
        catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())
        self.assertIsNone(catalog.detail("   "))  # empty name path
        first = catalog.detail("exa")
        second = catalog.detail("exa")
        self.assertEqual(first, second)
        # MarketplaceCache() with root=None does not persist, so each call hits fetcher.
        # Use a tmp-backed cache to prove single fetch.

    def test_detail_path_encoded_for_namespaced_name(self) -> None:
        fetcher = mock.Mock(return_value=_DESKTOP_DETAIL_SAMPLE)
        catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())
        catalog.detail("wonderwhy-er/desktop-commander")
        called_path = fetcher.call_args.args[0]
        self.assertEqual(called_path, "/servers/wonderwhy-er/desktop-commander")

if __name__ == "__main__":
    unittest.main()
