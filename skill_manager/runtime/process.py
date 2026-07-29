from __future__ import annotations

import ctypes
from ctypes import wintypes
import os
from pathlib import Path
import signal
import shutil
import subprocess
import time

from .state import RuntimeState


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
    process_query_limited_information = 0x1000
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    open_process = kernel32.OpenProcess
    open_process.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    open_process.restype = wintypes.HANDLE
    get_process_times = kernel32.GetProcessTimes
    get_process_times.argtypes = [
        wintypes.HANDLE,
        ctypes.POINTER(wintypes.FILETIME),
        ctypes.POINTER(wintypes.FILETIME),
        ctypes.POINTER(wintypes.FILETIME),
        ctypes.POINTER(wintypes.FILETIME),
    ]
    get_process_times.restype = wintypes.BOOL
    close_handle = kernel32.CloseHandle
    close_handle.argtypes = [wintypes.HANDLE]
    close_handle.restype = wintypes.BOOL

    handle = open_process(process_query_limited_information, False, pid)
    if not handle:
        return None
    try:
        creation = wintypes.FILETIME()
        exit_time = wintypes.FILETIME()
        kernel_time = wintypes.FILETIME()
        user_time = wintypes.FILETIME()
        if not get_process_times(
            handle,
            ctypes.byref(creation),
            ctypes.byref(exit_time),
            ctypes.byref(kernel_time),
            ctypes.byref(user_time),
        ):
            return None
        windows_ticks = (creation.dwHighDateTime << 32) | creation.dwLowDateTime
        return (windows_ticks - 116444736000000000) / 10_000_000
    finally:
        close_handle(handle)


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


def _windows_process_image(pid: int) -> str | None:
    if not _is_windows():
        return None
    process_query_limited_information = 0x1000
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    open_process = kernel32.OpenProcess
    open_process.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    open_process.restype = wintypes.HANDLE
    close_handle = kernel32.CloseHandle
    close_handle.argtypes = [wintypes.HANDLE]
    close_handle.restype = wintypes.BOOL
    query_image = kernel32.QueryFullProcessImageNameW
    query_image.argtypes = [
        wintypes.HANDLE,
        wintypes.DWORD,
        wintypes.LPWSTR,
        ctypes.POINTER(wintypes.DWORD),
    ]
    query_image.restype = wintypes.BOOL

    handle = open_process(process_query_limited_information, False, pid)
    if not handle:
        return None
    try:
        buffer = ctypes.create_unicode_buffer(32768)
        size = wintypes.DWORD(len(buffer))
        if not query_image(handle, 0, buffer, ctypes.byref(size)):
            return None
        return buffer.value
    finally:
        close_handle(handle)


def _terminate_windows_process(pid: int) -> None:
    process_terminate = 0x0001
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    open_process = kernel32.OpenProcess
    open_process.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    open_process.restype = wintypes.HANDLE
    terminate = kernel32.TerminateProcess
    terminate.argtypes = [wintypes.HANDLE, wintypes.UINT]
    terminate.restype = wintypes.BOOL
    close_handle = kernel32.CloseHandle
    close_handle.argtypes = [wintypes.HANDLE]
    close_handle.restype = wintypes.BOOL

    handle = open_process(process_terminate, False, pid)
    if not handle:
        if not process_is_alive(pid):
            return
        raise OSError(ctypes.get_last_error(), f"unable to open process {pid} for termination")
    try:
        if not terminate(handle, 0):
            raise OSError(ctypes.get_last_error(), f"unable to terminate process {pid}")
    finally:
        close_handle(handle)
