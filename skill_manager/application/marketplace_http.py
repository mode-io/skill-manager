from __future__ import annotations

import os
from pathlib import Path
import ssl
import sys

import certifi


def configured_marketplace_ca_file(env: dict[str, str] | None = None) -> Path | None:
    active_env = os.environ if env is None else env
    override = active_env.get("SSL_CERT_FILE", "").strip()
    if override:
        return Path(override)
    if _is_packaged_runtime():
        return Path(certifi.where())
    return None


def marketplace_ssl_context(env: dict[str, str] | None = None) -> ssl.SSLContext | None:
    cafile = configured_marketplace_ca_file(env)
    if cafile is None:
        return None
    return ssl.create_default_context(cafile=str(cafile))


def _is_packaged_runtime() -> bool:
    return bool(getattr(sys, "frozen", False))


__all__ = ["configured_marketplace_ca_file", "marketplace_ssl_context"]
