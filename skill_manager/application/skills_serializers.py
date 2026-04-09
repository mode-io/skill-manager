from __future__ import annotations

from skill_manager.application.inventory import InventoryColumn, InventoryEntry, InventorySighting, SkillInventory

DETAIL_HARNESS_ORDER = ("codex", "claude", "cursor", "opencode")


def serialize_skills_page(inventory: SkillInventory) -> dict[str, object]:
    counts = {
        "managed": sum(1 for entry in inventory.entries if entry.display_status == "Managed"),
        "unmanaged": sum(1 for entry in inventory.entries if entry.display_status == "Unmanaged"),
        "custom": sum(1 for entry in inventory.entries if entry.display_status == "Custom"),
        "builtIn": sum(1 for entry in inventory.entries if entry.display_status == "Built-in"),
    }
    return {
        "summary": counts,
        "harnessColumns": [serialize_column(column) for column in inventory.columns],
        "rows": [serialize_row(entry, inventory.columns) for entry in inventory.entries],
    }


def serialize_skill_detail(
    entry: InventoryEntry,
    *,
    columns: tuple[InventoryColumn, ...],
    document_markdown: str | None,
    source_links: dict[str, str | None] | None,
    update_status: str | None,
    stop_managing_status: str | None,
) -> dict[str, object]:
    return {
        "skillRef": entry.skill_ref,
        "name": entry.name,
        "description": entry.description,
        "displayStatus": entry.display_status,
        "attentionMessage": entry.attention_message,
        "actions": {
            "canManage": entry.can_manage,
            "updateStatus": update_status,
            "stopManagingStatus": stop_managing_status,
            "stopManagingHarnessLabels": linked_harness_labels(entry, columns),
            "canDelete": entry.can_delete,
            "deleteHarnessLabels": linked_harness_labels(entry, columns),
        },
        "harnessCells": [serialize_cell(entry, column) for column in detail_columns(entry, columns)],
        "locations": [serialize_sighting(sighting) for sighting in entry.detail_sightings()],
        "sourceLinks": source_links,
        "documentMarkdown": document_markdown,
    }


def serialize_settings(inventory: SkillInventory) -> dict[str, object]:
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
            "canManageAll": any(entry.can_manage for entry in inventory.entries),
        },
    }


def serialize_column(column: InventoryColumn) -> dict[str, str]:
    return {"harness": column.harness, "label": column.label}


def detail_columns(entry: InventoryEntry, columns: tuple[InventoryColumn, ...]) -> tuple[InventoryColumn, ...]:
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


def serialize_row(entry: InventoryEntry, columns: tuple[InventoryColumn, ...]) -> dict[str, object]:
    return {
        "skillRef": entry.skill_ref,
        "name": entry.name,
        "description": entry.description,
        "displayStatus": entry.display_status,
        "attentionMessage": entry.attention_message,
        "actions": {
            "canManage": entry.can_manage,
        },
        "cells": [serialize_cell(entry, column) for column in columns],
    }


def serialize_cell(entry: InventoryEntry, column: InventoryColumn) -> dict[str, object]:
    state = entry.cell_state(column.harness)
    return {
        "harness": column.harness,
        "label": column.label,
        "state": state,
        "interactive": state in {"enabled", "disabled"},
    }


def serialize_sighting(sighting: InventorySighting) -> dict[str, str | None]:
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
