from __future__ import annotations

import re
from typing import Mapping


_ENV_REF_PATTERN = re.compile(r"^\$\{env:[A-Z][A-Z0-9_]*\}$")


def is_env_var_reference(value: str) -> bool:
    return bool(_ENV_REF_PATTERN.match(value or ""))


def annotate_env(
    env: Mapping[str, str] | tuple[tuple[str, str], ...] | None,
) -> list[dict[str, object]]:
    """Render env entries exactly as stored in the local manifest."""
    if not env:
        return []
    pairs = env.items() if isinstance(env, Mapping) else env
    return [
        {
            "key": key,
            "value": value,
            "isEnvRef": is_env_var_reference(value),
        }
        for key, value in pairs
    ]


__all__ = ["annotate_env", "is_env_var_reference"]
