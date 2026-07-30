from __future__ import annotations

from urllib.parse import quote

from skill_manager.application.marketplace_http import (
    MarketplaceHttpClient,
    configured_base_url,
    configured_marketplace_ca_file,
)

DEFAULT_CLIS_DEV_BASE_URL = "https://clis.dev"
CLIS_DEV_BASE_URL_ENV = "SKILL_MANAGER_CLIS_DEV_BASE_URL"


def configured_clis_dev_base_url(env: dict[str, str] | None = None) -> str:
    return configured_base_url(env, env_var=CLIS_DEV_BASE_URL_ENV, default=DEFAULT_CLIS_DEV_BASE_URL)


class ClisDevClient(MarketplaceHttpClient):
    """Small CLIs.dev JSON client for preview-only marketplace reads."""

    DEFAULT_BASE_URL = DEFAULT_CLIS_DEV_BASE_URL
    BASE_URL_ENV = CLIS_DEV_BASE_URL_ENV

    def detail_url(self, slug: str) -> str:
        return self.absolute_url(f"/cli/{quote(slug, safe='')}")

    def list_clis(self) -> dict[str, object]:
        return self.fetch_json("/api/clis")

    def search_clis(self, query: str) -> dict[str, object]:
        return self.fetch_json(f"/api/search?q={quote(query, safe='')}")


__all__ = [
    "CLIS_DEV_BASE_URL_ENV",
    "DEFAULT_CLIS_DEV_BASE_URL",
    "ClisDevClient",
    "configured_clis_dev_base_url",
    "configured_marketplace_ca_file",
]
