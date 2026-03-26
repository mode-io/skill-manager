from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.domain import SourceDescriptor, fingerprint_package, parse_skill_package
from skill_manager.harness import CommandRunner
from skill_manager.harness.link_operator import LinkOperator, MutationError
from skill_manager.sources import GitHubAvatarAsset, GitHubSource, fetch_agentskill

from .inventory import InventoryEntry, SkillInventory
from .marketplace import MarketplaceService
from .read_model_service import ReadModelService


class ApplicationService:
    def __init__(self, read_models: ReadModelService, *, marketplace: MarketplaceService | None = None) -> None:
        self.read_models = read_models
        self.marketplace = marketplace or MarketplaceService()

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

    def list_skills(self) -> dict[str, object]:
        inventory = self._inventory()
        return inventory.skills_page_dict()

    def get_skill_detail(self, skill_ref: str) -> dict[str, object] | None:
        inventory = self._inventory()
        entry = inventory.find(skill_ref)
        if entry is None:
            return None
        update_available = self._check_for_update(entry)
        return entry.detail_dict(inventory.columns, update_available=update_available)

    def enable_skill(self, skill_ref: str, harness: str) -> dict[str, bool]:
        entry = self._require_entry(skill_ref)
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
        entry = self._require_entry(skill_ref)
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
        entry = self._require_entry(skill_ref)
        if entry.kind != "found":
            raise MutationError(f"only found-local skills can be managed; this is {entry.display_status}", status=400)
        self._manage_entry(entry)
        return {"ok": True}

    def manage_all_skills(self) -> dict[str, bool]:
        inventory = self._inventory()
        for entry in inventory.entries:
            if not entry.can_manage:
                continue
            try:
                self._manage_entry(entry)
            except MutationError:
                continue
        return {"ok": True}

    def update_skill(self, skill_ref: str) -> dict[str, bool]:
        entry = self._require_entry(skill_ref)
        if not entry.can_update:
            raise MutationError("skill cannot be updated from its source", status=400)
        if entry.package_dir is None:
            raise MutationError("managed skill is missing its package directory name", status=500)
        with TemporaryDirectory(prefix="skill-update-") as work_dir:
            skill_path = self._fetch_source(
                source_kind=entry.source.kind,
                source_locator=entry.source.locator,
                work_dir=Path(work_dir),
            )
            try:
                self.read_models.store.update(entry.package_dir, source_path=skill_path)
            except ValueError as error:
                raise MutationError(str(error), status=409) from error
        return {"ok": True}

    def popular_marketplace(self, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        return self.marketplace.popular_page(limit=limit, offset=offset)

    def search_marketplace(self, query: str, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        return self.marketplace.search_page(query, limit=limit, offset=offset)

    def marketplace_avatar(self, *, repo: str | None = None, owner: str | None = None) -> GitHubAvatarAsset | None:
        if repo:
            return self.marketplace.avatar_for_repo(repo)
        if owner:
            return self.marketplace.avatar_for_owner(owner)
        return None

    def install_skill(self, source_kind: str, source_locator: str) -> dict[str, bool]:
        with TemporaryDirectory(prefix="skill-install-") as work_dir:
            skill_path = self._fetch_source(
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

    def settings(self) -> dict[str, object]:
        inventory = self._inventory()
        return inventory.settings_dict()

    def _inventory(self) -> SkillInventory:
        snapshot = self.read_models.snapshot()
        return SkillInventory.from_snapshot(
            store_scan=snapshot.store_scan,
            harness_scans=snapshot.harness_scans,
        )

    def _require_entry(self, skill_ref: str) -> InventoryEntry:
        inventory = self._inventory()
        entry = inventory.find(skill_ref)
        if entry is None:
            raise MutationError(f"unknown skill ref: {skill_ref}", status=404)
        return entry

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

    def _check_for_update(self, entry: InventoryEntry) -> bool | None:
        if not entry.can_update or entry.current_revision is None:
            return None
        with TemporaryDirectory(prefix="skill-check-") as work_dir:
            try:
                skill_path = self._fetch_source(
                    source_kind=entry.source.kind,
                    source_locator=entry.source.locator,
                    work_dir=Path(work_dir),
                )
            except MutationError:
                return None
            fetched_revision, _ = fingerprint_package(skill_path)
            return fetched_revision != entry.current_revision

    def _fetch_source(self, *, source_kind: str, source_locator: str, work_dir: Path) -> Path:
        try:
            if source_kind == "github":
                locator = source_locator.removeprefix("github:")
                return GitHubSource().fetch(locator, work_dir)
            if source_kind == "agentskill":
                slug = source_locator.removeprefix("agentskill:")
                return fetch_agentskill(slug, work_dir)
        except MutationError:
            raise
        except Exception as error:
            raise MutationError(str(error), status=400) from error
        raise MutationError(f"unsupported source kind: {source_kind}", status=400)
