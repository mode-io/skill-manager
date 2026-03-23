from __future__ import annotations

from skill_manager.domain import CatalogAssembler
from skill_manager.harness import CommandRunner
from skill_manager.harness.link_operator import LinkOperator, MutationError

from .read_model_service import ReadModelService
from .serializers import catalog_detail_to_json, catalog_entry_to_json, check_report_to_json, harness_scan_to_json


class ApplicationService:
    def __init__(self, read_models: ReadModelService) -> None:
        self.read_models = read_models

    @classmethod
    def from_environment(
        cls,
        env: dict[str, str] | None = None,
        *,
        command_runner: CommandRunner | None = None,
    ) -> "ApplicationService":
        return cls(ReadModelService.from_environment(env, command_runner=command_runner))

    def health(self) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        return {
            "ok": True,
            "app": "skill-manager",
            "readOnly": False,
            "harnessCount": len(snapshot.harness_scans),
        }

    def list_harnesses(self) -> list[dict[str, object]]:
        snapshot = self.read_models.snapshot()
        return [harness_scan_to_json(scan) for scan in snapshot.harness_scans]

    def list_catalog(self) -> list[dict[str, object]]:
        snapshot = self.read_models.snapshot()
        return [catalog_entry_to_json(entry) for entry in snapshot.catalog_entries]

    def get_catalog_detail(self, skill_ref: str) -> dict[str, object] | None:
        snapshot = self.read_models.snapshot()
        entry = CatalogAssembler.find_entry(snapshot.catalog_entries, skill_ref=skill_ref)
        if entry is None:
            return None
        return catalog_detail_to_json(entry)

    def run_check(self) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        return check_report_to_json(store_scan=snapshot.store_scan, harness_scans=snapshot.harness_scans)

    def enable_shared(self, skill_ref: str, harness: str) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        entry = CatalogAssembler.find_entry(snapshot.catalog_entries, skill_ref=skill_ref)
        if entry is None:
            raise MutationError(f"unknown skill ref: {skill_ref}", status=404)
        if entry.ownership != "shared":
            raise MutationError(f"only shared skills can be toggled; this is {entry.ownership}", status=400)
        adapter = self.read_models.find_adapter(harness)
        if adapter is None:
            raise MutationError(f"unknown harness: {harness}", status=400)
        shared_sighting = next((s for s in entry.sightings if s.kind == "shared"), None)
        if shared_sighting is None or shared_sighting.package_path is None:
            raise MutationError("shared sighting has no package path", status=500)
        LinkOperator().link_shared(
            package_path=shared_sighting.package_path,
            harness_skills_root=adapter.user_skills_root,
        )
        fresh = self.read_models.snapshot()
        updated = CatalogAssembler.find_entry(fresh.catalog_entries, skill_ref=skill_ref)
        return catalog_detail_to_json(updated) if updated is not None else {}

    def disable_shared(self, skill_ref: str, harness: str) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        entry = CatalogAssembler.find_entry(snapshot.catalog_entries, skill_ref=skill_ref)
        if entry is None:
            raise MutationError(f"unknown skill ref: {skill_ref}", status=404)
        if entry.ownership != "shared":
            raise MutationError(f"only shared skills can be toggled; this is {entry.ownership}", status=400)
        adapter = self.read_models.find_adapter(harness)
        if adapter is None:
            raise MutationError(f"unknown harness: {harness}", status=400)
        shared_sighting = next((s for s in entry.sightings if s.kind == "shared"), None)
        if shared_sighting is None or shared_sighting.package_path is None:
            raise MutationError("shared sighting has no package path", status=500)
        LinkOperator().unlink_shared(
            package_dir=shared_sighting.package_path.name,
            harness_skills_root=adapter.user_skills_root,
        )
        fresh = self.read_models.snapshot()
        updated = CatalogAssembler.find_entry(fresh.catalog_entries, skill_ref=skill_ref)
        return catalog_detail_to_json(updated) if updated is not None else {}
