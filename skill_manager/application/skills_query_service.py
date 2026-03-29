from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.domain import fingerprint_package
from skill_manager.harness.link_operator import MutationError

from .inventory import InventoryEntry, SkillInventory
from .read_model_service import ReadModelService
from .skills_serializers import serialize_settings, serialize_skill_detail, serialize_skills_page
from .source_fetch_service import SourceFetchService


class SkillsQueryService:
    def __init__(self, read_models: ReadModelService, source_fetcher: SourceFetchService) -> None:
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
        return serialize_skills_page(self.inventory())

    def get_skill_detail(self, skill_ref: str) -> dict[str, object] | None:
        inventory = self.inventory()
        entry = inventory.find(skill_ref)
        if entry is None:
            return None
        package_root = self.resolve_detail_package_root(entry)
        return serialize_skill_detail(
            entry,
            package_root=package_root,
            document_markdown=self.read_skill_document_markdown(package_root),
            update_available=self.check_for_update(entry),
        )

    def settings(self) -> dict[str, object]:
        return serialize_settings(self.inventory())

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
        if not entry.can_update or entry.current_revision is None:
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

    def read_skill_document_markdown(self, package_root: Path | None) -> str | None:
        if package_root is None:
            return None

        skill_path = package_root / "SKILL.md"
        if not skill_path.is_file():
            return None

        document = skill_path.read_text(encoding="utf-8").strip()
        if not document:
            return None
        return _strip_frontmatter(document)


def _strip_frontmatter(document: str) -> str | None:
    lines = document.splitlines()
    if lines[:1] != ["---"]:
        return document.strip()

    for index in range(1, len(lines)):
        if lines[index].strip() == "---":
            return "\n".join(lines[index + 1:]).strip() or None

    return document.strip()
