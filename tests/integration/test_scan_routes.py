from __future__ import annotations

import unittest
from unittest.mock import patch

from skill_manager.application.scan.service import ScanService

from tests.support.app_harness import AppTestHarness


class _FakeProviderConfig:
    def __init__(self, *, model: str | None = None, **_kwargs) -> None:
        self.model = f"openai/{model or ''}"

    def validate(self) -> None:
        return None


class ScanRoutesTests(unittest.TestCase):
    def test_validate_config_reports_missing_fields_without_error_status(self) -> None:
        with AppTestHarness() as harness:
            payload = harness.post_json(
                "/api/scan/configs/validate",
                {
                    "name": "Bad",
                    "baseUrl": "",
                    "apiKey": "",
                    "model": "",
                },
            )

        self.assertEqual(payload["ok"], False)
        self.assertEqual(payload["errorCode"], "missing_required_field")
        self.assertIn("baseUrl", payload["message"])
        self.assertIn("apiKey", payload["message"])
        self.assertIn("model", payload["message"])

    def test_create_config_validates_and_masks_api_key(self) -> None:
        with (
            patch("skill_manager.application.scan.service.ProviderConfig", _FakeProviderConfig),
            patch.object(ScanService, "_run_validation_request", return_value="OK"),
            AppTestHarness() as harness,
        ):
            created = harness.post_json(
                "/api/scan/configs",
                {
                    "name": "Volcengine",
                    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
                    "apiKey": "sk-secret-value",
                    "model": "doubao-test",
                },
            )
            configs = harness.get_json("/api/scan/configs")
            secret = harness.get_json(f"/api/scan/configs/{created['id']}/secret")

        self.assertEqual(created["provider"], "openai-compatible")
        self.assertEqual(created["apiKeyMasked"], "sk-s...alue")
        self.assertNotIn("apiKey", created)
        self.assertEqual(configs["configs"][0]["apiKeyMasked"], "sk-s...alue")
        self.assertNotIn("sk-secret-value", str(configs))
        self.assertEqual(secret, {"apiKey": "sk-secret-value"})

    def test_invalid_create_returns_400_and_does_not_persist(self) -> None:
        with AppTestHarness() as harness:
            error = harness.post_json(
                "/api/scan/configs",
                {
                    "name": "Bad",
                    "baseUrl": "",
                    "apiKey": "",
                    "model": "",
                },
                expected_status=400,
            )
            configs = harness.get_json("/api/scan/configs")

        self.assertIn("baseUrl", error["error"])
        self.assertEqual(configs["configs"], [])

    def test_update_with_empty_api_key_preserves_saved_key(self) -> None:
        with (
            patch("skill_manager.application.scan.service.ProviderConfig", _FakeProviderConfig),
            patch.object(ScanService, "_run_validation_request", return_value="OK"),
            AppTestHarness() as harness,
        ):
            created = harness.post_json(
                "/api/scan/configs",
                {
                    "name": "Volcengine",
                    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
                    "apiKey": "sk-secret-value",
                    "model": "doubao-test",
                },
            )
            updated = harness.put_json(
                f"/api/scan/configs/{created['id']}",
                {
                    "name": "Volcengine updated",
                    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
                    "apiKey": "",
                    "model": "doubao-updated",
                },
            )
            configs = harness.get_json("/api/scan/configs")

        self.assertEqual(updated["name"], "Volcengine updated")
        self.assertEqual(updated["model"], "doubao-updated")
        self.assertEqual(updated["apiKeyMasked"], "sk-s...alue")
        self.assertNotIn("sk-secret-value", str(configs))

    def test_validate_existing_config_can_reuse_saved_api_key(self) -> None:
        with (
            patch("skill_manager.application.scan.service.ProviderConfig", _FakeProviderConfig),
            patch.object(ScanService, "_run_validation_request", return_value="OK"),
            AppTestHarness() as harness,
        ):
            created = harness.post_json(
                "/api/scan/configs",
                {
                    "name": "Volcengine",
                    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
                    "apiKey": "sk-secret-value",
                    "model": "doubao-test",
                },
            )
            result = harness.post_json(
                "/api/scan/configs/validate",
                {
                    "name": "Volcengine",
                    "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
                    "apiKey": "",
                    "model": "doubao-test",
                    "existingConfigId": created["id"],
                },
            )

        self.assertTrue(result["ok"])
        self.assertEqual(result["message"], "Connectivity test passed.")


if __name__ == "__main__":
    unittest.main()
