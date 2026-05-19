from __future__ import annotations

import asyncio
import json
import logging
import os
import warnings
from pathlib import Path
from typing import Any

from .provider import ProviderConfig

logger = logging.getLogger(__name__)

acompletion: Any
try:
    from litellm import acompletion as _acompletion

    acompletion = _acompletion
    LITELLM_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    LITELLM_AVAILABLE = False
    acompletion = None

genai: Any
try:
    from google import genai as _genai

    genai = _genai
    GOOGLE_GENAI_AVAILABLE = True
except (ImportError, ModuleNotFoundError):
    GOOGLE_GENAI_AVAILABLE = False
    genai = None

warnings.filterwarnings("ignore", message=".*Pydantic serializer warnings.*")
warnings.filterwarnings("ignore", message=".*Expected `Message`.*")
warnings.filterwarnings("ignore", message=".*Expected `StreamingChoices`.*")
warnings.filterwarnings("ignore", message=".*close_litellm_async_clients.*")
warnings.filterwarnings("ignore", message=".*async_success_handler.*was never awaited.*")
warnings.filterwarnings("ignore", message=".*Enable tracemalloc.*")


class LLMRequestHandler:
    def __init__(
        self,
        provider_config: ProviderConfig,
        max_tokens: int = 8192,
        temperature: float = 0.0,
        max_retries: int = 3,
        rate_limit_delay: float = 2.0,
        timeout: int = 120,
    ) -> None:
        self.provider_config = provider_config
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.max_retries = max_retries
        self.rate_limit_delay = rate_limit_delay
        self.timeout = timeout

        self.response_schema = self._load_response_schema()
        self._use_plain_json_output = self._env_flag_enabled("SKILL_SCANNER_LLM_FORCE_JSON_OBJECT")

    def _env_flag_enabled(self, env_name: str) -> bool:
        raw_value = os.getenv(env_name, "")
        return raw_value.strip().lower() in {"1", "true", "yes", "on"}

    def _load_response_schema(self) -> dict[str, Any] | None:
        try:
            schema_path = Path(__file__).parent.parent.parent.parent / "data" / "prompts" / "llm_response_schema.json"
            if schema_path.exists():
                loaded: dict[str, Any] = json.loads(schema_path.read_text(encoding="utf-8"))
                try:
                    from ..models import VALID_AITECH_CODES

                    aitech_codes = sorted(VALID_AITECH_CODES)
                    loaded["properties"]["findings"]["items"]["properties"]["aitech"]["enum"] = aitech_codes
                except Exception as e:
                    logger.warning("Could not inject runtime AITech enum into schema: %s", e)
                return loaded
        except Exception as e:
            logger.warning("Could not load response schema: %s", e)
        return None

    def _sanitize_schema_for_google(self, schema: dict[str, Any]) -> dict[str, Any]:
        sanitized: dict[str, Any] = {}
        for key, value in schema.items():
            if key == "additionalProperties":
                continue
            elif key == "type" and isinstance(value, list):
                types = list(value)
                has_null = "null" in types
                if has_null:
                    types.remove("null")
                if len(types) == 0:
                    raise NotImplementedError(f"Google GenAI SDK does not support null-only types: {value!r}")
                if len(types) > 1:
                    raise NotImplementedError(f"Google GenAI SDK does not support multi-type unions: {value!r}")
                sanitized["type"] = types[0].upper()
                if has_null:
                    sanitized["nullable"] = True
            elif key == "type" and isinstance(value, str):
                if value == "null":
                    raise NotImplementedError("Google GenAI SDK does not support null-only types")
                sanitized["type"] = value.upper()
            elif isinstance(value, dict):
                sanitized[key] = self._sanitize_schema_for_google(value)
            elif isinstance(value, list):
                sanitized[key] = [
                    self._sanitize_schema_for_google(item) if isinstance(item, dict) else item for item in value
                ]
            else:
                sanitized[key] = value
        return sanitized

    def _should_use_json_object(self) -> bool:
        if self._use_plain_json_output:
            return True
        model_lower = self.provider_config.model.lower()
        unsupported_json_schema_providers = ["deepseek"]
        return any(name in model_lower for name in unsupported_json_schema_providers)

    def _build_response_format(self) -> dict[str, Any] | None:
        if not self.response_schema:
            return None
        # Anthropic-compatible proxies often don't support structured output —
        # rely on the prompt instructions to produce valid JSON instead.
        if getattr(self.provider_config, "is_anthropic_proxy", False):
            return None
        if self._should_use_json_object():
            return {"type": "json_object"}
        return {
            "type": "json_schema",
            "json_schema": {
                "name": "security_analysis_response",
                "schema": self.response_schema,
                "strict": True,
            },
        }

    def _should_fallback_to_json_object(self, error: Exception, response_format: dict[str, Any] | None) -> bool:
        if not response_format or response_format.get("type") != "json_schema":
            return False
        error_msg = str(error).lower()
        if "response_format.json_schema" in error_msg:
            return True
        if "json_schema" in error_msg and any(
            phrase in error_msg
            for phrase in ["missing required parameter", "unsupported", "not supported", "invalid", "unknown parameter"]
        ):
            return True
        return False

    async def make_request(self, messages: list[dict[str, str]], context: str = "") -> str:
        if self.provider_config.use_google_sdk:
            prompt_parts = []
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "system":
                    prompt_parts.append(f"System Instructions:\n{content}\n")
                elif role == "user":
                    prompt_parts.append(f"User Request:\n{content}\n")
            combined_prompt = "\n".join(prompt_parts).strip()
            return await self._make_google_sdk_request(combined_prompt)
        else:
            return await self._make_litellm_request(messages, context)

    async def _make_litellm_request(self, messages: list[dict[str, str]], context: str) -> str:
        last_exception: Exception | None = None

        # Enable Anthropic prompt caching for system message if applicable
        cached_messages = messages
        if messages and messages[0].get("role") == "system" and self.provider_config.model.startswith("anthropic/"):
            cached_messages = [
                {"role": "system", "content": [{"type": "text", "text": messages[0]["content"], "cache_control": {"type": "ephemeral"}}]},
                *messages[1:],
            ]

        for attempt in range(self.max_retries + 1):
            try:
                request_params = {
                    "model": self.provider_config.model,
                    "messages": cached_messages,
                    "max_tokens": self.max_tokens,
                    "temperature": self.temperature,
                    "timeout": self.timeout,
                    **self.provider_config.get_request_params(),
                }

                response_format = self._build_response_format()
                if response_format:
                    request_params["response_format"] = response_format

                response = await acompletion(**request_params, drop_params=True)
                content: str = response.choices[0].message.content or ""
                return content

            except Exception as e:
                response_format = request_params.get("response_format")
                if self._should_fallback_to_json_object(e, response_format):
                    logger.warning("Structured output rejected for %s, retrying with plain JSON output", context)
                    self._use_plain_json_output = True
                    retry_params = dict(request_params)
                    retry_params["response_format"] = {"type": "json_object"}
                    response = await acompletion(**retry_params, drop_params=True)
                    content: str = response.choices[0].message.content or ""
                    return content

                last_exception = e
                error_msg = str(e).lower()

                if any(keyword in error_msg for keyword in ["rate limit", "quota", "too many requests", "429", "throttling"]):
                    if attempt < self.max_retries:
                        delay = (2 ** attempt) * self.rate_limit_delay
                        logger.warning("Rate limit hit for %s, retrying in %ss (attempt %d/%d)", context, delay, attempt + 1, self.max_retries + 1)
                        await asyncio.sleep(delay)
                        continue

                logger.error("LLM API error for %s: %s", context, e)
                break

        if last_exception is not None:
            raise last_exception
        raise RuntimeError("All retries exhausted")

    async def _make_google_sdk_request(self, prompt: str) -> str:
        last_exception: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                client = genai.Client(api_key=self.provider_config.api_key)

                config_dict: dict[str, Any] = {
                    "max_output_tokens": self.max_tokens,
                    "temperature": self.temperature,
                }

                if self.response_schema:
                    config_dict["response_mime_type"] = "application/json"
                    sanitized_schema = self._sanitize_schema_for_google(self.response_schema)
                    config_dict["response_schema"] = sanitized_schema

                loop = asyncio.get_event_loop()

                def generate():
                    return client.models.generate_content(
                        model=self.provider_config.model,
                        contents=prompt,
                        config=config_dict,
                    )

                response = await loop.run_in_executor(None, generate)

                if hasattr(response, "text") and response.text:
                    text_val: str = response.text
                    return text_val
                elif hasattr(response, "candidates") and response.candidates:
                    candidate = response.candidates[0]
                    if hasattr(candidate, "content") and candidate.content:
                        parts = candidate.content.parts if hasattr(candidate.content, "parts") else []
                        if parts and hasattr(parts[0], "text"):
                            part_text: str = parts[0].text
                            return part_text
                elif hasattr(response, "content"):
                    return str(response.content)
                else:
                    return str(response)

            except Exception as e:
                last_exception = e
                error_msg = str(e).lower()

                if "quota" in error_msg or "rate limit" in error_msg or "429" in error_msg:
                    if attempt < self.max_retries:
                        wait_time = self.rate_limit_delay * (2 ** attempt)
                        await asyncio.sleep(wait_time)
                        continue

                logger.error("LLM analysis failed: %s", e)
                raise

        if last_exception is not None:
            raise last_exception
        raise RuntimeError("All retries exhausted")
