from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
import re
from urllib.parse import quote, urlparse

from skill_manager.application.marketplace_cache import MarketplaceCache
from skill_manager.errors import MarketplaceUpstreamError
from skill_manager.sources.github import github_owner_avatar_url

from .client import ClisDevClient

Fetcher = Callable[[str], dict[str, object]]

_DEFAULT_PAGE_SIZE = 30
_MAX_PAGE_SIZE = 100
_POPULAR_TTL_SECONDS = 3600
_SEARCH_TTL_SECONDS = 900
_POPULAR_NAMESPACE = "clisdev-popular-v1"
_SEARCH_NAMESPACE = "clisdev-search-v1"


@dataclass(frozen=True)
class CliMarketplaceRecord:
    slug: str
    name: str
    description: str
    long_description: str | None
    marketplace_url: str
    icon_url: str | None
    github_url: str | None
    website_url: str | None
    stars: int | None
    language: str | None
    category: str | None
    install_command: str | None
    has_mcp: bool
    has_skill: bool
    is_official: bool
    is_tui: bool
    source_type: str | None
    vendor_name: str | None

    @property
    def item_id(self) -> str:
        return f"clisdev:{self.slug}"

    def to_item_dict(self) -> dict[str, object]:
        return {
            "id": self.item_id,
            "slug": self.slug,
            "name": self.name,
            "description": self.description,
            "marketplaceUrl": self.marketplace_url,
            "iconUrl": self.icon_url,
            "githubUrl": self.github_url,
            "websiteUrl": self.website_url,
            "stars": self.stars,
            "language": self.language,
            "category": self.category,
            "hasMcp": self.has_mcp,
            "hasSkill": self.has_skill,
            "isOfficial": self.is_official,
            "isTui": self.is_tui,
            "sourceType": self.source_type,
            "vendorName": self.vendor_name,
        }

    def to_detail_dict(self) -> dict[str, object]:
        return {
            **self.to_item_dict(),
            "longDescription": self.long_description,
            "installCommand": self.install_command,
        }


