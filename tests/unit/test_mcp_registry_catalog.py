from __future__ import annotations

import unittest
from unittest import mock
from tempfile import TemporaryDirectory
from pathlib import Path

from skill_manager.application.marketplace_cache import MarketplaceCache
from skill_manager.application.mcp.marketplace.catalog import (
    McpMarketplaceCatalog,
    _flatten_input_schema,
)
from skill_manager.errors import MarketplaceUpstreamError


_OFFICIAL_META = "io.modelcontextprotocol.registry/official"


def _entry(
    name: str,
    version: str,
    *,
    latest: bool = True,
    status: str = "active",
    title: str | None = None,
    description: str = "Server description",
    packages: list[dict[str, object]] | None = None,
    remotes: list[dict[str, object]] | None = None,
    website_url: str | None = None,
    repository_url: str | None = None,
) -> dict[str, object]:
    server: dict[str, object] = {
        "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
        "name": name,
        "version": version,
        "description": description,
    }
    if title is not None:
        server["title"] = title
    if packages is not None:
        server["packages"] = packages
    if remotes is not None:
        server["remotes"] = remotes
    if website_url is not None:
        server["websiteUrl"] = website_url
    if repository_url is not None:
        server["repository"] = {"url": repository_url, "source": "github"}
    return {
        "server": server,
        "_meta": {
            _OFFICIAL_META: {
                "status": status,
                "publishedAt": "2026-05-01T00:00:00Z",
                "updatedAt": "2026-05-02T00:00:00Z",
                "isLatest": latest,
            }
        },
    }


_NPM_PACKAGE = {
    "registryType": "npm",
    "identifier": "@adeu/mcp-server",
    "version": "1.7.1",
    "transport": {"type": "stdio"},
}

_PYPI_PACKAGE = {
    "registryType": "pypi",
    "identifier": "adeu",
    "version": "1.5.2",
    "transport": {"type": "stdio"},
}

_HTTP_REMOTE = {"type": "streamable-http", "url": "https://example.com/mcp"}


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


