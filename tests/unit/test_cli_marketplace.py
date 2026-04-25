from __future__ import annotations

import json
import unittest
from unittest import mock

from skill_manager.application.cli_marketplace.catalog import CliMarketplaceCatalog
from skill_manager.application.cli_marketplace.client import (
    ClisDevClient,
    configured_clis_dev_base_url,
)
from skill_manager.application.marketplace_cache import MarketplaceCache


_LIST_RESPONSE_SAMPLE: dict[str, object] = {
    "count": 4,
    "clis": [
        {
            "slug": "ollama",
            "name": "Ollama",
            "description": "Run local models.",
            "long_description": "Run and manage local language models.\n\nWorks offline.",
            "category": "AI",
            "install": "brew install ollama",
            "github": "https://github.com/ollama/ollama",
            "website": "https://ollama.com",
            "stars": 120000,
            "language": "Go",
            "has_mcp": True,
            "has_skill": False,
            "is_official": True,
            "is_tui": False,
            "source_type": "official",
            "vendor_name": "Ollama",
        },
        {
            "slug": "lazygit",
            "name": "lazygit",
            "description": "Terminal UI for git.",
            "category": "Developer Tools",
            "install": "brew install lazygit",
            "github": "https://github.com/jesseduffield/lazygit/tree/master",
            "website": "https://github.com/jesseduffield/lazygit",
            "stars": "61000",
            "language": "Go",
            "has_mcp": False,
            "has_skill": True,
            "is_official": False,
            "is_tui": True,
            "source_type": "github",
            "vendor_name": "jesseduffield",
        },
        {
            "slug": "broken-repo",
            "name": "Broken repo",
            "description": "No stable repo URL.",
            "github": "https://example.com/not/github",
            "source_url": "https://docs.example.com/broken-repo",
        },
        {
            "slug": "no-repo",
            "name": "No repo",
            "long_description": "Fallback summary.\n\nDetailed body.",
            "github": "notaurl",
        },
    ],
}


class ClisDevClientTests(unittest.TestCase):
    def test_base_url_override_is_normalized(self) -> None:
        self.assertEqual(
            configured_clis_dev_base_url({"SKILL_MANAGER_CLIS_DEV_BASE_URL": "https://fixture.local/"}),
            "https://fixture.local",
        )

    def test_fetches_list_endpoint(self) -> None:
        response = mock.MagicMock()
        response.read.return_value = json.dumps({"clis": []}).encode("utf-8")
        response.__enter__ = mock.Mock(return_value=response)
        response.__exit__ = mock.Mock(return_value=None)

        with mock.patch("skill_manager.application.cli_marketplace.client.urlopen", return_value=response) as urlopen:
            client = ClisDevClient(base_url="https://fixture.local", ssl_context=None)
            payload = client.list_clis()

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://fixture.local/api/clis")
        self.assertEqual(request.headers["Accept"], "application/json")
        self.assertEqual(payload, {"clis": []})

    def test_search_endpoint_encodes_query(self) -> None:
        response = mock.MagicMock()
        response.read.return_value = json.dumps({"clis": []}).encode("utf-8")
        response.__enter__ = mock.Mock(return_value=response)
        response.__exit__ = mock.Mock(return_value=None)

        with mock.patch("skill_manager.application.cli_marketplace.client.urlopen", return_value=response) as urlopen:
            client = ClisDevClient(base_url="https://fixture.local", ssl_context=None)
            client.search_clis("git ui")

        request = urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://fixture.local/api/search?q=git%20ui")


class CliMarketplaceCatalogTests(unittest.TestCase):
    def test_popular_page_normalizes_and_paginates_locally(self) -> None:
        catalog = CliMarketplaceCatalog(
            fetcher=lambda _path: _LIST_RESPONSE_SAMPLE,
            cache=MarketplaceCache(),
        )

        page = catalog.popular_page(limit=2, offset=1)

        self.assertEqual([item["slug"] for item in page["items"]], ["lazygit", "broken-repo"])
        self.assertTrue(page["hasMore"])
        self.assertEqual(page["nextOffset"], 3)
        first = page["items"][0]
        self.assertEqual(first["id"], "clisdev:lazygit")
        self.assertEqual(first["githubUrl"], "https://github.com/jesseduffield/lazygit")
        self.assertEqual(first["iconUrl"], "https://github.com/jesseduffield.png?size=96")
        self.assertEqual(first["stars"], 61000)
        self.assertTrue(first["isTui"])
        self.assertTrue(first["hasSkill"])

    def test_invalid_github_url_is_omitted(self) -> None:
        catalog = CliMarketplaceCatalog(
            fetcher=lambda _path: _LIST_RESPONSE_SAMPLE,
            cache=MarketplaceCache(),
        )

        detail = catalog.detail("broken-repo")

        self.assertIsNotNone(detail)
        self.assertIsNone(detail["githubUrl"])
        self.assertIsNone(detail["iconUrl"])
        self.assertEqual(detail["websiteUrl"], "https://docs.example.com/broken-repo")

    def test_detail_resolves_clisdev_id_and_preview_fields(self) -> None:
        catalog = CliMarketplaceCatalog(
            fetcher=lambda _path: _LIST_RESPONSE_SAMPLE,
            cache=MarketplaceCache(),
        )

        detail = catalog.detail("clisdev:ollama")

        self.assertIsNotNone(detail)
        self.assertEqual(detail["slug"], "ollama")
        self.assertEqual(detail["marketplaceUrl"], "https://clis.dev/cli/ollama")
        self.assertEqual(detail["iconUrl"], "https://github.com/ollama.png?size=96")
        self.assertEqual(detail["longDescription"], "Run and manage local language models.\n\nWorks offline.")
        self.assertEqual(detail["installCommand"], "brew install ollama")
        self.assertTrue(detail["isOfficial"])

    def test_search_requires_minimum_query_and_uses_search_endpoint(self) -> None:
        paths: list[str] = []

        def fetcher(path: str) -> dict[str, object]:
            paths.append(path)
            return {"clis": [_LIST_RESPONSE_SAMPLE["clis"][1]]}

        catalog = CliMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())

        with self.assertRaises(ValueError):
            catalog.search_page("g")

        page = catalog.search_page("git ui", limit=10, offset=0)

        self.assertEqual(paths, ["/api/search?q=git%20ui"])
        self.assertEqual(page["items"][0]["slug"], "lazygit")
        self.assertFalse(page["hasMore"])

    def test_detail_falls_back_to_search_when_index_misses(self) -> None:
        def fetcher(path: str) -> dict[str, object]:
            if path == "/api/clis":
                return {"clis": []}
            if path == "/api/search?q=lazygit":
                return {"clis": [_LIST_RESPONSE_SAMPLE["clis"][1]]}
            raise AssertionError(path)

        catalog = CliMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())

        detail = catalog.detail("lazygit")

        self.assertIsNotNone(detail)
        self.assertEqual(detail["slug"], "lazygit")

    def test_unknown_detail_returns_none(self) -> None:
        catalog = CliMarketplaceCatalog(
            fetcher=lambda _path: {"clis": []},
            cache=MarketplaceCache(),
        )

        self.assertIsNone(catalog.detail("missing"))


if __name__ == "__main__":
    unittest.main()
