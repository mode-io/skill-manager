from __future__ import annotations

from typing import Literal

from skill_manager.errors import MutationError

from .contracts import McpBinding, McpHarnessScan, McpInventory, McpInventoryIssue
from .availability import (
    AvailabilityCache,
    McpAvailabilityProbe,
    McpAvailabilityResult,
    availability_cache_key,
)
from .enrichment import McpEnrichmentService
from .install_state import McpInstallConfigStatus, install_config_status
from .inventory import build_inventory
from .marketplace.catalog import McpMarketplaceCatalog
from .planner import McpAdoptionPlanner
from .read_models import McpReadModelService
from .redaction import annotate_redacted_env, redact_payload, redacted_spec_dict
from .store import McpServerSpec


class McpQueryService:
    """Read-side service exposing raw managed MCP config and inventory views."""

    def __init__(
        self,
        read_models: McpReadModelService,
        *,
        planner: McpAdoptionPlanner | None = None,
        enrichment: McpEnrichmentService | None = None,
        marketplace_catalog: McpMarketplaceCatalog | None = None,
        availability_probe: McpAvailabilityProbe | None = None,
        availability_cache: AvailabilityCache | None = None,
    ) -> None:
        self.read_models = read_models
        self.planner = planner
        self.enrichment = enrichment
        self.marketplace = marketplace_catalog
        self.availability_probe = availability_probe or McpAvailabilityProbe()
        self._availability_cache = availability_cache if availability_cache is not None else {}

    def list_servers(self) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        inventory = self._inventory(snapshot.harness_scans)
        install_config_statuses = self._install_config_statuses(inventory)
        return _inventory_to_payload(
            inventory,
            self.read_models.visible_scans(snapshot),
            self._availability_cache,
            install_config_statuses,
        )

    def get_server(self, name: str) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        inventory = self._inventory(snapshot.harness_scans)
        visible_scans = self.read_models.visible_scans(snapshot)
        for entry in inventory.entries:
            if entry.name == name:
                payload = _entry_to_payload(
                    entry,
                    visible_scans,
                    self._availability_cache.get(_availability_cache_key(entry)),
                    self._install_config_status_for_spec(entry.spec),
                )
                if entry.spec is not None:
                    payload["env"] = annotate_redacted_env(entry.spec.env)
                    payload["configChoices"] = _config_choices_payload(
                        name,
                        entry.spec,
                        visible_scans,
                    )
                    link = self.enrichment.lookup(name) if self.enrichment else None
                    if link is not None:
                        payload["marketplaceLink"] = link.to_dict()
                return payload
        raise MutationError(f"unknown mcp server: {name}", status=404)

    def check_availability(self, name: str) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        inventory = self._inventory(snapshot.harness_scans)
        entry = next((item for item in inventory.entries if item.name == name), None)
        if entry is None or entry.spec is None:
            raise MutationError(f"unknown mcp server: {name}", status=404)
        result = self.availability_probe.probe(entry.spec)
        self._availability_cache[_availability_cache_key(entry)] = result
        return {
            "ok": True,
            "name": name,
            "availabilityStatus": result.status,
            "availabilityReason": result.reason,
        }

    def list_unmanaged_by_server(self) -> dict[str, object]:
        if self.planner is None:
            raise RuntimeError("unmanaged MCP planner is not configured")
        snapshot = self.read_models.snapshot()
        plan = self.planner.plan()
        visible_scans = self.read_models.visible_scans(snapshot)
        visible_harnesses = {scan.harness for scan in visible_scans}
        harness_meta = [
            {
                "harness": scan.harness,
                "label": scan.label,
                "logoKey": scan.logo_key,
                "installed": scan.installed,
                "configPresent": scan.config_present,
                "configPath": str(scan.config_path),
                "mcpWritable": scan.mcp_writable,
                "mcpUnavailableReason": scan.mcp_unavailable_reason,
            }
            for scan in visible_scans
        ]
        issues_payload = [
            {
                "harness": scan.harness,
                "label": scan.label,
                "logoKey": scan.logo_key,
                "name": f"{scan.label} config",
                "configPath": str(scan.config_path),
                "payloadPreview": None,
                "reason": scan.scan_issue,
            }
            for scan in visible_scans
            if scan.scan_issue
        ]
        issues_payload.extend(
            [
                {
                    "harness": issue.harness,
                    "label": issue.label,
                    "logoKey": issue.logo_key,
                    "name": issue.name,
                    "configPath": issue.config_path,
                    "payloadPreview": redact_payload(issue.payload) if issue.payload is not None else None,
                    "reason": issue.reason,
                }
                for issue in plan.issues
                if issue.harness in visible_harnesses
            ]
        )
        servers_payload: list[dict[str, object]] = []
        for group in plan.groups:
            sightings = tuple(
                sighting for sighting in group.sightings if sighting.harness in visible_harnesses
            )
            if not sightings:
                continue
            sightings_payload = [
                {
                    "harness": s.harness,
                    "label": s.label,
                    "logoKey": s.logo_key,
                    "configPath": s.config_path,
                    "payloadPreview": redact_payload(s.payload),
                    "spec": redacted_spec_dict(s.spec),
                    "env": annotate_redacted_env(s.spec.env),
                }
                for s in sightings
            ]
            link = self.enrichment.lookup(group.name) if self.enrichment else None
            servers_payload.append(
                {
                    "name": group.name,
                    "identical": group.identical,
                    "canonicalSpec": redacted_spec_dict(group.canonical_spec)
                    if group.canonical_spec is not None
                    else None,
                    "sightings": sightings_payload,
                    "marketplaceLink": link.to_dict() if link is not None else None,
                }
            )
        return {"harnesses": harness_meta, "servers": servers_payload, "issues": issues_payload}

    def _inventory(self, scans: tuple[McpHarnessScan, ...]) -> McpInventory:
        issues = [
            McpInventoryIssue(name=issue.name, reason=issue.reason)
            for issue in self.read_models.store.manifest_issues()
        ]
        issues.extend(
            McpInventoryIssue(name=f"{scan.label} config", reason=scan.scan_issue)
            for scan in scans
            if scan.scan_issue
        )
        return build_inventory(
            managed_servers=self.read_models.store.list_managed(),
            specs=self.read_models.store.list_public_specs(),
            scans=scans,
            issues=issues,
        )

    def _install_config_statuses(
        self,
        inventory: McpInventory,
    ) -> dict[str, McpInstallConfigStatus]:
        return {
            entry.name: self._install_config_status_for_spec(entry.spec)
            for entry in inventory.entries
            if entry.spec is not None
        }

    def _install_config_status_for_spec(
        self,
        spec: McpServerSpec | None,
    ) -> McpInstallConfigStatus:
        if spec is None or spec.source.kind != "marketplace" or self.marketplace is None:
            return McpInstallConfigStatus()
        detail = self._marketplace_install_detail(spec.source.locator)
        if detail is None:
            return McpInstallConfigStatus()
        return install_config_status(detail, spec)

    def _marketplace_install_detail(self, qualified_name: str):
        if self.marketplace is None:
            return None
        install_detail = getattr(self.marketplace, "install_detail", None)
        try:
            if callable(install_detail):
                detail = install_detail(qualified_name)
                if detail is not None:
                    to_resolver_detail = getattr(detail, "to_resolver_detail", None)
                    return to_resolver_detail() if callable(to_resolver_detail) else detail
            return self.marketplace.detail(qualified_name)
        except Exception:
            return None


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
    entry,
    addressable_harnesses: set[str],
) -> Literal["enabled", "disabled"]:
    for binding in entry.sightings:
        if binding.harness in addressable_harnesses and binding.state == "managed":
            return "enabled"
    return "disabled"


