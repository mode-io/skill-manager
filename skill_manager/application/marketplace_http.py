from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import ssl
from typing import Self
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import certifi

from skill_manager.errors import MarketplaceUpstreamError


_TIMEOUT_SECONDS = 15
_USER_AGENT = "skill-manager/0.1"


def configured_marketplace_ca_file(env: dict[str, str] | None = None) -> Path | None:
    active_env = os.environ if env is None else env
    override = active_env.get("SSL_CERT_FILE", "").strip()
    if override:
        return Path(override)
    return Path(certifi.where())


def marketplace_ssl_context(env: dict[str, str] | None = None) -> ssl.SSLContext | None:
    cafile = configured_marketplace_ca_file(env)
    if cafile is None:
        return None
    return ssl.create_default_context(cafile=str(cafile))


def configured_base_url(env: dict[str, str] | None, *, env_var: str, default: str) -> str:
    active_env = os.environ if env is None else env
    configured = active_env.get(env_var, default).strip()
    return (configured or default).rstrip("/")


class MarketplaceHttpClient:
    """Shared read-only JSON client for the marketplace upstreams.

    Subclasses supply the upstream identity via `DEFAULT_BASE_URL` and `BASE_URL_ENV`.
    """

    DEFAULT_BASE_URL: str = ""
    BASE_URL_ENV: str = ""

    def __init__(
        self,
        *,
        base_url: str | None = None,
        timeout_seconds: float = _TIMEOUT_SECONDS,
        ssl_context: ssl.SSLContext | None = None,
    ) -> None:
        self.base_url = (base_url or self.DEFAULT_BASE_URL).rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.ssl_context = ssl_context

    @classmethod
    def from_environment(cls, env: dict[str, str] | None = None) -> Self:
        return cls(
            base_url=configured_base_url(env, env_var=cls.BASE_URL_ENV, default=cls.DEFAULT_BASE_URL),
            ssl_context=marketplace_ssl_context(env),
        )

    def absolute_url(self, path_or_url: str) -> str:
        if path_or_url.startswith(("http://", "https://")):
            return path_or_url
        return urljoin(f"{self.base_url}/", path_or_url.lstrip("/"))

    def fetch_json(self, path_or_url: str) -> dict[str, object]:
        url = self.absolute_url(path_or_url)
        payload = self._request(path_or_url, accept="application/json")
        try:
            parsed = json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise MarketplaceUpstreamError("payload", url, f"invalid JSON payload: {error}") from error
        if not isinstance(parsed, dict):
            raise MarketplaceUpstreamError("payload", url, "JSON payload must be an object")
        return parsed

    def _request(self, path_or_url: str, *, accept: str | None = None) -> bytes:
        url = self.absolute_url(path_or_url)
        headers = {"User-Agent": _USER_AGENT}
        if accept:
            headers["Accept"] = accept
        request = Request(url, headers=headers)
        open_kwargs: dict[str, object] = {"timeout": self.timeout_seconds}
        if self.ssl_context is not None:
            open_kwargs["context"] = self.ssl_context
        try:
            with urlopen(request, **open_kwargs) as response:
                return response.read()
        except HTTPError as error:
            raise MarketplaceUpstreamError(
                "bad_status",
                url,
                f"upstream returned HTTP {error.code}",
                upstream_status=error.code,
            ) from error
        except ssl.SSLCertVerificationError as error:
            raise MarketplaceUpstreamError("tls", url, str(error)) from error
        except TimeoutError as error:
            raise MarketplaceUpstreamError("timeout", url, str(error)) from error
        except URLError as error:
            reason = error.reason
            if isinstance(reason, ssl.SSLError):
                kind = "tls"
            elif isinstance(reason, (TimeoutError, socket.timeout)):
                kind = "timeout"
            else:
                kind = "network"
            raise MarketplaceUpstreamError(kind, url, str(reason)) from error
        except OSError as error:
            raise MarketplaceUpstreamError("network", url, str(error)) from error


__all__ = [
    "MarketplaceHttpClient",
    "configured_base_url",
    "configured_marketplace_ca_file",
    "marketplace_ssl_context",
]
