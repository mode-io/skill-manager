from __future__ import annotations

import logging
import os
from pathlib import Path

from skill_manager.db.repositories import LLMScanConfigRow

from .config_service import ScanConfigService
from .context_builder import PromptContextBuilder
from .llm.analyzer import LLMAnalyzer
from .llm.detector import LLMDetector, LLMDetectionResult
from .llm.provider import ProviderConfig
from .models import Finding, ScanResult, Severity, ThreatCategory
from .target_resolver import ScanTargetResolver

logger = logging.getLogger(__name__)


class ScanService:
    def __init__(
        self,
        config_service: ScanConfigService | None = None,
        *,
        target_resolver: ScanTargetResolver | None = None,
        context_builder: PromptContextBuilder | None = None,
    ) -> None:
        self.config_service = config_service or ScanConfigService()
        self.target_resolver = target_resolver
        self.context_builder = context_builder or PromptContextBuilder()
        self._available = self._check_available()

    def _check_available(self) -> bool:
        try:
            ProviderConfig
            return True
        except ImportError:
            logger.info("LLM scan dependencies not installed")
            return False

    @property
    def available(self) -> bool:
        return self._available

    def detect_llm(self) -> LLMDetectionResult:
        return LLMDetector.detect()

    def scan_skill_ref(
        self,
        skill_ref: str,
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
    ) -> ScanResult | None:
        if self.target_resolver is None:
            raise RuntimeError("No scan target resolver available")
        skill_path = self.target_resolver.resolve_skill_path(skill_ref)
        if skill_path is None:
            return None
        return self.scan_skill_with_options(
            skill_path,
            use_llm=use_llm,
            llm_api_key=llm_api_key,
            llm_model=llm_model,
            llm_base_url=llm_base_url,
            llm_provider=llm_provider,
            llm_api_version=llm_api_version,
            llm_max_tokens=llm_max_tokens,
            llm_consensus_runs=llm_consensus_runs,
            aws_region=aws_region,
            aws_profile=aws_profile,
            aws_session_token=aws_session_token,
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

        active = self.config_service.get_active_config()
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
        llm_provider = ScanConfigService.infer_provider(
            llm_provider or os.getenv("SKILL_SCANNER_LLM_PROVIDER") or self._env_provider(),
            llm_base_url,
            llm_model,
        )
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
            context = self.context_builder.build(skill_path)
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
            return analyzer.analyze_context(context)
        except Exception as error:
            logger.error("LLM analyzer failed: %s", error)
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
                    description=str(error),
                    analyzer="llm_analyzer",
                )],
            )

    def list_configs(self) -> list[LLMScanConfigRow]:
        return self.config_service.list_configs()

    def get_active_config(self) -> LLMScanConfigRow | None:
        return self.config_service.get_active_config()

    def get_config_by_id(self, config_id: int) -> LLMScanConfigRow | None:
        return self.config_service.get_config_by_id(config_id)

    def save_config_validated(self, config: LLMScanConfigRow) -> int:
        return self.config_service.save_config_validated(config)

    def delete_config(self, config_id: int) -> None:
        self.config_service.delete_config(config_id)

    def set_active_config(self, config_id: int) -> None:
        self.config_service.set_active_config(config_id)

    def validate_config(self, config: LLMScanConfigRow):
        return self.config_service.validate_config(config)

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
