from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory

from skill_manager.errors import MutationError

from ..document_utils import read_skill_document_markdown
from ..source_fetch_service import SourceFetchService
from .cache import MarketplaceCache
from .models import SkillsShSkill


class MarketplaceDocumentService:
    _DOCUMENT_TTL_SECONDS = 86400

    def __init__(
        self,
        source_fetcher: SourceFetchService,
        *,
        cache: MarketplaceCache | None = None,
    ) -> None:
        self.source_fetcher = source_fetcher
        self.cache = cache or MarketplaceCache()

    def get_document_payload(self, record: SkillsShSkill) -> dict[str, object]:
        cached = self.cache.read("documents", record.source_locator, ttl_seconds=self._DOCUMENT_TTL_SECONDS)
        if cached is not None and isinstance(cached.payload, dict):
            payload = cached.payload
            return {
                "status": payload.get("status") if isinstance(payload.get("status"), str) else "unavailable",
                "documentMarkdown": payload.get("documentMarkdown") if isinstance(payload.get("documentMarkdown"), str) else None,
            }

        payload = self._resolve_document_payload(record)
        self.cache.write("documents", record.source_locator, payload)
        return payload

    def _resolve_document_payload(self, record: SkillsShSkill) -> dict[str, object]:
        with TemporaryDirectory(prefix="marketplace-document-") as work_dir:
            try:
                skill_path = self.source_fetcher.fetch(
                    source_kind="github",
                    source_locator=record.source_locator,
                    work_dir=Path(work_dir),
                )
            except MutationError:
                return {"status": "unavailable", "documentMarkdown": None}
            document_markdown = read_skill_document_markdown(skill_path)
            if document_markdown:
                return {"status": "ready", "documentMarkdown": document_markdown}
            return {"status": "unavailable", "documentMarkdown": None}
