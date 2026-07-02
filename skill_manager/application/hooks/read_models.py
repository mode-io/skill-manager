from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from threading import Lock

from skill_manager.errors import MutationError
from skill_manager.harness import HarnessKernelService

from .adapters import build_hooks_adapters
from .contracts import HookHarnessAdapter, HookHarnessScan, HookHarnessStatus
from .store import HookStore, HookSpec


@dataclass(frozen=True)
class HooksReadModelSnapshot:
    harness_scans: tuple[HookHarnessScan, ...]


@dataclass(frozen=True)
class _CachedSnapshot:
    snapshot: HooksReadModelSnapshot
    captured_at: float


class HooksReadModelService:
    def __init__(
        self,
        *,
        store: HookStore,
        adapters: tuple[HookHarnessAdapter, ...],
        kernel: HarnessKernelService,
        snapshot_ttl_seconds: float = 1.0,
    ) -> None:
        self.store = store
        self.adapters = adapters
        self.kernel = kernel
        self.snapshot_ttl_seconds = snapshot_ttl_seconds
        self._cache: _CachedSnapshot | None = None
        self._lock = Lock()

    @classmethod
    def from_kernel(
        cls,
        *,
        store: HookStore,
        kernel: HarnessKernelService,
    ) -> "HooksReadModelService":
        return cls(store=store, adapters=build_hooks_adapters(kernel), kernel=kernel)

    def find_adapter(self, harness: str) -> HookHarnessAdapter | None:
        return next((adapter for adapter in self.adapters if adapter.harness == harness), None)

    def enabled_harnesses(self) -> tuple[str, ...]:
        return self.kernel.enabled_harness_ids_for_family("hooks")

    def visible_harnesses(self) -> tuple[str, ...]:
        return self.enabled_harnesses()

    def enabled_adapters(self) -> tuple[HookHarnessAdapter, ...]:
        enabled = set(self.enabled_harnesses())
        return tuple(adapter for adapter in self.adapters if adapter.harness in enabled)

    def visible_scans(
        self,
        snapshot: HooksReadModelSnapshot | None = None,
    ) -> tuple[HookHarnessScan, ...]:
        current = snapshot or self.snapshot()
        visible = set(self.visible_harnesses())
        return tuple(scan for scan in current.harness_scans if scan.harness in visible)

    def require_enabled_adapter(self, harness: str) -> HookHarnessAdapter:
        adapter = self.find_adapter(harness)
        if adapter is None:
            raise MutationError(f"unknown harness: {harness}", status=400)
        if harness not in self.enabled_harnesses():
            raise MutationError(f"harness support is disabled: {harness}", status=400)
        status = adapter.status()
        if not status.installed and not status.config_present:
            raise MutationError(
                f"{adapter.label} is not installed and has no hooks config file",
                status=400,
            )
        return adapter

    def harness_statuses(self) -> tuple[HookHarnessStatus, ...]:
        return tuple(adapter.status() for adapter in self.adapters)

    def snapshot(self) -> HooksReadModelSnapshot:
        with self._lock:
            cached = self._cache
            if cached is not None and (time.time() - cached.captured_at) < self.snapshot_ttl_seconds:
                return cached.snapshot

        specs = self.store.list_managed()
        if not self.adapters:
            scans: tuple[HookHarnessScan, ...] = ()
        else:
            with ThreadPoolExecutor(max_workers=max(2, len(self.adapters))) as executor:
                scans = tuple(executor.map(lambda adapter: adapter.scan(specs), self.adapters))
        snapshot = HooksReadModelSnapshot(harness_scans=scans)
        with self._lock:
            self._cache = _CachedSnapshot(snapshot=snapshot, captured_at=time.time())
        return snapshot

    def invalidate(self) -> None:
        with self._lock:
            self._cache = None
        for adapter in self.adapters:
            adapter.invalidate()


__all__ = ["HooksReadModelService", "HooksReadModelSnapshot"]
