from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Literal

from skill_manager.domain import fingerprint_package
from skill_manager.harness.link_operator import MutationError
from skill_manager.sources import github_repo_from_locator, github_repo_url, github_skill_dir_from_locator

from ..document_utils import read_skill_document_markdown
from ..read_model_service import ReadModelService
from ..source_fetch_service import SourceFetchService
from .inventory import InventoryEntry, SkillInventory
from .policy import can_stop_managing, can_update
from .presenters import skill_detail_payload, skills_page_payload, source_status_payload


class SkillsQueryService:
    def __init__(
        self,
        read_models: ReadModelService,
        source_fetcher: SourceFetchService,
    ) -> None:
        self.read_models = read_models
        self.source_fetcher = source_fetcher

    def health(self) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        return {
            "ok": True,
            "app": "skill-manager",
            "readOnly": False,
            "harnessCount": len(snapshot.harness_scans),
        }

    def list_skills(self) -> dict[str, object]:
        return skills_page_payload(self.inventory())

    def get_skill_detail(self, skill_ref: str) -> dict[str, object] | None:
        inventory = self.inventory()
        entry = inventory.find(skill_ref)
        if entry is None:
            return None
        package_root = self.resolve_detail_package_root(entry)
        return skill_detail_payload(
            entry,
            columns=inventory.columns,
            document_markdown=read_skill_document_markdown(package_root),
            source_links=self.build_source_links(entry),
        )

    def get_skill_source_status(self, skill_ref: str) -> dict[str, object] | None:
        entry = self.inventory().find(skill_ref)
        if entry is None:
            return None
        return source_status_payload(self.resolve_update_status(entry))

    def inventory(self) -> SkillInventory:
        snapshot = self.read_models.snapshot()
        return SkillInventory.from_snapshot(
            store_scan=snapshot.store_scan,
            harness_scans=snapshot.harness_scans,
        )

    def require_entry(self, skill_ref: str) -> InventoryEntry:
        entry = self.inventory().find(skill_ref)
        if entry is None:
            raise MutationError(f"unknown skill ref: {skill_ref}", status=404)
        return entry

    def check_for_update(self, entry: InventoryEntry) -> bool | None:
        if not can_update(entry) or entry.current_revision is None:
            return None
        with TemporaryDirectory(prefix="skill-check-") as work_dir:
            try:
                skill_path = self.source_fetcher.fetch(
                    source_kind=entry.source.kind,
                    source_locator=entry.source.locator,
                    work_dir=Path(work_dir),
                )
            except MutationError:
                return None
            fetched_revision, _ = fingerprint_package(skill_path)
            return fetched_revision != entry.current_revision

    def resolve_detail_package_root(self, entry: InventoryEntry) -> Path | None:
        if entry.package_path is not None and (entry.package_path / "SKILL.md").is_file():
            return entry.package_path

        for sighting in entry.detail_sightings():
            if sighting.path is not None and (sighting.path / "SKILL.md").is_file():
                return sighting.path
        return None

    def build_source_links(self, entry: InventoryEntry) -> dict[str, str | None] | None:
        if entry.source.kind != "github":
            return None

        repo = github_repo_from_locator(entry.source.locator)
        if repo is None:
            return None

        skill_dir = github_skill_dir_from_locator(entry.source.locator)
        folder_url = None
        if skill_dir:
            folder_url = f"{github_repo_url(repo)}/tree/HEAD/{skill_dir}"

        return {
            "repoLabel": repo,
            "repoUrl": github_repo_url(repo),
            "folderUrl": folder_url,
        }

    def resolve_update_status(
        self,
        entry: InventoryEntry,
    ) -> Literal["update_available", "no_update_available", "no_source_available"] | None:
        if entry.kind != "managed":
            return None
        if not can_update(entry):
            return "no_source_available"
        if self.check_for_update(entry):
            return "update_available"
        return "no_update_available"

    def can_stop_managing(self, entry: InventoryEntry) -> bool:
        return can_stop_managing(entry)
