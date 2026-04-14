from __future__ import annotations

import socket
from urllib.error import HTTPError, URLError
from unittest import mock
import unittest

from skill_manager.application.marketplace.client import (
    SkillsShClient,
    configured_marketplace_base_url,
    configured_marketplace_ca_file,
)
from skill_manager.application.marketplace.skillssh import fetch_all_time_leaderboard, search_skills
from skill_manager.errors import MARKETPLACE_UNAVAILABLE_MESSAGE, MarketplaceUpstreamError


class MarketplaceClientConfigTests(unittest.TestCase):
    def test_base_url_override_is_normalized(self) -> None:
        self.assertEqual(
            configured_marketplace_base_url({"SKILL_MANAGER_MARKETPLACE_BASE_URL": "https://fixture.local/"}),
            "https://fixture.local",
        )

    def test_ssl_cert_override_takes_precedence(self) -> None:
        self.assertEqual(
            str(configured_marketplace_ca_file({"SSL_CERT_FILE": "/tmp/custom-ca.pem"})),
            "/tmp/custom-ca.pem",
        )

    def test_packaged_runtime_uses_certifi_when_no_override_exists(self) -> None:
        with (
            mock.patch("skill_manager.application.marketplace.client._is_packaged_runtime", return_value=True),
            mock.patch("skill_manager.application.marketplace.client.certifi.where", return_value="/tmp/certifi-ca.pem"),
        ):
            self.assertEqual(str(configured_marketplace_ca_file({})), "/tmp/certifi-ca.pem")

    def test_source_runtime_uses_system_trust_when_no_override_exists(self) -> None:
        with mock.patch("skill_manager.application.marketplace.client._is_packaged_runtime", return_value=False):
            self.assertIsNone(configured_marketplace_ca_file({}))


class MarketplaceProviderErrorTests(unittest.TestCase):
    def test_fetch_all_time_leaderboard_wraps_malformed_homepage_payload(self) -> None:
        client = mock.Mock()
        client.fetch_text.return_value = "<html><body>missing payload</body></html>"
        client.base_url = "https://fixture.local"
        client.absolute_url.return_value = "https://fixture.local/"

        with self.assertRaises(MarketplaceUpstreamError) as captured:
            fetch_all_time_leaderboard(client=client)

        self.assertEqual(str(captured.exception), MARKETPLACE_UNAVAILABLE_MESSAGE)
        self.assertEqual(captured.exception.kind, "payload")

    def test_search_skills_wraps_malformed_search_payload(self) -> None:
        client = mock.Mock()
        client.fetch_json.return_value = {"skills": "bad"}
        client.base_url = "https://fixture.local"
        client.absolute_url.return_value = "https://fixture.local/api/search?q=trace&limit=20"

        with self.assertRaises(MarketplaceUpstreamError) as captured:
            search_skills("trace", client=client)

        self.assertEqual(str(captured.exception), MARKETPLACE_UNAVAILABLE_MESSAGE)
        self.assertEqual(captured.exception.kind, "payload")

    def test_search_skills_filters_unsupported_sources(self) -> None:
        client = mock.Mock()
        client.fetch_json.return_value = {
            "skills": [
                {
                    "source": "smithery.ai",
                    "skillId": "ui-ux-pro-max",
                    "name": "ui-ux-pro-max",
                    "installs": 128,
                },
                {
                    "source": "mode-io/skills",
                    "skillId": "mode-switch",
                    "name": "Mode Switch",
                    "installs": 64,
                },
            ],
        }
        client.base_url = "https://fixture.local"
        client.absolute_url.return_value = "https://fixture.local/api/search?q=mode&limit=20"

        skills = search_skills("mode", client=client)

        self.assertEqual([(item.repo, item.skill_id) for item in skills], [("mode-io/skills", "mode-switch")])


class SkillsShClientErrorTests(unittest.TestCase):
    def test_fetch_json_maps_http_error_to_upstream_error(self) -> None:
        client = SkillsShClient(base_url="https://fixture.local")
        http_error = HTTPError(
            url="https://fixture.local/api/search?q=trace&limit=20",
            code=502,
            msg="Bad Gateway",
            hdrs=None,
            fp=None,
        )
        with mock.patch("skill_manager.application.marketplace.client.urlopen", side_effect=http_error):
            with self.assertRaises(MarketplaceUpstreamError) as captured:
                client.fetch_json("/api/search?q=trace&limit=20")

        self.assertEqual(str(captured.exception), MARKETPLACE_UNAVAILABLE_MESSAGE)
        self.assertEqual(captured.exception.kind, "bad_status")
        self.assertEqual(captured.exception.upstream_status, 502)

    def test_fetch_text_maps_timeout_to_upstream_error(self) -> None:
        client = SkillsShClient(base_url="https://fixture.local")
        timeout_error = URLError(socket.timeout("timed out"))
        with mock.patch("skill_manager.application.marketplace.client.urlopen", side_effect=timeout_error):
            with self.assertRaises(MarketplaceUpstreamError) as captured:
                client.fetch_text("/")

        self.assertEqual(str(captured.exception), MARKETPLACE_UNAVAILABLE_MESSAGE)
        self.assertEqual(captured.exception.kind, "timeout")


if __name__ == "__main__":
    unittest.main()