def _entry_mcp_status(
    entry,
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


def _entry_to_payload(
    entry,
    scans: tuple[McpHarnessScan, ...],
    availability: McpAvailabilityResult | None = None,
    config_status: McpInstallConfigStatus | None = None,
) -> dict[str, object]:
    visible_harnesses = {scan.harness for scan in scans}
    addressable_harnesses = _addressable_harnesses(scans)
    spec_payload = redacted_spec_dict(entry.spec) if entry.spec is not None else None
    enabled_status = _entry_enabled_status(entry, addressable_harnesses)
    effective_availability = _entry_effective_availability(availability)
    effective_config_status = config_status or McpInstallConfigStatus()
    return {
        "name": entry.name,
        "displayName": entry.display_name,
        "kind": entry.kind,
        "spec": spec_payload,
        "canEnable": entry.can_enable,
        "enabledStatus": enabled_status,
        "availabilityStatus": effective_availability.status,
        "availabilityReason": effective_availability.reason,
        "mcpStatus": _entry_mcp_status(
            entry,
            availability,
            effective_config_status,
        ),
        "installConfigStatus": effective_config_status.to_dict(),
        "sightings": [
            _binding_to_dict(binding)
            for binding in entry.sightings
            if binding.harness in visible_harnesses
        ],
    }


def _availability_cache_key(entry) -> tuple[str, str]:
    if entry.spec is None:
        return (entry.name, "")
    return availability_cache_key(entry.name, entry.spec)


def _entry_effective_availability(
    availability: McpAvailabilityResult | None,
) -> McpAvailabilityResult:
    if availability is None:
        return McpAvailabilityResult(status="unavailable", reason=None)
    return availability


def _config_choices_payload(
    name: str,
    managed_spec,
    scans: tuple[McpHarnessScan, ...],
) -> list[dict[str, object]]:
    choices: list[dict[str, object]] = [
        {
            "sourceKind": "managed",
            "observedHarness": None,
            "label": "Managed config",
            "logoKey": None,
            "configPath": None,
            "payloadPreview": redacted_spec_dict(managed_spec),
            "spec": redacted_spec_dict(managed_spec),
            "env": annotate_redacted_env(managed_spec.env),
        }
    ]
    for scan in scans:
        for observed in scan.entries:
            if observed.name != name or observed.state != "drifted":
                continue
            if observed.parsed_spec is None:
                continue
            choices.append(
                {
                    "sourceKind": "harness",
                    "observedHarness": scan.harness,
                    "label": f"{scan.label} config",
                    "logoKey": scan.logo_key,
                    "configPath": str(scan.config_path) if scan.config_present else None,
                    "payloadPreview": redact_payload(dict(observed.raw_payload or {})),
                    "spec": redacted_spec_dict(observed.parsed_spec),
                    "env": annotate_redacted_env(observed.parsed_spec.env),
                }
            )
    return choices


def _inventory_to_payload(
    inventory: McpInventory,
    scans: tuple[McpHarnessScan, ...],
    availability_cache: dict[tuple[str, str], McpAvailabilityResult] | None = None,
    install_config_statuses: dict[str, McpInstallConfigStatus] | None = None,
) -> dict[str, object]:
    visible_harnesses = {scan.harness for scan in scans}
    statuses = install_config_statuses or {}
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
            _entry_to_payload(
                entry,
                scans,
                (availability_cache or {}).get(_availability_cache_key(entry)),
                statuses.get(entry.name),
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


__all__ = ["McpQueryService"]
