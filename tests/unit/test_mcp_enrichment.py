from __future__ import annotations

import unittest
from unittest.mock import MagicMock

from skill_manager.application.mcp.enrichment import McpEnrichmentService


def _popular(items: list[dict]) -> dict:
    return {"items": items, "nextOffset": None, "hasMore": False}


class McpEnrichmentServiceTests(unittest.TestCase):
    def test_warm_from_popular_caches_entries(self) -> None:
        catalog = MagicMock()
        catalog.popular_page.return_value = _popular(
            [
                {
                    "qualifiedName": "@exa/exa-mcp",
                    "displayName": "Exa",
                    "iconUrl": "https://icon.example/exa.png",
                    "externalUrl": "https://registry.modelcontextprotocol.io/?q=%40exa%2Fexa-mcp",
                    "githubUrl": "https://github.com/exa-labs/exa-mcp-server",
                    "websiteUrl": "https://exa.ai",
                    "description": "Web search",
                    "isRemote": True,
                    "isVerified": True,
                },
            ]
        )
        service = McpEnrichmentService(catalog)
        link = service.lookup("exa-mcp", allow_search=False)
        self.assertIsNotNone(link)
        assert link is not None
        self.assertEqual(link.qualified_name, "@exa/exa-mcp")
        self.assertEqual(link.display_name, "Exa")
        self.assertEqual(link.github_url, "https://github.com/exa-labs/exa-mcp-server")
        self.assertEqual(link.website_url, "https://exa.ai")
        self.assertEqual(link.to_dict()["githubUrl"], "https://github.com/exa-labs/exa-mcp-server")
        self.assertEqual(link.to_dict()["websiteUrl"], "https://exa.ai")
        catalog.popular_page.assert_called_once()

    def test_cold_miss_triggers_search(self) -> None:
        catalog = MagicMock()
        catalog.popular_page.return_value = _popular([])
        catalog.search_page.return_value = {
            "items": [
                {
                    "qualifiedName": "@other/context7",
                    "displayName": "Context7",
                    "iconUrl": None,
                    "externalUrl": "https://registry.modelcontextprotocol.io/?q=%40other%2Fcontext7",
                    "githubUrl": "https://github.com/upstash/context7",
                    "websiteUrl": "https://context7.com",
                    "description": "",
                    "isRemote": False,
                    "isVerified": True,
                },
            ],
        }
        service = McpEnrichmentService(catalog)
        link = service.lookup("context7")
        self.assertIsNotNone(link)
        assert link is not None
        self.assertEqual(link.qualified_name, "@other/context7")
        self.assertEqual(link.github_url, "https://github.com/upstash/context7")
        self.assertEqual(link.website_url, "https://context7.com")
        catalog.search_page.assert_called_once_with("context7", limit=10, offset=0, verified=True)

    def test_cache_prevents_double_search(self) -> None:
        catalog = MagicMock()
        catalog.popular_page.return_value = _popular([])
        catalog.search_page.return_value = {"items": []}
        service = McpEnrichmentService(catalog)
        self.assertIsNone(service.lookup("unknown"))
        self.assertIsNone(service.lookup("unknown"))
        # Popular called once; search called once; second lookup hits cached None.
        self.assertEqual(catalog.popular_page.call_count, 1)
        self.assertEqual(catalog.search_page.call_count, 1)

    def test_invalidate_clears_cache(self) -> None:
        catalog = MagicMock()
        catalog.popular_page.return_value = _popular([])
        catalog.search_page.return_value = {"items": []}
        service = McpEnrichmentService(catalog)
        service.lookup("x")
        service.invalidate()
        service.lookup("x")
        self.assertEqual(catalog.popular_page.call_count, 2)


if __name__ == "__main__":
    unittest.main()
