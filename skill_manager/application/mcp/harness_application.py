from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable, Literal

from .contracts import McpHarnessAdapter
from .read_models import McpReadModelService
from .store import McpServerSpec

HarnessAction = Literal["enable", "disable"]
ManifestCommit = Callable[[], None]


@dataclass(frozen=True)
class McpHarnessApplicationResult:
    succeeded: list[str]
    failed: list[dict[str, str]]

    @property
    def ok(self) -> bool:
        return not self.failed

    @property
    def changed(self) -> bool:
        return bool(self.succeeded)

    def to_dict(self) -> dict[str, object]:
        return {
            "ok": self.ok,
            "succeeded": self.succeeded,
            "failed": self.failed,
        }


class McpHarnessApplication:
    def __init__(self, read_models: McpReadModelService) -> None:
        self.read_models = read_models

    def enable_one(
        self,
        adapter: McpHarnessAdapter,
        spec: McpServerSpec,
        *,
        commit: ManifestCommit | None = None,
    ) -> McpHarnessApplicationResult:
        try:
            adapter.enable_server(spec)
        except Exception as error:  # noqa: BLE001
            return McpHarnessApplicationResult(
                succeeded=[],
                failed=[{"harness": adapter.harness, "error": str(error)}],
            )
        if commit is not None:
            commit()
        self.read_models.invalidate()
        return McpHarnessApplicationResult(succeeded=[adapter.harness], failed=[])

    def enable_many(
        self,
        spec: McpServerSpec,
        harnesses: Iterable[str],
        *,
        writable_only: bool = False,
        skip_harnesses: Iterable[str] = (),
        commit: ManifestCommit | None = None,
    ) -> McpHarnessApplicationResult:
        targets = set(harnesses)
        skipped = set(skip_harnesses)
        adapters = (
            self.read_models.enabled_writable_adapters()
            if writable_only
            else self.read_models.enabled_adapters()
        )
        succeeded: list[str] = []
        failed: list[dict[str, str]] = []
        for adapter in adapters:
            if adapter.harness not in targets or adapter.harness in skipped:
                continue
            try:
                adapter.enable_server(spec)
            except Exception as error:  # noqa: BLE001
                failed.append({"harness": adapter.harness, "error": str(error)})
                continue
            succeeded.append(adapter.harness)

        if succeeded:
            if commit is not None:
                commit()
            self.read_models.invalidate()
        return McpHarnessApplicationResult(succeeded=succeeded, failed=failed)

    def disable_many(
        self,
        name: str,
        harnesses: Iterable[str],
        *,
        addressable_only: bool = False,
        remove_after_full_success: Callable[[], None] | None = None,
    ) -> McpHarnessApplicationResult:
        targets = set(harnesses)
        adapters = (
            self.read_models.enabled_addressable_adapters()
            if addressable_only
            else self.read_models.enabled_adapters()
        )
        succeeded: list[str] = []
        failed: list[dict[str, str]] = []
        for adapter in adapters:
            if adapter.harness not in targets:
                continue
            try:
                adapter.disable_server(name)
            except Exception as error:  # noqa: BLE001
                failed.append({"harness": adapter.harness, "error": str(error)})
                continue
            succeeded.append(adapter.harness)

        if not failed and remove_after_full_success is not None:
            remove_after_full_success()
        if succeeded or (not failed and remove_after_full_success is not None):
            self.read_models.invalidate()
        return McpHarnessApplicationResult(succeeded=succeeded, failed=failed)


__all__ = ["McpHarnessApplication", "McpHarnessApplicationResult"]
