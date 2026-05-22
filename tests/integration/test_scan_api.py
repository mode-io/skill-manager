from __future__ import annotations

import unittest

from skill_manager.db.repositories import LLMScanConfigRow
from tests.support.app_harness import AppTestHarness


def scan_config(*, name: str = "Default", api_key: str = "sk-test-full-secret") -> LLMScanConfigRow:
    return LLMScanConfigRow(
        id=None,
        name=name,
        base_url="https://api.example.com/v1",
        api_key=api_key,
        model="model-a",
        provider="openai-compatible",
        api_version="",
        aws_region="",
        aws_profile="",
        aws_session_token="",
        max_tokens=8192,
        consensus_runs=1,
        is_active=False,
    )


class ScanApiTests(unittest.TestCase):
    def test_config_list_masks_api_key_but_secret_endpoint_reveals_full_key(self) -> None:
        with AppTestHarness() as harness:
            config_id = harness.container.scan_config_service.save_config(scan_config())
            harness.container.scan_config_service.set_active_config(config_id)

            listed = harness.get_json("/api/scan/configs")
            self.assertEqual(listed["activeId"], config_id)
            self.assertEqual(len(listed["configs"]), 1)
            item = listed["configs"][0]
            self.assertEqual(item["apiKeyMasked"], "sk-t...cret")
            self.assertNotIn("sk-test-full-secret", str(listed))

            secret = harness.get_json(f"/api/scan/configs/{config_id}/secret")
            self.assertEqual(secret, {"apiKey": "sk-test-full-secret"})

    def test_secret_endpoint_404s_for_unknown_config(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.get_json("/api/scan/configs/999/secret", expected_status=404)
            self.assertIn("Config 999 not found", payload["error"])


if __name__ == "__main__":
    unittest.main()
