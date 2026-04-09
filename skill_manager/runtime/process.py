from __future__ import annotations

import os
from pathlib import Path
import signal
import subprocess
import time

from .state import RuntimeState


def process_is_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def process_command(pid: int) -> str:
    result = subprocess.run(
        ["ps", "-p", str(pid), "-o", "command="],
        check=False,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def is_owned_runtime_process(state: RuntimeState) -> bool:
    if not process_is_alive(state.pid):
        return False
    command = process_command(state.pid)
    if not command:
        return False
    if state.executable and state.executable in command:
        return True
    executable_name = Path(state.executable).name if state.executable else ""
    if executable_name and executable_name in command:
        return True
    return "skill_manager" in command or "skill-manager" in command


def terminate_process(pid: int, *, timeout_seconds: float = 5.0) -> None:
    if not process_is_alive(pid):
        return
    os.kill(pid, signal.SIGTERM)
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if not process_is_alive(pid):
            return
        time.sleep(0.05)
    os.kill(pid, signal.SIGKILL)
