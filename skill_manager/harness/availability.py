from __future__ import annotations

from collections.abc import Sequence
import subprocess
import shutil

from skill_manager.platform_context import PlatformName


VERSION_PROBE_TIMEOUT_SECONDS = 3.0


def probe_command_succeeds(argv: Sequence[str], *, timeout_seconds: float) -> bool:
    """Run a short health probe against an already-resolved executable.

    A timeout counts as success. Reaching it means the OS launched the
    executable and it was merely slow, which is what the probe asks about:
    some CLIs run update or environment checks on a cold start, and a slow
    one must not disappear from the UI.
    """
    try:
        result = subprocess.run(
            list(argv),
            check=False,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout_seconds,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
    except subprocess.TimeoutExpired:
        return True
    except OSError:
        return False
    return result.returncode == 0


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
    # Windows PATH entries include app-execution aliases and stale shims that
    # resolve but cannot run, so discovery there has to invoke the command.
    return probe_command_succeeds(
        [executable, "--version"],
        timeout_seconds=VERSION_PROBE_TIMEOUT_SECONDS,
    )


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


__all__ = [
    "any_command_is_available",
    "command_is_available",
    "probe_command_succeeds",
]
