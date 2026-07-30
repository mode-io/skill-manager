from __future__ import annotations

import os
from pathlib import Path
import shutil
import time


WINDOWS_SHARING_VIOLATION = 32


def remove_temporary_tree(
    path: Path,
    *,
    timeout_seconds: float = 5.0,
    retry_interval_seconds: float = 0.05,
    os_name: str | None = None,
) -> None:
    """Remove a test tree, retrying only transient Windows sharing violations."""
    active_os_name = os.name if os_name is None else os_name
    deadline = time.monotonic() + timeout_seconds
    while True:
        try:
            shutil.rmtree(path)
            return
        except FileNotFoundError:
            return
        except PermissionError as error:
            if (
                active_os_name != "nt"
                or getattr(error, "winerror", None) != WINDOWS_SHARING_VIOLATION
                or time.monotonic() >= deadline
            ):
                raise
            time.sleep(retry_interval_seconds)
