from __future__ import annotations

from dataclasses import replace
from typing import Iterable

from skill_manager.errors import MutationError

from .harness_application import HooksHarnessApplication
from .read_models import HooksReadModelService
from .store import HookSpec, HookStore


class HooksMutationService:
    """Mutations for observed Hooks."""

    def __init__(
        self,
        *,
        store: HookStore,
        read_models: HooksReadModelService,
    ) -> None:
        self.store = store
        self.read_models = read_models
        self.harness_application = HooksHarnessApplication(read_models)

    def create_hook(self, spec: HookSpec) -> HookSpec:
        if not spec.id:
            raise MutationError("id is required", status=400)
        if self.store.get_managed(spec.id) is not None:
            raise MutationError(
                f"a hook named '{spec.id}' is already registered",
                status=409,
            )
        stored = self.store.upsert_managed(spec)
        self.read_models.invalidate()
        return stored

    def delete_hook(self, id: str) -> dict[str, object]:
        if self.store.get_managed(id) is None:
            raise MutationError(f"unknown hook: {id}", status=404)
        bound_harnesses = self._harnesses_in_states(id, {"managed", "drifted"})
        return self.harness_application.disable_many(
            id,
            bound_harnesses,
            remove_after_full_success=lambda: self.store.remove(id),
        ).to_dict()

    def enable_hook(
        self,
        id: str,
        harness: str,
    ) -> dict[str, bool]:
        spec = self._require_spec(id)
        adapter = self.read_models.require_enabled_adapter(harness)
        if adapter.has_binding(id):
            return {"ok": True}
        result = self.harness_application.enable_one(
            adapter,
            spec,
        )
        if result.failed:
            raise MutationError(result.failed[0]["error"], status=400)
        return {"ok": True}

    def disable_hook(self, id: str, harness: str) -> dict[str, bool]:
        if self.store.get_managed(id) is None:
            raise MutationError(f"unknown hook: {id}", status=404)
        adapter = self.read_models.require_enabled_adapter(harness)
        adapter.disable_hook(id)
        self.read_models.invalidate()
        return {"ok": True}

    def set_hook_all_harnesses(
        self,
        id: str,
        target: str,
    ) -> dict[str, object]:
        if target not in ("enabled", "disabled"):
            raise MutationError("target must be 'enabled' or 'disabled'", status=400)
        spec = self._require_spec(id)
        bound_now = self._harnesses_in_states(id, {"managed", "drifted"})
        
        if target == "enabled":
            return self.harness_application.enable_many(
                spec,
                self.read_models.enabled_harnesses(),
                skip_harnesses=bound_now,
            ).to_dict()
        return self.harness_application.disable_many(
            id,
            bound_now,
        ).to_dict()

    def reconcile_hook(
        self,
        id: str,
        *,
        source_kind: str,
        observed_harness: str | None = None,
        harnesses: list[str] | None = None,
    ) -> dict[str, object]:
        current = self._require_spec(id)
        target_harnesses = (
            set(harnesses)
            if harnesses is not None
            else self._harnesses_in_states(id, {"managed", "drifted"})
        )
        
        if source_kind == "managed":
            source_spec = current
        elif source_kind == "harness":
            if not observed_harness:
                raise MutationError("observedHarness is required when sourceKind is 'harness'", status=400)
            observed_spec = self._observed_spec(id, observed_harness)
            source_spec = replace(
                observed_spec,
                id=current.id,
                description=current.description,
            )
            self.store.upsert_managed(source_spec)
        else:
            raise MutationError("sourceKind must be 'managed' or 'harness'", status=400)

        result = self.harness_application.enable_many(
            source_spec,
            target_harnesses,
        )
        stored = self.store.get_managed(id) or source_spec
        return {
            "ok": result.ok,
            "hook": stored.to_dict(),
            "succeeded": result.succeeded,
            "failed": result.failed,
        }

    # Internal helpers -----------------------------------------------------

    def _harnesses_in_states(
        self,
        id: str,
        states: Iterable[str],
    ) -> set[str]:
        allowed_states = set(states)
        addressable = set(self.read_models.enabled_harnesses())
        snapshot = self.read_models.snapshot()
        result: set[str] = set()
        for scan in snapshot.harness_scans:
            if scan.harness not in addressable:
                continue
            for entry in scan.entries:
                if entry.id == id and entry.state in allowed_states:
                    result.add(scan.harness)
        return result

    def _observed_spec(self, id: str, harness: str) -> HookSpec:
        snapshot = self.read_models.snapshot()
        for scan in snapshot.harness_scans:
            if scan.harness == harness:
                for entry in scan.entries:
                    if entry.id == id and entry.parsed_spec is not None:
                        return entry.parsed_spec
        raise MutationError(f"hook '{id}' was not observed in harness '{harness}'", status=400)

    def _require_spec(self, id: str) -> HookSpec:
        spec = self.store.get_managed(id)
        if spec is None:
            raise MutationError(f"unknown hook: {id}", status=404)
        return spec


__all__ = ["HooksMutationService"]
