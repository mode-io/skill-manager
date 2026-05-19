from __future__ import annotations

import os
from dataclasses import dataclass, field


@dataclass
class DetectedProvider:
    provider: str
    api_key_source: str
    model: str | None = None
    base_url: str | None = None
    is_available: bool = False


@dataclass
class LLMDetectionResult:
    providers: list[DetectedProvider] = field(default_factory=list)
    default_model: str | None = None
    default_provider: str | None = None
    has_any_available: bool = False


class LLMDetector:
    @staticmethod
    def detect() -> LLMDetectionResult:
        providers: list[DetectedProvider] = []

        # 1. Skill Scanner 显式配置（最高优先级）
        scanner_key = os.getenv("SKILL_SCANNER_LLM_API_KEY")
        scanner_model = os.getenv("SKILL_SCANNER_LLM_MODEL")
        scanner_base_url = os.getenv("SKILL_SCANNER_LLM_BASE_URL")
        scanner_provider = os.getenv("SKILL_SCANNER_LLM_PROVIDER")

        if scanner_key or scanner_model:
            provider_name = scanner_provider or _infer_provider_from_model(scanner_model)
            providers.append(DetectedProvider(
                provider=provider_name or "custom",
                api_key_source="SKILL_SCANNER_LLM_API_KEY" if scanner_key else "SKILL_SCANNER_LLM_MODEL",
                model=scanner_model,
                base_url=scanner_base_url,
                is_available=bool(scanner_key),
            ))

        # 2. Anthropic
        anthropic_key = os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY")
        anthropic_model = os.getenv("ANTHROPIC_MODEL")
        if anthropic_key:
            key_source = "ANTHROPIC_AUTH_TOKEN" if os.getenv("ANTHROPIC_AUTH_TOKEN") else "ANTHROPIC_API_KEY"
            providers.append(DetectedProvider(
                provider="anthropic",
                api_key_source=key_source,
                model=anthropic_model,
                base_url=os.getenv("ANTHROPIC_BASE_URL"),
                is_available=True,
            ))

        # 3. OpenAI
        openai_key = os.getenv("OPENAI_API_KEY")
        openai_model = os.getenv("OPENAI_MODEL")
        if openai_key:
            providers.append(DetectedProvider(
                provider="openai",
                api_key_source="OPENAI_API_KEY",
                model=openai_model,
                base_url=os.getenv("OPENAI_BASE_URL"),
                is_available=True,
            ))

        # 4. Google/Gemini
        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        gemini_model = os.getenv("GEMINI_MODEL")
        if gemini_key:
            key_source = "GEMINI_API_KEY" if os.getenv("GEMINI_API_KEY") else "GOOGLE_API_KEY"
            providers.append(DetectedProvider(
                provider="google",
                api_key_source=key_source,
                model=gemini_model,
                base_url=None,
                is_available=True,
            ))

        # 5. Azure OpenAI
        azure_key = os.getenv("AZURE_OPENAI_API_KEY")
        azure_model = os.getenv("AZURE_OPENAI_MODEL") or os.getenv("AZURE_OPENAI_DEPLOYMENT")
        azure_base_url = os.getenv("AZURE_OPENAI_ENDPOINT")
        if azure_key:
            providers.append(DetectedProvider(
                provider="azure",
                api_key_source="AZURE_OPENAI_API_KEY",
                model=azure_model,
                base_url=azure_base_url,
                is_available=bool(azure_base_url),
            ))

        # 6. AWS Bedrock
        aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        aws_region = os.getenv("AWS_REGION", "us-east-1")
        if aws_access_key and aws_secret_key:
            providers.append(DetectedProvider(
                provider="bedrock",
                api_key_source="AWS_ACCESS_KEY_ID",
                model=os.getenv("AWS_BEDROCK_MODEL"),
                base_url=None,
                is_available=True,
            ))

        # 7. Ollama（无需 API key）
        ollama_host = os.getenv("OLLAMA_HOST")
        ollama_model = os.getenv("OLLAMA_MODEL")
        if ollama_host:
            providers.append(DetectedProvider(
                provider="ollama",
                api_key_source="OLLAMA_HOST",
                model=ollama_model,
                base_url=ollama_host,
                is_available=True,
            ))

        # 确定默认模型和提供商
        default_model = _resolve_default_model(providers, scanner_model)
        default_provider = _resolve_default_provider(providers, scanner_provider)
        has_any = any(p.is_available for p in providers)

        return LLMDetectionResult(
            providers=providers,
            default_model=default_model,
            default_provider=default_provider,
            has_any_available=has_any,
        )


def _infer_provider_from_model(model: str | None) -> str | None:
    if not model:
        return None
    lower = model.lower()
    if lower.startswith("anthropic/") or "claude" in lower:
        return "anthropic"
    if lower.startswith("openai/") or "gpt" in lower:
        return "openai"
    if "gemini" in lower:
        return "google"
    if lower.startswith("azure/"):
        return "azure"
    if lower.startswith("bedrock/"):
        return "bedrock"
    if lower.startswith("ollama/"):
        return "ollama"
    return None


def _resolve_default_model(providers: list[DetectedProvider], scanner_model: str | None) -> str | None:
    if scanner_model:
        return scanner_model
    for p in providers:
        if p.is_available and p.model:
            return p.model
    return None


def _resolve_default_provider(providers: list[DetectedProvider], scanner_provider: str | None) -> str | None:
    if scanner_provider:
        return scanner_provider
    for p in providers:
        if p.is_available:
            return p.provider
    return None
