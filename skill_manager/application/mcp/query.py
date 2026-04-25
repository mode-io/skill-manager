from __future__ import annotations

from skill_manager.errors import MutationError

from .contracts import McpBinding, McpHarnessScan, McpInventory, McpInventoryIssue
from .enrichment import McpEnrichmentService
from .inventory import build_inventory
from .planner import McpAdoptionPlanner
from .read_models import McpReadModelService
from .env import annotate_env


class McpQueryService:
    """Read-side service exposing raw managed MCP config and inventory views."""

    def __init__(
        self,
        read_models: McpReadModelService,
        *,
        planner: McpAdoptionPlanner | None = None,
        enrichment: McpEnrichmentService | None = None,
    ) -> None:
        self.read_models = read_models
        self.planner = planner
        self.enrichment = enrichment

    def list_servers(self) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        inventory = self._inventory(snapshot.harness_scans)
        return _inventory_to_payload(inventory, self.read_models.visible_scans(snapshot))

    def get_server(self, name: str) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        inventory = self._inventory(snapshot.harness_scans)
        visible_scans = self.read_models.visible_scans(snapshot)
        for entry in inventory.entries:
            if entry.name == name:
                payload = _entry_to_payload(entry, visible_scans)
                if entry.spec is not None:
                    payload["env"] = annotate_env(entry.spec.env)
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
                    "payloadPreview": issue.payload,
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
                    "payloadPreview": s.payload,
                    "spec": s.spec.to_dict(),
                    "env": annotate_env(s.spec.env),
                }
                for s in sightings
            ]
            link = self.enrichment.lookup(group.name) if self.enrichment else None
            servers_payload.append(
                {
                    "name": group.name,
                    "identical": group.identical,
                    "canonicalSpec": group.canonical_spec.to_dict()
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


def _binding_to_dict(binding: McpBinding) -> dict[str, object]:
    payload: dict[str, object] = {
        "harness": binding.harness,
        "state": binding.state,
    }
    if binding.drift_detail:
        payload["driftDetail"] = binding.drift_detail
    return payload


def _entry_to_payload(entry, scans: tuple[McpHarnessScan, ...]) -> dict[str, object]:
    visible_harnesses = {scan.harness for scan in scans}
    spec_payload = entry.spec.to_dict() if entry.spec is not None else None
    return {
        "name": entry.name,
        "displayName": entry.display_name,
        "kind": entry.kind,
        "spec": spec_payload,
        "canEnable": entry.can_enable,
        "sightings": [
            _binding_to_dict(binding)
            for binding in entry.sightings
            if binding.harness in visible_harnesses
        ],
    }


def _config_choices_payload(
    name: str,
    managed_spec,
    scans: tuple[McpHarnessScan, ...],
) -> list[dict[str, object]]:
    choices: list[dict[str, object]] = [
        {
            "sourceKind": "managed",
            "sourceHarness": None,
            "label": "Managed config",
            "logoKey": None,
            "configPath": None,
            "payloadPreview": managed_spec.to_dict(),
            "spec": managed_spec.to_dict(),
            "env": annotate_env(managed_spec.env),
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
                    "sourceHarness": scan.harness,
                    "label": f"{scan.label} config",
                    "logoKey": scan.logo_key,
                    "configPath": str(scan.config_path) if scan.config_present else None,
                    "payloadPreview": dict(observed.raw_payload or {}),
                    "spec": observed.parsed_spec.to_dict(),
                    "env": annotate_env(observed.parsed_spec.env),
                }
            )
    return choices


def _inventory_to_payload(inventory: McpInventory, scans: tuple[McpHarnessScan, ...]) -> dict[str, object]:
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
            _entry_to_payload(entry, scans)
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
