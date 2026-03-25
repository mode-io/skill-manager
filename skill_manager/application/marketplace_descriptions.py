from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, Protocol

from skill_manager.domain import parse_skill_manifest_text
from skill_manager.sources import GitHubManifestFetcher, fetch_agentskill_skill_md

DescriptionStatus = Literal["resolved", "fallback", "missing", "unavailable"]


@dataclass(frozen=True)
class MarketplaceDescription:
    description: str | None
    status: DescriptionStatus


class SourceManifestFetcher(Protocol):
    def fetch_manifest_text(self, source_locator: str) -> str | None:
        ...


class AgentSkillManifestFetcher:
    def fetch_manifest_text(self, source_locator: str) -> str | None:
        slug = source_locator.removeprefix("agentskill:")
        text = fetch_agentskill_skill_md(slug)
        return text or None


class MarketplaceDescriptionResolver:
    def __init__(
        self,
        *,
        github_fetcher: SourceManifestFetcher | None = None,
        agentskill_fetcher: SourceManifestFetcher | None = None,
    ) -> None:
        self._fetchers: dict[str, SourceManifestFetcher] = {
            "github": github_fetcher or GitHubManifestFetcher(),
            "agentskill": agentskill_fetcher or AgentSkillManifestFetcher(),
        }
        self._cache: dict[str, MarketplaceDescription] = {}

    def resolve(self, *, source_kind: str, source_locator: str, description_hint: str | None = None) -> MarketplaceDescription:
        key = f"{source_kind}:{source_locator}"
        cached = self._cache.get(key)
        if cached is not None:
            return cached

        fetcher = self._fetchers.get(source_kind)
        hint = normalize_description(description_hint)
        if fetcher is None:
            return MarketplaceDescription(description=hint, status="fallback" if hint else "unavailable")

        try:
            manifest_text = fetcher.fetch_manifest_text(source_locator)
        except Exception:  # noqa: BLE001
            return MarketplaceDescription(description=hint, status="fallback" if hint else "unavailable")

        if not manifest_text:
            return MarketplaceDescription(description=hint, status="fallback" if hint else "unavailable")

        manifest = parse_skill_manifest_text(manifest_text)
        description = normalize_description(manifest.description)
        if description:
            result = MarketplaceDescription(description=description, status="resolved")
        else:
            result = MarketplaceDescription(description=None, status="missing")

        self._cache[key] = result
        return result


def normalize_description(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None
