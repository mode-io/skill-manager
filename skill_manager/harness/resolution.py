from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ResolutionContext:
    env: dict[str, str]
    home: Path
    xdg_config_home: Path
    xdg_data_home: Path

def resolve_context(env: dict[str, str] | None = None) -> ResolutionContext:
    active_env = dict(env or {})
    home = Path(active_env.get("HOME", str(Path.home())))
    return ResolutionContext(
        env=active_env,
        home=home,
        xdg_config_home=Path(active_env.get("XDG_CONFIG_HOME", home / ".config")),
        xdg_data_home=Path(active_env.get("XDG_DATA_HOME", home / ".local" / "share")),
    )
