from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from skill_manager.platform_context import PlatformName, resolve_platform_context


@dataclass(frozen=True)
class ResolutionContext:
    env: dict[str, str]
    platform: PlatformName
    sys_platform: str
    home: Path
    xdg_config_home: Path
    xdg_data_home: Path
    xdg_state_home: Path

def resolve_context(env: dict[str, str] | None = None) -> ResolutionContext:
    platform_context = resolve_platform_context(env)
    return ResolutionContext(
        env=platform_context.env,
        platform=platform_context.platform,
        sys_platform=platform_context.sys_platform,
        home=platform_context.home,
        xdg_config_home=platform_context.xdg_config_home,
        xdg_data_home=platform_context.xdg_data_home,
        xdg_state_home=platform_context.xdg_state_home,
    )
