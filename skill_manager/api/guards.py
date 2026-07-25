"""Request guards for the local, unauthenticated mutation API.

The server binds to loopback and carries no credentials, which is the right
default for a local-first tool — but only if browsers cannot be tricked into
calling it. Two browser-side attacks are in scope:

- **DNS rebinding**: a malicious page rebinds its origin to 127.0.0.1, making
  the browser send requests with the *attacker's* ``Host`` header. Rejecting
  non-loopback ``Host`` values closes this.
- **Cross-site "simple request" CSRF**: HTML forms and ``fetch`` can send
  POSTs cross-origin without a CORS preflight, but they always carry an
  ``Origin`` header naming the attacking site. Rejecting mutations whose
  ``Origin`` is not loopback closes this. Non-browser local clients (curl,
  scripts) send no ``Origin`` and keep working, matching the long-standing
  trust level for same-user local processes.

Both checks are disabled when the operator explicitly launches with
``--allow-remote`` to bind a non-loopback interface.
"""

from __future__ import annotations

import ipaddress
import json
from urllib.parse import urlsplit

from starlette.types import ASGIApp, Receive, Scope, Send

_MUTATION_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
_LOOPBACK_HOSTNAMES = frozenset({"localhost", "localhost."})


def is_loopback_host(host: str) -> bool:
    """True when a ``Host`` header value (optional port) names this machine."""
    normalized = host.strip().lower()
    if not normalized:
        return False
    if normalized.startswith("["):
        # Bracketed IPv6, e.g. "[::1]:8000".
        candidate = normalized[1:].split("]", 1)[0]
    elif normalized.count(":") == 1:
        candidate = normalized.rsplit(":", 1)[0]
    else:
        candidate = normalized
    if candidate in _LOOPBACK_HOSTNAMES:
        return True
    try:
        return ipaddress.ip_address(candidate).is_loopback
    except ValueError:
        return False


class LoopbackOnlyMiddleware:
    """ASGI middleware enforcing the loopback Host/Origin policy above."""

    def __init__(self, app: ASGIApp, *, allow_remote: bool = False) -> None:
        self.app = app
        self.allow_remote = allow_remote

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self.allow_remote:
            await self.app(scope, receive, send)
            return
        headers = {key.decode("latin-1"): value.decode("latin-1") for key, value in scope["headers"]}
        if not is_loopback_host(headers.get("host", "")):
            await _reject(send, "forbidden host: skill-manager only accepts loopback requests")
            return
        if scope["method"] in _MUTATION_METHODS:
            origin = headers.get("origin")
            if origin is not None and not is_loopback_host(urlsplit(origin).hostname or ""):
                await _reject(send, "forbidden origin: mutations must originate from the skill-manager app")
                return
        await self.app(scope, receive, send)


async def _reject(send: Send, message: str) -> None:
    body = json.dumps({"error": message}).encode("utf-8")
    await send(
        {
            "type": "http.response.start",
            "status": 403,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode("ascii"))],
        }
    )
    await send({"type": "http.response.body", "body": body})
