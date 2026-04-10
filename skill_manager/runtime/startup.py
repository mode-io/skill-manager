from __future__ import annotations

import sys
import time
from urllib.error import URLError
from urllib.request import urlopen


SOURCE_STARTUP_TIMEOUT_SECONDS = 10.0
PACKAGED_STARTUP_TIMEOUT_SECONDS = 90.0
HEALTHCHECK_REQUEST_TIMEOUT_SECONDS = 2.0


def is_packaged_runtime() -> bool:
    return bool(getattr(sys, "frozen", False))


def startup_timeout_seconds(*, packaged: bool | None = None) -> float:
    active = is_packaged_runtime() if packaged is None else packaged
    return PACKAGED_STARTUP_TIMEOUT_SECONDS if active else SOURCE_STARTUP_TIMEOUT_SECONDS


def healthcheck_ready(base_url: str, *, request_timeout_seconds: float = HEALTHCHECK_REQUEST_TIMEOUT_SECONDS) -> bool:
    try:
        with urlopen(f"{base_url}/api/health", timeout=request_timeout_seconds) as response:
            return response.status == 200
    except URLError:
        return False
    except Exception:  # noqa: BLE001
        return False


def wait_for_health(base_url: str, *, timeout_seconds: float | None = None) -> bool:
    deadline = time.time() + (startup_timeout_seconds() if timeout_seconds is None else timeout_seconds)
    while time.time() < deadline:
        if healthcheck_ready(base_url):
            return True
        time.sleep(0.1)
    return False
