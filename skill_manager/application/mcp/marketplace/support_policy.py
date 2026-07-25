from __future__ import annotations

from typing import Mapping

from ..install_resolver import RegistryInstallOption, registry_install_options

_OFFICIAL_META_KEY = "io.modelcontextprotocol.registry/official"


def is_latest_active_registry_entry(entry: Mapping[str, object]) -> bool:
    meta = official_registry_meta(entry)
    return meta.get("status") == "active" and meta.get("isLatest") is True


def official_registry_meta(entry: Mapping[str, object]) -> Mapping[str, object]:
    meta = entry.get("_meta")
    if not isinstance(meta, Mapping):
        return {}
    official = meta.get(_OFFICIAL_META_KEY)
    return official if isinstance(official, Mapping) else {}


def registry_entry_server(entry: Mapping[str, object]) -> Mapping[str, object] | None:
    server = entry.get("server")
    return server if isinstance(server, Mapping) else None


def supported_registry_entry(
    entry: Mapping[str, object],
) -> tuple[Mapping[str, object], tuple[RegistryInstallOption, ...]] | None:
    if not is_latest_active_registry_entry(entry):
        return None
    server = registry_entry_server(entry)
    if server is None:
        return None
    options = registry_install_options(server)
    if not options:
        return None
    return server, options


__all__ = [
    "is_latest_active_registry_entry",
    "official_registry_meta",
    "registry_entry_server",
    "supported_registry_entry",
]
