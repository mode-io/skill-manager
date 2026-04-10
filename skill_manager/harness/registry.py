from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from skill_manager.domain import HarnessScan

from .catalog import supported_harness_definitions
from .contracts import HarnessDriver, HarnessStatus
from .resolution import resolve_context


def create_default_drivers(
    env: dict[str, str] | None = None,
) -> tuple[HarnessDriver, ...]:
    context = resolve_context(env)
    return tuple(
        definition.create_driver(context)
        for definition in supported_harness_definitions()
    )


def scan_all_harnesses(drivers: tuple[HarnessDriver, ...]) -> tuple[HarnessScan, ...]:
    if not drivers:
        return ()
    with ThreadPoolExecutor(max_workers=len(drivers)) as executor:
        scans = executor.map(lambda driver: driver.scan(), drivers)
        return tuple(scans)


def collect_harness_statuses(drivers: tuple[HarnessDriver, ...]) -> tuple[HarnessStatus, ...]:
    if not drivers:
        return ()
    with ThreadPoolExecutor(max_workers=len(drivers)) as executor:
        statuses = executor.map(lambda driver: driver.status(), drivers)
        return tuple(statuses)
