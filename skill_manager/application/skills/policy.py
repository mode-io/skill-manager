from __future__ import annotations

from typing import Literal

from .inventory import InventoryEntry


DisplayStatus = Literal["Managed", "Unmanaged", "Custom", "Built-in"]
HarnessCellState = Literal["enabled", "disabled", "found", "builtin", "empty"]
StopManagingStatus = Literal["available", "disabled_no_enabled"]


def is_custom(entry: InventoryEntry) -> bool:
    return (
        entry.kind == "managed"
        and entry.recorded_revision is not None
        and entry.current_revision is not None
        and entry.recorded_revision != entry.current_revision
    )


def display_status(entry: InventoryEntry) -> DisplayStatus:
    if entry.kind == "builtin":
        return "Built-in"
    if entry.kind == "unmanaged":
        return "Unmanaged"
    if is_custom(entry):
        return "Custom"
    return "Managed"


def attention_message(entry: InventoryEntry) -> str | None:
    if is_custom(entry):
        return "Modified locally; source updates are disabled."
    return None


def can_manage(entry: InventoryEntry) -> bool:
    return entry.kind == "unmanaged"


def can_update(entry: InventoryEntry) -> bool:
    return entry.kind == "managed" and not is_custom(entry) and entry.source.kind == "github"


def can_delete(entry: InventoryEntry) -> bool:
    return entry.kind == "managed" and entry.package_dir is not None and entry.package_path is not None


def can_stop_managing(entry: InventoryEntry) -> bool:
    return entry.kind == "managed" and entry.package_dir is not None and entry.package_path is not None


def cell_state(entry: InventoryEntry, harness: str) -> HarnessCellState:
    if entry.kind == "builtin":
        return "builtin" if any(s.harness == harness for s in entry.sightings) else "empty"
    if entry.kind == "unmanaged":
        return "found" if any(s.harness == harness for s in entry.sightings) else "empty"
    return "enabled" if any(s.harness == harness for s in entry.sightings if s.kind == "harness") else "disabled"


def stop_managing_status(entry: InventoryEntry) -> StopManagingStatus | None:
    if not can_stop_managing(entry):
        return None
    if entry.linked_harnesses():
        return "available"
    return "disabled_no_enabled"


def sort_entries(entries: list[InventoryEntry]) -> None:
    order = {
        "Managed": 0,
        "Custom": 1,
        "Unmanaged": 2,
        "Built-in": 3,
    }
    entries.sort(
        key=lambda entry: (
            order[display_status(entry)],
            entry.name.lower(),
            entry.skill_ref,
        )
    )
