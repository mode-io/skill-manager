from __future__ import annotations

import importlib.util
import logging
import os

logger = logging.getLogger(__name__)

try:
    GOOGLE_GENAI_AVAILABLE = importlib.util.find_spec("google.genai") is not None
except (ImportError, ModuleNotFoundError):
    GOOGLE_GENAI_AVAILABLE = False

try:
    LITELLM_AVAILABLE = importlib.util.find_spec("litellm") is not None
except (ImportError, ModuleNotFoundError):
    LITELLM_AVAILABLE = False

try:
    from azure.identity import DefaultAzureCredential

    AZURE_IDENTITY_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    DefaultAzureCredential = None  # type: ignore[misc,assignment]
    AZURE_IDENTITY_AVAILABLE = False


class ProviderConfig:
    def __init__(
        self,
        model: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        api_version: str | None = None,
        provider: str | None = None,
        aws_region: str | None = None,
        aws_profile: str | None = None,
        aws_session_token: str | None = None,
    ) -> None:
        self.base_url = (
            base_url
            or os.getenv("SKILL_SCANNER_LLM_BASE_URL")
            or os.getenv("ANTHROPIC_BASE_URL")
            or os.getenv("OPENAI_BASE_URL")
            or os.getenv("AZURE_OPENAI_ENDPOINT")
            or os.getenv("OLLAMA_HOST")
        )
        self.api_version = api_version or os.getenv("AZURE_OPENAI_API_VERSION")
        self.provider = self._normalize_provider(provider or os.getenv("SKILL_SCANNER_LLM_PROVIDER"))
        self.aws_region = aws_region or os.getenv("AWS_REGION", "us-east-1")
        self.aws_profile = aws_profile or os.getenv("AWS_PROFILE")
        self.aws_session_token = aws_session_token or os.getenv("AWS_SESSION_TOKEN")

        # Resolve model
        resolved_model = (
            model
            or os.getenv("SKILL_SCANNER_LLM_MODEL")
            or os.getenv("ANTHROPIC_MODEL")
            or os.getenv("OPENAI_MODEL")
            or os.getenv("OPENROUTER_MODEL")
            or os.getenv("GEMINI_MODEL")
            or os.getenv("AZURE_OPENAI_MODEL")
            or os.getenv("AZURE_OPENAI_DEPLOYMENT")
            or os.getenv("AWS_BEDROCK_MODEL")
            or os.getenv("OLLAMA_MODEL")
            or "anthropic/claude-3-5-sonnet-20241022"
        )

        self.is_openai_compatible = self.provider in {"openai", "openai-compatible", "custom-openai"}

        model_lower = resolved_model.lower()
        self.is_openrouter = not self.is_openai_compatible and (
            self.provider == "openrouter"
            or model_lower.startswith("openrouter/")
            or bool(self.base_url and self._is_openrouter_base_url(self.base_url))
        )
        self.is_bedrock = not self.is_openai_compatible and (self.provider == "bedrock" or "bedrock/" in resolved_model or model_lower.startswith("bedrock/"))
        self.is_gemini = not self.is_openai_compatible and (self.provider in {"google", "gemini"} or "gemini" in model_lower or model_lower.startswith("gemini/"))
        self.is_azure = not self.is_openai_compatible and (self.provider == "azure" or model_lower.startswith("azure/") or "azure" in model_lower)
        self.is_vertex = not self.is_openai_compatible and (model_lower.startswith("vertex_ai/") or "vertex" in model_lower)
        self.is_ollama = not self.is_openai_compatible and (self.provider == "ollama" or model_lower.startswith("ollama/"))

        self.use_google_sdk = False
        self.is_anthropic_proxy = False

        if self.is_openai_compatible:
            if not LITELLM_AVAILABLE:
                raise ImportError("LiteLLM is required for OpenAI-compatible providers. Install with: pip install litellm")
            self.model = self._normalize_openai_compatible_model_name(resolved_model)
        elif self.is_azure:
            if not LITELLM_AVAILABLE:
                raise ImportError("LiteLLM is required for Azure OpenAI. Install with: pip install litellm")
            self.model = resolved_model if resolved_model.lower().startswith("azure/") else f"azure/{resolved_model}"
        elif self.is_bedrock:
            if not LITELLM_AVAILABLE:
                raise ImportError("LiteLLM is required for AWS Bedrock. Install with: pip install litellm")
            self.model = resolved_model if resolved_model.lower().startswith("bedrock/") else f"bedrock/{resolved_model}"
        elif self.is_ollama:
            if not LITELLM_AVAILABLE:
                raise ImportError("LiteLLM is required for Ollama. Install with: pip install litellm")
            self.model = resolved_model if resolved_model.lower().startswith("ollama/") else f"ollama/{resolved_model}"
        elif self.is_vertex:
            if not LITELLM_AVAILABLE:
                raise ImportError("LiteLLM is required for Vertex AI. Install with: pip install litellm")
            self.model = resolved_model
        elif self.is_openrouter:
            if not LITELLM_AVAILABLE:
                raise ImportError("LiteLLM is required for OpenRouter. Install with: pip install litellm")
            self.model = self._normalize_openrouter_model_name(resolved_model)
        elif self.is_gemini and GOOGLE_GENAI_AVAILABLE:
            self.use_google_sdk = True
            self.model = self._normalize_gemini_model_name(resolved_model)
        elif self.is_gemini and LITELLM_AVAILABLE:
            if not resolved_model.startswith("gemini/"):
                model_name = resolved_model.replace("gemini-", "").replace("gemini/", "")
                self.model = f"gemini/{model_name}"
            else:
                self.model = resolved_model
        elif self.is_gemini:
            raise ImportError(
                "For Gemini models, either LiteLLM or google-genai is required. "
                "Install with: pip install litellm or pip install google-genai"
            )
        elif not LITELLM_AVAILABLE:
            raise ImportError("LiteLLM is required for enhanced LLM analyzer. Install with: pip install litellm")
        else:
            if "/" not in resolved_model:
                # Model name has no litellm provider prefix — add one based on available credentials
                if self.base_url and self._is_anthropic_official_base_url(self.base_url):
                    # Official Anthropic API — use Anthropic SDK with structured output
                    self.model = f"anthropic/{resolved_model}"
                elif self.base_url and "anthropic" in self.base_url.lower():
                    # Anthropic-compatible proxy (e.g. ModelArts MaaS) — use Anthropic
                    # SDK but disable structured output (proxies often don't support it)
                    self.model = f"anthropic/{resolved_model}"
                    self.is_anthropic_proxy = True
                elif self.base_url:
                    # Custom base URL — use OpenAI-compatible
                    self.model = f"openai/{resolved_model}"
                    self.is_openai_compatible = True
                elif os.getenv("ANTHROPIC_AUTH_TOKEN") or os.getenv("ANTHROPIC_API_KEY"):
                    # No custom base_url — assume official Anthropic API
                    self.model = f"anthropic/{resolved_model}"
                elif os.getenv("OPENAI_API_KEY"):
                    self.model = f"openai/{resolved_model}"
                else:
                    self.model = resolved_model
            else:
                self.model = resolved_model

        self._using_entra_id = False
        self.api_key = self._resolve_api_key(api_key)

    def _normalize_provider(self, provider: str | None) -> str | None:
        if provider is None:
            return None
        normalized = provider.strip().lower().replace("_", "-")
        if normalized in {"custom-openai", "openai-compatible"}:
            return normalized
        return normalized

    @staticmethod
    def _is_anthropic_official_base_url(base_url: str) -> bool:
        """Check if base_url points to the official Anthropic API.

        Only ``api.anthropic.com`` (and subdomains) uses the native
        Anthropic Messages API.  All other endpoints — even if they
        contain "anthropic" in the path — are OpenAI-compatible
        proxies and must use the ``openai/`` litellm prefix.
        """
        from urllib.parse import urlparse
        try:
            host = urlparse(base_url).hostname or ""
            return host == "api.anthropic.com" or host.endswith(".api.anthropic.com")
        except Exception:
            return False

    @staticmethod
    def _is_openrouter_base_url(base_url: str) -> bool:
        from urllib.parse import urlparse
        try:
            host = urlparse(base_url).hostname or ""
            return host == "openrouter.ai" or host.endswith(".openrouter.ai")
        except Exception:
            return False

    def _normalize_openai_compatible_model_name(self, model: str) -> str:
        if model.lower().startswith("openai/"):
            return model
        return f"openai/{model}"

    def _normalize_openrouter_model_name(self, model: str) -> str:
        model_lower = model.lower()
        if model_lower.startswith("openrouter/"):
            return model
        if model_lower.startswith("openai/"):
            return f"openrouter/{model.split('/', 1)[1]}"
        return f"openrouter/{model}"

    def _normalize_gemini_model_name(self, model: str) -> str:
        model_name = model.replace("gemini/", "")
        model_name = model_name.replace("models/", "")

        model_mapping = {
            "gemini-1.5-pro": "gemini-pro-latest",
            "gemini-1.5-flash": "gemini-flash-latest",
        }
        if model_name in model_mapping:
            model_name = model_mapping[model_name]

        if not model_name.startswith("gemini-"):
            model_name = f"gemini-{model_name}"

        if not model_name.startswith("models/"):
            model_name = f"models/{model_name}"

        return model_name

    def _resolve_api_key(self, api_key: str | None) -> str | None:
        if api_key is not None:
            return api_key

        if self.is_vertex:
            return os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        elif self.is_ollama:
            return None

        env_key = os.getenv("SKILL_SCANNER_LLM_API_KEY")
        if env_key:
            return env_key

        if self.is_azure:
            token = self._try_azure_entra_id_token()
            if token:
                return token

        return (
            os.getenv("ANTHROPIC_AUTH_TOKEN")
            or os.getenv("ANTHROPIC_API_KEY")
            or os.getenv("OPENAI_API_KEY")
            or os.getenv("OPENROUTER_API_KEY")
            or os.getenv("GEMINI_API_KEY")
            or os.getenv("GOOGLE_API_KEY")
            or os.getenv("AZURE_OPENAI_API_KEY")
        )

    def _try_azure_entra_id_token(self) -> str | None:
        if not AZURE_IDENTITY_AVAILABLE or DefaultAzureCredential is None:
            logger.debug(
                "Azure model detected but azure-identity is not installed. "
                "Install with: pip install skill-scanner[azure]"
            )
            return None
        try:
            credential = DefaultAzureCredential()
            token = credential.get_token("https://cognitiveservices.azure.com/.default")
            logger.info("Acquired Azure OpenAI token via Entra ID (DefaultAzureCredential)")
            self._using_entra_id = True
            return token.token
        except Exception as e:
            logger.debug("Entra ID token acquisition failed: %s", e)
            return None

    def validate(self) -> None:
        if not self.is_bedrock and not self.is_ollama and not self.api_key:
            if self.is_azure:
                raise ValueError(
                    f"No API key or Entra ID credentials found for Azure model {self.model}. "
                    "Set SKILL_SCANNER_LLM_API_KEY, run 'az login', or install "
                    "skill-scanner[azure] for Entra ID support."
                )
            raise ValueError(f"API key required for model {self.model}. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.")

    def get_request_params(self) -> dict:
        params: dict = {}
        if self.api_key:
            if self.is_gemini:
                if not os.getenv("GEMINI_API_KEY"):
                    os.environ["GEMINI_API_KEY"] = self.api_key
            elif self.is_azure and self._using_entra_id:
                params["azure_ad_token"] = self.api_key
            else:
                params["api_key"] = self.api_key

        if self.base_url:
            params["api_base"] = self.base_url
        if self.api_version:
            params["api_version"] = self.api_version

        if self.is_bedrock:
            if self.aws_region:
                params["aws_region_name"] = self.aws_region
            if self.aws_session_token:
                params["aws_session_token"] = self.aws_session_token
            if self.aws_profile:
                params["aws_profile_name"] = self.aws_profile

        return params

    @staticmethod
    def from_env() -> ProviderConfig:
        return ProviderConfig()
