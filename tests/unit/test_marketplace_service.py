from __future__ import annotations

from pathlib import Path
from tempfile import mkdtemp
import unittest

from skill_manager.application.marketplace import MarketplaceCatalog
from skill_manager.application.marketplace.cache import MarketplaceCache
from skill_manager.application.marketplace.models import SkillsShSkill
from skill_manager.application.marketplace.resolver import DetailEnrichment, GitHubSkillResolver
from skill_manager.errors import MARKETPLACE_UNAVAILABLE_MESSAGE, MarketplaceUpstreamError
from skill_manager.sources import GitHubRepoMetadata, GitHubRepoMetadataClient
from tests.support.marketplace_fixture import create_fixture_marketplace_service


class MarketplaceServiceTests(unittest.TestCase):
    def test_popular_returns_install_sorted_cards_with_repo_links(self) -> None:
        payload = create_fixture_marketplace_service().popular_page()["items"]

        self.assertEqual([item["name"] for item in payload[:3]], ["Mode Switch", "Trace Scout", "Azure Observability"])

        mode_switch = payload[0]
        self.assertEqual(mode_switch["installs"], 128)
        self.assertEqual(mode_switch["stars"], 512)
        self.assertEqual(mode_switch["repoLabel"], "mode-io/skills")
        self.assertEqual(mode_switch["repoUrl"], "https://github.com/mode-io/skills")
        self.assertEqual(mode_switch["skillsDetailUrl"], "https://skills.sh/mode-io/skills/mode-switch")
        self.assertNotIn("sourceKind", mode_switch)
        self.assertNotIn("sourceLocator", mode_switch)
        self.assertNotIn("github", mode_switch)

    def test_search_requires_two_characters(self) -> None:
        with self.assertRaisesRegex(ValueError, "Enter at least 2 characters"):
            create_fixture_marketplace_service().search_page("a")

    def test_find_item_propagates_marketplace_upstream_errors(self) -> None:
        service = MarketplaceCatalog(
            leaderboard_fetcher=lambda: [],
            search_fetcher=lambda query, limit: (_ for _ in ()).throw(
                MarketplaceUpstreamError("network", "https://fixture.local/api/search", "offline")
            ),
            warm_on_init=False,
        )

        with self.assertRaises(MarketplaceUpstreamError) as captured:
            service.find_item("skillssh:mode-io/skills:mode-switch")

        self.assertEqual(str(captured.exception), MARKETPLACE_UNAVAILABLE_MESSAGE)

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
        service = MarketplaceCatalog(
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
                SkillsShSkill(
                    repo="mode-io/skills",
                    skill_id=f"skill-{index}",
                    name=f"Skill {index}",
                    installs=100 - index,
                    description_hint=f"Skill {index} description",
                )
                for index in range(limit)
            ]

        service = MarketplaceCatalog(
            leaderboard_fetcher=lambda: [],
            search_fetcher=searcher,
            github_resolver=GitHubSkillResolver(
                GitHubRepoMetadataClient(
                    metadata_fetcher=lambda repo: GitHubRepoMetadata(
                        repo=repo,
                        repo_url=f"https://github.com/{repo}",
                        owner_login="mode-io",
                        owner_avatar_url=None,
                        stars=42,
                        default_branch="main",
                    ),
                ),
            ),
            cache=MarketplaceCache(Path(mkdtemp(prefix="skill-manager-marketplace-test-cache-"))),
            warm_on_init=False,
        )

        payload = service.search_page("skill", limit=20, offset=40)
        self.assertEqual(calls[-1], 61)
        self.assertEqual(len(payload["items"]), 20)
        self.assertEqual(payload["nextOffset"], 60)

    def test_popular_page_fetches_real_descriptions_on_cold_cache(self) -> None:
        record = SkillsShSkill(repo="mode-io/skills", skill_id="mode-switch", name="Mode Switch", installs=128)
        cache = MarketplaceCache(Path(mkdtemp(prefix="skill-manager-marketplace-test-cache-")))
        service = MarketplaceCatalog(
            leaderboard_fetcher=lambda: [record],
            search_fetcher=lambda query, limit: [record],
            detail_fetcher=lambda detail_url: """
                <section>
                  <h2>Summary</h2>
                  <p>Switch between supported skill execution modes.</p>
                </section>
            """,
            github_resolver=GitHubSkillResolver(
                GitHubRepoMetadataClient(metadata_fetcher=lambda repo: GitHubRepoMetadata(
                    repo=repo,
                    repo_url=f"https://github.com/{repo}",
                    owner_login="mode-io",
                    owner_avatar_url=None,
                    stars=42,
                    default_branch="main",
                )),
            ),
            cache=cache,
            warm_on_init=False,
        )

        payload = service.popular_page()["items"]

        self.assertEqual(payload[0]["description"], "Switch between supported skill execution modes.")
        cached = cache.read("details", record.detail_url, ttl_seconds=3600)
        self.assertIsNotNone(cached)

    def test_search_page_falls_back_to_detail_when_hint_is_missing(self) -> None:
        record = SkillsShSkill(
            repo="google-labs-code/stitch-skills",
            skill_id="react-components",
            name="React Components",
            installs=12,
            description_hint="",
        )
        service = MarketplaceCatalog(
            leaderboard_fetcher=lambda: [],
            search_fetcher=lambda query, limit: [record],
            detail_fetcher=lambda detail_url: """
                <section>
                  <h2>SKILL.md</h2>
                  <p>React Components</p>
                  <p>Build React components from Stitch designs.</p>
                </section>
            """,
            github_resolver=GitHubSkillResolver(GitHubRepoMetadataClient(metadata_fetcher=lambda repo: None)),
            cache=MarketplaceCache(Path(mkdtemp(prefix="skill-manager-marketplace-test-cache-"))),
            warm_on_init=False,
        )

        payload = service.search_page("react")["items"]

        self.assertEqual(payload[0]["description"], "Build React components from Stitch designs.")

    def test_detail_enrichment_returns_summary_when_folder_resolution_fails(self) -> None:
        record = SkillsShSkill(
            repo="google-labs-code/stitch-skills",
            skill_id="react-components",
            name="React Components",
            installs=12,
        )
        service = MarketplaceCatalog(
            leaderboard_fetcher=lambda: [record],
            search_fetcher=lambda query, limit: [record],
            detail_fetcher=lambda detail_url: """
                <section>
                  <h2>SKILL.md</h2>
                  <p>React Components</p>
                  <p>Build React components from Stitch designs.</p>
                </section>
            """,
            github_resolver=GitHubSkillResolver(GitHubRepoMetadataClient(metadata_fetcher=lambda repo: None)),
            cache=MarketplaceCache(Path(mkdtemp(prefix="skill-manager-marketplace-test-cache-"))),
            warm_on_init=False,
        )
        service._resolver.github_folder_url = lambda repo, skill_id, default_branch=None: (_ for _ in ()).throw(ValueError("no path"))  # type: ignore[method-assign]

        detail = service.detail_enrichment(record)

        self.assertEqual(detail.description, "Build React components from Stitch designs.")
        self.assertIsNone(detail.github_folder_url)
        self.assertTrue(detail.folder_resolution_complete)

    def test_detail_enrichment_fetches_and_caches_on_first_access(self) -> None:
        cache = MarketplaceCache(Path(mkdtemp(prefix="skill-manager-marketplace-test-cache-")))
        record = SkillsShSkill(
            repo="mode-io/skills",
            skill_id="mode-switch",
            name="Mode Switch",
            installs=128,
        )
        service = MarketplaceCatalog(
            leaderboard_fetcher=lambda: [record],
            search_fetcher=lambda query, limit: [record],
            detail_fetcher=lambda detail_url: """
                <section>
                  <h2>SKILL.md</h2>
                  <p>Mode Switch</p>
                  <p>Switch between supported skill execution modes.</p>
                </section>
            """,
            github_resolver=GitHubSkillResolver(
                GitHubRepoMetadataClient(
                    metadata_fetcher=lambda repo: GitHubRepoMetadata(
                        repo=repo,
                        repo_url=f"https://github.com/{repo}",
                        owner_login="mode-io",
                        owner_avatar_url=None,
                        stars=42,
                        default_branch="main",
                    ),
                ),
            ),
            cache=cache,
            warm_on_init=False,
        )
        service._resolver.github_folder_url = lambda repo, skill_id, default_branch=None: f"https://github.com/{repo}/tree/{default_branch or 'main'}/skills/{skill_id}"  # type: ignore[method-assign]

        detail = service.detail_enrichment(record)

        self.assertEqual(detail.description, "Switch between supported skill execution modes.")
        self.assertEqual(
            detail.github_folder_url,
            "https://github.com/mode-io/skills/tree/main/skills/mode-switch",
        )
        cached = cache.read("details", record.detail_url, ttl_seconds=3600)
        self.assertIsNotNone(cached)


if __name__ == "__main__":
    unittest.main()
