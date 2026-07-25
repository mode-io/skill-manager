from __future__ import annotations

import http.client
import json
import unittest
from urllib.parse import urlsplit

from tests.support.app_harness import AppTestHarness


def raw_request(base_url: str, method: str, path: str, headers: dict[str, str], body: str | None = None) -> tuple[int, str]:
    """Send one request with full control over headers (urllib adds its own Host)."""
    parsed = urlsplit(base_url)
    connection = http.client.HTTPConnection(parsed.hostname, parsed.port, timeout=5)
    try:
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        return response.status, response.read().decode("utf-8")
    finally:
        connection.close()


class RequestGuardTests(unittest.TestCase):
    def test_plain_loopback_requests_pass(self) -> None:
        with AppTestHarness() as harness:
            health = harness.get_json("/api/health")
            self.assertTrue(health["ok"])

    def test_non_loopback_host_header_is_rejected(self) -> None:
        """DNS rebinding sends the attacker's Host header; it must not reach the API."""
        with AppTestHarness() as harness:
            status, payload = raw_request(harness.base_url, "GET", "/api/health", {"Host": "evil.example"})
            self.assertEqual(status, 403)
            self.assertIn("forbidden host", payload)

    def test_cross_origin_mutation_is_rejected_and_not_applied(self) -> None:
        with AppTestHarness() as harness:
            status, payload = raw_request(
                harness.base_url,
                "PUT",
                "/api/settings/harnesses/codex/support",
                {"Origin": "https://evil.example", "Content-Type": "application/json"},
                body=json.dumps({"enabled": False}),
            )
            self.assertEqual(status, 403)
            self.assertIn("forbidden origin", payload)

            settings = harness.get_json("/api/settings")
            codex = next(item for item in settings["harnesses"] if item["harness"] == "codex")
            self.assertTrue(codex["supportEnabled"])

    def test_cross_origin_read_is_allowed(self) -> None:
        """Browsers already hide responses cross-origin (CORS); only mutations are guarded."""
        with AppTestHarness() as harness:
            status, _ = raw_request(harness.base_url, "GET", "/api/health", {"Origin": "https://evil.example"})
            self.assertEqual(status, 200)

    def test_loopback_origin_mutation_passes(self) -> None:
        """The Vite dev server serves the UI from 127.0.0.1:5173 and proxies /api."""
        with AppTestHarness() as harness:
            status, _ = raw_request(
                harness.base_url,
                "PUT",
                "/api/settings/harnesses/codex/support",
                {"Origin": "http://127.0.0.1:5173", "Content-Type": "application/json"},
                body=json.dumps({"enabled": True}),
            )
            self.assertEqual(status, 200)

    def test_allow_remote_disables_the_guard(self) -> None:
        with AppTestHarness(allow_remote=True) as harness:
            status, _ = raw_request(harness.base_url, "GET", "/api/health", {"Host": "evil.example"})
            self.assertEqual(status, 200)


if __name__ == "__main__":
    unittest.main()
