from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
from typing import Mapping

from .marketplace.catalog import McpMarketplaceCatalog

@dataclass(frozen=True)
class MarketplaceLink:
    qualified_name: str
    display_name: str
    icon_url: str | None
    external_url: str
    description: str
    is_remote: bool
    is_verified: bool

    def to_dict(self) -> dict[str, object]:
        return {
            "qualifiedName": self.qualified_name,
            "displayName": self.display_name,
            "iconUrl": self.icon_url,
            "externalUrl": self.external_url,
            "description": self.description,
            "isRemote": self.is_remote,
            "isVerified": self.is_verified,
        }


def _canonical_lookup_key(qualified_name: str) -> str:
    """Reverse of mutations._canonical_name; used to map local name → smithery id."""
    cleaned = qualified_name.lstrip("@")
    if "/" in cleaned:
        cleaned = cleaned.split("/", 1)[1]
    return cleaned.replace("@", "-").replace("/", "-").lower()


class McpEnrichmentService:
    """Maps a local server name to a smithery marketplace entry, when one exists.

    Lookups go through three tiers:
      1. In-memory cache (per-process, hit immediately).
      2. Popular list scan (one network call per process; warm cache covers ~most servers).
      3. On-demand verified search by name.

    Negative results are also cached (None) to avoid repeated misses.
    """

    def __init__(self, catalog: McpMarketplaceCatalog) -> None:
        self._catalog = catalog
        self._cache: dict[str, MarketplaceLink | None] = {}
        self._lock = Lock()
        self._popular_warmed = False

    def warm_from_popular(self) -> None:
        with self._lock:
            if self._popular_warmed:
                return
            self._popular_warmed = True
        try:
            page = self._catalog.popular_page(limit=100, offset=0)
        except Exception:
            return
        items = page.get("items") if isinstance(page, dict) else []
        if not isinstance(items, list):
            return
        with self._lock:
            for item in items:
                if not isinstance(item, Mapping):
                    continue
                qualified_name = item.get("qualifiedName")
                if not isinstance(qualified_name, str) or not qualified_name:
                    continue
                key = _canonical_lookup_key(qualified_name)
                if key in self._cache:
                    continue
                self._cache[key] = MarketplaceLink(
                    qualified_name=qualified_name,
                    display_name=str(item.get("displayName") or key),
                    icon_url=_optional_str(item.get("iconUrl")),
                    external_url=str(item.get("externalUrl") or ""),
                    description=str(item.get("description") or ""),
                    is_remote=bool(item.get("isRemote", False)),
                    is_verified=bool(item.get("isVerified", False)),
                )

    def lookup(self, name: str, *, allow_search: bool = True) -> MarketplaceLink | None:
        if not name:
            return None
        key = name.lower()
        self.warm_from_popular()
        with self._lock:
            if key in self._cache:
                return self._cache[key]
        if not allow_search:
            return None
        link = self._search_by_name(name)
        with self._lock:
            self._cache[key] = link
        return link

    def invalidate(self) -> None:
        with self._lock:
            self._cache.clear()
            self._popular_warmed = False

    def _search_by_name(self, name: str) -> MarketplaceLink | None:
        try:
            page = self._catalog.search_page(name, limit=10, offset=0, verified=True)
        except Exception:
            return None
        items = page.get("items") if isinstance(page, dict) else []
        if not isinstance(items, list):
            return None
        target_key = name.lower()
        # Prefer exact canonical-name match before falling back to first result.
        for item in items:
            if not isinstance(item, Mapping):
                continue
            qualified_name = item.get("qualifiedName")
            if not isinstance(qualified_name, str) or not qualified_name:
                continue
            if _canonical_lookup_key(qualified_name) == target_key:
                return _link_from_item(item, qualified_name)
        return None


def _link_from_item(item: Mapping[str, object], qualified_name: str) -> MarketplaceLink:
    return MarketplaceLink(
        qualified_name=qualified_name,
        display_name=str(item.get("displayName") or qualified_name),
        icon_url=_optional_str(item.get("iconUrl")),
        external_url=str(item.get("externalUrl") or ""),
        description=str(item.get("description") or ""),
        is_remote=bool(item.get("isRemote", False)),
        is_verified=bool(item.get("isVerified", False)),
    )


def _optional_str(value: object) -> str | None:
    if isinstance(value, str) and value:
        return value
    return None


__all__ = ["McpEnrichmentService", "MarketplaceLink"]
