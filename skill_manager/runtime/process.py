from __future__ import annotations

from contextlib import contextmanager
import ctypes
from ctypes import wintypes
from functools import lru_cache
import os
from pathlib import Path
import signal
import shutil
import subprocess
import time
from typing import Iterator

from .state import RuntimeState


PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
PROCESS_TERMINATE = 0x0001
# FILETIME counts 100ns ticks from 1601-01-01; Unix time starts 369 years later.
UNIX_EPOCH_IN_FILETIME_TICKS = 116_444_736_000_000_000
FILETIME_TICKS_PER_SECOND = 10_000_000


def process_is_alive(pid: int) -> bool:
    if _is_windows():
        return _windows_process_image(pid) is not None
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def process_command(pid: int) -> str:
    if _is_windows():
        return _windows_process_image(pid) or ""
    ps_executable = _resolve_ps_executable()
    if not ps_executable:
        return ""
    result = subprocess.run(
        [ps_executable, "-p", str(pid), "-o", "command="],
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
    if _is_windows():
        if not _same_executable(command, state.executable):
            return False
        if state.process_started_at is None:
            return False
        actual_started_at = process_started_at(state.pid)
        return actual_started_at is not None and abs(
            actual_started_at - state.process_started_at
        ) < 1.0
    if state.executable and state.executable in command:
        return True
    executable_name = Path(state.executable).name if state.executable else ""
    if executable_name and executable_name in command:
        return True
    return "skill_manager" in command or "skill-manager" in command


def terminate_process(pid: int, *, timeout_seconds: float = 5.0) -> None:
    if not process_is_alive(pid):
        return
    if _is_windows():
        _terminate_windows_process(pid)
        _wait_for_exit(pid, timeout_seconds)
        return
    os.kill(pid, signal.SIGTERM)
    if _wait_for_exit(pid, timeout_seconds):
        return
    os.kill(pid, signal.SIGKILL)


def process_started_at(pid: int) -> float | None:
    if not _is_windows():
        return None
    with _windows_process_handle(pid, PROCESS_QUERY_LIMITED_INFORMATION) as handle:
        if handle is None:
            return None
        creation = wintypes.FILETIME()
        exit_time = wintypes.FILETIME()
        kernel_time = wintypes.FILETIME()
        user_time = wintypes.FILETIME()
        if not _kernel32().GetProcessTimes(
            handle,
            ctypes.byref(creation),
            ctypes.byref(exit_time),
            ctypes.byref(kernel_time),
            ctypes.byref(user_time),
        ):
            return None
        ticks = (creation.dwHighDateTime << 32) | creation.dwLowDateTime
        return (ticks - UNIX_EPOCH_IN_FILETIME_TICKS) / FILETIME_TICKS_PER_SECOND


def _resolve_ps_executable() -> str | None:
    for path_env in (os.environ.get("PATH"), os.defpath):
        executable = shutil.which("ps", path=path_env)
        if executable:
            return executable
    for candidate in (Path("/bin/ps"), Path("/usr/bin/ps")):
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return str(candidate)
    return None


def _is_windows() -> bool:
    return os.name == "nt"


def _same_executable(left: str, right: str) -> bool:
    if not left or not right:
        return False
    return os.path.normcase(os.path.realpath(left)) == os.path.normcase(os.path.realpath(right))


def _wait_for_exit(pid: int, timeout_seconds: float) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if not process_is_alive(pid):
            return True
        time.sleep(0.05)
    return not process_is_alive(pid)


@lru_cache(maxsize=1)
def _kernel32() -> "ctypes.WinDLL":
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL
    kernel32.QueryFullProcessImageNameW.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.LPWSTR,
        ctypes.POINTER(wintypes.DWORD),
    ]
    kernel32.QueryFullProcessImageNameW.restype = wintypes.BOOL
    kernel32.GetProcessTimes.argtypes = [
        wintypes.HANDLE,
        *(ctypes.POINTER(wintypes.FILETIME),) * 4,
    ]
    kernel32.GetProcessTimes.restype = wintypes.BOOL
    kernel32.TerminateProcess.argtypes = [wintypes.HANDLE, wintypes.UINT]
    kernel32.TerminateProcess.restype = wintypes.BOOL
    return kernel32


@contextmanager
def _windows_process_handle(pid: int, access: int) -> Iterator["wintypes.HANDLE | None"]:
    """Open a process handle, yielding None when the process is gone or denied."""
    kernel32 = _kernel32()
    handle = kernel32.OpenProcess(access, False, pid)
    try:
        yield handle or None
    finally:
        if handle:
            kernel32.CloseHandle(handle)


def _windows_process_image(pid: int) -> str | None:
    if not _is_windows():
        return None
    with _windows_process_handle(pid, PROCESS_QUERY_LIMITED_INFORMATION) as handle:
        if handle is None:
            return None
        buffer = ctypes.create_unicode_buffer(32768)
        size = wintypes.DWORD(len(buffer))
        if not _kernel32().QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
            return None
        return buffer.value


def _terminate_windows_process(pid: int) -> None:
    with _windows_process_handle(pid, PROCESS_TERMINATE) as handle:
        if handle is None:
            # Read the failure before process_is_alive issues its own calls.
            open_error = ctypes.get_last_error()
            if not process_is_alive(pid):
                return
            raise OSError(open_error, f"unable to open process {pid} for termination")
        if not _kernel32().TerminateProcess(handle, 0):
            raise OSError(ctypes.get_last_error(), f"unable to terminate process {pid}")
