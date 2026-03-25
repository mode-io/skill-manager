from __future__ import annotations

from urllib.parse import quote
from urllib.request import urlopen
import unittest

from tests.support import AppTestHarness, create_fixture_marketplace_service


class MarketplaceApiTests(unittest.TestCase):
    def test_marketplace_payload_uses_nested_github_identity(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            payload = harness.get_json("/marketplace/popular")

            self.assertIn("items", payload)
            self.assertTrue(payload["hasMore"])
            self.assertEqual(payload["nextOffset"], 18)

            mode_switch = next(item for item in payload["items"] if item["name"] == "Mode Switch")
            switch_modes = next(item for item in payload["items"] if item["name"] == "Switch Modes")
            self.assertEqual(mode_switch["github"]["repo"], "mode-io/skills")
            self.assertEqual(mode_switch["github"]["ownerLogin"], "mode-io")
            self.assertEqual(mode_switch["description"], "Canonical description for Mode Switch.")
            self.assertEqual(mode_switch["descriptionStatus"], "resolved")
            self.assertNotIn("githubRepo", mode_switch)
            self.assertNotIn("githubStars", mode_switch)
            self.assertNotIn("badge", mode_switch)
            self.assertNotIn("installs", mode_switch)
            self.assertIsNone(switch_modes["github"]["repo"])
            self.assertEqual(switch_modes["description"], "Canonical description for Switch Modes.")
            self.assertEqual(switch_modes["descriptionStatus"], "resolved")
            self.assertEqual(switch_modes["github"]["ownerLogin"], "openclaw")
            self.assertEqual(switch_modes["github"]["avatarPath"], "/marketplace/avatar?owner=openclaw")

    def test_marketplace_pagination_supports_offset_progression(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            first = harness.get_json("/marketplace/popular?limit=10&offset=0")
            second = harness.get_json("/marketplace/popular?limit=10&offset=10")

            self.assertEqual(len(first["items"]), 10)
            self.assertEqual(first["nextOffset"], 10)
            self.assertTrue(first["hasMore"])

            self.assertEqual(len(second["items"]), 10)
            self.assertEqual(second["nextOffset"], 20)
            self.assertTrue(second["hasMore"])
            self.assertNotEqual(first["items"][0]["id"], second["items"][0]["id"])

    def test_marketplace_search_and_popular_share_canonical_descriptions(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            popular = harness.get_json("/marketplace/popular?limit=18&offset=0")
            search = harness.get_json("/marketplace/search?q=mode&limit=18&offset=0")

            popular_mode_switch = next(item for item in popular["items"] if item["name"] == "Mode Switch")
            search_mode_switch = next(item for item in search["items"] if item["name"] == "Mode Switch")

            self.assertEqual(popular_mode_switch["description"], "Canonical description for Mode Switch.")
            self.assertEqual(search_mode_switch["description"], "Canonical description for Mode Switch.")
            self.assertEqual(popular_mode_switch["descriptionStatus"], "resolved")
            self.assertEqual(search_mode_switch["descriptionStatus"], "resolved")

    def test_marketplace_avatar_route_serves_local_avatar_bytes(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            repo = quote("mode-io/skills", safe="")
            with urlopen(f"{harness.base_url}/marketplace/avatar?repo={repo}") as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers.get_content_type(), "image/svg+xml")
                self.assertIn(b"<svg", response.read())

            with urlopen(f"{harness.base_url}/marketplace/avatar?owner=openclaw") as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.headers.get_content_type(), "image/svg+xml")
                self.assertIn(b"<svg", response.read())


if __name__ == "__main__":
    unittest.main()
