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


__all__ = ["command_is_available"]
