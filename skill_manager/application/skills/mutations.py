from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.domain import SourceDescriptor, parse_skill_package
from skill_manager.errors import MutationError
from skill_manager.harness import HarnessManager

from ..read_model_service import ReadModelService
from ..source_fetch_service import SourceFetchService
from .inventory import InventoryEntry
from .policy import can_delete, can_manage, can_stop_managing, can_update, display_status
from .queries import SkillsQueryService


class SkillsMutationService:
    def __init__(
        self,
        read_models: ReadModelService,
        queries: SkillsQueryService,
        source_fetcher: SourceFetchService,
    ) -> None:
        self.read_models = read_models
        self.queries = queries
        self.source_fetcher = source_fetcher

    def enable_skill(self, skill_ref: str, harness: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if entry.kind != "managed":
            raise MutationError(f"only managed skills can be toggled; this is {display_status(entry)}", status=400)
        if entry.package_path is None:
            raise MutationError("managed skill is missing its shared package path", status=500)
        manager = self.read_models.require_enabled_manager(harness)
        manager.enable_shared_package(entry.package_path)
        self.read_models.invalidate()
        return {"ok": True}

    def disable_skill(self, skill_ref: str, harness: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if entry.kind != "managed":
            raise MutationError(f"only managed skills can be toggled; this is {display_status(entry)}", status=400)
        if entry.package_dir is None:
            raise MutationError("managed skill is missing its package directory name", status=500)
        manager = self.read_models.require_enabled_manager(harness)
        manager.disable_shared_package(entry.package_dir)
        self.read_models.invalidate()
        return {"ok": True}

    def manage_skill(self, skill_ref: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if entry.kind != "unmanaged":
            raise MutationError(f"only unmanaged skills can be managed; this is {display_status(entry)}", status=400)
        self._manage_entry(entry)
        self.read_models.invalidate()
        return {"ok": True}

    def manage_all_skills(self) -> dict[str, object]:
        inventory = self.queries.inventory()
        managed_count = 0
        skipped_count = 0
        failures: list[dict[str, str]] = []

        for entry in inventory.entries:
            if not can_manage(entry):
                skipped_count += 1
                continue
            try:
                self._manage_entry(entry)
                managed_count += 1
            except MutationError as error:
                failures.append({
                    "skillRef": entry.skill_ref,
                    "name": entry.name,
                    "error": str(error),
                })

        if managed_count:
            self.read_models.invalidate()

        return {
            "ok": not failures,
            "managedCount": managed_count,
            "skippedCount": skipped_count,
            "failures": failures,
        }

    def update_skill(self, skill_ref: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if not can_update(entry):
            raise MutationError("skill cannot be updated from its source", status=400)
        if entry.package_dir is None:
            raise MutationError("managed skill is missing its package directory name", status=500)
        with TemporaryDirectory(prefix="skill-update-") as work_dir:
            skill_path = self.source_fetcher.fetch(
                source_kind=entry.source.kind,
                source_locator=entry.source.locator,
                work_dir=Path(work_dir),
            )
            try:
                self.read_models.store.update(entry.package_dir, source_path=skill_path)
            except ValueError as error:
                raise MutationError(str(error), status=409) from error
        self.read_models.invalidate()
        return {"ok": True}

    def unmanage_skill(self, skill_ref: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if not can_stop_managing(entry):
            raise MutationError(
                f"only managed or custom shared-store skills can be moved back to unmanaged; this is {display_status(entry)}",
                status=400,
            )
        if entry.package_dir is None or entry.package_path is None:
            raise MutationError("managed skill is missing its shared package metadata", status=500)

        enabled_bindings, disabled_bindings = self._partition_bound_managers(entry.package_dir)
        if disabled_bindings:
            raise MutationError(
                "cannot stop managing while disabled harnesses still have bindings: "
                f"{self._describe_harnesses(disabled_bindings)}; re-enable support or clean them manually",
                status=409,
            )
        if not enabled_bindings:
            raise MutationError("turn on at least one harness before stopping management", status=400)

        try:
            self.read_models.store.ensure_deletable(entry.package_dir)
        except ValueError as error:
            raise MutationError(str(error), status=409) from error

        for _harness, manager in enabled_bindings:
            manager.prepare_materialize(entry.package_dir, entry.package_path)

        for _harness, manager in enabled_bindings:
            manager.materialize_binding(entry.package_dir, entry.package_path)

        try:
            self.read_models.store.delete(entry.package_dir)
        except ValueError as error:
            raise MutationError(str(error), status=409) from error
        self.read_models.invalidate()
        return {"ok": True}

    def delete_skill(self, skill_ref: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if not can_delete(entry):
            raise MutationError(
                f"only managed or custom shared-store skills can be deleted; this is {display_status(entry)}",
                status=400,
            )
        if entry.package_dir is None:
            raise MutationError("managed skill is missing its package directory name", status=500)

        _enabled_bindings, disabled_bindings = self._partition_bound_managers(entry.package_dir)
        if disabled_bindings:
            raise MutationError(
                "cannot delete while disabled harnesses still have bindings: "
                f"{self._describe_harnesses(disabled_bindings)}; re-enable support or clean them manually",
                status=409,
            )
        try:
            self.read_models.store.ensure_deletable(entry.package_dir)
        except ValueError as error:
            raise MutationError(str(error), status=409) from error
        for _harness, manager in self.read_models.enabled_managers():
            manager.prepare_remove(entry.package_dir)
        for _harness, manager in self.read_models.enabled_managers():
            manager.remove_binding(entry.package_dir)
        try:
            self.read_models.store.delete(entry.package_dir)
        except ValueError as error:
            raise MutationError(str(error), status=409) from error
        self.read_models.invalidate()
        return {"ok": True}

    def install_skill(self, *, source_kind: str, source_locator: str) -> dict[str, bool]:
        with TemporaryDirectory(prefix="skill-install-") as work_dir:
            skill_path = self.source_fetcher.fetch(
                source_kind=source_kind,
                source_locator=source_locator,
                work_dir=Path(work_dir),
            )
            package = parse_skill_package(
                skill_path,
                default_source=SourceDescriptor(kind=source_kind, locator=source_locator),
            )
            try:
                self.read_models.store.ingest(
                    source_path=skill_path,
                    declared_name=package.declared_name,
                    source_kind=source_kind,
                    source_locator=source_locator,
                )
            except ValueError as error:
                raise MutationError(str(error), status=409) from error
        self.read_models.invalidate()
        return {"ok": True}

    def _manage_entry(self, entry: InventoryEntry) -> None:
        harness_sightings = [s for s in entry.sightings if s.kind == "harness" and s.path is not None]
        if not harness_sightings:
            raise MutationError("no local skill copy found to manage", status=400)
        source = harness_sightings[0].source
        if source.is_source_backed:
            source_kind, source_locator = source.kind, source.locator
        else:
            source_kind = "centralized"
            source_locator = f"centralized:{entry.name}"
        try:
            ingested = self.read_models.store.ingest(
                source_path=harness_sightings[0].path,
                declared_name=entry.name,
                source_kind=source_kind,
                source_locator=source_locator,
            )
        except ValueError as error:
            raise MutationError(str(error), status=409) from error
        canonical_bound_harnesses: set[str] = set()
        for sighting in harness_sightings:
            manager = self.read_models.require_enabled_manager(sighting.harness)
            if sighting.scope == "canonical":
                manager.adopt_local_copy(existing_dir=sighting.path, package_path=ingested)
                canonical_bound_harnesses.add(sighting.harness)
        for sighting in harness_sightings:
            if sighting.harness in canonical_bound_harnesses:
                continue
            manager = self.read_models.require_enabled_manager(sighting.harness)
            manager.enable_shared_package(ingested)
            canonical_bound_harnesses.add(sighting.harness)

    def _partition_bound_managers(self, package_dir: str) -> tuple[list[tuple[str, HarnessManager]], list[tuple[str, HarnessManager]]]:
        enabled = set(self.read_models.enabled_harnesses())
        enabled_bindings: list[tuple[str, HarnessManager]] = []
        disabled_bindings: list[tuple[str, HarnessManager]] = []
        for harness, manager in self.read_models.all_managers():
            if not manager.has_binding(package_dir):
                continue
            if harness in enabled:
                enabled_bindings.append((harness, manager))
            else:
                disabled_bindings.append((harness, manager))
        return enabled_bindings, disabled_bindings

    def _describe_harnesses(self, bindings: list[tuple[str, HarnessManager]]) -> str:
        labels: list[str] = []
        for harness, _manager in bindings:
            driver = self.read_models.find_driver(harness)
            labels.append(driver.label if driver is not None else harness)
        return ", ".join(labels)
