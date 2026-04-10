from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from skill_manager.domain import HarnessScan

from .catalog import supported_harness_definitions
from .contracts import HarnessAdapter, HarnessStatus
from .path_resolver import resolve_harness_paths


def create_default_adapters(
    env: dict[str, str] | None = None,
) -> tuple[HarnessAdapter, ...]:
    active_env = env or {}
    paths = resolve_harness_paths(active_env)
    return tuple(
        definition.create_adapter(active_env, paths)
        for definition in supported_harness_definitions()
    )


def scan_all_harnesses(adapters: tuple[HarnessAdapter, ...]) -> tuple[HarnessScan, ...]:
    if not adapters:
        return ()
    with ThreadPoolExecutor(max_workers=len(adapters)) as executor:
        scans = executor.map(lambda adapter: adapter.scan(), adapters)
        return tuple(scans)


def collect_harness_statuses(adapters: tuple[HarnessAdapter, ...]) -> tuple[HarnessStatus, ...]:
    if not adapters:
        return ()
    with ThreadPoolExecutor(max_workers=len(adapters)) as executor:
        statuses = executor.map(lambda adapter: adapter.status(), adapters)
        return tuple(statuses)
