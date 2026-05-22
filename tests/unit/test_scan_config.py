from __future__ import annotations

import unittest
from unittest.mock import patch

from skill_manager.application.scan.service import ScanService
from skill_manager.application.scan.llm.provider import ProviderConfig
from skill_manager.db import Database
import skill_manager.db.dao.scan_config

from skill_manager.db.repositories import LLMScanConfigRow
from skill_manager.errors import MutationError


class _FakeProviderConfig:
    def __init__(self, *, model: str | None = None, **_kwargs) -> None:
        self.model = f"openai/{model or ''}"

    def validate(self) -> None:
        return None


def _config(**overrides) -> LLMScanConfigRow:
    values = {
        "id": None,
        "name": "Volcengine",
        "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        "api_key": "sk-test",
        "model": "doubao-test",
        "provider": "",
        "api_version": "",
        "aws_region": "",
        "aws_profile": "",
        "aws_session_token": "",
        "max_tokens": 8192,
        "consensus_runs": 1,
        "is_active": False,
        "last_validated_at": None,
        "last_validation_error": "",
    }
    values.update(overrides)
    return LLMScanConfigRow(**values)


class ScanConfigTests(unittest.TestCase):
    def test_database_schema_has_validation_columns(self) -> None:
        db = Database.memory()
        try:
            rows = db.execute_fetchall("PRAGMA table_info(llm_scan_configs)")
            columns = {row["name"] for row in rows}
        finally:
            db.close()

        self.assertIn("api_version", columns)
        self.assertIn("aws_region", columns)
        self.assertIn("aws_profile", columns)
        self.assertIn("aws_session_token", columns)
        self.assertIn("last_validated_at", columns)
        self.assertIn("last_validation_error", columns)

    def test_validate_reports_missing_required_fields_without_saving(self) -> None:
        db = Database.memory()
        service = ScanService(db)
        try:
            result = service.validate_config(_config(base_url="", api_key="", model=""))
            self.assertFalse(result.ok)
            self.assertEqual(result.error_code, "missing_required_field")
            self.assertIn("baseUrl", result.message)
            self.assertIn("apiKey", result.message)
            self.assertIn("model", result.message)
            self.assertEqual(service.list_configs(), [])
        finally:
            db.close()

    def test_save_validated_config_persists_maskable_valid_config(self) -> None:
        db = Database.memory()
        service = ScanService(db)
        try:
            with (
                patch("skill_manager.application.scan.service.ProviderConfig", _FakeProviderConfig),
                patch.object(ScanService, "_run_validation_request", return_value="OK"),
            ):
                config_id = service.save_config_validated(_config())

            saved = service.get_config_by_id(config_id)
            self.assertIsNotNone(saved)
            assert saved is not None
            self.assertEqual(saved.provider, "openai-compatible")
            self.assertEqual(saved.api_key, "sk-test")
            self.assertIsNotNone(saved.last_validated_at)
            self.assertEqual(saved.last_validation_error, "")
        finally:
            db.close()

    def test_openrouter_base_url_infers_openrouter_provider(self) -> None:
        db = Database.memory()
        try:
            service = ScanService(db)
            self.assertEqual(
                service._infer_provider("", "https://openrouter.ai/api/v1", "qwen/qwen3-coder:free"),
                "openrouter",
            )
        finally:
            db.close()

    def test_provider_config_uses_litellm_openrouter_model_prefix(self) -> None:
        with patch("skill_manager.application.scan.llm.provider.LITELLM_AVAILABLE", True):
            config = ProviderConfig(
                model="qwen/qwen3-coder:free",
                api_key="sk-test",
                base_url="https://openrouter.ai/api/v1",
                provider="openrouter",
            )

        self.assertTrue(config.is_openrouter)
        self.assertEqual(config.model, "openrouter/qwen/qwen3-coder:free")

    def test_rate_limit_errors_are_classified_and_sanitized(self) -> None:
        db = Database.memory()
        try:
            service = ScanService(db)
            error = RuntimeError("litellm.RateLimitError: OpenAIException - Provider returned error sk-test")
            config = _config(
                base_url="https://openrouter.ai/api/v1",
                api_key="sk-test",
                model="qwen/qwen3-coder:free",
            )

            self.assertEqual(service._validation_error_code(error), "rate_limited")
            message = service._validation_error_message(error, config)
            self.assertIn("OpenRouter returned a rate limit or quota error", message)
            self.assertNotIn("sk-test", message)
        finally:
            db.close()

    def test_failed_update_does_not_overwrite_existing_config(self) -> None:
        db = Database.memory()
        service = ScanService(db)
        try:
            with (
                patch("skill_manager.application.scan.service.ProviderConfig", _FakeProviderConfig),
                patch.object(ScanService, "_run_validation_request", return_value="OK"),
            ):
                config_id = service.save_config_validated(_config())

            with (
                patch("skill_manager.application.scan.service.ProviderConfig", _FakeProviderConfig),
                patch.object(ScanService, "_run_validation_request", side_effect=RuntimeError("401 invalid API key sk-bad")),
            ):
                with self.assertRaises(MutationError):
                    service.save_config_validated(_config(id=config_id, api_key="sk-bad", model="bad-model"))

            saved = service.get_config_by_id(config_id)
            self.assertIsNotNone(saved)
            assert saved is not None
            self.assertEqual(saved.api_key, "sk-test")
            self.assertEqual(saved.model, "doubao-test")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
