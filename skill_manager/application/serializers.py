from __future__ import annotations

from skill_manager.domain import (
    CatalogConflict,
    CatalogEntry,
    CatalogSighting,
    CheckIssue,
    HarnessBinding,
    HarnessScan,
    StoreScan,
)


def harness_scan_to_json(scan: HarnessScan) -> dict[str, object]:
    return {
        "harness": scan.harness,
        "label": scan.label,
        "detected": scan.detected,
        "manageable": scan.manageable,
        "builtinSupport": scan.builtin_support,
        "discoveryMode": scan.discovery_mode,
        "detectionDetails": list(scan.detection_details),
        "issues": list(scan.issues),
    }


def _binding_to_json(binding: HarnessBinding) -> dict[str, object]:
    return {
        "harness": binding.harness,
        "label": binding.label,
        "state": binding.state,
        "scopes": list(binding.scopes),
    }


def _conflict_to_json(conflict: CatalogConflict) -> dict[str, object]:
    return {
        "conflictType": conflict.conflict_type,
        "message": conflict.message,
        "revisions": list(conflict.revisions),
        "harnesses": list(conflict.harnesses),
    }


def _sighting_to_json(sighting: CatalogSighting) -> dict[str, object]:
    return {
        "kind": sighting.kind,
        "harness": sighting.harness,
        "label": sighting.label,
        "scope": sighting.scope,
        "packagePath": str(sighting.package_path) if sighting.package_path is not None else None,
        "revision": sighting.revision,
        "sourceKind": sighting.source.kind,
        "sourceLocator": sighting.source.locator,
    }


def catalog_entry_to_json(entry: CatalogEntry) -> dict[str, object]:
    return {
        "skillRef": entry.skill_ref,
        "declaredName": entry.declared_name,
        "ownership": entry.ownership,
        "sourceKind": entry.source.kind,
        "sourceLocator": entry.source.locator,
        "revision": entry.primary_revision,
        "harnesses": [_binding_to_json(b) for b in entry.bindings],
        "builtinHarnesses": list(entry.builtin_harnesses),
        "issues": list(entry.issues),
        "conflicts": [_conflict_to_json(c) for c in entry.conflicts],
    }


def catalog_detail_to_json(entry: CatalogEntry) -> dict[str, object]:
    payload = catalog_entry_to_json(entry)
    payload["sightings"] = [_sighting_to_json(s) for s in entry.sightings]
    return payload


def _issue_to_json(issue: CheckIssue) -> dict[str, str]:
    return {"severity": issue.severity, "message": issue.message, "code": issue.code}


def check_report_to_json(*, store_scan: StoreScan, harness_scans: tuple[HarnessScan, ...]) -> dict[str, object]:
    errors = [CheckIssue(severity="error", message=msg, code="store-integrity") for msg in store_scan.issues]
    warnings = [
        CheckIssue(severity="warning", message=issue, code="discovery-warning")
        for scan in harness_scans
        for issue in scan.issues
    ]
    status = "error" if errors else "warning" if warnings else "ok"
    return {
        "status": status,
        "issues": [_issue_to_json(i) for i in errors],
        "warnings": [_issue_to_json(w) for w in warnings],
        "counts": {
            "shared": len(store_scan.packages),
            "discoveredHarnesses": sum(1 for s in harness_scans if s.detected),
            "warnings": len(warnings),
            "errors": len(errors),
        },
    }
