from __future__ import annotations

import os
from pathlib import Path
import sys


APP_NAME = "skill-manager"


def app_config_dir(env: dict[str, str] | None = None) -> Path:
    active_env = _active_env(env)
    home = Path(active_env.get("HOME", str(Path.home())))
    xdg_config_home = active_env.get("XDG_CONFIG_HOME")
    if xdg_config_home:
        return Path(xdg_config_home) / APP_NAME
    if sys.platform == "darwin":
        return home / "Library" / "Application Support" / APP_NAME
    return home / ".config" / APP_NAME


def app_data_dir(env: dict[str, str] | None = None) -> Path:
    active_env = _active_env(env)
    home = Path(active_env.get("HOME", str(Path.home())))
    xdg_data_home = active_env.get("XDG_DATA_HOME")
    if xdg_data_home:
        return Path(xdg_data_home) / APP_NAME
    if sys.platform == "darwin":
        return home / "Library" / "Application Support" / APP_NAME
    return home / ".local" / "share" / APP_NAME


def app_state_dir(env: dict[str, str] | None = None) -> Path:
    active_env = _active_env(env)
    home = Path(active_env.get("HOME", str(Path.home())))
    xdg_state_home = active_env.get("XDG_STATE_HOME")
    if xdg_state_home:
        return Path(xdg_state_home) / APP_NAME
    if sys.platform == "darwin":
        return home / "Library" / "Application Support" / APP_NAME
    return home / ".local" / "state" / APP_NAME


def _active_env(env: dict[str, str] | None) -> dict[str, str]:
    active_env = dict(os.environ)
    if env is not None:
        active_env.update(env)
    return active_env
