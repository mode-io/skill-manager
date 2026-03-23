from __future__ import annotations

from skill_manager.domain import CatalogAssembler
from skill_manager.harness import CommandRunner

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
            "readOnly": True,
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
