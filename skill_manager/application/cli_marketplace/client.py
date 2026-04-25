from __future__ import annotations

import json
import os
import socket
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

from skill_manager.application.marketplace_http import (
    configured_marketplace_ca_file,
    marketplace_ssl_context,
)
from skill_manager.errors import MarketplaceUpstreamError

DEFAULT_CLIS_DEV_BASE_URL = "https://clis.dev"
CLIS_DEV_BASE_URL_ENV = "SKILL_MANAGER_CLIS_DEV_BASE_URL"
_TIMEOUT_SECONDS = 15
_USER_AGENT = "skill-manager/0.1"


def configured_clis_dev_base_url(env: dict[str, str] | None = None) -> str:
    active_env = os.environ if env is None else env
    configured = active_env.get(CLIS_DEV_BASE_URL_ENV, DEFAULT_CLIS_DEV_BASE_URL).strip()
    return (configured or DEFAULT_CLIS_DEV_BASE_URL).rstrip("/")


class ClisDevClient:
    """Small CLIs.dev JSON client for preview-only marketplace reads."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_CLIS_DEV_BASE_URL,
        timeout_seconds: float = _TIMEOUT_SECONDS,
        ssl_context: ssl.SSLContext | None = None,
    ) -> None:
        self.base_url = (base_url or DEFAULT_CLIS_DEV_BASE_URL).rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.ssl_context = ssl_context

    @classmethod
    def from_environment(cls, env: dict[str, str] | None = None) -> "ClisDevClient":
        return cls(
            base_url=configured_clis_dev_base_url(env),
            ssl_context=marketplace_ssl_context(env),
        )

    def absolute_url(self, path_or_url: str) -> str:
        if path_or_url.startswith(("http://", "https://")):
            return path_or_url
        return urljoin(f"{self.base_url}/", path_or_url.lstrip("/"))

    def detail_url(self, slug: str) -> str:
        return self.absolute_url(f"/cli/{quote(slug, safe='')}")

    def list_clis(self) -> dict[str, object]:
        return self.fetch_json("/api/clis")

    def search_clis(self, query: str) -> dict[str, object]:
        return self.fetch_json(f"/api/search?q={quote(query, safe='')}")

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
    "CLIS_DEV_BASE_URL_ENV",
    "DEFAULT_CLIS_DEV_BASE_URL",
    "ClisDevClient",
    "configured_clis_dev_base_url",
    "configured_marketplace_ca_file",
]
