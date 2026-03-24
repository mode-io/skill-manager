from __future__ import annotations

from dataclasses import dataclass

from skill_manager.domain import HarnessScan, StoreScan
from skill_manager.harness import CommandRunner, HarnessAdapter, create_default_adapters, scan_all_harnesses
from skill_manager.store import SharedStore, default_shared_store_root


@dataclass(frozen=True)
class ReadModelSnapshot:
    store_scan: StoreScan
    harness_scans: tuple[HarnessScan, ...]


class ReadModelService:
    def __init__(self, *, store: SharedStore, harness_adapters: tuple[HarnessAdapter, ...]) -> None:
        self.store = store
        self.harness_adapters = harness_adapters

    @classmethod
    def from_environment(
        cls,
        env: dict[str, str] | None = None,
        *,
        command_runner: CommandRunner | None = None,
    ) -> "ReadModelService":
        active_env = env or {}
        store = SharedStore(default_shared_store_root(active_env))
        adapters = create_default_adapters(active_env, command_runner=command_runner)
        return cls(store=store, harness_adapters=adapters)

    def find_adapter(self, harness: str) -> HarnessAdapter | None:
        return next((a for a in self.harness_adapters if a.config.harness == harness), None)

    def snapshot(self) -> ReadModelSnapshot:
        store_scan = self.store.scan()
        harness_scans = scan_all_harnesses(self.harness_adapters)
        return ReadModelSnapshot(
            store_scan=store_scan,
            harness_scans=harness_scans,
        )
