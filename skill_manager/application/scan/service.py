from __future__ import annotations

import asyncio
import concurrent.futures
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
from typing import TYPE_CHECKING
from urllib.parse import urlparse

from skill_manager.errors import MutationError

from .llm.provider import ProviderConfig
from .llm.request_handler import LLMRequestHandler
from .llm.analyzer import LLMAnalyzer
from .llm.detector import LLMDetector, LLMDetectionResult
from .models import Finding, ScanResult, Severity, ThreatCategory

if TYPE_CHECKING:
    from skill_manager.db import Database
    from skill_manager.db.dao.scan_config import LLMScanConfigRow

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LLMConfigValidationResult:
    ok: bool
    message: str
    provider: str | None = None
    model: str | None = None
    duration_ms: int | None = None
    error_code: str | None = None


class ScanService:
    def __init__(self, db: Database | None = None) -> None:
        self._db = db
        self._available = self._check_available()

    def _check_available(self) -> bool:
        try:
            from .llm.provider import ProviderConfig  # noqa: F401
            return True
        except ImportError:
            logger.info("LLM scan dependencies not installed")
            return False

    @property
    def available(self) -> bool:
        return self._available

    def _require_dao(self):
        if not self._db:
            raise RuntimeError("No database available")
        from skill_manager.db.dao.scan_config import ScanConfigDao
        return ScanConfigDao(), self._db

    def list_configs(self) -> list[LLMScanConfigRow]:
        if not self._db:
            return []
        from skill_manager.db.dao.scan_config import ScanConfigDao
        return ScanConfigDao().list_all(self._db)

    def get_active_config(self) -> LLMScanConfigRow | None:
        if not self._db:
            return None
        from skill_manager.db.dao.scan_config import ScanConfigDao
        return ScanConfigDao().get_active(self._db)

    def get_config_by_id(self, config_id: int) -> LLMScanConfigRow | None:
        if not self._db:
            return None
        from skill_manager.db.dao.scan_config import ScanConfigDao
        return ScanConfigDao().get_by_id(self._db, config_id)

    def save_config(self, config: LLMScanConfigRow) -> int:
        dao, db = self._require_dao()
        config_id = dao.save(db, config)
        logger.info("LLM scan config saved: id=%d name=%s", config_id, config.name)
        return config_id

    def save_config_validated(self, config: LLMScanConfigRow) -> int:
        validated = self._validated_config(config)
        return self.save_config(validated)

    def delete_config(self, config_id: int) -> None:
        dao, db = self._require_dao()
        dao.delete(db, config_id)
        logger.info("LLM scan config deleted: id=%d", config_id)

    def set_active_config(self, config_id: int) -> None:
        dao, db = self._require_dao()
        dao.set_active(db, config_id)
        logger.info("LLM scan config set active: id=%d", config_id)

    def detect_llm(self) -> LLMDetectionResult:
        return LLMDetector.detect()

    def validate_config(self, config: LLMScanConfigRow) -> LLMConfigValidationResult:
        missing = self._missing_config_fields(config)
        if missing:
            field_list = ", ".join(missing)
            return LLMConfigValidationResult(
                ok=False,
                message=f"Missing required LLM config field(s): {field_list}.",
                provider=self._infer_provider(config.provider, config.base_url, config.model),
                model=config.model or None,
                error_code="missing_required_field",
            )

        provider = self._infer_provider(config.provider, config.base_url, config.model)
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
        except Exception as e:
            return LLMConfigValidationResult(
                ok=False,
                message=self._validation_error_message(e, config),
                provider=provider,
                model=config.model,
                duration_ms=self._elapsed_ms(started),
                error_code=self._validation_error_code(e),
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

    def scan_skill(self, skill_path: Path) -> ScanResult:
        return self.scan_skill_with_options(skill_path)

    def scan_skill_with_options(
        self,
        skill_path: Path,
        *,
        use_llm: bool = True,
        llm_api_key: str | None = None,
        llm_model: str | None = None,
        llm_base_url: str | None = None,
        llm_provider: str | None = None,
        llm_api_version: str | None = None,
        llm_max_tokens: int = 8192,
        llm_consensus_runs: int = 1,
        aws_region: str | None = None,
        aws_profile: str | None = None,
        aws_session_token: str | None = None,
    ) -> ScanResult:
        if not use_llm:
            return ScanResult(skill_name=skill_path.name, is_safe=True, max_severity=Severity.SAFE)

        active = self.get_active_config()
        if active:
            llm_api_key = llm_api_key or active.api_key
            llm_model = llm_model or active.model
            llm_base_url = llm_base_url or active.base_url
            llm_provider = llm_provider or active.provider
            llm_api_version = llm_api_version or active.api_version
            llm_max_tokens = llm_max_tokens if llm_max_tokens != 8192 else active.max_tokens
            llm_consensus_runs = llm_consensus_runs if llm_consensus_runs != 1 else active.consensus_runs
            aws_region = aws_region or active.aws_region
            aws_profile = aws_profile or active.aws_profile
            aws_session_token = aws_session_token or active.aws_session_token

        llm_api_key = llm_api_key or self._env_api_key()
        llm_model = llm_model or self._env_model()
        llm_base_url = llm_base_url or self._env_base_url()
        llm_provider = self._infer_provider(llm_provider or os.getenv("SKILL_SCANNER_LLM_PROVIDER") or self._env_provider(), llm_base_url, llm_model)
        llm_api_version = llm_api_version or os.getenv("AZURE_OPENAI_API_VERSION")
        aws_region = aws_region or os.getenv("AWS_REGION")
        aws_profile = aws_profile or os.getenv("AWS_PROFILE")
        aws_session_token = aws_session_token or os.getenv("AWS_SESSION_TOKEN")

        if not llm_api_key and llm_provider not in {"bedrock", "ollama"}:
            logger.warning("LLM scan requested but no API key found")
            return ScanResult(
                skill_name=skill_path.name,
                is_safe=True,
                max_severity=Severity.INFO,
                findings=[Finding(
                    id="llm_no_api_key",
                    rule_id="LLM_NO_API_KEY",
                    category=ThreatCategory.POLICY_VIOLATION,
                    severity=Severity.INFO,
                    title="LLM scan skipped - no API key",
                    description="Set ANTHROPIC_API_KEY or OPENAI_API_KEY environment variable",
                    analyzer="llm_analyzer",
                )],
            )

        try:
            analyzer = LLMAnalyzer(
                model=llm_model,
                api_key=llm_api_key,
                base_url=llm_base_url,
                api_version=llm_api_version,
                provider=llm_provider,
                aws_region=aws_region,
                aws_profile=aws_profile,
                aws_session_token=aws_session_token,
                max_tokens=llm_max_tokens,
                consensus_runs=llm_consensus_runs,
            )
            logger.info("LLM analyzer enabled: model=%s, base_url=%s, provider=%s", llm_model, llm_base_url, llm_provider)
            return analyzer.analyze(skill_path)
        except Exception as e:
            logger.error("LLM analyzer failed: %s", e)
            return ScanResult(
                skill_name=skill_path.name,
                is_safe=True,
                max_severity=Severity.INFO,
                findings=[Finding(
                    id="llm_init_failed",
                    rule_id="LLM_INIT_FAILED",
                    category=ThreatCategory.POLICY_VIOLATION,
                    severity=Severity.INFO,
                    title="LLM analyzer initialization failed",
                    description=str(e),
                    analyzer="llm_analyzer",
                )],
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
    def _infer_provider(cls, provider: str | None, base_url: str | None, model: str | None) -> str:
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

    @staticmethod
    def _env_api_key() -> str | None:
        return (
            os.getenv("SKILL_SCANNER_LLM_API_KEY")
            or os.getenv("ANTHROPIC_AUTH_TOKEN")
            or os.getenv("ANTHROPIC_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or os.getenv("OPENROUTER_API_KEY")
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("AZURE_OPENAI_API_KEY")
        )

    @staticmethod
    def _env_model() -> str | None:
        return (
            os.getenv("SKILL_SCANNER_LLM_MODEL")
            or os.getenv("ANTHROPIC_MODEL")
            or os.getenv("OPENAI_MODEL")
            or os.getenv("OPENROUTER_MODEL")
            or os.getenv("GEMINI_MODEL")
            or os.getenv("AZURE_OPENAI_MODEL")
            or os.getenv("AZURE_OPENAI_DEPLOYMENT")
            or os.getenv("AWS_BEDROCK_MODEL")
            or os.getenv("OLLAMA_MODEL")
        )

    @staticmethod
    def _env_base_url() -> str | None:
        return (
            os.getenv("SKILL_SCANNER_LLM_BASE_URL")
            or os.getenv("ANTHROPIC_BASE_URL")
            or os.getenv("OPENAI_BASE_URL")
            or os.getenv("AZURE_OPENAI_ENDPOINT")
            or os.getenv("OLLAMA_HOST")
        )

    @staticmethod
    def _env_provider() -> str | None:
        if os.getenv("AZURE_OPENAI_ENDPOINT"):
            return "azure"
        if os.getenv("OLLAMA_HOST"):
            return "ollama"
        if os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"):
            return "google"
        if os.getenv("AWS_BEDROCK_MODEL"):
            return "bedrock"
        return None

    @classmethod
    def _validation_error_message(cls, error: Exception, config: LLMScanConfigRow) -> str:
        code = cls._validation_error_code(error)
        provider = cls._infer_provider(config.provider, config.base_url, config.model)
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
        from skill_manager.db.dao.scan_config import LLMScanConfigRow

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
