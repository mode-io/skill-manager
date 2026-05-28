from __future__ import annotations

import re
from dataclasses import replace
from typing import Mapping
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from .env import annotate_env, is_env_var_reference
from .store import McpServerSpec


REDACTED_MCP_SECRET_VALUE = "[redacted]"

_SECRET_KEY_RE = re.compile(r"(authorization|api[-_]?key|token|secret|password)", re.IGNORECASE)


def redact_spec(spec: McpServerSpec) -> McpServerSpec:
    return replace(
        spec,
        env=_redact_pairs(spec.env),
        headers=_redact_pairs(spec.headers),
        url=redact_url(spec.url),
    )


def redacted_spec_dict(spec: McpServerSpec) -> dict[str, object]:
    return redact_spec(spec).to_dict()


def annotate_redacted_env(
    env: Mapping[str, str] | tuple[tuple[str, str], ...] | None,
) -> list[dict[str, object]]:
    return annotate_env(_redact_pairs(tuple(env.items()) if isinstance(env, Mapping) else env))


def redact_payload(value: object, *, parent_key: str = "") -> object:
    if isinstance(value, Mapping):
        return {
            str(key): _redact_value_for_key(str(key), nested)
            for key, nested in value.items()
        }
    if isinstance(value, list):
        return [redact_payload(item, parent_key=parent_key) for item in value]
    if isinstance(value, str) and parent_key.lower() == "url":
        return redact_url(value)
    return value


def redact_url(url: str | None) -> str | None:
    if not url:
        return url
    parts = urlsplit(url)
    if not parts.query:
        return url
    query = [
        (key, REDACTED_MCP_SECRET_VALUE if is_secret_key(key) else value)
        for key, value in parse_qsl(parts.query, keep_blank_values=True)
    ]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def is_secret_key(key: str) -> bool:
    return bool(_SECRET_KEY_RE.search(key))


def _redact_value_for_key(key: str, value: object) -> object:
    if is_secret_key(key):
        if isinstance(value, str) and is_env_var_reference(value):
            return value
        return REDACTED_MCP_SECRET_VALUE
    return redact_payload(value, parent_key=key)


def _redact_pairs(pairs: tuple[tuple[str, str], ...] | None) -> tuple[tuple[str, str], ...] | None:
    if not pairs:
        return pairs
    return tuple(
        (
            key,
            value if is_env_var_reference(value) or not is_secret_key(key) else REDACTED_MCP_SECRET_VALUE,
        )
        for key, value in pairs
    )


__all__ = [
    "REDACTED_MCP_SECRET_VALUE",
    "annotate_redacted_env",
    "is_secret_key",
    "redact_payload",
    "redact_spec",
    "redact_url",
    "redacted_spec_dict",
]
