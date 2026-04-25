from __future__ import annotations

import hashlib
from typing import Callable
from urllib.parse import quote, urlencode

from skill_manager.errors import MarketplaceUpstreamError
from skill_manager.application.marketplace_cache import MarketplaceCache

from ..names import canonical_server_name
from ..stdio import parse_static_stdio_function
from .client import SmitheryClient

Fetcher = Callable[[str], dict[str, object]]

_SMITHERY_WEB_BASE_URL = "https://smithery.ai"
_DEFAULT_PAGE_SIZE = 30
_MAX_PAGE_SIZE = 100
_POPULAR_TTL_SECONDS = 3600
_SEARCH_TTL_SECONDS = 900
_DETAIL_TTL_SECONDS = 86400

_POPULAR_NAMESPACE = "smithery-popular-v1"
_SEARCH_NAMESPACE = "smithery-search-v1"
_DETAIL_NAMESPACE = "smithery-detail-v5"


class McpMarketplaceCatalog:
    DEFAULT_PAGE_SIZE = _DEFAULT_PAGE_SIZE
    MAX_PAGE_SIZE = _MAX_PAGE_SIZE

    def __init__(
        self,
        *,
        fetcher: Fetcher | None = None,
        cache: MarketplaceCache | None = None,
    ) -> None:
        self._fetcher = fetcher or SmitheryClient.from_environment().fetch_json
        self._cache = cache or MarketplaceCache()

    @classmethod
    def from_environment(
        cls,
        env: dict[str, str] | None = None,
        *,
        cache: MarketplaceCache | None = None,
    ) -> "McpMarketplaceCatalog":
        client = SmitheryClient.from_environment(env)
        return cls(
            fetcher=client.fetch_json,
            cache=cache or MarketplaceCache.from_environment(env),
        )

    @property
    def cache(self) -> MarketplaceCache:
        return self._cache

    def popular_page(self, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        return self._list_page(
            query=None,
            limit=limit,
            offset=offset,
            remote=None,
            verified=None,
            namespace=_POPULAR_NAMESPACE,
            ttl_seconds=_POPULAR_TTL_SECONDS,
        )

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
            raise ValueError("Enter at least 2 characters to search Smithery.")
        return self._list_page(
            query=trimmed or None,
            limit=limit,
            offset=offset,
            remote=remote,
            verified=verified,
            namespace=_SEARCH_NAMESPACE,
            ttl_seconds=_SEARCH_TTL_SECONDS,
        )

    def detail(self, qualified_name: str) -> dict[str, object] | None:
        name = (qualified_name or "").strip()
        if not name:
            return None
        cache_key = name
        cached = self._cache.read(_DETAIL_NAMESPACE, cache_key, ttl_seconds=_DETAIL_TTL_SECONDS)
        if cached is not None and isinstance(cached.payload, dict):
            return cached.payload
        try:
            raw = self._fetcher(f"/servers/{quote(name, safe='/')}")
        except MarketplaceUpstreamError as error:
            if error.upstream_status == 404:
                return None
            raise
        payload = _map_detail(raw, qualified_name=name)
        self._cache.write(_DETAIL_NAMESPACE, cache_key, payload)
        return payload

    def _list_page(
        self,
        *,
        query: str | None,
        limit: int | None,
        offset: int,
        remote: bool | None,
        verified: bool | None,
        namespace: str,
        ttl_seconds: int,
    ) -> dict[str, object]:
        page_size = _normalize_limit(limit)
        page_offset = max(offset, 0)
        page_number = (page_offset // page_size) + 1

        params: list[tuple[str, str]] = [
            ("pageSize", str(page_size)),
            ("page", str(page_number)),
        ]
        if query:
            params.append(("q", query))
        if remote is True:
            params.append(("remote", "true"))
        elif remote is False:
            params.append(("remote", "false"))
        if verified is True:
            params.append(("verified", "true"))

        path = f"/servers?{urlencode(params)}"
        cache_key = _cache_key_for_path(path)
        cached = self._cache.read(namespace, cache_key, ttl_seconds=ttl_seconds)
        raw: dict[str, object] | None = None
        if cached is not None and isinstance(cached.payload, dict):
            raw = cached.payload  # type: ignore[assignment]
        if raw is None:
            raw = self._fetcher(path)
            self._cache.write(namespace, cache_key, raw)

        servers_obj = raw.get("servers", []) if isinstance(raw, dict) else []
        servers = servers_obj if isinstance(servers_obj, list) else []
        pagination = raw.get("pagination", {}) if isinstance(raw, dict) else {}
        total_pages = 0
        current_page = page_number
        if isinstance(pagination, dict):
            total_pages = _coerce_int(pagination.get("totalPages"), default=0)
            current_page = _coerce_int(pagination.get("currentPage"), default=page_number)

        items = [_map_summary(server) for server in servers if isinstance(server, dict)]
        has_more = current_page < total_pages and bool(items)
        next_offset = page_offset + len(items) if has_more else None
        return {
            "items": items,
            "nextOffset": next_offset,
            "hasMore": has_more,
        }


def _normalize_limit(limit: int | None) -> int:
    if limit is None:
        return _DEFAULT_PAGE_SIZE
    return max(1, min(int(limit), _MAX_PAGE_SIZE))


def _cache_key_for_path(path: str) -> str:
    return hashlib.sha1(path.encode("utf-8")).hexdigest()


def _coerce_int(value: object, *, default: int) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return int(value)
    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return default
    return default


def _coerce_str(value: object, *, default: str = "") -> str:
    return value if isinstance(value, str) else default


def _coerce_optional_str(value: object) -> str | None:
    if isinstance(value, str) and value.strip():
        return value
    return None


def _coerce_bool(value: object, *, default: bool = False) -> bool:
    return value if isinstance(value, bool) else default


def _map_summary(server: dict[str, object]) -> dict[str, object]:
    qualified_name = _coerce_str(server.get("qualifiedName"))
    return {
        "qualifiedName": qualified_name,
        "namespace": _coerce_str(server.get("namespace")),
        "displayName": _coerce_str(server.get("displayName"), default=qualified_name),
        "description": _coerce_str(server.get("description")),
        "iconUrl": _coerce_optional_str(server.get("iconUrl")),
        "isVerified": _coerce_bool(server.get("verified")),
        "isRemote": _coerce_bool(server.get("remote")),
        "isDeployed": _coerce_bool(server.get("isDeployed")),
        "useCount": _coerce_int(server.get("useCount"), default=0),
        "createdAt": _coerce_optional_str(server.get("createdAt")),
        "homepage": _coerce_optional_str(server.get("homepage")),
        "externalUrl": _external_url(qualified_name),
    }


def _map_detail(raw: dict[str, object], *, qualified_name: str) -> dict[str, object]:
    display_name = _coerce_str(raw.get("displayName"), default=qualified_name)
    description = _coerce_str(raw.get("description"))
    icon_url = _coerce_optional_str(raw.get("iconUrl"))
    is_remote = _coerce_bool(raw.get("remote"))
    deployment_url = _coerce_optional_str(raw.get("deploymentUrl"))

    connections_raw = raw.get("connections", [])
    connections: list[dict[str, object]] = []
    if isinstance(connections_raw, list):
        for connection in connections_raw:
            if not isinstance(connection, dict):
                continue
            kind_raw = _coerce_str(connection.get("type"), default="unknown").lower()
            kind = (
                "http"
                if kind_raw in {"http", "streamable-http"}
                else ("sse" if kind_raw == "sse" else ("stdio" if kind_raw == "stdio" else kind_raw or "unknown"))
            )
            config_schema = connection.get("configSchema")
            mapped_connection: dict[str, object] = {
                "kind": kind,
                "deploymentUrl": _coerce_optional_str(connection.get("deploymentUrl")),
                "configSchema": config_schema if isinstance(config_schema, dict) else None,
            }
            if kind == "stdio":
                stdio_function = _coerce_optional_str(connection.get("stdioFunction"))
                bundle_url = _coerce_optional_str(connection.get("bundleUrl"))
                runtime = _coerce_optional_str(connection.get("runtime"))
                static_stdio = parse_static_stdio_function(stdio_function)
                mapped_connection["stdioFunction"] = stdio_function
                mapped_connection["bundleUrl"] = bundle_url
                mapped_connection["runtime"] = runtime
                mapped_connection["stdioCommand"] = static_stdio.command if static_stdio else None
                mapped_connection["stdioArgs"] = list(static_stdio.args) if static_stdio else None
            connections.append(mapped_connection)

    tools_raw = raw.get("tools", [])
    tools: list[dict[str, object]] = []
    if isinstance(tools_raw, list):
        for tool in tools_raw:
            if not isinstance(tool, dict):
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

    resources_raw = raw.get("resources", [])
    resources: list[dict[str, object]] = []
    if isinstance(resources_raw, list):
        for resource in resources_raw:
            if not isinstance(resource, dict):
                continue
            resources.append(
                {
                    "name": _coerce_str(resource.get("name")),
                    "uri": _coerce_str(resource.get("uri")),
                    "description": _coerce_str(resource.get("description")),
                    "mimeType": _coerce_optional_str(resource.get("mimeType")),
                }
            )

    prompts_raw = raw.get("prompts", [])
    prompts: list[dict[str, object]] = []
    if isinstance(prompts_raw, list):
        for prompt in prompts_raw:
            if not isinstance(prompt, dict):
                continue
            arguments_raw = prompt.get("arguments")
            arguments: list[dict[str, object]] = []
            if isinstance(arguments_raw, list):
                for argument in arguments_raw:
                    if not isinstance(argument, dict):
                        continue
                    arguments.append(
                        {
                            "name": _coerce_str(argument.get("name")),
                            "description": _coerce_str(argument.get("description")),
                            "required": _coerce_bool(argument.get("required")),
                        }
                    )
            prompts.append(
                {
                    "name": _coerce_str(prompt.get("name")),
                    "description": _coerce_str(prompt.get("description")),
                    "arguments": arguments,
                }
            )

    return {
        "qualifiedName": qualified_name,
        "managedName": canonical_server_name(qualified_name),
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
        "externalUrl": _external_url(qualified_name),
    }


def _flatten_input_schema(schema: object) -> list[dict[str, object]]:
    if not isinstance(schema, dict):
        return []
    properties = schema.get("properties")
    required_raw = schema.get("required")
    required_set: set[str] = set()
    if isinstance(required_raw, list):
        required_set = {item for item in required_raw if isinstance(item, str)}
    if not isinstance(properties, dict):
        return []
    parameters: list[dict[str, object]] = []
    for name, value in properties.items():
        if not isinstance(name, str):
            continue
        entry = value if isinstance(value, dict) else {}
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
        return _SMITHERY_WEB_BASE_URL
    return f"{_SMITHERY_WEB_BASE_URL}/server/{quote(qualified_name, safe='/')}"


__all__ = [
    "McpMarketplaceCatalog",
]
