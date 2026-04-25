from __future__ import annotations

from skill_manager.sources import github_repo_url

from ..inventory import SkillInventory
from ..read_models import SkillsReadModelService
from .catalog import MarketplaceCatalog
from .documents import MarketplaceDocumentService


class MarketplaceQueryService:
    def __init__(
        self,
        read_models: SkillsReadModelService,
        catalog: MarketplaceCatalog,
        document_service: MarketplaceDocumentService,
    ) -> None:
        self.read_models = read_models
        self.catalog = catalog
        self.document_service = document_service

    def popular_page(self, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        return self._enrich_page(self.catalog.popular_page(limit=limit, offset=offset))

    def search_page(self, query: str, *, limit: int | None = None, offset: int = 0) -> dict[str, object]:
        return self._enrich_page(self.catalog.search_page(query, limit=limit, offset=offset))

    def get_item_detail(self, item_id: str) -> dict[str, object] | None:
        record = self.catalog.find_item(item_id)
        if record is None:
            return None

        installation = self._installation_state("github", record.source_locator)
        enrichment = self.catalog.detail_enrichment(record)
        repo_meta = self.catalog.repo_metadata(record.repo)

        return {
            "id": item_id,
            "name": record.name,
            "description": enrichment.description,
            "installs": record.installs,
            "stars": repo_meta.stars,
            "repoLabel": record.repo,
            "repoImageUrl": repo_meta.image_url,
            "sourceLinks": {
                "repoLabel": record.repo,
                "repoUrl": github_repo_url(record.repo),
                "folderUrl": enrichment.folder_url,
                "skillsDetailUrl": record.detail_url,
            },
            "installation": installation,
            "installToken": self.catalog.install_token("github", record.source_locator),
        }

    def get_item_document(self, item_id: str) -> dict[str, object] | None:
        record = self.catalog.find_item(item_id)
        if record is None:
            return None
        return self.document_service.get_document_payload(record)

    def _enrich_page(self, payload: dict[str, object]) -> dict[str, object]:
        items = payload.get("items", [])
        if not isinstance(items, list):
            return payload
        enriched_items: list[dict[str, object]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            install_token = item.get("installToken")
            source_kind = "github"
            source_locator = None
            if isinstance(install_token, str):
                descriptor = self.catalog.resolve_install_token(install_token)
                if descriptor is not None:
                    source_kind, source_locator = descriptor
            enriched_item = dict(item)
            if source_locator is None:
                enriched_item["installation"] = {
                    "status": "installable",
                    "installedSkillRef": None,
                }
            else:
                enriched_item["installation"] = self._installation_state(source_kind, source_locator)
            enriched_items.append(enriched_item)
        return {**payload, "items": enriched_items}

    def _installation_state(self, source_kind: str, source_locator: str) -> dict[str, str | None]:
        installed_ref = self._installed_by_source().get((source_kind, source_locator))
        if installed_ref is None:
            return {
                "status": "installable",
                "installedSkillRef": None,
            }
        return {
            "status": "installed",
            "installedSkillRef": installed_ref,
        }

    def _installed_by_source(self) -> dict[tuple[str, str], str]:
        inventory = self.inventory()
        installed: dict[tuple[str, str], str] = {}
        for entry in inventory.entries:
            if entry.kind != "managed":
                continue
            installed[(entry.source.kind, entry.source.locator)] = entry.skill_ref
        return installed

    def inventory(self) -> SkillInventory:
        snapshot = self.read_models.snapshot()
        return SkillInventory.from_snapshot(
            store_scan=snapshot.store_scan,
            harness_scans=self.read_models.visible_scans(snapshot),
        )
