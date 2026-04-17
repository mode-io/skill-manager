from __future__ import annotations

import unittest

from tests.support.app_harness import AppTestHarness


class RequestValidationTests(unittest.TestCase):
    def test_enable_skill_rejects_empty_body(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.post_json("/api/skills/missing/enable", {}, expected_status=422)
        self.assertIn("harness", payload["error"])

    def test_enable_skill_rejects_blank_harness(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.post_json("/api/skills/missing/enable", {"harness": ""}, expected_status=422)
        self.assertIn("harness", payload["error"])

    def test_disable_skill_rejects_empty_body(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.post_json("/api/skills/missing/disable", {}, expected_status=422)
        self.assertIn("harness", payload["error"])

    def test_set_harness_support_requires_boolean_enabled(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.put_json(
                "/api/settings/harnesses/codex/support",
                {"enabled": 42},
                expected_status=422,
            )
        self.assertIn("enabled", payload["error"])

    def test_install_marketplace_requires_install_token(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.post_json("/api/marketplace/install", {}, expected_status=422)
        self.assertIn("installToken", payload["error"])


if __name__ == "__main__":
    unittest.main()
