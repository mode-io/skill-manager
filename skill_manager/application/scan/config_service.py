from __future__ import annotations

import asyncio
import concurrent.futures
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
from urllib.parse import urlparse

from skill_manager.db.repositories import LLMScanConfigRow, ScanConfigRepository
from skill_manager.errors import MutationError

from .llm.provider import ProviderConfig
from .llm.request_handler import LLMRequestHandler

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LLMConfigValidationResult:
    ok: bool
    message: str
    provider: str | None = None
    model: str | None = None
    duration_ms: int | None = None
    error_code: str | None = None


class ScanConfigService:
    def __init__(self, repository: ScanConfigRepository | None = None) -> None:
        self.repository = repository

    def list_configs(self) -> list[LLMScanConfigRow]:
        if self.repository is None:
            return []
        return self.repository.list_all()

    def get_active_config(self) -> LLMScanConfigRow | None:
        if self.repository is None:
            return None
        return self.repository.get_active()

    def get_config_by_id(self, config_id: int) -> LLMScanConfigRow | None:
        if self.repository is None:
            return None
        return self.repository.get_by_id(config_id)

    def save_config(self, config: LLMScanConfigRow) -> int:
        if self.repository is None:
            raise RuntimeError("No database available")
        config_id = self.repository.save(config)
        logger.info("LLM scan config saved: id=%d name=%s", config_id, config.name)
        return config_id

    def save_config_validated(self, config: LLMScanConfigRow) -> int:
        validated = self._validated_config(config)
        return self.save_config(validated)

    def delete_config(self, config_id: int) -> None:
        if self.repository is None:
            raise RuntimeError("No database available")
        self.repository.delete(config_id)
        logger.info("LLM scan config deleted: id=%d", config_id)

    def set_active_config(self, config_id: int) -> None:
        if self.repository is None:
            raise RuntimeError("No database available")
        self.repository.set_active(config_id)
        logger.info("LLM scan config set active: id=%d", config_id)

    def validate_config(self, config: LLMScanConfigRow) -> LLMConfigValidationResult:
        missing = self._missing_config_fields(config)
        if missing:
            field_list = ", ".join(missing)
            return LLMConfigValidationResult(
                ok=False,
                message=f"Missing required LLM config field(s): {field_list}.",
                provider=self.infer_provider(config.provider, config.base_url, config.model),
                model=config.model or None,
                error_code="missing_required_field",
            )

        provider = self.infer_provider(config.provider, config.base_url, config.model)
        started = datetime.now(timezone.utc)
        try:
            provider_config = ProviderConfig(
                model=config.model,
                api_key=config.api_key,
                base_url=config.base_url,
                api_version=config.api_version or None,
                provider=provider,
                aws_region=config.aws_region or None,
                aws_profile=config.aws_profile or None,
                aws_session_token=config.aws_session_token or None,
            )
            provider_config.validate()
            response = self._run_validation_request(provider_config)
            if not response.strip():
                return LLMConfigValidationResult(
                    ok=False,
                    message="LLM provider returned an empty response during connectivity test.",
                    provider=provider,
                    model=provider_config.model,
                    duration_ms=self._elapsed_ms(started),
                    error_code="empty_response",
                )
            return LLMConfigValidationResult(
                ok=True,
                message="Connectivity test passed.",
                provider=provider,
                model=provider_config.model,
                duration_ms=self._elapsed_ms(started),
            )
        except Exception as error:
            return LLMConfigValidationResult(
                ok=False,
                message=self._validation_error_message(error, config),
                provider=provider,
                model=config.model,
                duration_ms=self._elapsed_ms(started),
                error_code=self._validation_error_code(error),
            )

    def _validated_config(self, config: LLMScanConfigRow) -> LLMScanConfigRow:
        result = self.validate_config(config)
        if not result.ok:
            raise MutationError(result.message, status=400)
        return self._copy_config(
            config,
            provider=result.provider or config.provider,
            last_validated_at=self._now_utc(),
            last_validation_error="",
        )

    def _run_validation_request(self, provider_config: ProviderConfig) -> str:
        async def validate_async() -> str:
            handler = LLMRequestHandler(
                provider_config=provider_config,
                max_tokens=8,
                temperature=0.0,
                max_retries=0,
                rate_limit_delay=0.0,
                timeout=20,
            )
            handler.response_schema = None
            return await handler.make_request(
                [{"role": "user", "content": "Reply with exactly OK."}],
                context="LLM config connectivity validation",
            )

        try:
            asyncio.get_running_loop()
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                return pool.submit(asyncio.run, validate_async()).result()
        except RuntimeError:
            return asyncio.run(validate_async())

    @staticmethod
    def _missing_config_fields(config: LLMScanConfigRow) -> list[str]:
        missing: list[str] = []
        if not config.name.strip():
            missing.append("name")
        if not config.base_url.strip():
            missing.append("baseUrl")
        if not config.api_key.strip():
            missing.append("apiKey")
        if not config.model.strip():
            missing.append("model")
        return missing

    @classmethod
    def infer_provider(cls, provider: str | None, base_url: str | None, model: str | None) -> str:
        normalized = (provider or "").strip().lower().replace("_", "-")
        if normalized:
            if normalized == "custom-openai":
                return "openai-compatible"
            return normalized
        host = cls._host(base_url)
        if host:
            if host == "api.anthropic.com" or host.endswith(".api.anthropic.com"):
                return "anthropic"
            if host == "api.openai.com" or host.endswith(".api.openai.com"):
                return "openai"
            if host == "openrouter.ai" or host.endswith(".openrouter.ai"):
                return "openrouter"
            return "openai-compatible"
        lower_model = (model or "").strip().lower()
        if lower_model.startswith("anthropic/") or "claude" in lower_model:
            return "anthropic"
        if lower_model.startswith("openai/") or "gpt" in lower_model:
            return "openai"
        if "gemini" in lower_model:
            return "google"
        if lower_model.startswith("azure/"):
            return "azure"
        if lower_model.startswith("bedrock/"):
            return "bedrock"
        if lower_model.startswith("ollama/"):
            return "ollama"
        return "openai-compatible"

    @staticmethod
    def _host(base_url: str | None) -> str:
        if not base_url:
            return ""
        try:
            parsed = urlparse(base_url)
            return (parsed.hostname or "").lower()
        except Exception:
            return ""

    @staticmethod
    def _elapsed_ms(started: datetime) -> int:
        return int((datetime.now(timezone.utc) - started).total_seconds() * 1000)

    @staticmethod
    def _now_utc() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

    @classmethod
    def _validation_error_message(cls, error: Exception, config: LLMScanConfigRow) -> str:
        code = cls._validation_error_code(error)
        provider = cls.infer_provider(config.provider, config.base_url, config.model)
        if code == "rate_limited" and provider == "openrouter":
            return (
                "Connectivity test failed: OpenRouter returned a rate limit or quota error. "
                "Free models can be temporarily unavailable; retry later or use a different model/key."
            )
        if code == "rate_limited":
            return "Connectivity test failed: provider rate limit or quota was reached. Retry later or use a different model/key."
        return f"Connectivity test failed: {cls._sanitize_error(str(error), config)}"

    @staticmethod
    def _sanitize_error(message: str, config: LLMScanConfigRow) -> str:
        sanitized = message
        secrets = [config.api_key, config.aws_session_token]
        for secret in secrets:
            if secret:
                sanitized = sanitized.replace(secret, "[redacted]")
        return sanitized[:500]

    @staticmethod
    def _validation_error_code(error: Exception) -> str:
        text = str(error).lower()
        if any(marker in text for marker in ["401", "unauthorized", "invalid api key", "authentication"]):
            return "auth_failed"
        if any(marker in text for marker in ["404", "model_not_found", "model not found", "deploymentnotfound"]):
            return "model_not_found"
        if any(marker in text for marker in ["timed out", "timeout", "connection", "dns", "name or service not known"]):
            return "endpoint_unreachable"
        if any(marker in text for marker in ["rate limit", "ratelimit", "too many requests", "429", "quota"]):
            return "rate_limited"
        if any(marker in text for marker in ["required", "install with", "not installed", "no module named"]):
            return "provider_dependency_missing"
        return "provider_error"

    @staticmethod
    def _copy_config(config: LLMScanConfigRow, **updates) -> LLMScanConfigRow:
        values = {
            "id": config.id,
            "name": config.name,
            "base_url": config.base_url,
            "api_key": config.api_key,
            "model": config.model,
            "provider": config.provider,
            "api_version": config.api_version,
            "aws_region": config.aws_region,
            "aws_profile": config.aws_profile,
            "aws_session_token": config.aws_session_token,
            "max_tokens": config.max_tokens,
            "consensus_runs": config.consensus_runs,
            "is_active": config.is_active,
            "last_validated_at": config.last_validated_at,
            "last_validation_error": config.last_validation_error,
        }
        values.update(updates)
        return LLMScanConfigRow(**values)