class McpRegistryCatalogTests(unittest.TestCase):
    def test_popular_page_returns_latest_active_supported_items(self) -> None:
        response = {
            "servers": [
                _entry("ai.adeu/adeu", "1.5.2", latest=False, packages=[_PYPI_PACKAGE]),
                _entry(
                    "ai.adeu/adeu",
                    "1.7.1",
                    title="ADEU",
                    packages=[_NPM_PACKAGE],
                    website_url="https://adeu.ai",
                    repository_url="https://github.com/adeu/adeu-mcp",
                ),
                _entry("old.example/mcp", "1.0.0", status="deleted", remotes=[_HTTP_REMOTE]),
                _entry(
                    "bad.example/mcp",
                    "1.0.0",
                    remotes=[{"type": "websocket", "url": "https://unsupported.example/bad/mcp"}],
                ),
                _entry("remote.example/mcp", "1.0.0", remotes=[_HTTP_REMOTE]),
            ],
            "metadata": {"count": 5},
        }
        catalog = McpMarketplaceCatalog(fetcher=lambda _path: response, cache=MarketplaceCache())

        page = catalog.popular_page(limit=30, offset=0)

        self.assertEqual([item["qualifiedName"] for item in page["items"]], ["ai.adeu/adeu", "remote.example/mcp"])
        self.assertFalse(page["items"][0]["isRemote"])
        self.assertTrue(page["items"][0]["isVerified"])
        self.assertEqual(page["items"][0]["displayName"], "ADEU")
        self.assertEqual(
            page["items"][0]["externalUrl"],
            "https://registry.modelcontextprotocol.io/?q=ai.adeu%2Fadeu",
        )
        self.assertEqual(page["items"][0]["githubUrl"], "https://github.com/adeu/adeu-mcp")
        self.assertEqual(page["items"][0]["websiteUrl"], "https://adeu.ai")
        self.assertTrue(page["items"][1]["isRemote"])

    def test_popular_page_reports_more_items_from_same_registry_page(self) -> None:
        response = {
            "servers": [
                _entry("first/mcp", "1.0.0", packages=[_NPM_PACKAGE]),
                _entry("second/mcp", "1.0.0", packages=[_NPM_PACKAGE]),
                _entry("third/mcp", "1.0.0", packages=[_NPM_PACKAGE]),
            ],
            "metadata": {"count": 3},
        }
        catalog = McpMarketplaceCatalog(fetcher=lambda _path: response, cache=MarketplaceCache())

        page = catalog.popular_page(limit=2, offset=0)

        self.assertEqual([item["qualifiedName"] for item in page["items"]], ["first/mcp", "second/mcp"])
        self.assertEqual(page["nextOffset"], 2)
        self.assertTrue(page["hasMore"])

    def test_popular_page_defaults_to_twenty_items_like_skills_marketplace(self) -> None:
        response = {
            "servers": [
                _entry(f"server/{index}", "1.0.0", packages=[_NPM_PACKAGE])
                for index in range(25)
            ],
            "metadata": {"count": 25},
        }
        catalog = McpMarketplaceCatalog(fetcher=lambda _path: response, cache=MarketplaceCache())

        page = catalog.popular_page()

        self.assertEqual(len(page["items"]), 20)
        self.assertEqual(page["nextOffset"], 20)
        self.assertTrue(page["hasMore"])

    def test_popular_page_caps_limit_to_sixty_like_skills_marketplace(self) -> None:
        response = {
            "servers": [
                _entry(f"server/{index}", "1.0.0", packages=[_NPM_PACKAGE])
                for index in range(61)
            ],
            "metadata": {"count": 61},
        }
        catalog = McpMarketplaceCatalog(fetcher=lambda _path: response, cache=MarketplaceCache())

        page = catalog.popular_page(limit=100)

        self.assertEqual(len(page["items"]), 60)
        self.assertEqual(page["nextOffset"], 60)
        self.assertTrue(page["hasMore"])

    def test_popular_page_uses_github_owner_avatar_when_registry_icon_is_missing(self) -> None:
        response = {
            "servers": [
                _entry(
                    "github/mcp",
                    "1.0.0",
                    packages=[_NPM_PACKAGE],
                    repository_url="https://github.com/modelcontextprotocol/servers",
                ),
            ],
            "metadata": {"count": 1},
        }
        catalog = McpMarketplaceCatalog(fetcher=lambda _path: response, cache=MarketplaceCache())

        page = catalog.popular_page(limit=30, offset=0)

        self.assertEqual(
            page["items"][0]["iconUrl"],
            "https://github.com/modelcontextprotocol.png?size=96",
        )

    def test_search_filters_locally_by_text_and_remote_flag(self) -> None:
        response = {
            "servers": [
                _entry("ai.adeu/adeu", "1.7.1", title="ADEU", packages=[_NPM_PACKAGE]),
                _entry("remote.example/mcp", "1.0.0", title="Remote Search", remotes=[_HTTP_REMOTE]),
            ],
            "metadata": {"count": 2},
        }
        catalog = McpMarketplaceCatalog(fetcher=lambda _path: response, cache=MarketplaceCache())

        local = catalog.search_page("adeu", limit=30, offset=0, remote=False)
        remote = catalog.search_page("search", limit=30, offset=0, remote=True)

        self.assertEqual([item["qualifiedName"] for item in local["items"]], ["ai.adeu/adeu"])
        self.assertEqual([item["qualifiedName"] for item in remote["items"]], ["remote.example/mcp"])

    def test_search_uses_registry_search_parameter(self) -> None:
        response = {
            "servers": [
                _entry("ai.i18nagent/i18n-agent", "1.0.0", title="i18n-agent", packages=[_NPM_PACKAGE]),
            ],
            "metadata": {},
        }
        fetcher = mock.Mock(return_value=response)
        catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())

        page = catalog.search_page("i18", limit=20, offset=0)

        self.assertEqual([item["qualifiedName"] for item in page["items"]], ["ai.i18nagent/i18n-agent"])
        self.assertEqual(fetcher.call_args.args[0], "/v0.1/servers?limit=60&search=i18")

    def test_search_uses_skills_marketplace_fetch_floor_before_stopping(self) -> None:
        first_page = {
            "servers": [
                _entry(f"github.example/{index}", "1.0.0", title=f"GitHub {index}", packages=[_NPM_PACKAGE])
                for index in range(21)
            ],
            "metadata": {"nextCursor": "next"},
        }
        second_page = {
            "servers": [
                _entry(f"github.more/{index}", "1.0.0", title=f"GitHub more {index}", packages=[_NPM_PACKAGE])
                for index in range(20)
            ],
            "metadata": {},
        }
        fetcher = mock.Mock(side_effect=[first_page, second_page])
        catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())

        page = catalog.search_page("github", limit=20, offset=0)

        self.assertEqual(len(page["items"]), 20)
        self.assertEqual(page["nextOffset"], 20)
        self.assertTrue(page["hasMore"])
        self.assertEqual(fetcher.call_count, 2)

    def test_search_reuses_in_memory_snapshot_for_same_query_and_filter(self) -> None:
        response = {
            "servers": [
                _entry(f"github.example/{index}", "1.0.0", title=f"GitHub {index}", packages=[_NPM_PACKAGE])
                for index in range(45)
            ],
            "metadata": {"count": 45},
        }
        fetcher = mock.Mock(return_value=response)
        catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())

        first = catalog.search_page("github", limit=20, offset=0)
        second = catalog.search_page("github", limit=20, offset=0)

        self.assertEqual(first, second)
        self.assertEqual(fetcher.call_count, 1)

    def test_search_refetches_when_page_cache_is_corrupt(self) -> None:
        response = {
            "servers": [
                _entry("ai.adeu/adeu", "1.7.1", title="ADEU", packages=[_NPM_PACKAGE]),
            ],
            "metadata": {"count": 1},
        }
        fetcher = mock.Mock(return_value=response)
        with TemporaryDirectory() as temp_dir:
            cache = MarketplaceCache(root=Path(temp_dir))
            catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=cache)
            catalog.popular_page(limit=30, offset=0)
            page_cache_file = next((Path(temp_dir) / "mcp-registry-page-v1").glob("*.json"))
            page_cache_file.write_text('{"payload": {}}\n{"payload": {}}', encoding="utf-8")

            page = catalog.search_page("adeu", limit=30, offset=0)

        self.assertEqual([item["qualifiedName"] for item in page["items"]], ["ai.adeu/adeu"])
        self.assertEqual(fetcher.call_count, 2)

    def test_detail_uses_latest_version_and_maps_connections(self) -> None:
        calls: list[str] = []

        def fetcher(path: str) -> dict[str, object]:
            calls.append(path)
            if path == "/v0.1/servers/ac.inference.sh%2Fmcp/versions":
                return {
                    "servers": [
                        _entry(
                            "ac.inference.sh/mcp",
                            "1.0.1",
                            title="inference.sh",
                            remotes=[_HTTP_REMOTE],
                            website_url="https://inference.sh",
                            repository_url="git@github.com:acme/inference-mcp.git",
                        ),
                        _entry("ac.inference.sh/mcp", "1.0.0", latest=False, remotes=[_HTTP_REMOTE]),
                    ],
                    "metadata": {"count": 2},
                }
            if path == "/v0.1/servers/ac.inference.sh%2Fmcp/versions/1.0.1":
                return _entry(
                    "ac.inference.sh/mcp",
                    "1.0.1",
                    title="inference.sh",
                    remotes=[_HTTP_REMOTE],
                    website_url="https://inference.sh",
                    repository_url="git@github.com:acme/inference-mcp.git",
                )
            raise AssertionError(path)

        catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())

        detail = catalog.detail("ac.inference.sh/mcp")

        assert detail is not None
        self.assertEqual(calls, [
            "/v0.1/servers/ac.inference.sh%2Fmcp/versions",
            "/v0.1/servers/ac.inference.sh%2Fmcp/versions/1.0.1",
        ])
        self.assertEqual(detail["qualifiedName"], "ac.inference.sh/mcp")
        self.assertEqual(detail["managedName"], "ac-inference-sh-mcp")
        self.assertTrue(detail["isRemote"])
        self.assertEqual(detail["connections"][0]["kind"], "http")
        self.assertEqual(detail["connections"][0]["deploymentUrl"], "https://example.com/mcp")
        self.assertEqual(
            detail["externalUrl"],
            "https://registry.modelcontextprotocol.io/?q=ac.inference.sh%2Fmcp",
        )
        self.assertEqual(detail["githubUrl"], "https://github.com/acme/inference-mcp")
        self.assertEqual(detail["websiteUrl"], "https://inference.sh")
        self.assertNotIn("registryServer", detail)

        install_detail = catalog.install_detail("ac.inference.sh/mcp")
        assert install_detail is not None
        self.assertEqual(install_detail.qualified_name, "ac.inference.sh/mcp")
        self.assertEqual(install_detail.display_name, "inference.sh")
        self.assertEqual(install_detail.registry_server["name"], "ac.inference.sh/mcp")
        self.assertEqual(install_detail.to_resolver_detail()["registryServer"]["name"], "ac.inference.sh/mcp")

    def test_detail_exposes_install_config_fields(self) -> None:
        def fetcher(path: str) -> dict[str, object]:
            if path == "/v0.1/servers/ai.cueapi%2Fmcp/versions":
                return {
                    "servers": [
                        _entry(
                            "ai.cueapi/mcp",
                            "0.1.3",
                            packages=[
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
                        )
                    ],
                    "metadata": {"count": 1},
                }
            if path == "/v0.1/servers/ai.cueapi%2Fmcp/versions/0.1.3":
                return _entry(
                    "ai.cueapi/mcp",
                    "0.1.3",
                    packages=[
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
                )
            raise AssertionError(path)

        catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())

        detail = catalog.detail("ai.cueapi/mcp")

        assert detail is not None
        self.assertTrue(detail["installConfig"]["required"])
        self.assertEqual(detail["installConfig"]["fields"][0]["name"], "CUEAPI_API_KEY")
        self.assertTrue(detail["installConfig"]["fields"][0]["secret"])

    def test_detail_returns_none_on_404(self) -> None:
        def fetcher(_path: str) -> dict[str, object]:
            raise MarketplaceUpstreamError("bad_status", "u", "x", upstream_status=404)

        catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())

        self.assertIsNone(catalog.detail("missing"))

    def test_detail_caches_within_ttl(self) -> None:
        fetcher = mock.Mock(
            side_effect=[
                {"servers": [_entry("ai.adeu/adeu", "1.7.1", packages=[_NPM_PACKAGE])], "metadata": {"count": 1}},
                _entry("ai.adeu/adeu", "1.7.1", packages=[_NPM_PACKAGE]),
            ]
        )
        with TemporaryDirectory() as temp_dir:
            catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache(root=Path(temp_dir)))

            first = catalog.detail("ai.adeu/adeu")
            second = catalog.detail("ai.adeu/adeu")

        self.assertEqual(first, second)
        self.assertEqual(fetcher.call_count, 2)

    def test_detail_normalizes_legacy_cached_api_external_url(self) -> None:
        fetcher = mock.Mock()
        with TemporaryDirectory() as temp_dir:
            cache = MarketplaceCache(root=Path(temp_dir))
            cache.write(
                "mcp-registry-detail-v1",
                "ac.inference.sh/mcp",
                {
                    "qualifiedName": "ac.inference.sh/mcp",
                    "externalUrl": (
                        "https://registry.modelcontextprotocol.io/v0.1/servers/"
                        "ac.inference.sh%2Fmcp/versions/1.0.1"
                    ),
                    "registryServer": {"name": "ac.inference.sh/mcp"},
                },
            )
            catalog = McpMarketplaceCatalog(fetcher=fetcher, cache=cache)

            detail = catalog.detail("ac.inference.sh/mcp")

        assert detail is not None
        self.assertEqual(
            detail["externalUrl"],
            "https://registry.modelcontextprotocol.io/?q=ac.inference.sh%2Fmcp",
        )
        self.assertNotIn("registryServer", detail)
        fetcher.assert_not_called()


if __name__ == "__main__":
    unittest.main()
