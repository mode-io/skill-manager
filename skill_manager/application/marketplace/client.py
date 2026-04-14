from __future__ import annotations

import json
import os
from pathlib import Path
import socket
import ssl
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin
from urllib.request import Request, urlopen

import certifi

from skill_manager.errors import MarketplaceUpstreamError

DEFAULT_SKILLS_SH_BASE_URL = "https://skills.sh"
MARKETPLACE_BASE_URL_ENV = "SKILL_MANAGER_MARKETPLACE_BASE_URL"
_TIMEOUT_SECONDS = 15
_USER_AGENT = "skill-manager/0.1"


def configured_marketplace_base_url(env: dict[str, str] | None = None) -> str:
    active_env = os.environ if env is None else env
    configured = active_env.get(MARKETPLACE_BASE_URL_ENV, DEFAULT_SKILLS_SH_BASE_URL).strip()
    return (configured or DEFAULT_SKILLS_SH_BASE_URL).rstrip("/")


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


def skills_sh_detail_url(repo: str, skill_id: str, *, base_url: str = DEFAULT_SKILLS_SH_BASE_URL) -> str:
    normalized = (base_url or DEFAULT_SKILLS_SH_BASE_URL).rstrip("/")
    return f"{normalized}/{quote(repo, safe='/')}/{quote(skill_id, safe='')}"


class SkillsShClient:
    def __init__(
        self,
        *,
        base_url: str = DEFAULT_SKILLS_SH_BASE_URL,
        timeout_seconds: float = _TIMEOUT_SECONDS,
        ssl_context: ssl.SSLContext | None = None,
    ) -> None:
        self.base_url = (base_url or DEFAULT_SKILLS_SH_BASE_URL).rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.ssl_context = ssl_context

    @classmethod
    def from_environment(cls, env: dict[str, str] | None = None) -> "SkillsShClient":
        return cls(
            base_url=configured_marketplace_base_url(env),
            ssl_context=marketplace_ssl_context(env),
        )

    def absolute_url(self, path_or_url: str) -> str:
        if path_or_url.startswith(("http://", "https://")):
            return path_or_url
        return urljoin(f"{self.base_url}/", path_or_url.lstrip("/"))

    def detail_url(self, repo: str, skill_id: str) -> str:
        return skills_sh_detail_url(repo, skill_id, base_url=self.base_url)

    def fetch_text(self, path_or_url: str) -> str:
        return self._request(path_or_url).decode("utf-8", "replace")

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


def _is_packaged_runtime() -> bool:
    return bool(getattr(sys, "frozen", False))
