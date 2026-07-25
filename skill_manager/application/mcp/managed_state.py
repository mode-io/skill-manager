from __future__ import annotations

from typing import Callable, Mapping

from .availability import McpAvailabilityResult, availability_cache_key
from .config_choice import config_choices_payload
from .contracts import McpBinding, McpHarnessScan, McpInventory, McpInventoryEntry
from .install_intent import ManagedMcpRecord
from .install_state import McpInstallConfigStatus, install_config_status
from .redaction import annotate_redacted_env, redacted_spec_dict
from .store import McpServerSpec

InstallDetailLookup = Callable[[str], Mapping[str, object] | None]


def inventory_payload(
    inventory: McpInventory,
    scans: tuple[McpHarnessScan, ...],
    *,
    records: Mapping[str, ManagedMcpRecord],
    availability_cache: Mapping[tuple[str, str], McpAvailabilityResult],
    install_detail_lookup: InstallDetailLookup | None,
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
                "mcpWritable": scan.mcp_writable,
                "mcpUnavailableReason": scan.mcp_unavailable_reason,
            }
            for scan in scans
        ],
        "entries": [
            entry_payload(
                entry,
                scans,
                records=records,
                availability=availability_cache.get(_availability_cache_key(entry)),
                install_detail_lookup=install_detail_lookup,
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
    entry: McpInventoryEntry,
    scans: tuple[McpHarnessScan, ...],
    *,
    records: Mapping[str, ManagedMcpRecord],
    availability: McpAvailabilityResult | None,
    install_detail_lookup: InstallDetailLookup | None,
) -> dict[str, object]:
    visible_harnesses = {scan.harness for scan in scans}
    addressable_harnesses = _addressable_harnesses(scans)
    spec_payload = redacted_spec_dict(entry.spec) if entry.spec is not None else None
    enabled_status = _entry_enabled_status(entry, addressable_harnesses)
    effective_availability = _entry_effective_availability(availability)
    config_status = install_config_status_for_entry(entry, records, install_detail_lookup)
    return {
        "name": entry.name,
        "displayName": entry.display_name,
        "kind": entry.kind,
        "spec": spec_payload,
        "canEnable": entry.can_enable,
        "enabledStatus": enabled_status,
        "availabilityStatus": effective_availability.status,
        "availabilityReason": effective_availability.reason,
        "mcpStatus": mcp_status(availability, config_status),
        "installConfigStatus": config_status.to_dict(),
        "sightings": [
            _binding_to_dict(binding)
            for binding in entry.sightings
            if binding.harness in visible_harnesses
        ],
    }


def detail_extras_payload(
    *,
    name: str,
    spec: McpServerSpec,
    scans: tuple[McpHarnessScan, ...],
) -> dict[str, object]:
    return {
        "env": annotate_redacted_env(spec.env),
        "configChoices": config_choices_payload(name, spec, scans),
    }


def install_config_status_for_entry(
    entry: McpInventoryEntry,
    records: Mapping[str, ManagedMcpRecord],
    install_detail_lookup: InstallDetailLookup | None,
) -> McpInstallConfigStatus:
    spec = entry.spec
    if spec is None or spec.source.kind != "marketplace" or install_detail_lookup is None:
        return McpInstallConfigStatus()
    detail = install_detail_lookup(spec.source.locator)
    if detail is None:
        return McpInstallConfigStatus()
    record = records.get(spec.name)
    return install_config_status(
        detail,
        spec,
        record.install_intent if record is not None else None,
    )


def mcp_status(
    availability: McpAvailabilityResult | None,
    install_config_status: McpInstallConfigStatus,
) -> dict[str, object]:
    if install_config_status.missing_required:
        return {
            "kind": "needs_config",
            "reason": None,
        }
    if availability is None:
        return {
            "kind": "unchecked",
            "reason": None,
        }
    if availability.status == "available":
        return {
            "kind": "available",
            "reason": None,
        }
    if not availability.reason:
        return {
            "kind": "unchecked",
            "reason": None,
        }
    return {
        "kind": "connection_issue",
        "reason": availability.reason,
    }


def _binding_to_dict(binding: McpBinding) -> dict[str, object]:
    payload: dict[str, object] = {
        "harness": binding.harness,
        "state": binding.state,
    }
    if binding.drift_detail:
        payload["driftDetail"] = binding.drift_detail
    return payload


def _is_scan_addressable(scan: McpHarnessScan) -> bool:
    return scan.mcp_writable and (scan.installed or scan.config_present)


def _addressable_harnesses(scans: tuple[McpHarnessScan, ...]) -> set[str]:
    return {
        scan.harness
        for scan in scans
        if _is_scan_addressable(scan)
    }


def _entry_enabled_status(
    entry: McpInventoryEntry,
    addressable_harnesses: set[str],
) -> str:
    for binding in entry.sightings:
        if binding.harness in addressable_harnesses and binding.state == "managed":
            return "enabled"
    return "disabled"


def _availability_cache_key(entry: McpInventoryEntry) -> tuple[str, str]:
    if entry.spec is None:
        return (entry.name, "")
    return availability_cache_key(entry.name, entry.spec)


def _entry_effective_availability(
    availability: McpAvailabilityResult | None,
) -> McpAvailabilityResult:
    if availability is None:
        return McpAvailabilityResult(status="unavailable", reason=None)
    return availability


__all__ = [
    "detail_extras_payload",
    "entry_payload",
    "install_config_status_for_entry",
    "inventory_payload",
    "mcp_status",
]
