from __future__ import annotations

from urllib.parse import quote
from urllib.request import urlopen
import unittest

from tests.support import AppTestHarness, create_fixture_marketplace_service


class MarketplaceApiTests(unittest.TestCase):
    def test_marketplace_payload_uses_nested_github_identity(self) -> None:
        with AppTestHarness(marketplace=create_fixture_marketplace_service()) as harness:
            payload = harness.get_json("/marketplace/popular")

            mode_switch = next(item for item in payload if item["name"] == "Mode Switch")
            switch_modes = next(item for item in payload if item["name"] == "Switch Modes")
            self.assertEqual(mode_switch["github"]["repo"], "mode-io/skills")
            self.assertEqual(mode_switch["github"]["ownerLogin"], "mode-io")
            self.assertNotIn("githubRepo", mode_switch)
            self.assertNotIn("githubStars", mode_switch)
            self.assertIsNone(switch_modes["github"]["repo"])
            self.assertEqual(switch_modes["github"]["ownerLogin"], "openclaw")
            self.assertEqual(switch_modes["github"]["avatarPath"], "/marketplace/avatar?owner=openclaw")

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