class CliMarketplaceCatalog:
    DEFAULT_PAGE_SIZE = _DEFAULT_PAGE_SIZE
    MAX_PAGE_SIZE = _MAX_PAGE_SIZE

    def __init__(
        self,
        *,
        client: ClisDevClient | None = None,
        fetcher: Fetcher | None = None,
        cache: MarketplaceCache | None = None,
    ) -> None:
        self.client = client or ClisDevClient.from_environment()
        self._fetcher = fetcher
        self._cache = cache or MarketplaceCache()

    @classmethod
    def from_environment(
        cls,
        env: dict[str, str] | None = None,
        *,
        cache: MarketplaceCache | None = None,
    ) -> "CliMarketplaceCatalog":
        return cls(
            client=ClisDevClient.from_environment(env),
            cache=cache or MarketplaceCache.from_environment(env),
        )

    def popular_page(self, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        return self._page(self.known_records(), limit=limit, offset=offset)

    def search_page(self, query: str, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        trimmed = query.strip()
        if len(trimmed) < 2:
            raise ValueError("Enter at least 2 characters to search CLIs.")
        return self._page(self.search_records(trimmed), limit=limit, offset=offset)

    def detail(self, slug_or_id: str) -> dict[str, object] | None:
        slug = parse_cli_slug(slug_or_id)
        if slug is None:
            return None
        for record in self.known_records():
            if record.slug == slug:
                return record.to_detail_dict()
        try:
            matches = self.search_records(slug)
        except MarketplaceUpstreamError:
            return None
        for record in matches:
            if record.slug == slug:
                return record.to_detail_dict()
        return None

    def known_records(self) -> tuple[CliMarketplaceRecord, ...]:
        payload = self._cached_payload(
            _POPULAR_NAMESPACE,
            "all",
            ttl_seconds=_POPULAR_TTL_SECONDS,
            fetch=lambda: self._fetch_json("/api/clis"),
        )
        return self._records_from_payload(payload)

    def search_records(self, query: str) -> tuple[CliMarketplaceRecord, ...]:
        normalized = query.strip().lower()
        payload = self._cached_payload(
            _SEARCH_NAMESPACE,
            normalized,
            ttl_seconds=_SEARCH_TTL_SECONDS,
            fetch=lambda: self._fetch_json(f"/api/search?q={quote(query.strip(), safe='')}"),
        )
        return self._records_from_payload(payload)

    def _cached_payload(
        self,
        namespace: str,
        key: str,
        *,
        ttl_seconds: int,
        fetch: Callable[[], dict[str, object]],
    ) -> dict[str, object]:
        cached = self._cache.read(namespace, key, ttl_seconds=ttl_seconds)
        if cached is not None and cached.is_fresh and isinstance(cached.payload, dict):
            return cached.payload
        try:
            payload = fetch()
        except MarketplaceUpstreamError:
            if cached is not None and isinstance(cached.payload, dict):
                return cached.payload
            raise
        self._cache.write(namespace, key, payload)
        return payload

    def _fetch_json(self, path: str) -> dict[str, object]:
        if self._fetcher is not None:
            payload = self._fetcher(path)
            if not isinstance(payload, dict):
                raise MarketplaceUpstreamError("payload", path, "JSON payload must be an object")
            return payload
        return self.client.fetch_json(path)

    def _records_from_payload(self, payload: dict[str, object]) -> tuple[CliMarketplaceRecord, ...]:
        items = _extract_items(payload)
        records: list[CliMarketplaceRecord] = []
        seen: set[str] = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            record = _normalize_record(item, detail_url=self.client.detail_url)
            if record.slug in seen:
                continue
            records.append(record)
            seen.add(record.slug)
        return tuple(records)

    def _page(
        self,
        records: tuple[CliMarketplaceRecord, ...],
        *,
        limit: int | None,
        offset: int,
    ) -> dict[str, object]:
        page_limit = _normalize_limit(limit)
        page_offset = max(offset, 0)
        page_items = records[page_offset:page_offset + page_limit]
        next_offset = page_offset + len(page_items)
        has_more = next_offset < len(records)
        return {
            "items": [record.to_item_dict() for record in page_items],
            "nextOffset": next_offset if has_more else None,
            "hasMore": has_more,
        }


def parse_cli_slug(slug_or_id: str) -> str | None:
    value = slug_or_id.strip()
    if value.startswith("clisdev:"):
        value = value.removeprefix("clisdev:")
    return _slugify(value) if value else None


def _extract_items(payload: dict[str, object]) -> list[object]:
    for key in ("clis", "items", "results", "data"):
        value = payload.get(key)
        if isinstance(value, list):
            return value
    return []


def _normalize_record(payload: dict[str, object], *, detail_url: Callable[[str], str]) -> CliMarketplaceRecord:
    slug = _slugify(_first_str(payload, "slug", "id", "name", fallback="cli"))
    name = _first_str(payload, "name", "title", fallback=_title_from_slug(slug))
    long_description = _optional_str(payload.get("long_description")) or _optional_str(payload.get("longDescription"))
    description = _first_str(payload, "description", "summary", fallback=_description_from_long(long_description))
    github_url = _valid_github_url(payload.get("github"))
    website_url = _valid_http_url(payload.get("website")) or _valid_http_url(payload.get("source_url"))
    return CliMarketplaceRecord(
        slug=slug,
        name=name,
        description=description,
        long_description=long_description,
        marketplace_url=detail_url(slug),
        icon_url=_github_icon_url(github_url),
        github_url=github_url,
        website_url=website_url,
        stars=_optional_int(payload.get("stars")),
        language=_optional_str(payload.get("language")),
        category=_optional_str(payload.get("category")),
        install_command=_optional_str(payload.get("install")),
        has_mcp=_bool(payload.get("has_mcp")),
        has_skill=_bool(payload.get("has_skill")),
        is_official=_bool(payload.get("is_official")),
        is_tui=_bool(payload.get("is_tui")),
        source_type=_optional_str(payload.get("source_type")),
        vendor_name=_optional_str(payload.get("vendor_name")),
    )


def _normalize_limit(limit: int | None) -> int:
    if limit is None:
        return _DEFAULT_PAGE_SIZE
    return max(1, min(int(limit), _MAX_PAGE_SIZE))


def _first_str(payload: dict[str, object], *keys: str, fallback: str) -> str:
    for key in keys:
        value = _optional_str(payload.get(key))
        if value is not None:
            return value
    return fallback


def _optional_str(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _optional_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value.replace(",", "").strip())
        except ValueError:
            return None
    return None


def _bool(value: object) -> bool:
    return value if isinstance(value, bool) else False


def _valid_http_url(value: object) -> str | None:
    raw = _optional_str(value)
    if raw is None:
        return None
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return raw


def _valid_github_url(value: object) -> str | None:
    raw = _valid_http_url(value)
    if raw is None:
        return None
    parsed = urlparse(raw)
    if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
        return None
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        return None
    owner, repo = parts[0], parts[1]
    if not owner or not repo:
        return None
    if repo.endswith(".git"):
        repo = repo[:-4]
    return f"https://github.com/{owner}/{repo}"


def _github_icon_url(github_url: str | None) -> str | None:
    if github_url is None:
        return None
    parsed = urlparse(github_url)
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        return None
    return github_owner_avatar_url(f"{parts[0]}/{parts[1]}", size=96)


def _slugify(value: str) -> str:
    normalized = value.strip().lower()
    normalized = re.sub(r"[^a-z0-9._-]+", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized).strip("-")
    return normalized or "cli"


def _title_from_slug(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.replace("_", "-").split("-") if part)


def _description_from_long(long_description: str | None) -> str:
    if not long_description:
        return "No description available."
    first = long_description.strip().split("\n\n", 1)[0].strip()
    return first or "No description available."


__all__ = [
    "CliMarketplaceCatalog",
    "CliMarketplaceRecord",
    "parse_cli_slug",
]
