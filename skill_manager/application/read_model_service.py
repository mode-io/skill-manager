from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
import time

from skill_manager.domain import HarnessScan, StoreScan
from skill_manager.errors import MutationError
from skill_manager.harness import HarnessDriver, HarnessManager, HarnessStatus, collect_harness_statuses, create_default_drivers, scan_all_harnesses, supported_harness_ids
from skill_manager.storage_paths import default_harness_support_path, resolve_shared_store_root
from skill_manager.store import HarnessSupportStore, SharedStore


@dataclass(frozen=True)
class ReadModelSnapshot:
    store_scan: StoreScan
    harness_scans: tuple[HarnessScan, ...]


@dataclass(frozen=True)
class CachedSnapshot:
    snapshot: ReadModelSnapshot
    captured_at: float


class ReadModelService:
    def __init__(
        self,
        *,
        store: SharedStore,
        harness_drivers: tuple[HarnessDriver, ...],
        support_store: HarnessSupportStore,
        snapshot_ttl_seconds: float = 1.0,
    ) -> None:
        self.store = store
        self.harness_drivers = harness_drivers
        self.support_store = support_store
        self.snapshot_ttl_seconds = snapshot_ttl_seconds
        self._snapshot_cache: CachedSnapshot | None = None
        self._lock = Lock()

    @classmethod
    def from_environment(
        cls,
        env: dict[str, str] | None = None,
        *,
        support_store: HarnessSupportStore | None = None,
    ) -> "ReadModelService":
        active_env = env or {}
        store = SharedStore(resolve_shared_store_root(active_env))
        active_support_store = support_store or HarnessSupportStore(default_harness_support_path(active_env))
        drivers = create_default_drivers(active_env)
        return cls(store=store, harness_drivers=drivers, support_store=active_support_store)

    def find_driver(self, harness: str) -> HarnessDriver | None:
        return next((driver for driver in self.harness_drivers if driver.harness == harness), None)

    def find_manager(self, harness: str) -> HarnessManager | None:
        driver = self.find_driver(harness)
        if driver is None:
            return None
        return driver.manager()

    def require_enabled_manager(self, harness: str) -> HarnessManager:
        driver = self.find_driver(harness)
        if driver is None:
            raise MutationError(f"unknown harness: {harness}", status=400)
        if harness not in self.enabled_harnesses():
            raise MutationError(f"harness support is disabled: {harness}", status=400)
        status = driver.status()
        if not status.installed:
            raise MutationError(f"{driver.label} is not installed or not available on PATH", status=400)
        manager = driver.manager()
        if manager is None:
            raise MutationError(f"harness cannot be managed: {harness}", status=400)
        return manager

    def enabled_harnesses(self) -> tuple[str, ...]:
        return self.support_store.enabled_harnesses(supported_harness_ids())

    def enabled_managers(self) -> tuple[tuple[str, HarnessManager], ...]:
        enabled = set(self.enabled_harnesses())
        managers: list[tuple[str, HarnessManager]] = []
        for driver in self.harness_drivers:
            if driver.harness not in enabled:
                continue
            manager = driver.manager()
            if manager is not None:
                managers.append((driver.harness, manager))
        return tuple(managers)

    def all_managers(self) -> tuple[tuple[str, HarnessManager], ...]:
        managers: list[tuple[str, HarnessManager]] = []
        for driver in self.harness_drivers:
            manager = driver.manager()
            if manager is not None:
                managers.append((driver.harness, manager))
        return tuple(managers)

    def harness_statuses(self) -> tuple[HarnessStatus, ...]:
        return collect_harness_statuses(self.harness_drivers)

    def snapshot(self) -> ReadModelSnapshot:
        with self._lock:
            cached = self._snapshot_cache
            if cached is not None and (time.time() - cached.captured_at) < self.snapshot_ttl_seconds:
                return cached.snapshot

        store_scan = self.store.scan()
        enabled = set(self.enabled_harnesses())
        active_drivers = tuple(
            driver for driver in self.harness_drivers if driver.harness in enabled
        )
        harness_scans = scan_all_harnesses(active_drivers)
        snapshot = ReadModelSnapshot(
            store_scan=store_scan,
            harness_scans=harness_scans,
        )
        with self._lock:
            self._snapshot_cache = CachedSnapshot(snapshot=snapshot, captured_at=time.time())
        return snapshot

    def invalidate(self) -> None:
        with self._lock:
            self._snapshot_cache = None
        for driver in self.harness_drivers:
            driver.invalidate()
