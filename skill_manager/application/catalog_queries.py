from __future__ import annotations

from skill_manager.domain import CatalogAssembler, CatalogEntry

from .view_models import CatalogDetailView, CatalogEntryView


def build_catalog_views(entries: tuple[CatalogEntry, ...]) -> tuple[CatalogEntryView, ...]:
    return tuple(CatalogEntryView.from_entry(entry) for entry in entries)


def build_catalog_detail(entries: tuple[CatalogEntry, ...], *, skill_ref: str) -> CatalogDetailView | None:
    entry = CatalogAssembler.find_entry(entries, skill_ref=skill_ref)
    if entry is None:
        return None
    return CatalogDetailView.from_entry(entry)
