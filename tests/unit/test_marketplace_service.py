from __future__ import annotations

from pathlib import Path
from tempfile import mkdtemp
import unittest

from skill_manager.application.marketplace import MarketplaceService
from skill_manager.application.marketplace.cache import MarketplaceCache
from skill_manager.application.marketplace.models import RepoDisplayMetadata, SkillsShSkill
from skill_manager.application.marketplace.resolver import DetailEnrichment
from skill_manager.sources import GitHubRepoMetadata, GitHubRepoMetadataClient
from tests.support import create_fixture_marketplace_service


class MarketplaceServiceTests(unittest.TestCase):
    def test_popular_returns_install_sorted_cards_without_legacy_source_fields(self) -> None:
        payload = create_fixture_marketplace_service().popular_page()["items"]

        self.assertEqual([item["name"] for item in payload[:3]], ["Mode Switch", "Trace Scout", "Azure Observability"])

        mode_switch = payload[0]
        self.assertEqual(mode_switch["installs"], 128)
        self.assertEqual(mode_switch["stars"], 512)
        self.assertEqual(mode_switch["repoLabel"], "mode-io/skills")
        self.assertEqual(
            mode_switch["githubFolderUrl"],
            "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
        )
        self.assertEqual(
            mode_switch["skillsDetailUrl"],
            "https://skills.sh/mode-io/skills/mode-switch",
        )
        self.assertNotIn("sourceKind", mode_switch)
        self.assertNotIn("sourceLocator", mode_switch)
        self.assertNotIn("github", mode_switch)

    def test_search_requires_two_characters(self) -> None:
        with self.assertRaisesRegex(ValueError, "Enter at least 2 characters"):
            create_fixture_marketplace_service().search_page("a")

    def test_search_results_are_sorted_by_installs(self) -> None:
        payload = create_fixture_marketplace_service().search_page("switch")["items"]
        self.assertEqual([item["name"] for item in payload], ["Mode Switch", "Switch Audit"])
        self.assertEqual([item["installs"] for item in payload], [128, 12])

    def test_install_tokens_resolve_to_github_descriptors(self) -> None:
        service = create_fixture_marketplace_service()
        payload = service.popular_page()["items"]
        descriptor = service.resolve_install_token(payload[0]["installToken"])
        self.assertEqual(descriptor, ("github", "github:mode-io/skills/mode-switch"))

    def test_unexpected_provider_errors_are_not_silently_swallowed(self) -> None:
        service = MarketplaceService(
            leaderboard_fetcher=lambda: (_ for _ in ()).throw(TypeError("bad provider wiring")),
            search_fetcher=lambda query, limit: [],
            warm_on_init=False,
        )

        with self.assertRaisesRegex(TypeError, "bad provider wiring"):
            service.popular_page()

    def test_searcher_injection_is_used_for_expanded_fetch_windows(self) -> None:
        calls: list[int] = []

        def searcher(query: str, limit: int) -> list[SkillsShSkill]:
            calls.append(limit)
            return [
                SkillsShSkill(repo="mode-io/skills", skill_id=f"skill-{index}", name=f"Skill {index}", installs=100 - index)
                for index in range(limit)
            ]

        cache = MarketplaceCache(Path(mkdtemp(prefix="skill-manager-marketplace-test-cache-")))
        for index in range(61):
            cache.write(
                "details",
                f"https://skills.sh/mode-io/skills/skill-{index}",
                DetailEnrichment(
                    description=f"Skill {index} description",
                    github_folder_url=f"https://github.com/mode-io/skills/tree/main/skills/skill-{index}",
                ).to_dict(),
            )

        service = MarketplaceService(
            leaderboard_fetcher=lambda: [],
            search_fetcher=searcher,
            github_client=GitHubRepoMetadataClient(
                metadata_fetcher=lambda repo: GitHubRepoMetadata(
                    repo=repo,
                    repo_url=f"https://github.com/{repo}",
                    owner_login="mode-io",
                    owner_avatar_url=None,
                    stars=42,
                    default_branch="main",
                ),
            ),
            cache=cache,
            warm_on_init=False,
        )

        payload = service.search_page("skill", limit=20, offset=40)
        self.assertEqual(calls[-1], 61)
        self.assertEqual(len(payload["items"]), 20)
        self.assertEqual(payload["nextOffset"], 60)

    def test_warm_details_persists_description_when_folder_resolution_fails(self) -> None:
        cache = MarketplaceCache(Path(mkdtemp(prefix="skill-manager-marketplace-test-cache-")))
        record = SkillsShSkill(
            repo="google-labs-code/stitch-skills",
            skill_id="react:components",
            name="react:components",
            installs=12,
        )
        service = MarketplaceService(
            leaderboard_fetcher=lambda: [record],
            search_fetcher=lambda query, limit: [record],
            detail_fetcher=lambda detail_url: """
                <section>
                  <h2>SKILL.md</h2>
                  <p>react:components</p>
                  <p>Build React components from Stitch designs.</p>
                </section>
            """,
            github_client=GitHubRepoMetadataClient(metadata_fetcher=lambda repo: None),
            cache=cache,
            warm_on_init=False,
        )
        service._resolver.github_folder_url = lambda repo, skill_id, default_branch=None: (_ for _ in ()).throw(ValueError("no path"))  # type: ignore[method-assign]

        service._warm_details([
            (record, RepoDisplayMetadata(stars=None, image_url=None, default_branch="main")),
        ])

        cached = cache.read("details", record.detail_url, ttl_seconds=3600)
        self.assertIsNotNone(cached)
        payload = cached.payload
        self.assertEqual(payload["description"], "Build React components from Stitch designs.")
        self.assertIsNone(payload["githubFolderUrl"])


if __name__ == "__main__":
    unittest.main()
