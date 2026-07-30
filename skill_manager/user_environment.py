from __future__ import annotations

import re
from typing import Mapping


_WINDOWS_ENV_REFERENCE = re.compile(r"%([^%]+)%")


def live_user_environment_value(name: str, env: Mapping[str, str]) -> str | None:
    """Read a user-scoped variable from the OS rather than this process.

    A long-lived process keeps the environment it was started with, so a
    variable an installer wrote after login is invisible to it. On Windows the
    user scope is readable from the registry, and its values may still contain
    unexpanded `%VAR%` references, which are expanded against `env`. Other
    platforms have no such side channel and always return None.
    """
    raw = _windows_user_environment_value(name)
    if raw is None:
        return None
    return _expand_windows_environment_references(raw, env)


def _windows_user_environment_value(name: str) -> str | None:
    try:
        import winreg
    except ImportError:
        return None

    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, "Environment") as key:
            value, _value_type = winreg.QueryValueEx(key, name)
    except OSError:
        return None
    normalized = str(value).strip()
    return normalized or None


def _expand_windows_environment_references(value: str, env: Mapping[str, str]) -> str:
    lookup = {key.upper(): item for key, item in env.items()}
    return _WINDOWS_ENV_REFERENCE.sub(
        lambda match: lookup.get(match.group(1).upper(), match.group(0)),
        value,
    )


__all__ = ["live_user_environment_value"]
