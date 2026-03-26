from __future__ import annotations

import unittest

from skill_manager.application.marketplace import MarketplaceService
from skill_manager.sources import GitHubRepoMetadataClient
from skill_manager.sources.types import SkillListing
from tests.support import create_fixture_marketplace_service


class MarketplaceServiceTests(unittest.TestCase):
    def test_popular_returns_nested_github_identity_without_legacy_fields(self) -> None:
        payload = create_fixture_marketplace_service().popular()

        self.assertEqual(payload[0]["name"], "Switch Modes")
        self.assertNotIn("popularity", payload[0])

        mode_switch = next(item for item in payload if item["name"] == "Mode Switch")
        switch_modes = next(item for item in payload if item["name"] == "Switch Modes")

        self.assertEqual(mode_switch["github"]["repo"], "mode-io/skills")
        self.assertEqual(mode_switch["github"]["url"], "https://github.com/mode-io/skills")
        self.assertEqual(mode_switch["github"]["avatarPath"], "/marketplace/avatar?repo=mode-io%2Fskills")
        self.assertEqual(mode_switch["github"]["stars"], 512)

        self.assertIsNone(switch_modes["github"]["repo"])
        self.assertEqual(switch_modes["github"]["url"], "https://github.com/openclaw")
        self.assertEqual(switch_modes["github"]["ownerLogin"], "openclaw")
        self.assertEqual(switch_modes["github"]["avatarPath"], "/marketplace/avatar?owner=openclaw")
        self.assertEqual(switch_modes["github"]["stars"], 2218)

    def test_identity_backed_rows_emit_avatar_paths_without_prefetched_avatar_metadata(self) -> None:
        service = MarketplaceService(
            searchers=(
                lambda query, *, limit=20: [
                    SkillListing(
                        name="Repo Only",
                        description="Repo-backed listing without metadata preload.",
                        source_kind="github",
                        source_locator="github:mode-io/skills/repo-only",
                        registry="skillssh",
                        github_repo="mode-io/skills",
                    ),
                    SkillListing(
                        name="Owner Only",
                        description="Owner-backed listing without metadata preload.",
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
        )

        payload = service.popular()
        repo_only = next(item for item in payload if item["name"] == "Repo Only")
        owner_only = next(item for item in payload if item["name"] == "Owner Only")

        self.assertEqual(repo_only["github"]["repo"], "mode-io/skills")
        self.assertEqual(repo_only["github"]["url"], "https://github.com/mode-io/skills")
        self.assertEqual(repo_only["github"]["avatarPath"], "/marketplace/avatar?repo=mode-io%2Fskills")

        self.assertIsNone(owner_only["github"]["repo"])
        self.assertEqual(owner_only["github"]["url"], "https://github.com/openclaw")
        self.assertEqual(owner_only["github"]["ownerLogin"], "openclaw")
        self.assertEqual(owner_only["github"]["avatarPath"], "/marketplace/avatar?owner=openclaw")


if __name__ == "__main__":
    unittest.main()
