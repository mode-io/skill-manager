from __future__ import annotations

from .inventory import InventoryColumn, InventoryEntry, InventorySighting, SkillInventory
from .policy import (
    attention_message,
    can_delete,
    can_manage,
    cell_state,
    display_status,
)


DETAIL_HARNESS_ORDER = ("codex", "claude", "cursor", "opencode")


def skills_page_payload(inventory: SkillInventory) -> dict[str, object]:
    counts = {
        "managed": sum(1 for entry in inventory.entries if display_status(entry) == "Managed"),
        "unmanaged": sum(1 for entry in inventory.entries if display_status(entry) == "Unmanaged"),
        "custom": sum(1 for entry in inventory.entries if display_status(entry) == "Custom"),
        "builtIn": sum(1 for entry in inventory.entries if display_status(entry) == "Built-in"),
    }
    return {
        "summary": counts,
        "harnessColumns": [column_payload(column) for column in inventory.columns],
        "rows": [row_payload(entry, inventory.columns) for entry in inventory.entries],
    }


def skill_detail_payload(
    entry: InventoryEntry,
    *,
    columns: tuple[InventoryColumn, ...],
    document_markdown: str | None,
    source_links: dict[str, str | None] | None,
) -> dict[str, object]:
    return {
        "skillRef": entry.skill_ref,
        "name": entry.name,
        "description": entry.description,
        "displayStatus": display_status(entry),
        "attentionMessage": attention_message(entry),
        "actions": {
            "canManage": can_manage(entry),
            "stopManagingStatus": stop_managing_status_payload(entry),
            "stopManagingHarnessLabels": linked_harness_labels(entry, columns),
            "canDelete": can_delete(entry),
            "deleteHarnessLabels": linked_harness_labels(entry, columns),
        },
        "harnessCells": [cell_payload(entry, column) for column in detail_columns(columns)],
        "locations": [sighting_payload(sighting) for sighting in entry.detail_sightings()],
        "sourceLinks": source_links,
        "documentMarkdown": document_markdown,
    }


def source_status_payload(update_status: str | None) -> dict[str, object]:
    return {"updateStatus": update_status}


def settings_payload(inventory: SkillInventory) -> dict[str, object]:
    return {
        "harnesses": [
            {
                "harness": scan.harness,
                "label": scan.label,
                "detected": scan.detected,
                "manageable": scan.manageable,
                "builtinSupport": scan.builtin_support,
                "issues": list(scan.issues),
                "diagnostics": {
                    "discoveryMode": scan.discovery_mode,
                    "detectionDetails": list(scan.detection_details),
                },
            }
            for scan in inventory.harness_scans
        ],
        "storeIssues": list(inventory.store_issues),
        "bulkActions": {
            "canManageAll": any(can_manage(entry) for entry in inventory.entries),
        },
    }


def column_payload(column: InventoryColumn) -> dict[str, str]:
    return {"harness": column.harness, "label": column.label}


def row_payload(entry: InventoryEntry, columns: tuple[InventoryColumn, ...]) -> dict[str, object]:
    return {
        "skillRef": entry.skill_ref,
        "name": entry.name,
        "description": entry.description,
        "displayStatus": display_status(entry),
        "attentionMessage": attention_message(entry),
        "actions": {
            "canManage": can_manage(entry),
        },
        "cells": [cell_payload(entry, column) for column in columns],
    }


def cell_payload(entry: InventoryEntry, column: InventoryColumn) -> dict[str, object]:
    state = cell_state(entry, column.harness)
    return {
        "harness": column.harness,
        "label": column.label,
        "state": state,
        "interactive": state in {"enabled", "disabled"},
    }


def sighting_payload(sighting: InventorySighting) -> dict[str, str | None]:
    return {
        "kind": sighting.kind,
        "harness": sighting.harness,
        "label": sighting.label,
        "scope": sighting.scope,
        "path": str(sighting.path) if sighting.path is not None else None,
        "revision": sighting.revision,
        "sourceKind": sighting.source.kind,
        "sourceLocator": sighting.source.locator,
        "detail": sighting.detail or None,
    }


def detail_columns(columns: tuple[InventoryColumn, ...]) -> tuple[InventoryColumn, ...]:
    columns_by_harness = {column.harness: column for column in columns}
    selected: list[InventoryColumn] = []
    for harness in DETAIL_HARNESS_ORDER:
        column = columns_by_harness.get(harness)
        if column is None:
            continue
        selected.append(column)
    return tuple(selected)


def linked_harness_labels(entry: InventoryEntry, columns: tuple[InventoryColumn, ...]) -> list[str]:
    linked_harnesses = entry.linked_harnesses()
    return [column.label for column in columns if column.harness in linked_harnesses]


def stop_managing_status_payload(entry: InventoryEntry) -> str | None:
    from .policy import stop_managing_status

    return stop_managing_status(entry)
