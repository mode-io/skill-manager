from __future__ import annotations

from skill_manager.errors import MutationError

from .availability import (
    AvailabilityCache,
    McpAvailabilityProbe,
    availability_cache_key,
)
from .config_choice import recommended_observed_harness
from .contracts import McpHarnessScan, McpInventory, McpInventoryIssue
from .enrichment import McpEnrichmentService
from .inventory import build_inventory
from .managed_state import detail_extras_payload, entry_payload, inventory_payload
from .marketplace.catalog import McpMarketplaceCatalog
from .planner import McpAdoptionPlanner
from .read_models import McpReadModelService
from .redaction import annotate_redacted_env, redact_payload, redacted_spec_dict


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
        return inventory_payload(
            inventory,
            self.read_models.visible_scans(snapshot),
            records=self._records_by_name(),
            availability_cache=self._availability_cache,
            install_detail_lookup=self._marketplace_install_detail,
        )

    def get_server(self, name: str) -> dict[str, object]:
        snapshot = self.read_models.snapshot()
        inventory = self._inventory(snapshot.harness_scans)
        visible_scans = self.read_models.visible_scans(snapshot)
        for entry in inventory.entries:
            if entry.name == name:
                payload = entry_payload(
                    entry,
                    visible_scans,
                    records=self._records_by_name(),
                    availability=self._availability_cache.get(_availability_cache_key(entry)),
                    install_detail_lookup=self._marketplace_install_detail,
                )
                if entry.spec is not None:
                    payload.update(detail_extras_payload(name=name, spec=entry.spec, scans=visible_scans))
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
            recommended_harness = recommended_observed_harness(sightings)
            sightings_payload = [
                {
                    "harness": s.harness,
                    "label": s.label,
                    "logoKey": s.logo_key,
                    "configPath": s.config_path,
                    "payloadPreview": redact_payload(s.payload),
                    "spec": redacted_spec_dict(s.spec),
                    "env": annotate_redacted_env(s.spec.env),
                    "recommended": s.harness == recommended_harness,
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

    def _records_by_name(self):
        return {
            record.spec.name: record
            for record in self.read_models.store.list_records()
        }

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


def _availability_cache_key(entry) -> tuple[str, str]:
    if entry.spec is None:
        return (entry.name, "")
    return availability_cache_key(entry.name, entry.spec)


__all__ = ["McpQueryService"]
