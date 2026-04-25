from __future__ import annotations

import unittest

from skill_manager.application.cli_marketplace import CliMarketplaceCatalog
from skill_manager.application.marketplace_cache import MarketplaceCache
from tests.support.app_harness import AppTestHarness


_FIXTURE_CLIS: dict[str, object] = {
    "clis": [
        {
            "slug": "ollama",
            "name": "Ollama",
            "description": "Run local models.",
            "long_description": "Run local models from a CLI.",
            "install": "brew install ollama",
            "github": "https://github.com/ollama/ollama",
            "website": "https://ollama.com",
            "stars": 120000,
            "language": "Go",
            "category": "AI",
            "has_mcp": True,
            "is_official": True,
        },
        {
            "slug": "lazygit",
            "name": "lazygit",
            "description": "Terminal UI for git.",
            "github": "https://github.com/jesseduffield/lazygit",
            "has_skill": True,
            "is_tui": True,
        },
    ]
}


def _fixture_catalog() -> CliMarketplaceCatalog:
    def fetcher(path: str) -> dict[str, object]:
        if path == "/api/clis":
            return _FIXTURE_CLIS
        if path.startswith("/api/search?q="):
            return {"clis": [_FIXTURE_CLIS["clis"][1]]}
        raise AssertionError(path)

    return CliMarketplaceCatalog(fetcher=fetcher, cache=MarketplaceCache())


class CliMarketplaceApiTests(unittest.TestCase):
    def test_cli_marketplace_popular_returns_preview_page(self) -> None:
        with AppTestHarness(cli_marketplace=_fixture_catalog()) as harness:
            payload = harness.get_json("/api/marketplace/clis/popular?limit=1&offset=0")

        self.assertEqual(payload["items"][0]["id"], "clisdev:ollama")
        self.assertEqual(payload["items"][0]["marketplaceUrl"], "https://clis.dev/cli/ollama")
        self.assertEqual(payload["items"][0]["githubUrl"], "https://github.com/ollama/ollama")
        self.assertEqual(payload["items"][0]["iconUrl"], "https://github.com/ollama.png?size=96")
        self.assertEqual(payload["nextOffset"], 1)
        self.assertTrue(payload["hasMore"])

    def test_cli_marketplace_search_paginates_from_search_response(self) -> None:
        with AppTestHarness(cli_marketplace=_fixture_catalog()) as harness:
            payload = harness.get_json("/api/marketplace/clis/search?q=git&limit=10&offset=0")

        self.assertEqual([item["slug"] for item in payload["items"]], ["lazygit"])
        self.assertFalse(payload["hasMore"])

    def test_cli_marketplace_search_rejects_short_queries(self) -> None:
        with AppTestHarness(cli_marketplace=_fixture_catalog()) as harness:
            payload = harness.get_json("/api/marketplace/clis/search?q=g", expected_status=400)

        self.assertIn("Enter at least 2 characters", payload["error"])

    def test_cli_marketplace_detail_resolves_from_index(self) -> None:
        with AppTestHarness(cli_marketplace=_fixture_catalog()) as harness:
            payload = harness.get_json("/api/marketplace/clis/items/ollama")

        self.assertEqual(payload["slug"], "ollama")
        self.assertEqual(payload["longDescription"], "Run local models from a CLI.")
        self.assertEqual(payload["installCommand"], "brew install ollama")

    def test_cli_marketplace_detail_returns_404_for_unknown_slug(self) -> None:
        with AppTestHarness(cli_marketplace=_fixture_catalog()) as harness:
            payload = harness.get_json("/api/marketplace/clis/items/missing", expected_status=404)

        self.assertIn("unknown CLI", payload["error"])

    def test_cli_marketplace_does_not_add_management_routes(self) -> None:
        with AppTestHarness(cli_marketplace=_fixture_catalog()) as harness:
            payload = harness.post_json("/api/clis/install", {}, expected_status=405)

        self.assertIn("Method Not Allowed", payload.get("error", payload.get("detail", "")))


if __name__ == "__main__":
    unittest.main()
