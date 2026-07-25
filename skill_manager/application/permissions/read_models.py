from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from threading import Lock

from skill_manager.errors import MutationError
from skill_manager.harness import HarnessKernelService

from .adapters import build_permissions_adapters
from .contracts import (
    PermissionHarnessAdapter,
    PermissionHarnessScan,
    PermissionHarnessStatus,
)
from .store import PermissionSpec, PermissionStore


@dataclass(frozen=True)
class PermissionsReadModelSnapshot:
    harness_scans: tuple[PermissionHarnessScan, ...]


@dataclass(frozen=True)
class _CachedSnapshot:
    snapshot: PermissionsReadModelSnapshot
    captured_at: float


class PermissionsReadModelService:
    def __init__(
        self,
        *,
        store: PermissionStore,
        adapters: tuple[PermissionHarnessAdapter, ...],
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
        store: PermissionStore,
        kernel: HarnessKernelService,
    ) -> "PermissionsReadModelService":
        return cls(store=store, adapters=build_permissions_adapters(kernel), kernel=kernel)

    def find_adapter(self, harness: str) -> PermissionHarnessAdapter | None:
        return next((adapter for adapter in self.adapters if adapter.harness == harness), None)

    def enabled_harnesses(self) -> tuple[str, ...]:
        return self.kernel.enabled_harness_ids_for_family("permissions")

    def visible_harnesses(self) -> tuple[str, ...]:
        return self.enabled_harnesses()

    def enabled_adapters(self) -> tuple[PermissionHarnessAdapter, ...]:
        enabled = set(self.enabled_harnesses())
        return tuple(adapter for adapter in self.adapters if adapter.harness in enabled)

    def visible_scans(
        self,
        snapshot: PermissionsReadModelSnapshot | None = None,
    ) -> tuple[PermissionHarnessScan, ...]:
        current = snapshot or self.snapshot()
        visible = set(self.visible_harnesses())
        return tuple(scan for scan in current.harness_scans if scan.harness in visible)

    def require_enabled_adapter(self, harness: str) -> PermissionHarnessAdapter:
        adapter = self.find_adapter(harness)
        if adapter is None:
            raise MutationError(f"unknown harness: {harness}", status=400)
        if harness not in self.enabled_harnesses():
            raise MutationError(f"harness support is disabled: {harness}", status=400)
        status = adapter.status()
        if not status.installed and not status.config_present:
            raise MutationError(
                f"{adapter.label} is not installed and has no permissions config file",
                status=400,
            )
        return adapter

    def harness_statuses(self) -> tuple[PermissionHarnessStatus, ...]:
        return tuple(adapter.status() for adapter in self.adapters)

    def snapshot(self) -> PermissionsReadModelSnapshot:
        with self._lock:
            cached = self._cache
            if cached is not None and (time.time() - cached.captured_at) < self.snapshot_ttl_seconds:
                return cached.snapshot

        specs = self.store.list_managed()
        if not self.adapters:
            scans: tuple[PermissionHarnessScan, ...] = ()
        else:
            with ThreadPoolExecutor(max_workers=max(2, len(self.adapters))) as executor:
                scans = tuple(executor.map(lambda adapter: adapter.scan(specs), self.adapters))
        snapshot = PermissionsReadModelSnapshot(harness_scans=scans)
        with self._lock:
            self._cache = _CachedSnapshot(snapshot=snapshot, captured_at=time.time())
        return snapshot

    def invalidate(self) -> None:
        with self._lock:
            self._cache = None
        for adapter in self.adapters:
            adapter.invalidate()


__all__ = ["PermissionsReadModelService", "PermissionsReadModelSnapshot"]
