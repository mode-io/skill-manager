from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Callable, Mapping
from urllib.parse import quote, urlencode, urlparse

from skill_manager.application.marketplace_cache import MarketplaceCache
from skill_manager.errors import MarketplaceUpstreamError

from ..install_resolver import (
    McpInstallConfig,
    RegistryInstallOption,
    registry_install_options,
    registry_managed_name,
)
from .client import McpRegistryClient


Fetcher = Callable[[str], dict[str, object]]
SupportedRegistryEntry = tuple[Mapping[str, object], Mapping[str, object], tuple[RegistryInstallOption, ...]]
RegistrySummaryCandidate = tuple[Mapping[str, object], dict[str, object]]

_REGISTRY_API_VERSION = "v0.1"
_REGISTRY_EXTERNAL_BASE_URL = "https://registry.modelcontextprotocol.io"
_OFFICIAL_META_KEY = "io.modelcontextprotocol.registry/official"
_DEFAULT_PAGE_SIZE = 20
_MAX_PAGE_SIZE = 60
_POPULAR_TTL_SECONDS = 3600
_SEARCH_TTL_SECONDS = 900
_DETAIL_TTL_SECONDS = 86400
_SEARCH_FETCH_FLOOR = 40
_SEARCH_CACHE_LIMIT = 24

_DETAIL_NAMESPACE = "mcp-registry-detail-v1"
_PAGE_NAMESPACE = "mcp-registry-page-v1"


@dataclass(frozen=True)
class McpRegistryInstallDetail:
    qualified_name: str
    display_name: str
    registry_server: Mapping[str, object]
    options: tuple[RegistryInstallOption, ...]

    def to_resolver_detail(self) -> dict[str, object]:
        return {
            "qualifiedName": self.qualified_name,
            "displayName": self.display_name,
            "registryServer": self.registry_server,
        }


@dataclass(frozen=True)
class SearchSnapshot:
    items: tuple[dict[str, object], ...]
    fetched_limit: int
    maybe_more: bool
    fetched_at: float


