from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from skill_manager.application.marketplace import MarketplaceCatalog
from skill_manager.application.marketplace.client import SkillsShClient
from skill_manager.application.marketplace.models import RepoDisplayMetadata
from skill_manager.application.marketplace.skillssh import fetch_all_time_leaderboard, fetch_detail_page, search_skills
from skill_manager.application.source_fetch_service import SourceFetchService
from skill_manager.errors import MARKETPLACE_UNAVAILABLE_MESSAGE, MutationError
from skill_manager.sources import github_owner_avatar_url
from tests.support.app_harness import AppTestHarness
from tests.support.fake_home import seed_skill_package
from tests.support.marketplace_fixture import create_fixture_marketplace_service
from tests.support.marketplace_https_fixture import MarketplaceFixtureServer


class _FixtureResolver:
    def __init__(self, *, broken_repos: set[str] | None = None) -> None:
        self._broken_repos = broken_repos or set()

    def repo_metadata(self, repo: str) -> RepoDisplayMetadata:
        return RepoDisplayMetadata(
            stars=512 if repo == "mode-io/skills" else 84,
            image_url=github_owner_avatar_url(repo),
            default_branch="main",
        )

    def repo_metadata_for_repos(self, repos: list[str]) -> dict[str, RepoDisplayMetadata]:
        return {repo: self.repo_metadata(repo) for repo in repos}

    def close(self) -> None:
        return None

    def github_folder_url(self, repo: str, skill_id: str, *, default_branch: str | None = None) -> str | None:
        if repo in self._broken_repos:
            raise ValueError("folder resolution unavailable")
        branch = default_branch or "main"
        return f"https://github.com/{repo}/tree/{branch}/skills/{skill_id}"


class _FixtureGitHubSource:
    def __init__(self, roots: dict[str, Path], failures: set[str] | None = None) -> None:
        self._roots = roots
        self._failures = failures or set()

    def fetch(self, locator: str, work_dir: Path) -> Path:
        if locator in self._failures:
            raise MutationError("unable to fetch source", status=400)
        root = self._roots.get(locator)
        if root is None:
            raise MutationError("unknown source", status=400)
        return root


def _fixture_catalog(env: dict[str, str], *, broken_repos: set[str] | None = None) -> MarketplaceCatalog:
    client = SkillsShClient.from_environment(env)
    return MarketplaceCatalog(
        leaderboard_fetcher=lambda: fetch_all_time_leaderboard(client=client),
        search_fetcher=lambda query, limit: search_skills(query, limit=limit, client=client),
        detail_fetcher=lambda detail_url: fetch_detail_page(detail_url, client=client),
        github_resolver=_FixtureResolver(broken_repos=broken_repos),
        warm_on_init=False,
    )


