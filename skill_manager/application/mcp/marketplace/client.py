from __future__ import annotations

from skill_manager.application.marketplace_http import (
    MarketplaceHttpClient,
    configured_base_url,
    configured_marketplace_ca_file,
)


DEFAULT_MCP_REGISTRY_BASE_URL = "https://registry.modelcontextprotocol.io"
MCP_REGISTRY_BASE_URL_ENV = "SKILL_MANAGER_MCP_REGISTRY_BASE_URL"


def configured_mcp_registry_base_url(env: dict[str, str] | None = None) -> str:
    return configured_base_url(
        env,
        env_var=MCP_REGISTRY_BASE_URL_ENV,
        default=DEFAULT_MCP_REGISTRY_BASE_URL,
    )


class McpRegistryClient(MarketplaceHttpClient):
    DEFAULT_BASE_URL = DEFAULT_MCP_REGISTRY_BASE_URL
    BASE_URL_ENV = MCP_REGISTRY_BASE_URL_ENV


__all__ = [
    "DEFAULT_MCP_REGISTRY_BASE_URL",
    "MCP_REGISTRY_BASE_URL_ENV",
    "McpRegistryClient",
    "configured_marketplace_ca_file",
    "configured_mcp_registry_base_url",
]
