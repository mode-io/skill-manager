from __future__ import annotations

import os
from pathlib import Path
import sys


APP_NAME = "skill-manager"
STATE_DIR_ENV = "SKILL_MANAGER_STATE_DIR"


def state_dir(env: dict[str, str] | None = None) -> Path:
    active_env = dict(os.environ)
    if env is not None:
        active_env.update(env)

    override = active_env.get(STATE_DIR_ENV)
    if override:
        return Path(override)

    home = Path(active_env.get("HOME", str(Path.home())))
    if sys.platform == "darwin":
        return home / "Library" / "Application Support" / APP_NAME

    xdg_state_home = active_env.get("XDG_STATE_HOME")
    if xdg_state_home:
        return Path(xdg_state_home) / APP_NAME
    return home / ".local" / "state" / APP_NAME