class MarketplaceApiTests(unittest.TestCase):
    def test_marketplace_popular_uses_https_fixture_when_trusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(marketplace=_fixture_catalog(fixture.env())) as harness:
                payload = harness.get_json("/api/marketplace/popular")

        first = payload["items"][0]
        self.assertEqual(first["name"], "Mode Switch")
        self.assertEqual(first["description"], "Switch between supported skill execution modes.")
        self.assertEqual(first["repoUrl"], "https://github.com/mode-io/skills")
        self.assertEqual(first["skillsDetailUrl"], f"{fixture.base_url}/mode-io/skills/mode-switch")
        self.assertTrue(all(item["repoLabel"] != "smithery.ai" for item in payload["items"]))

    def test_marketplace_search_uses_https_fixture_when_trusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(marketplace=_fixture_catalog(fixture.env())) as harness:
                payload = harness.get_json("/api/marketplace/search?q=trace")

        self.assertEqual([item["name"] for item in payload["items"]], ["Trace Scout"])
        self.assertEqual(payload["items"][0]["description"], "Review traces and highlight suspicious flows.")

    def test_marketplace_search_degrades_when_fixture_search_result_has_no_detail_page(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(marketplace=_fixture_catalog(fixture.env())) as harness:
                payload = harness.get_json("/api/marketplace/search?q=ui-ux")

        self.assertEqual(payload["items"][0]["name"], "ui-ux-pro-max")
        self.assertEqual(payload["items"][0]["repoLabel"], "broken-org/ui-ux-pro-max-skill")
        self.assertEqual(payload["items"][0]["description"], MarketplaceCatalog.DETAIL_MISSING_FALLBACK)
        self.assertTrue(all(item["repoLabel"] != "smithery.ai" for item in payload["items"]))

    def test_marketplace_popular_returns_503_when_fixture_is_untrusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(env_overrides={"SKILL_MANAGER_MARKETPLACE_BASE_URL": fixture.base_url}) as harness:
                payload = harness.get_json("/api/marketplace/popular", expected_status=503)

        self.assertEqual(payload["error"], MARKETPLACE_UNAVAILABLE_MESSAGE)

    def test_marketplace_search_returns_503_when_fixture_is_untrusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(env_overrides={"SKILL_MANAGER_MARKETPLACE_BASE_URL": fixture.base_url}) as harness:
                payload = harness.get_json("/api/marketplace/search?q=trace", expected_status=503)

        self.assertEqual(payload["error"], MARKETPLACE_UNAVAILABLE_MESSAGE)

    def test_marketplace_detail_uses_https_fixture_and_handles_folder_resolution_failure(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(
                marketplace=_fixture_catalog(fixture.env(), broken_repos={"vercel-labs/skills"}),
            ) as harness:
                payload = harness.get_json("/api/marketplace/items/skillssh%3Avercel-labs%2Fskills%3Atrace-scout")

        self.assertEqual(payload["name"], "Trace Scout")
        self.assertEqual(payload["description"], "Review traces and highlight suspicious flows.")
        self.assertEqual(payload["sourceLinks"]["repoUrl"], "https://github.com/vercel-labs/skills")
        self.assertEqual(payload["sourceLinks"]["folderUrl"], None)
        self.assertEqual(payload["sourceLinks"]["skillsDetailUrl"], f"{fixture.base_url}/vercel-labs/skills/trace-scout")

    def test_marketplace_detail_degrades_when_summary_preview_is_missing(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(marketplace=_fixture_catalog(fixture.env())) as harness:
                payload = harness.get_json("/api/marketplace/items/skillssh%3Abroken-org%2Fui-ux-pro-max-skill%3Aui-ux-pro-max")

        self.assertEqual(payload["name"], "ui-ux-pro-max")
        self.assertEqual(payload["description"], MarketplaceCatalog.DETAIL_MISSING_FALLBACK)
        self.assertEqual(payload["sourceLinks"]["repoUrl"], "https://github.com/broken-org/ui-ux-pro-max-skill")

    def test_marketplace_detail_returns_503_when_fixture_is_untrusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(env_overrides={"SKILL_MANAGER_MARKETPLACE_BASE_URL": fixture.base_url}) as harness:
                payload = harness.get_json("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch", expected_status=503)

        self.assertEqual(payload["error"], MARKETPLACE_UNAVAILABLE_MESSAGE)

    def test_marketplace_detail_returns_404_for_unknown_item(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            payload = harness.get_json("/api/marketplace/items/skillssh%3Aunknown%2Frepo%3Anope", expected_status=404)

        self.assertIn("unknown marketplace item", payload["error"])

    def test_marketplace_detail_returns_404_for_filtered_unsupported_source(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(marketplace=_fixture_catalog(fixture.env())) as harness:
                payload = harness.get_json("/api/marketplace/items/skillssh%3Asmithery.ai%3Aui-ux-pro-max", expected_status=404)

        self.assertIn("unknown marketplace item", payload["error"])

    def test_marketplace_document_uses_source_fetcher_and_gracefully_handles_failures(self) -> None:
        with MarketplaceFixtureServer() as fixture, TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            good_root = seed_skill_package(root / "sources", "mode-switch", "Mode Switch", body="Use when marketplace tests run.")
            source_fetcher = SourceFetchService(
                github=_FixtureGitHubSource(
                    {
                        "mode-io/skills/mode-switch": good_root,
                    },
                    failures={"vercel-labs/skills/trace-scout"},
                ),
            )
            with AppTestHarness(
                marketplace=_fixture_catalog(fixture.env()),
                source_fetcher=source_fetcher,
            ) as harness:
                ready_payload = harness.get_json("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch/document")
                unavailable_payload = harness.get_json("/api/marketplace/items/skillssh%3Avercel-labs%2Fskills%3Atrace-scout/document")

        self.assertEqual(ready_payload["status"], "ready")
        self.assertIn("marketplace tests run", ready_payload["documentMarkdown"])
        self.assertEqual(unavailable_payload, {"status": "unavailable", "documentMarkdown": None})

    def test_marketplace_document_returns_503_when_fixture_is_untrusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(env_overrides={"SKILL_MANAGER_MARKETPLACE_BASE_URL": fixture.base_url}) as harness:
                payload = harness.get_json(
                    "/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch/document",
                    expected_status=503,
                )

        self.assertEqual(payload["error"], MARKETPLACE_UNAVAILABLE_MESSAGE)

    def test_marketplace_detail_returns_preview_payload_without_internal_source_fields(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            payload = harness.get_json("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch")

        self.assertEqual(payload["name"], "Mode Switch")
        self.assertEqual(payload["sourceLinks"]["repoLabel"], "mode-io/skills")
        self.assertEqual(payload["sourceLinks"]["repoUrl"], "https://github.com/mode-io/skills")
        self.assertEqual(payload["sourceLinks"]["skillsDetailUrl"], "https://skills.sh/mode-io/skills/mode-switch")
        self.assertNotIn("sourceLocator", payload)
        self.assertNotIn("sourceKind", payload)
        self.assertNotIn("documentMarkdown", payload)

    def test_marketplace_search_rejects_short_queries(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            payload = harness.get_json("/api/marketplace/search?q=a", expected_status=400)

        self.assertIn("Enter at least 2 characters", payload["error"])

    def test_marketplace_install_requires_install_token(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            payload = harness.post_json("/api/marketplace/install", {}, expected_status=400)

        self.assertEqual(payload["error"], "missing installToken")


if __name__ == "__main__":
    unittest.main()
