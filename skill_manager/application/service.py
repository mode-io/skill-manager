from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.domain import CatalogAssembler, SourceDescriptor, parse_skill_package
from skill_manager.harness import CommandRunner
from skill_manager.harness.link_operator import LinkOperator, MutationError
from skill_manager.sources import GitHubSource, fetch_agentskill, listing_to_json, search_agentskill, search_skillssh
from skill_manager.sources.types import SkillListing

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

    def centralize(self, skill_ref: str) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        entry = CatalogAssembler.find_entry(snapshot.catalog_entries, skill_ref=skill_ref)
        if entry is None:
            raise MutationError(f"unknown skill ref: {skill_ref}", status=404)
        if entry.ownership != "unmanaged":
            raise MutationError(f"only unmanaged skills can be centralized; this is {entry.ownership}", status=400)
        if entry.conflicts:
            raise MutationError("resolve conflicts before centralizing", status=409)
        harness_sightings = [s for s in entry.sightings if s.kind == "harness" and s.package_path is not None]
        if not harness_sightings:
            raise MutationError("no harness sightings to centralize", status=400)
        source_sighting = harness_sightings[0]
        if source_sighting.source.is_source_backed:
            src_kind, src_locator = source_sighting.source.kind, source_sighting.source.locator
        else:
            src_kind = "centralized"
            src_locator = f"centralized:{entry.declared_name}"
        try:
            ingested = self.read_models.store.ingest(
                source_path=source_sighting.package_path,
                declared_name=entry.declared_name,
                source_kind=src_kind,
                source_locator=src_locator,
            )
        except ValueError as error:
            raise MutationError(str(error), status=409) from error
        operator = LinkOperator()
        for sighting in harness_sightings:
            operator.replace_with_link(existing_dir=sighting.package_path, target_path=ingested)
        fresh = self.read_models.snapshot()
        updated = next(
            (e for e in fresh.catalog_entries if e.declared_name == entry.declared_name and e.ownership == "shared"),
            None,
        )
        return catalog_detail_to_json(updated) if updated is not None else {}

    def centralize_all(self) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        eligible = [e for e in snapshot.catalog_entries if e.ownership == "unmanaged" and not e.conflicts]
        centralized: list[dict[str, str]] = []
        skipped: list[dict[str, str]] = []
        for entry in eligible:
            harness_sightings = [s for s in entry.sightings if s.kind == "harness" and s.package_path is not None]
            if not harness_sightings:
                skipped.append({"skillRef": entry.skill_ref, "reason": "no harness sightings"})
                continue
            source_sighting = harness_sightings[0]
            if source_sighting.source.is_source_backed:
                src_kind, src_locator = source_sighting.source.kind, source_sighting.source.locator
            else:
                src_kind = "centralized"
                src_locator = f"centralized:{entry.declared_name}"
            try:
                ingested = self.read_models.store.ingest(
                    source_path=source_sighting.package_path,
                    declared_name=entry.declared_name,
                    source_kind=src_kind,
                    source_locator=src_locator,
                )
            except ValueError:
                skipped.append({"skillRef": entry.skill_ref, "reason": "ingest conflict"})
                continue
            operator = LinkOperator()
            for sighting in harness_sightings:
                operator.replace_with_link(existing_dir=sighting.package_path, target_path=ingested)
            centralized.append({"skillRef": entry.skill_ref, "declaredName": entry.declared_name})
        fresh = self.read_models.snapshot()
        return {
            "centralized": centralized,
            "skipped": skipped,
            "catalogSnapshot": [catalog_entry_to_json(e) for e in fresh.catalog_entries],
        }

    # --- Phase 6: Install and Update from Sources ---

    def search_sources(self, query: str) -> list[dict[str, object]]:
        results: list[SkillListing] = []
        for searcher in (search_skillssh, search_agentskill):
            try:
                results.extend(searcher(query, limit=10))
            except Exception:  # noqa: BLE001
                pass
        return [listing_to_json(r) for r in results]

    def install_from_source(self, source_kind: str, source_locator: str) -> dict[str, object]:
        with TemporaryDirectory(prefix="skill-install-") as work_dir:
            work = Path(work_dir)
            try:
                if source_kind == "github":
                    locator = source_locator.removeprefix("github:")
                    skill_path = GitHubSource().fetch(locator, work)
                elif source_kind == "agentskill":
                    slug = source_locator.removeprefix("agentskill:")
                    skill_path = fetch_agentskill(slug, work)
                else:
                    raise MutationError(f"unsupported source kind: {source_kind}", status=400)
            except MutationError:
                raise
            except Exception as error:
                raise MutationError(str(error), status=400) from error
            package = parse_skill_package(
                skill_path, default_source=SourceDescriptor(kind=source_kind, locator=source_locator),
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
            declared_name = package.declared_name
        fresh = self.read_models.snapshot()
        installed = next(
            (e for e in fresh.catalog_entries if e.declared_name == declared_name and e.ownership == "shared"),
            None,
        )
        return catalog_detail_to_json(installed) if installed is not None else {}

    def update_skill(self, skill_ref: str) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        entry = CatalogAssembler.find_entry(snapshot.catalog_entries, skill_ref=skill_ref)
        if entry is None:
            raise MutationError(f"unknown skill ref: {skill_ref}", status=404)
        if entry.ownership != "shared":
            raise MutationError(f"only shared skills can be updated; this is {entry.ownership}", status=400)
        if not entry.source.is_source_backed:
            raise MutationError("skill has no updateable source", status=400)
        shared_sighting = next((s for s in entry.sightings if s.kind == "shared"), None)
        if shared_sighting is None or shared_sighting.package_path is None:
            raise MutationError("shared sighting has no package path", status=500)
        package_dir = shared_sighting.package_path.name
        with TemporaryDirectory(prefix="skill-update-") as work_dir:
            work = Path(work_dir)
            if entry.source.kind == "github":
                locator = entry.source.locator.removeprefix("github:")
                skill_path = GitHubSource().fetch(locator, work)
            elif entry.source.kind == "agentskill":
                slug = entry.source.locator.removeprefix("agentskill:")
                skill_path = fetch_agentskill(slug, work)
            else:
                raise MutationError(f"unsupported source kind: {entry.source.kind}", status=400)
            try:
                _, changed = self.read_models.store.update(package_dir, source_path=skill_path)
            except ValueError as error:
                raise MutationError(str(error), status=409) from error
        fresh = self.read_models.snapshot()
        updated = CatalogAssembler.find_entry(fresh.catalog_entries, skill_ref=skill_ref)
        result = catalog_detail_to_json(updated) if updated is not None else {}
        result["updated"] = changed
        return result
