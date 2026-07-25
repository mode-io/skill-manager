from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable, Literal

from .contracts import PermissionHarnessAdapter
from .read_models import PermissionsReadModelService
from .store import PermissionSpec

HarnessAction = Literal["enable", "disable"]
ManifestCommit = Callable[[], None]


@dataclass(frozen=True)
class PermissionsHarnessApplicationResult:
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


class PermissionsHarnessApplication:
    def __init__(self, read_models: PermissionsReadModelService) -> None:
        self.read_models = read_models

    def enable_one(
        self,
        adapter: PermissionHarnessAdapter,
        spec: PermissionSpec,
        *,
        commit: ManifestCommit | None = None,
    ) -> PermissionsHarnessApplicationResult:
        try:
            adapter.enable_permission(spec)
        except Exception as error:  # noqa: BLE001
            return PermissionsHarnessApplicationResult(
                succeeded=[],
                failed=[{"harness": adapter.harness, "error": str(error)}],
            )
        if commit is not None:
            commit()
        self.read_models.invalidate()
        return PermissionsHarnessApplicationResult(succeeded=[adapter.harness], failed=[])

    def enable_many(
        self,
        spec: PermissionSpec,
        harnesses: Iterable[str],
        *,
        skip_harnesses: Iterable[str] = (),
        commit: ManifestCommit | None = None,
    ) -> PermissionsHarnessApplicationResult:
        targets = set(harnesses)
        skipped = set(skip_harnesses)
        adapters = self.read_models.enabled_adapters()
        succeeded: list[str] = []
        failed: list[dict[str, str]] = []
        for adapter in adapters:
            if adapter.harness not in targets or adapter.harness in skipped:
                continue
            try:
                adapter.enable_permission(spec)
            except Exception as error:  # noqa: BLE001
                failed.append({"harness": adapter.harness, "error": str(error)})
                continue
            succeeded.append(adapter.harness)

        if succeeded:
            if commit is not None:
                commit()
            self.read_models.invalidate()
        return PermissionsHarnessApplicationResult(succeeded=succeeded, failed=failed)

    def disable_many(
        self,
        id: str,
        harnesses: Iterable[str],
        *,
        remove_after_full_success: Callable[[], None] | None = None,
    ) -> PermissionsHarnessApplicationResult:
        targets = set(harnesses)
        adapters = self.read_models.enabled_adapters()
        succeeded: list[str] = []
        failed: list[dict[str, str]] = []
        for adapter in adapters:
            if adapter.harness not in targets:
                continue
            try:
                adapter.disable_permission(id)
            except Exception as error:  # noqa: BLE001
                failed.append({"harness": adapter.harness, "error": str(error)})
                continue
            succeeded.append(adapter.harness)

        if not failed and remove_after_full_success is not None:
            remove_after_full_success()
        if succeeded or (not failed and remove_after_full_success is not None):
            self.read_models.invalidate()
        return PermissionsHarnessApplicationResult(succeeded=succeeded, failed=failed)


__all__ = ["PermissionsHarnessApplication", "PermissionsHarnessApplicationResult"]
