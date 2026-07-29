from __future__ import annotations

import subprocess
import shutil

from skill_manager.platform_context import PlatformName


def command_is_available(
    command: str,
    *,
    path_env: str | None,
    platform: PlatformName,
) -> bool:
    executable = shutil.which(command, path=path_env)
    if executable is None:
        return False
    if platform != "windows":
        return True
    try:
        result = subprocess.run(
            [executable, "--version"],
            check=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=3,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except (OSError, subprocess.TimeoutExpired):
        return False
    return result.returncode == 0


def any_command_is_available(
    commands: tuple[str, ...],
    *,
    path_env: str | None,
    platform: PlatformName,
) -> bool:
    return any(
        command_is_available(
            command,
            path_env=path_env,
            platform=platform,
        )
        for command in commands
    )


__all__ = ["any_command_is_available", "command_is_available"]
