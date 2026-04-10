from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
import time

from skill_manager.domain import HarnessScan, StoreScan
from skill_manager.harness import HarnessAdapter, HarnessStatus, collect_harness_statuses, create_default_adapters, scan_all_harnesses, supported_harness_ids
from skill_manager.store import HarnessSupportStore, SharedStore, default_harness_support_path, default_shared_store_root


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
        harness_adapters: tuple[HarnessAdapter, ...],
        support_store: HarnessSupportStore,
        snapshot_ttl_seconds: float = 1.0,
    ) -> None:
        self.store = store
        self.harness_adapters = harness_adapters
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
        store = SharedStore(default_shared_store_root(active_env))
        active_support_store = support_store or HarnessSupportStore(default_harness_support_path(active_env))
        adapters = create_default_adapters(active_env)
        return cls(store=store, harness_adapters=adapters, support_store=active_support_store)

    def find_adapter(self, harness: str) -> HarnessAdapter | None:
        if harness not in self.enabled_harnesses():
            return None
        return next((a for a in self.harness_adapters if a.config.harness == harness), None)

    def enabled_harnesses(self) -> tuple[str, ...]:
        return self.support_store.enabled_harnesses(supported_harness_ids())

    def harness_statuses(self) -> tuple[HarnessStatus, ...]:
        return collect_harness_statuses(self.harness_adapters)

    def snapshot(self) -> ReadModelSnapshot:
        with self._lock:
            cached = self._snapshot_cache
            if cached is not None and (time.time() - cached.captured_at) < self.snapshot_ttl_seconds:
                return cached.snapshot

        store_scan = self.store.scan()
        enabled = set(self.enabled_harnesses())
        active_adapters = tuple(
            adapter for adapter in self.harness_adapters if adapter.config.harness in enabled
        )
        harness_scans = scan_all_harnesses(active_adapters)
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
        for adapter in self.harness_adapters:
            adapter.invalidate()
