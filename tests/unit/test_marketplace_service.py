from __future__ import annotations

import unittest

from skill_manager.application.marketplace import MarketplaceService
from skill_manager.application.marketplace_descriptions import MarketplaceDescriptionResolver
from skill_manager.sources import GitHubManifestFetcher
from skill_manager.sources import GitHubRepoMetadataClient
from skill_manager.sources.types import SkillListing
from tests.support import create_fixture_marketplace_service


class MarketplaceServiceTests(unittest.TestCase):
    def test_popular_returns_nested_github_identity_without_legacy_fields(self) -> None:
        payload = create_fixture_marketplace_service().popular_page(limit=10, offset=0)

        self.assertIn("items", payload)
        self.assertEqual(payload["nextOffset"], 10)
        self.assertTrue(payload["hasMore"])
        self.assertEqual(payload["items"][0]["name"], "Switch Modes")

        mode_switch = next(item for item in payload["items"] if item["name"] == "Mode Switch")
        switch_modes = next(item for item in payload["items"] if item["name"] == "Switch Modes")

        self.assertEqual(mode_switch["description"], "Canonical description for Mode Switch.")
        self.assertEqual(mode_switch["descriptionStatus"], "resolved")
        self.assertEqual(mode_switch["github"]["repo"], "mode-io/skills")
        self.assertEqual(mode_switch["github"]["url"], "https://github.com/mode-io/skills")
        self.assertEqual(mode_switch["github"]["avatarPath"], "/marketplace/avatar?repo=mode-io%2Fskills")
        self.assertEqual(mode_switch["github"]["stars"], 512)
        self.assertNotIn("badge", mode_switch)
        self.assertNotIn("installs", mode_switch)

        self.assertEqual(switch_modes["description"], "Canonical description for Switch Modes.")
        self.assertEqual(switch_modes["descriptionStatus"], "resolved")
        self.assertIsNone(switch_modes["github"]["repo"])
        self.assertEqual(switch_modes["github"]["url"], "https://github.com/openclaw")
        self.assertEqual(switch_modes["github"]["ownerLogin"], "openclaw")
        self.assertEqual(switch_modes["github"]["avatarPath"], "/marketplace/avatar?owner=openclaw")
        self.assertEqual(switch_modes["github"]["stars"], 2218)

    def test_pagination_uses_limit_and_offset(self) -> None:
        service = create_fixture_marketplace_service()

        first = service.popular_page(limit=8, offset=0)
        second = service.popular_page(limit=8, offset=8)

        self.assertEqual(len(first["items"]), 8)
        self.assertEqual(first["nextOffset"], 8)
        self.assertTrue(first["hasMore"])

        self.assertEqual(len(second["items"]), 8)
        self.assertEqual(second["nextOffset"], 16)
        self.assertTrue(second["hasMore"])
        self.assertNotEqual(first["items"][0]["id"], second["items"][0]["id"])

    def test_identity_backed_rows_emit_avatar_paths_without_prefetched_avatar_metadata(self) -> None:
        service = MarketplaceService(
            searchers=(
                lambda query, *, limit=20: [
                    SkillListing(
                        name="Repo Only",
                        description_hint="Repo-backed listing without metadata preload.",
                        source_kind="github",
                        source_locator="github:mode-io/skills/repo-only",
                        registry="skillssh",
                        github_repo="mode-io/skills",
                    ),
                    SkillListing(
                        name="Owner Only",
                        description_hint="Owner-backed listing without metadata preload.",
                        source_kind="agentskill",
                        source_locator="agentskill:openclaw/owner-only",
                        registry="agentskill",
                        github_owner="openclaw",
                    ),
                ][:limit],
            ),
            github_client=GitHubRepoMetadataClient(
                metadata_fetcher=lambda repo: None,
                owner_fetcher=lambda login: None,
            ),
            description_resolver=MarketplaceDescriptionResolver(
                github_fetcher=GitHubManifestFetcher(tree_fetcher=lambda repo: [], file_text_fetcher=lambda repo, path: None),
                agentskill_fetcher=_StaticManifestFetcher(),
            ),
        )

        payload = service.popular_page(limit=10, offset=0)
        repo_only = next(item for item in payload["items"] if item["name"] == "Repo Only")
        owner_only = next(item for item in payload["items"] if item["name"] == "Owner Only")

        self.assertEqual(repo_only["description"], "Repo-backed listing without metadata preload.")
        self.assertEqual(repo_only["descriptionStatus"], "fallback")
        self.assertEqual(repo_only["github"]["repo"], "mode-io/skills")
        self.assertEqual(repo_only["github"]["url"], "https://github.com/mode-io/skills")
        self.assertEqual(repo_only["github"]["avatarPath"], "/marketplace/avatar?repo=mode-io%2Fskills")

        self.assertIsNone(owner_only["github"]["repo"])
        self.assertEqual(owner_only["description"], "Owner-backed listing without metadata preload.")
        self.assertEqual(owner_only["descriptionStatus"], "fallback")
        self.assertEqual(owner_only["github"]["url"], "https://github.com/openclaw")
        self.assertEqual(owner_only["github"]["ownerLogin"], "openclaw")
        self.assertEqual(owner_only["github"]["avatarPath"], "/marketplace/avatar?owner=openclaw")


class _StaticManifestFetcher:
    def fetch_manifest_text(self, source_locator: str) -> str | None:
        return None


if __name__ == "__main__":
    unittest.main()
