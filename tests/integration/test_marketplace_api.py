from __future__ import annotations

import unittest

from skill_manager.errors import MARKETPLACE_UNAVAILABLE_MESSAGE
from tests.support.app_harness import AppTestHarness
from tests.support.marketplace_fixture import create_fixture_marketplace_service
from tests.support.marketplace_https_fixture import MarketplaceFixtureServer


class MarketplaceApiTests(unittest.TestCase):
    def test_marketplace_popular_uses_https_fixture_when_trusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(env_overrides=fixture.env()) as harness:
                payload = harness.get_json("/api/marketplace/popular")

            first = payload["items"][0]
            self.assertEqual(first["name"], "Mode Switch")
            self.assertEqual(first["skillsDetailUrl"], f"{fixture.base_url}/mode-io/skills/mode-switch")

    def test_marketplace_search_uses_https_fixture_when_trusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(env_overrides=fixture.env()) as harness:
                payload = harness.get_json("/api/marketplace/search?q=trace")

            self.assertEqual([item["name"] for item in payload["items"]], ["Trace Scout"])

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

    def test_marketplace_payload_uses_skills_sh_card_contract(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            payload = harness.get_json("/api/marketplace/popular")
            items = payload["items"]

            first = items[0]
            self.assertEqual(first["name"], "Mode Switch")
            self.assertEqual(first["installs"], 128)
            self.assertEqual(first["stars"], 512)
            self.assertEqual(first["repoLabel"], "mode-io/skills")
            self.assertIn("installToken", first)
            self.assertEqual(first["installation"], {
                "status": "installable",
                "installedSkillRef": None,
            })
            self.assertNotIn("sourceKind", first)
            self.assertNotIn("sourceLocator", first)
            self.assertNotIn("github", first)

    def test_marketplace_detail_returns_preview_payload_without_internal_source_fields(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            payload = harness.get_json("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch")
            document = harness.get_json("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch/document")

            self.assertEqual(payload["name"], "Mode Switch")
            self.assertEqual(payload["sourceLinks"]["repoLabel"], "mode-io/skills")
            self.assertEqual(payload["sourceLinks"]["skillsDetailUrl"], "https://skills.sh/mode-io/skills/mode-switch")
            self.assertEqual(payload["installation"], {
                "status": "installable",
                "installedSkillRef": None,
            })
            self.assertIn(document["status"], {"ready", "unavailable"})
            self.assertNotIn("sourceLocator", payload)
            self.assertNotIn("sourceKind", payload)
            self.assertNotIn("documentMarkdown", payload)

    def test_marketplace_detail_uses_https_fixture_when_trusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(env_overrides=fixture.env()) as harness:
                payload = harness.get_json("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch")

            self.assertEqual(payload["name"], "Mode Switch")
            self.assertEqual(payload["description"], "Switch between supported skill execution modes.")
            self.assertEqual(payload["sourceLinks"]["skillsDetailUrl"], f"{fixture.base_url}/mode-io/skills/mode-switch")

    def test_marketplace_detail_returns_503_when_fixture_is_untrusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(env_overrides={"SKILL_MANAGER_MARKETPLACE_BASE_URL": fixture.base_url}) as harness:
                payload = harness.get_json("/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch", expected_status=503)

            self.assertEqual(payload["error"], MARKETPLACE_UNAVAILABLE_MESSAGE)

    def test_marketplace_document_returns_503_when_fixture_is_untrusted(self) -> None:
        with MarketplaceFixtureServer() as fixture:
            with AppTestHarness(env_overrides={"SKILL_MANAGER_MARKETPLACE_BASE_URL": fixture.base_url}) as harness:
                payload = harness.get_json(
                    "/api/marketplace/items/skillssh%3Amode-io%2Fskills%3Amode-switch/document",
                    expected_status=503,
                )

            self.assertEqual(payload["error"], MARKETPLACE_UNAVAILABLE_MESSAGE)

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
