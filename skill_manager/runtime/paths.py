from __future__ import annotations

from pathlib import Path

from skill_manager.app_paths import app_state_dir

STATE_DIR_ENV = "SKILL_MANAGER_STATE_DIR"


def state_dir(env: dict[str, str] | None = None) -> Path:
    active_env = env or {}
    override = active_env.get(STATE_DIR_ENV)
    if override:
        return Path(override)
    return app_state_dir(active_env)
