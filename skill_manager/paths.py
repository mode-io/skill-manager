from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path


APP_NAME = "skill-manager"

SETTINGS_PATH_ENV = "SKILL_MANAGER_SETTINGS_PATH"
STATE_DIR_ENV = "SKILL_MANAGER_STATE_DIR"


@dataclass(frozen=True)
class AppPaths:
    config_dir: Path
    data_dir: Path
    state_dir: Path
    shared_store_root: Path
    shared_store_manifest: Path
    marketplace_cache_root: Path
    settings_path: Path
    runtime_state_path: Path
    server_log_path: Path


def resolve_app_paths(env: dict[str, str] | None = None) -> AppPaths:
    active_env = _active_env(env)
    config_dir, data_dir, state_dir = _base_dirs(active_env)
    settings_override = active_env.get(SETTINGS_PATH_ENV)
    settings_path = Path(settings_override) if settings_override else config_dir / "settings.json"
    return AppPaths(
        config_dir=config_dir,
        data_dir=data_dir,
        state_dir=state_dir,
        shared_store_root=data_dir / "shared",
        shared_store_manifest=data_dir / "manifest.json",
        marketplace_cache_root=data_dir / "marketplace",
        settings_path=settings_path,
        runtime_state_path=state_dir / "runtime.json",
        server_log_path=state_dir / "server.log",
    )


def _base_dirs(env: dict[str, str]) -> tuple[Path, Path, Path]:
    home = Path(env.get("HOME", str(Path.home())))
    state_override = env.get(STATE_DIR_ENV)

    if sys.platform == "darwin":
        default_macos = home / "Library" / "Application Support" / APP_NAME
        config_dir = _xdg_dir(env, "XDG_CONFIG_HOME", default_macos)
        data_dir = _xdg_dir(env, "XDG_DATA_HOME", default_macos)
        state_dir = (
            Path(state_override)
            if state_override
            else _xdg_dir(env, "XDG_STATE_HOME", default_macos)
        )
    else:
        config_dir = _xdg_dir(env, "XDG_CONFIG_HOME", home / ".config" / APP_NAME)
        data_dir = _xdg_dir(env, "XDG_DATA_HOME", home / ".local" / "share" / APP_NAME)
        state_dir = (
            Path(state_override)
            if state_override
            else _xdg_dir(env, "XDG_STATE_HOME", home / ".local" / "state" / APP_NAME)
        )
    return config_dir, data_dir, state_dir


def _xdg_dir(env: dict[str, str], xdg_key: str, fallback: Path) -> Path:
    override = env.get(xdg_key)
    if override:
        return Path(override) / APP_NAME
    return fallback


def _active_env(env: dict[str, str] | None) -> dict[str, str]:
    active_env = dict(os.environ)
    if env is not None:
        active_env.update(env)
    return active_env
