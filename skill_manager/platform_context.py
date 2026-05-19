from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Literal


PlatformName = Literal["macos", "linux"]


@dataclass(frozen=True)
class PlatformContext:
    platform: PlatformName
    sys_platform: str
    env: dict[str, str]
    home: Path
    xdg_config_home: Path
    xdg_data_home: Path
    xdg_state_home: Path


def resolve_platform_context(
    env: dict[str, str] | None = None,
    *,
    sys_platform: str | None = None,
) -> PlatformContext:
    active_env = dict(os.environ)
    if env is not None:
        active_env.update(env)
    active_sys_platform = sys.platform if sys_platform is None else sys_platform
    platform_name = _platform_name(active_sys_platform)
    home = _path_from_env(active_env, "HOME", Path.home())
    return PlatformContext(
        platform=platform_name,
        sys_platform=active_sys_platform,
        env=active_env,
        home=home,
        xdg_config_home=_path_from_env(active_env, "XDG_CONFIG_HOME", home / ".config"),
        xdg_data_home=_path_from_env(active_env, "XDG_DATA_HOME", home / ".local" / "share"),
        xdg_state_home=_path_from_env(active_env, "XDG_STATE_HOME", home / ".local" / "state"),
    )


def _platform_name(sys_platform: str) -> PlatformName:
    if sys_platform == "darwin":
        return "macos"
    if sys_platform.startswith("linux"):
        return "linux"
    raise RuntimeError(f"unsupported platform: {sys_platform}")


def _path_from_env(env: dict[str, str], key: str, fallback: Path) -> Path:
    value = env.get(key)
    return Path(value) if value else fallback


__all__ = ["PlatformContext", "PlatformName", "resolve_platform_context"]