class McpMarketplaceCatalog:
    DEFAULT_PAGE_SIZE = _DEFAULT_PAGE_SIZE
    MAX_PAGE_SIZE = _MAX_PAGE_SIZE

    def __init__(
        self,
        *,
        fetcher: Fetcher | None = None,
        cache: MarketplaceCache | None = None,
    ) -> None:
        self._fetcher = fetcher or McpRegistryClient.from_environment().fetch_json
        self._cache = cache or MarketplaceCache()
        self._search_cache: dict[tuple[str, bool | None, bool | None], SearchSnapshot] = {}

    @classmethod
    def from_environment(
        cls,
        env: dict[str, str] | None = None,
        *,
        cache: MarketplaceCache | None = None,
    ) -> "McpMarketplaceCatalog":
        client = McpRegistryClient.from_environment(env)
        return cls(
            fetcher=client.fetch_json,
            cache=cache or MarketplaceCache.from_environment(env),
        )

    @property
    def cache(self) -> MarketplaceCache:
        return self._cache

    def popular_page(self, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        page_size = _normalize_limit(limit)
        page_offset = max(offset, 0)
        collected, maybe_more = self._collect_items(limit=page_offset + page_size + 1)
        page_items = collected[page_offset : page_offset + page_size]
        has_more = len(collected) > page_offset + page_size or maybe_more
        next_offset = page_offset + len(page_items) if has_more and page_items else None
        return {"items": page_items, "nextOffset": next_offset, "hasMore": next_offset is not None}

    def search_page(
        self,
        query: str,
        *,
        limit: int | None = None,
        offset: int = 0,
        remote: bool | None = None,
        verified: bool | None = None,
    ) -> dict[str, object]:
        trimmed = (query or "").strip()
        if len(trimmed) < 2 and (remote is None and verified is None):
            raise ValueError("Enter at least 2 characters to search the MCP registry.")
        page_size = _normalize_limit(limit)
        page_offset = max(offset, 0)
        fetch_limit = max(page_offset + page_size + 1, _SEARCH_FETCH_FLOOR)
        snapshot = self._search_snapshot(
            trimmed,
            remote=remote,
            verified=verified,
            fetch_limit=fetch_limit,
        )
        items = list(snapshot.items)
        page_items = items[page_offset : page_offset + page_size]
        has_more = len(items) > page_offset + page_size or snapshot.maybe_more
        next_offset = page_offset + len(page_items) if has_more and page_items else None
        return {"items": page_items, "nextOffset": next_offset, "hasMore": next_offset is not None}

    def detail(self, qualified_name: str) -> dict[str, object] | None:
        name = (qualified_name or "").strip()
        if not name:
            return None
        cache_key = name
        cached = self._cache.read(_DETAIL_NAMESPACE, cache_key, ttl_seconds=_DETAIL_TTL_SECONDS)
        if cached is not None and isinstance(cached.payload, dict):
            payload = dict(cached.payload)
            payload.pop("registryServer", None)
            payload["externalUrl"] = _external_url(name)
            return payload
        resolved = self._latest_supported_detail(name)
        if resolved is None:
            return None
        raw, options = resolved
        payload = _map_detail(raw, qualified_name=name, options=options)
        self._cache.write(_DETAIL_NAMESPACE, cache_key, payload)
        return payload

    def install_detail(self, qualified_name: str) -> McpRegistryInstallDetail | None:
        name = (qualified_name or "").strip()
        if not name:
            return None
        resolved = self._latest_supported_detail(name)
        if resolved is None:
            return None
        raw, options = resolved
        server = _entry_server(raw)
        if server is None:
            return None
        return McpRegistryInstallDetail(
            qualified_name=name,
            display_name=_coerce_str(server.get("title"), default=name),
            registry_server=server,
            options=options,
        )

    def _latest_supported_detail(
        self,
        name: str,
    ) -> tuple[Mapping[str, object], tuple[RegistryInstallOption, ...]] | None:
        try:
            versions = self._fetcher(f"/{_REGISTRY_API_VERSION}/servers/{quote(name, safe='')}/versions")
        except MarketplaceUpstreamError as error:
            if error.upstream_status == 404:
                return None
            raise
        latest = _latest_active_entry(versions)
        if latest is None:
            return None
        server = _entry_server(latest)
        if server is None:
            return None
        version = _coerce_str(server.get("version"))
        if not version:
            return None
        try:
            raw = self._fetcher(
                f"/{_REGISTRY_API_VERSION}/servers/{quote(name, safe='')}/versions/{quote(version, safe='')}"
            )
        except MarketplaceUpstreamError as error:
            if error.upstream_status == 404:
                return None
            raise
        if not _is_latest_active(raw):
            return None
        detail_server = _entry_server(raw)
        if detail_server is None:
            return None
        options = registry_install_options(detail_server)
        if not options:
            return None
        return raw, options

    def _search_snapshot(
        self,
        query: str,
        *,
        remote: bool | None,
        verified: bool | None,
        fetch_limit: int,
    ) -> SearchSnapshot:
        key = (query, remote, verified)
        cached = self._search_cache.get(key)
        if cached is not None and (time.time() - cached.fetched_at) < _SEARCH_TTL_SECONDS and cached.fetched_limit >= fetch_limit:
            return cached

        collected, maybe_more = self._collect_items(
            limit=fetch_limit + 1,
            query=query,
            remote=remote,
            verified=verified,
        )
        items = tuple(collected[:fetch_limit])
        snapshot = SearchSnapshot(
            items=items,
            fetched_limit=fetch_limit,
            maybe_more=maybe_more or len(collected) > fetch_limit,
            fetched_at=time.time(),
        )
        self._search_cache[key] = snapshot
        self._prune_search_cache()
        return snapshot

    def _prune_search_cache(self) -> None:
        if len(self._search_cache) <= _SEARCH_CACHE_LIMIT:
            return
        oldest = sorted(self._search_cache.items(), key=lambda item: item[1].fetched_at)
        for key, _snapshot in oldest[: len(self._search_cache) - _SEARCH_CACHE_LIMIT]:
            self._search_cache.pop(key, None)

    def _collect_items(
        self,
        *,
        limit: int,
        query: str = "",
        remote: bool | None = None,
        verified: bool | None = None,
    ) -> tuple[list[dict[str, object]], bool]:
        collected: list[dict[str, object]] = []
        cursor: str | None = None
        while len(collected) < limit:
            raw = self._list_registry_page(cursor=cursor, search=query)
            for server, item in _summary_candidates(raw):
                if not _item_matches_filters(item, server, query=query, remote=remote, verified=verified):
                    continue
                collected.append(item)
                if len(collected) >= limit:
                    break
            cursor = _next_cursor(raw)
            if not cursor:
                break
        return collected, cursor is not None

    def _list_registry_page(self, *, cursor: str | None = None, search: str = "") -> dict[str, object]:
        params: list[tuple[str, str]] = [("limit", str(_MAX_PAGE_SIZE))]
        if cursor:
            params.append(("cursor", cursor))
        trimmed_search = search.strip()
        if trimmed_search:
            params.append(("search", trimmed_search))
        path = f"/{_REGISTRY_API_VERSION}/servers?{urlencode(params)}"
        cache_key = _cache_key_for_path(path)
        cached = self._cache.read(_PAGE_NAMESPACE, cache_key, ttl_seconds=_POPULAR_TTL_SECONDS)
        if cached is not None and isinstance(cached.payload, dict):
            return cached.payload
        raw = self._fetcher(path)
        self._cache.write(_PAGE_NAMESPACE, cache_key, raw)
        return raw


def _normalize_limit(limit: int | None) -> int:
    if limit is None:
        return _DEFAULT_PAGE_SIZE
    return max(1, min(int(limit), _MAX_PAGE_SIZE))


def _cache_key_for_path(path: str) -> str:
    return hashlib.sha1(path.encode("utf-8")).hexdigest()


def _coerce_str(value: object, *, default: str = "") -> str:
    return value if isinstance(value, str) else default


def _coerce_optional_str(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None


def _entries(raw: Mapping[str, object]) -> list[Mapping[str, object]]:
    servers = raw.get("servers")
    if not isinstance(servers, list):
        return []
    return [entry for entry in servers if isinstance(entry, Mapping)]


def _entry_server(entry: Mapping[str, object]) -> Mapping[str, object] | None:
    server = entry.get("server")
    return server if isinstance(server, Mapping) else None


def _official_meta(entry: Mapping[str, object]) -> Mapping[str, object]:
    meta = entry.get("_meta")
    if not isinstance(meta, Mapping):
        return {}
    official = meta.get(_OFFICIAL_META_KEY)
    return official if isinstance(official, Mapping) else {}


def _is_latest_active(entry: Mapping[str, object]) -> bool:
    meta = _official_meta(entry)
    return meta.get("status") == "active" and meta.get("isLatest") is True


def _latest_active_entry(raw: Mapping[str, object]) -> Mapping[str, object] | None:
    for entry in _entries(raw):
        if _is_latest_active(entry):
            return entry
    return None


def _next_cursor(raw: Mapping[str, object]) -> str | None:
    metadata = raw.get("metadata")
    if not isinstance(metadata, Mapping):
        return None
    return _coerce_optional_str(metadata.get("nextCursor"))


def _supported_latest_entries(
    raw: Mapping[str, object],
) -> list[SupportedRegistryEntry]:
    supported: list[SupportedRegistryEntry] = []
    for entry in _entries(raw):
        server = _entry_server(entry)
        if server is None or not _is_latest_active(entry):
            continue
        options = registry_install_options(server)
        if not options:
            continue
        supported.append((entry, server, options))
    return supported


def _summary_candidates(raw: Mapping[str, object]) -> list[RegistrySummaryCandidate]:
    return [
        (server, _map_summary(entry, options=options))
        for entry, server, options in _supported_latest_entries(raw)
    ]


def _item_matches_filters(
    item: Mapping[str, object],
    server: Mapping[str, object],
    *,
    query: str,
    remote: bool | None,
    verified: bool | None,
) -> bool:
    if remote is not None and bool(item["isRemote"]) is not remote:
        return False
    if verified is not None and bool(item["isVerified"]) is not verified:
        return False
    if query and not _matches_query(server, query):
        return False
    return True


def _map_summary(
    entry: Mapping[str, object],
    *,
    options: tuple[RegistryInstallOption, ...],
) -> dict[str, object]:
    server = _entry_server(entry) or {}
    qualified_name = _coerce_str(server.get("name"))
    display_name = _coerce_str(server.get("title"), default=qualified_name)
    is_remote = _options_are_remote(options)
    official = _official_meta(entry)
    return {
        "qualifiedName": qualified_name,
        "namespace": _namespace(qualified_name),
        "displayName": display_name,
        "description": _coerce_str(server.get("description")),
        "iconUrl": _icon_url(server),
        "isVerified": True,
        "isRemote": is_remote,
        "isDeployed": is_remote,
        "useCount": 0,
        "createdAt": _coerce_optional_str(official.get("publishedAt")),
        "homepage": _coerce_optional_str(server.get("websiteUrl")),
        "websiteUrl": _coerce_optional_str(server.get("websiteUrl")),
        "githubUrl": _github_repository_url(server),
        "externalUrl": _external_url(qualified_name),
    }


def _map_detail(
    raw: Mapping[str, object],
    *,
    qualified_name: str,
    options: tuple[RegistryInstallOption, ...],
) -> dict[str, object]:
    server = _entry_server(raw) or {}
    display_name = _coerce_str(server.get("title"), default=qualified_name)
    description = _coerce_str(server.get("description"))
    icon_url = _icon_url(server)
    is_remote = _options_are_remote(options)
    connections = [_connection_from_option(option) for option in options]
    tools = _tools(server.get("tools"))
    resources = _resources(server.get("resources"))
    prompts = _prompts(server.get("prompts"))
    deployment_url = next(
        (connection.get("deploymentUrl") for connection in connections if connection.get("deploymentUrl")),
        None,
    )
    return {
        "qualifiedName": qualified_name,
        "managedName": registry_managed_name(qualified_name),
        "displayName": display_name,
        "description": description,
        "iconUrl": icon_url,
        "isRemote": is_remote,
        "deploymentUrl": deployment_url,
        "connections": connections,
        "tools": tools,
        "resources": resources,
        "prompts": prompts,
        "capabilityCounts": {
            "tools": len(tools),
            "resources": len(resources),
            "prompts": len(prompts),
        },
        "websiteUrl": _coerce_optional_str(server.get("websiteUrl")),
        "githubUrl": _github_repository_url(server),
        "externalUrl": _external_url(qualified_name),
        "installConfig": McpInstallConfig(options[0].fields).to_dict() if options else McpInstallConfig().to_dict(),
    }


def _connection_from_option(option: RegistryInstallOption) -> dict[str, object]:
    if option.transport == "stdio":
        return {
            "kind": "stdio",
            "deploymentUrl": None,
            "configSchema": None,
            "stdioFunction": None,
            "bundleUrl": None,
            "runtime": None,
            "stdioCommand": option.command,
            "stdioArgs": list(option.args or ()),
        }
    return {
        "kind": option.transport,
        "deploymentUrl": option.url,
        "configSchema": None,
        "stdioFunction": None,
        "bundleUrl": None,
        "runtime": None,
        "stdioCommand": None,
        "stdioArgs": None,
    }


def _options_are_remote(options: tuple[RegistryInstallOption, ...]) -> bool:
    if not options:
        return False
    return all(option.transport in {"http", "sse"} for option in options)


def _namespace(qualified_name: str) -> str:
    return qualified_name.split("/", 1)[0] if qualified_name else ""


def _icon_url(server: Mapping[str, object]) -> str | None:
    icons = server.get("icons")
    if isinstance(icons, list):
        for icon in icons:
            if isinstance(icon, Mapping):
                value = _coerce_optional_str(icon.get("src"))
                if value:
                    return value
    return _github_repository_avatar_url(server)


def _github_repository_avatar_url(server: Mapping[str, object]) -> str | None:
    repository = server.get("repository")
    if not isinstance(repository, Mapping):
        return None
    raw_url = _coerce_optional_str(repository.get("url"))
    if raw_url is None:
        return None
    owner = _github_owner_from_url(raw_url)
    if owner is None:
        return None
    return f"https://github.com/{owner}.png?size=96"


def _github_repository_url(server: Mapping[str, object]) -> str | None:
    repository = server.get("repository")
    if not isinstance(repository, Mapping):
        return None
    raw_url = _coerce_optional_str(repository.get("url"))
    if raw_url is None:
        return None
    path = _github_repository_path_from_url(raw_url)
    if path is None:
        return None
    return f"https://github.com/{path}"


def _github_owner_from_url(raw_url: str) -> str | None:
    path = _github_repository_path_from_url(raw_url)
    if path is None:
        return None
    return path.split("/", 1)[0]


def _github_repository_path_from_url(raw_url: str) -> str | None:
    if raw_url.startswith("git@github.com:"):
        path = raw_url.removeprefix("git@github.com:")
    else:
        parsed = urlparse(raw_url)
        if parsed.netloc.lower() not in {"github.com", "www.github.com"}:
            return None
        path = parsed.path
    parts = [part for part in path.strip("/").split("/") if part]
    if len(parts) < 2:
        return None
    owner = parts[0]
    repo = parts[1].removesuffix(".git")
    if not owner or not repo:
        return None
    return f"{owner}/{repo}"


def _matches_query(server: Mapping[str, object], query: str) -> bool:
    needle = query.lower()
    fields = [
        server.get("name"),
        server.get("title"),
        server.get("description"),
        server.get("websiteUrl"),
    ]
    repository = server.get("repository")
    if isinstance(repository, Mapping):
        fields.append(repository.get("url"))
    return any(isinstance(value, str) and needle in value.lower() for value in fields)


def _tools(raw: object) -> list[dict[str, object]]:
    if not isinstance(raw, list):
        return []
    tools: list[dict[str, object]] = []
    for tool in raw:
        if not isinstance(tool, Mapping):
            continue
        name = _coerce_str(tool.get("name"))
        if not name:
            continue
        tools.append(
            {
                "name": name,
                "description": _coerce_str(tool.get("description")),
                "parameters": _flatten_input_schema(tool.get("inputSchema")),
            }
        )
    return tools


def _resources(raw: object) -> list[dict[str, object]]:
    if not isinstance(raw, list):
        return []
    resources: list[dict[str, object]] = []
    for resource in raw:
        if not isinstance(resource, Mapping):
            continue
        resources.append(
            {
                "name": _coerce_str(resource.get("name")),
                "uri": _coerce_str(resource.get("uri")),
                "description": _coerce_str(resource.get("description")),
                "mimeType": _coerce_optional_str(resource.get("mimeType")),
            }
        )
    return resources


def _prompts(raw: object) -> list[dict[str, object]]:
    if not isinstance(raw, list):
        return []
    prompts: list[dict[str, object]] = []
    for prompt in raw:
        if not isinstance(prompt, Mapping):
            continue
        arguments_raw = prompt.get("arguments")
        arguments: list[dict[str, object]] = []
        if isinstance(arguments_raw, list):
            for argument in arguments_raw:
                if not isinstance(argument, Mapping):
                    continue
                arguments.append(
                    {
                        "name": _coerce_str(argument.get("name")),
                        "description": _coerce_str(argument.get("description")),
                        "required": bool(argument.get("required", False)),
                    }
                )
        prompts.append(
            {
                "name": _coerce_str(prompt.get("name")),
                "description": _coerce_str(prompt.get("description")),
                "arguments": arguments,
            }
        )
    return prompts


def _flatten_input_schema(schema: object) -> list[dict[str, object]]:
    if not isinstance(schema, Mapping):
        return []
    properties = schema.get("properties")
    required_raw = schema.get("required")
    required_set: set[str] = set()
    if isinstance(required_raw, list):
        required_set = {item for item in required_raw if isinstance(item, str)}
    if not isinstance(properties, Mapping):
        return []
    parameters: list[dict[str, object]] = []
    for name, value in properties.items():
        if not isinstance(name, str):
            continue
        entry = value if isinstance(value, Mapping) else {}
        param: dict[str, object] = {
            "name": name,
            "type": _coerce_param_type(entry.get("type")),
            "description": _coerce_str(entry.get("description")),
            "required": name in required_set,
        }
        for hint_key in ("default", "minimum", "maximum", "minItems", "maxItems", "minLength", "maxLength"):
            if hint_key in entry:
                param[_camel(hint_key)] = entry.get(hint_key)
        enum_value = entry.get("enum")
        if isinstance(enum_value, list) and enum_value:
            param["enum"] = enum_value
        parameters.append(param)
    return parameters


_VALID_PARAM_TYPES = {"string", "number", "integer", "boolean", "array", "object"}


def _coerce_param_type(value: object) -> str:
    if isinstance(value, str) and value in _VALID_PARAM_TYPES:
        return value
    if isinstance(value, list):
        for candidate in value:
            if isinstance(candidate, str) and candidate in _VALID_PARAM_TYPES:
                return candidate
    return "unknown"


def _camel(value: str) -> str:
    parts = value.split("_")
    return parts[0] + "".join(part.title() for part in parts[1:])


def _external_url(qualified_name: str) -> str:
    if not qualified_name:
        return _REGISTRY_EXTERNAL_BASE_URL
    return f"{_REGISTRY_EXTERNAL_BASE_URL}/?{urlencode({'q': qualified_name})}"


__all__ = [
    "McpMarketplaceCatalog",
]
