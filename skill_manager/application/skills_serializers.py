from __future__ import annotations

from pathlib import Path

from skill_manager.application.inventory import InventoryColumn, InventoryEntry, InventorySighting, SkillInventory


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
    package_root: Path | None,
    document_markdown: str | None,
    update_available: bool | None,
) -> dict[str, object]:
    return {
        "skillRef": entry.skill_ref,
        "name": entry.name,
        "description": entry.description,
        "displayStatus": entry.display_status,
        "attentionMessage": entry.attention_message,
        "actions": {
            "canManage": entry.can_manage,
            "canUpdate": entry.can_update,
            "updateAvailable": update_available,
        },
        "locations": [serialize_sighting(sighting) for sighting in entry.detail_sightings()],
        "advanced": {
            "packageDir": package_root.name if package_root is not None else entry.package_dir,
            "packagePath": str(package_root) if package_root is not None else None,
            "currentRevision": entry.current_revision,
            "recordedRevision": entry.recorded_revision,
            "sourceKind": entry.source.kind,
            "sourceLocator": entry.source.locator,
        },
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


def serialize_row(entry: InventoryEntry, columns: tuple[InventoryColumn, ...]) -> dict[str, object]:
    return {
        "skillRef": entry.skill_ref,
        "name": entry.name,
        "description": entry.description,
        "displayStatus": entry.display_status,
        "attentionMessage": entry.attention_message,
        "primaryAction": entry.primary_action,
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
