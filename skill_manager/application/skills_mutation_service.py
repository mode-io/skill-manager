from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.domain import SourceDescriptor, parse_skill_package
from skill_manager.harness.link_operator import LinkOperator, MutationError

from .inventory import InventoryEntry
from .read_model_service import ReadModelService
from .skills_query_service import SkillsQueryService
from .source_fetch_service import SourceFetchService


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
            raise MutationError(f"only managed skills can be toggled; this is {entry.display_status}", status=400)
        if entry.package_path is None:
            raise MutationError("managed skill is missing its shared package path", status=500)
        adapter = self.read_models.find_adapter(harness)
        if adapter is None:
            raise MutationError(f"unknown harness: {harness}", status=400)
        LinkOperator().link_shared(
            package_path=entry.package_path,
            harness_skills_root=adapter.user_skills_root,
        )
        return {"ok": True}

    def disable_skill(self, skill_ref: str, harness: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if entry.kind != "managed":
            raise MutationError(f"only managed skills can be toggled; this is {entry.display_status}", status=400)
        if entry.package_dir is None:
            raise MutationError("managed skill is missing its package directory name", status=500)
        adapter = self.read_models.find_adapter(harness)
        if adapter is None:
            raise MutationError(f"unknown harness: {harness}", status=400)
        LinkOperator().unlink_shared(
            package_dir=entry.package_dir,
            harness_skills_root=adapter.user_skills_root,
        )
        return {"ok": True}

    def manage_skill(self, skill_ref: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if entry.kind != "unmanaged":
            raise MutationError(f"only unmanaged skills can be managed; this is {entry.display_status}", status=400)
        self._manage_entry(entry)
        return {"ok": True}

    def manage_all_skills(self) -> dict[str, object]:
        inventory = self.queries.inventory()
        managed_count = 0
        skipped_count = 0
        failures: list[dict[str, str]] = []

        for entry in inventory.entries:
            if not entry.can_manage:
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

        return {
            "ok": not failures,
            "managedCount": managed_count,
            "skippedCount": skipped_count,
            "failures": failures,
        }

    def update_skill(self, skill_ref: str) -> dict[str, bool]:
        entry = self.queries.require_entry(skill_ref)
        if not entry.can_update:
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
        operator = LinkOperator()
        for sighting in harness_sightings:
            operator.replace_with_link(existing_dir=sighting.path, target_path=ingested)
