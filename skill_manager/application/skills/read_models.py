from __future__ import annotations

from dataclasses import dataclass
from threading import Lock
import time

from skill_manager.errors import MutationError
from skill_manager.harness import HarnessKernelService

from .adapters import build_skills_adapters, scan_all_adapters
from .contracts import SkillsHarnessAdapter, SkillsHarnessStatus
from .observations import SkillStoreScan, SkillsHarnessScan
from .store import SkillStore


@dataclass(frozen=True)
class SkillsReadModelSnapshot:
    store_scan: SkillStoreScan
    harness_scans: tuple[SkillsHarnessScan, ...]


@dataclass(frozen=True)
class _CachedSnapshot:
    snapshot: SkillsReadModelSnapshot
    captured_at: float


class SkillsReadModelService:
    def __init__(
        self,
        *,
        store: SkillStore,
        adapters: tuple[SkillsHarnessAdapter, ...],
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
        store: SkillStore,
        kernel: HarnessKernelService,
    ) -> "SkillsReadModelService":
        return cls(
            store=store,
            adapters=build_skills_adapters(kernel),
            kernel=kernel,
        )

    def find_adapter(self, harness: str) -> SkillsHarnessAdapter | None:
        return next((adapter for adapter in self.adapters if adapter.harness == harness), None)

    def visible_harnesses(self) -> tuple[str, ...]:
        return self.kernel.enabled_harness_ids_for_family("skills")

    def enabled_harnesses(self) -> tuple[str, ...]:
        return self.visible_harnesses()

    def enabled_adapters(self) -> tuple[SkillsHarnessAdapter, ...]:
        enabled = set(self.enabled_harnesses())
        return tuple(adapter for adapter in self.adapters if adapter.harness in enabled)

    def enabled_installed_adapters(self) -> tuple[SkillsHarnessAdapter, ...]:
        return tuple(adapter for adapter in self.enabled_adapters() if adapter.status().installed)

    def all_adapters(self) -> tuple[SkillsHarnessAdapter, ...]:
        return self.adapters

    def require_enabled_adapter(self, harness: str) -> SkillsHarnessAdapter:
        adapter = self.find_adapter(harness)
        if adapter is None:
            raise MutationError(f"unknown harness: {harness}", status=400)
        if harness not in self.enabled_harnesses():
            raise MutationError(f"harness support is disabled: {harness}", status=400)
        status = adapter.status()
        if not status.installed:
            raise MutationError(f"{adapter.label} is not installed or not available on PATH", status=400)
        return adapter

    def harness_statuses(self) -> tuple[SkillsHarnessStatus, ...]:
        return tuple(adapter.status() for adapter in self.adapters)

    def visible_scans(
        self,
        snapshot: SkillsReadModelSnapshot | None = None,
    ) -> tuple[SkillsHarnessScan, ...]:
        current = snapshot or self.snapshot()
        visible = set(self.visible_harnesses())
        return tuple(scan for scan in current.harness_scans if scan.harness in visible)

    def snapshot(self) -> SkillsReadModelSnapshot:
        with self._lock:
            cached = self._cache
            if cached is not None and (time.time() - cached.captured_at) < self.snapshot_ttl_seconds:
                return cached.snapshot

        snapshot = SkillsReadModelSnapshot(
            store_scan=self.store.scan(),
            harness_scans=scan_all_adapters(self.adapters),
        )
        with self._lock:
            self._cache = _CachedSnapshot(snapshot=snapshot, captured_at=time.time())
        return snapshot

    def invalidate(self) -> None:
        with self._lock:
            self._cache = None
        for adapter in self.adapters:
            adapter.invalidate()


__all__ = ["SkillsReadModelService", "SkillsReadModelSnapshot"]
