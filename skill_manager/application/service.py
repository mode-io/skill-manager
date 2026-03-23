from __future__ import annotations

from skill_manager.harness import CommandRunner

from .catalog_queries import build_catalog_detail, build_catalog_views
from .check_queries import build_check_report
from .read_model_service import ReadModelService
from .view_models import HarnessSummaryView


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
        return [HarnessSummaryView.from_scan(scan).to_dict() for scan in snapshot.harness_scans]

    def list_catalog(self) -> list[dict[str, object]]:
        snapshot = self.read_models.snapshot()
        return [entry.to_dict() for entry in build_catalog_views(snapshot.catalog_entries)]

    def get_catalog_detail(self, skill_ref: str) -> dict[str, object] | None:
        snapshot = self.read_models.snapshot()
        detail = build_catalog_detail(snapshot.catalog_entries, skill_ref=skill_ref)
        if detail is None:
            return None
        return detail.to_dict()

    def run_check(self) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        return build_check_report(store_scan=snapshot.store_scan, harness_scans=snapshot.harness_scans).to_dict()
