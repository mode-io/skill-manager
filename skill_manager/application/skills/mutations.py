from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.errors import MutationError

from .contracts import SkillsHarnessAdapter
from .identity import SourceDescriptor
from .inventory import InventoryEntry
from .package import parse_skill_package
from .policy import can_delete, can_manage, can_stop_managing, can_update, display_status, has_local_changes
from .queries import SkillsQueryService
from .read_models import SkillsReadModelService
from .source_fetch import SourceFetchService


class SkillsMutationService:
    def __init__(
        self,
        read_models: SkillsReadModelService,
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
        adapter = self.read_models.require_enabled_adapter(harness)
        adapter.enable_shared_package(entry.package_path)
        self.read_models.invalidate()
        return {"ok": True}

    def disable_skill(self, skill_ref: str, harness: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if entry.kind != "managed":
            raise MutationError(f"only managed skills can be toggled; this is {display_status(entry)}", status=400)
        if entry.package_dir is None:
            raise MutationError("managed skill is missing its package directory name", status=500)
        adapter = self.read_models.require_enabled_adapter(harness)
        adapter.disable_shared_package(entry.package_dir)
        self.read_models.invalidate()
        return {"ok": True}

    def set_skill_all_harnesses(self, skill_ref: str, target: str) -> dict[str, object]:
        if target not in ("enabled", "disabled"):
            raise MutationError("target must be 'enabled' or 'disabled'", status=400)
        entry = self.queries.require_entry(skill_ref)
        if entry.kind != "managed":
            raise MutationError(
                f"only managed skills can be toggled; this is {display_status(entry)}",
                status=400,
            )
        if entry.package_dir is None:
            raise MutationError("managed skill is missing its package directory name", status=500)
        if target == "enabled" and entry.package_path is None:
            raise MutationError("managed skill is missing its shared package path", status=500)

        succeeded: list[str] = []
        failures: list[dict[str, str]] = []
        flipped_any = False

        # Bulk set-all only targets harnesses whose CLI is installed on the
        # system. Enabling on an uninstalled harness would write a symlink
        # into a folder no runtime reads, which is misleading and happens
        # to cascade across overlapping discovery roots in the catalog.
        for adapter in self.read_models.enabled_installed_adapters():
            has_binding = adapter.has_binding(entry.package_dir)
            if target == "enabled" and has_binding:
                continue
            if target == "disabled" and not has_binding:
                continue
            try:
                if target == "enabled":
                    adapter.enable_shared_package(entry.package_path)  # type: ignore[arg-type]
                else:
                    adapter.disable_shared_package(entry.package_dir)
            except Exception as error:  # noqa: BLE001 — aggregate partial failures
                failures.append({"harness": adapter.harness, "error": str(error)})
                continue
            succeeded.append(adapter.harness)
            flipped_any = True

        if flipped_any:
            self.read_models.invalidate()

        return {
            "ok": not failures,
            "succeeded": succeeded,
            "failed": failures,
        }

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
            if has_local_changes(entry):
                raise MutationError("Local changes detected. Source updates are disabled.", status=400)
            raise MutationError("skill cannot be updated from its source", status=400)
        if entry.package_dir is None:
            raise MutationError("managed skill is missing its package directory name", status=500)
        with TemporaryDirectory(prefix="skill-update-") as work_dir:
            fetched = self.source_fetcher.fetch_package(
                source_kind=entry.source.kind,
                source_locator=entry.source.locator,
                work_dir=Path(work_dir),
            )
            try:
                self.read_models.store.update(
                    entry.package_dir,
                    source_path=fetched.package_path,
                    source_ref=fetched.source_ref,
                    source_path_hint=fetched.source_path,
                )
            except ValueError as error:
                raise MutationError(str(error), status=409) from error
        self.read_models.invalidate()
        return {"ok": True}

    def unmanage_skill(self, skill_ref: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if not can_stop_managing(entry):
            raise MutationError(
                f"only managed shared-store skills can be moved back to unmanaged; this is {display_status(entry)}",
                status=400,
            )
        if entry.package_dir is None or entry.package_path is None:
            raise MutationError("managed skill is missing its shared package metadata", status=500)

        enabled_bindings, disabled_bindings = self._partition_bound_adapters(entry.package_dir)
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

        for _harness, adapter in enabled_bindings:
            adapter.prepare_materialize(entry.package_dir, entry.package_path)

        for _harness, adapter in enabled_bindings:
            adapter.materialize_binding(entry.package_dir, entry.package_path)

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
                f"only managed shared-store skills can be deleted; this is {display_status(entry)}",
                status=400,
            )
        if entry.package_dir is None:
            raise MutationError("managed skill is missing its package directory name", status=500)

        enabled_bindings, disabled_bindings = self._partition_bound_adapters(entry.package_dir)
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
        for _harness, adapter in enabled_bindings:
            adapter.prepare_remove(entry.package_dir)
        for _harness, adapter in enabled_bindings:
            adapter.remove_binding(entry.package_dir)
        try:
            self.read_models.store.delete(entry.package_dir)
        except ValueError as error:
            raise MutationError(str(error), status=409) from error
        self.read_models.invalidate()
        return {"ok": True}

    def install_skill(self, *, source_kind: str, source_locator: str) -> dict[str, bool]:
        with TemporaryDirectory(prefix="skill-install-") as work_dir:
            fetched = self.source_fetcher.fetch_package(
                source_kind=source_kind,
                source_locator=source_locator,
                work_dir=Path(work_dir),
            )
            package = parse_skill_package(
                fetched.package_path,
                default_source=SourceDescriptor(kind=source_kind, locator=source_locator),
            )
            try:
                self.read_models.store.ingest(
                    source_path=fetched.package_path,
                    declared_name=package.declared_name,
                    source_kind=source_kind,
                    source_locator=source_locator,
                    source_ref=fetched.source_ref,
                    source_path_hint=fetched.source_path,
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
            adapter = self.read_models.require_enabled_adapter(sighting.harness)
            if sighting.scope == "canonical":
                adapter.adopt_local_copy(existing_dir=sighting.path, package_path=ingested)
                canonical_bound_harnesses.add(sighting.harness)
        for sighting in harness_sightings:
            if sighting.harness in canonical_bound_harnesses:
                continue
            adapter = self.read_models.require_enabled_adapter(sighting.harness)
            adapter.enable_shared_package(ingested)
            canonical_bound_harnesses.add(sighting.harness)

    def _partition_bound_adapters(
        self,
        package_dir: str,
    ) -> tuple[list[tuple[str, SkillsHarnessAdapter]], list[tuple[str, SkillsHarnessAdapter]]]:
        enabled = set(self.read_models.enabled_harnesses())
        enabled_bindings: list[tuple[str, SkillsHarnessAdapter]] = []
        disabled_bindings: list[tuple[str, SkillsHarnessAdapter]] = []
        for adapter in self.read_models.all_adapters():
            if not adapter.has_binding(package_dir):
                continue
            if adapter.harness in enabled:
                enabled_bindings.append((adapter.harness, adapter))
            else:
                disabled_bindings.append((adapter.harness, adapter))
        return enabled_bindings, disabled_bindings

    def _describe_harnesses(self, bindings: list[tuple[str, SkillsHarnessAdapter]]) -> str:
        return ", ".join(adapter.label for _harness, adapter in bindings)
