from __future__ import annotations

import os
from pathlib import Path

from .app_paths import app_config_dir, app_data_dir


SETTINGS_PATH_ENV = "SKILL_MANAGER_SETTINGS_PATH"


def canonical_shared_store_root(env: dict[str, str] | None = None) -> Path:
    active_env = _active_env(env)
    return app_data_dir(active_env) / "shared"


def legacy_shared_store_root(env: dict[str, str] | None = None) -> Path:
    active_env = _active_env(env)
    home = Path(active_env.get("HOME", str(Path.home())))
    return home / ".local" / "share" / "skill-manager" / "shared"


def resolve_shared_store_root(env: dict[str, str] | None = None) -> Path:
    active_env = _active_env(env)
    canonical_root = canonical_shared_store_root(active_env)
    legacy_root = legacy_shared_store_root(active_env)
    if canonical_root == legacy_root:
        return canonical_root
    if _store_location_initialized(canonical_root):
        return canonical_root
    if _store_location_initialized(legacy_root):
        return legacy_root
    return canonical_root


def canonical_marketplace_cache_root(env: dict[str, str] | None = None) -> Path:
    active_env = _active_env(env)
    return app_data_dir(active_env) / "marketplace"


def default_harness_support_path(env: dict[str, str] | None = None) -> Path:
    active_env = _active_env(env)
    override = active_env.get(SETTINGS_PATH_ENV)
    if override:
        return Path(override)
    return app_config_dir(active_env) / "settings.json"


def _store_location_initialized(root: Path) -> bool:
    manifest_path = root.parent / "manifest.json"
    if manifest_path.is_file():
        return True
    if not root.is_dir():
        return False
    return any(root.iterdir())


def _active_env(env: dict[str, str] | None) -> dict[str, str]:
    active_env = dict(os.environ)
    if env is not None:
        active_env.update(env)
    return active_env
