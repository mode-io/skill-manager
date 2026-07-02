from __future__ import annotations

from typing import Mapping

from .contracts import HookBinding, HookHarnessScan, HookInventory, HookInventoryEntry
from .store import HookSpec


def inventory_payload(
    inventory: HookInventory,
    scans: tuple[HookHarnessScan, ...],
) -> dict[str, object]:
    visible_harnesses = {scan.harness for scan in scans}
    return {
        "columns": [
            {
                "harness": scan.harness,
                "label": scan.label,
                "logoKey": scan.logo_key,
                "installed": scan.installed,
                "configPresent": scan.config_present,
                "hooksWritable": scan.hooks_writable,
                "hooksUnavailableReason": scan.hooks_unavailable_reason,
            }
            for scan in scans
        ],
        "entries": [
            entry_payload(
                entry,
                scans,
            )
            for entry in inventory.entries
            if entry.kind == "managed"
            or any(binding.harness in visible_harnesses for binding in entry.sightings)
        ],
        "issues": [
            {"name": issue.name, "reason": issue.reason}
            for issue in inventory.issues
        ],
    }


def entry_payload(
    entry: HookInventoryEntry,
    scans: tuple[HookHarnessScan, ...],
) -> dict[str, object]:
    visible_harnesses = {scan.harness for scan in scans}
    addressable_harnesses = _addressable_harnesses(scans)
    spec_payload = entry.spec.to_dict() if entry.spec is not None else None
    enabled_status = _entry_enabled_status(entry, addressable_harnesses)
    
    return {
        "id": entry.id,
        "displayName": entry.display_name,
        "kind": entry.kind,
        "spec": spec_payload,
        "canEnable": entry.can_enable,
        "enabledStatus": enabled_status,
        "sightings": [
            _binding_to_dict(binding)
            for binding in entry.sightings
            if binding.harness in visible_harnesses
        ],
    }


def _binding_to_dict(binding: HookBinding) -> dict[str, object]:
    payload: dict[str, object] = {
        "harness": binding.harness,
        "state": binding.state,
    }
    if binding.drift_detail:
        payload["driftDetail"] = binding.drift_detail
    if binding.caveat:
        payload["caveat"] = binding.caveat
    return payload


def _is_scan_addressable(scan: HookHarnessScan) -> bool:
    return scan.hooks_writable and (scan.installed or scan.config_present)


def _addressable_harnesses(scans: tuple[HookHarnessScan, ...]) -> set[str]:
    return {
        scan.harness
        for scan in scans
        if _is_scan_addressable(scan)
    }


def _entry_enabled_status(
    entry: HookInventoryEntry,
    addressable_harnesses: set[str],
) -> str:
    for binding in entry.sightings:
        if binding.harness in addressable_harnesses and binding.state == "managed":
            return "enabled"
    return "disabled"


__all__ = [
    "entry_payload",
    "inventory_payload",
]
